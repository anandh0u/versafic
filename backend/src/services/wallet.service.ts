/**
 * Wallet Service
 * Business logic for wallet operations, credit enforcement, and compliant trigger-based autopay.
 */

import { billingModel } from '../models/billing.model';
import { razorpayService } from './razorpay.service';
import {
  AutopayExecutionResponse,
  AutopayLog,
  AutopayMode,
  AutopayPendingCheckout,
  AutopaySettings,
  AutopayStatusResponse,
  AutopayTriggeredReason,
  CreatePaymentLinkResponse,
  CreateOrderResponse,
  CREDIT_COSTS,
  Payment,
  PRICING_PLANS,
  TransactionSource,
  Wallet,
  WalletResponse,
} from '../types/billing.types';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';
import { emailService } from './email.service';
import { normalizeEnvValue } from '../utils/env';

const DEFAULT_AUTOPAY_THRESHOLD = 100;
const DEFAULT_AUTOPAY_RECHARGE_AMOUNT = 19900;
const CREDITS_PER_RUPEE = 10;
const STALE_PENDING_AUTOPAY_MINUTES = 30;
const AUTOPAY_REPEAT_GUARD_MS = 60_000;

type CreditDeductionResult = {
  success: boolean;
  wallet?: Wallet;
  remaining?: number;
  required?: number;
  autopay?: AutopayActionState;
};

type AutopayActionState = {
  status: 'disabled' | 'skipped' | 'completed' | 'pending_checkout' | 'blocked';
  log?: AutopayLog;
  checkout?: AutopayPendingCheckout | null;
  balance_credits?: number;
  requires_user_action: boolean;
};

type PaymentContext = 'manual_topup' | 'autopay';

type CheckoutPricing = {
  amountPaise: number;
  credits: number;
  planName: string;
  description: string;
};

export class WalletService {
  private defaultAutopaySettings(userId: number): AutopaySettings {
    const now = new Date();

    return {
      id: 0,
      user_id: userId,
      enabled: false,
      threshold_credits: DEFAULT_AUTOPAY_THRESHOLD,
      recharge_amount: DEFAULT_AUTOPAY_RECHARGE_AMOUNT,
      mode: 'demo',
      status: 'paused',
      failure_reason: null,
      created_at: now,
      updated_at: now,
    };
  }

  private calculateCreditsFromAmount(amountPaise: number): number {
    return Math.max(1, Math.floor(amountPaise / CREDITS_PER_RUPEE));
  }

  private resolveCheckoutPricing(
    planId?: string,
    customAmountPaise?: number,
    customCredits?: number,
    paymentContext: PaymentContext = 'manual_topup'
  ): CheckoutPricing {
    if (planId) {
      const plan = PRICING_PLANS.find((item) => item.id === planId);
      if (!plan) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid plan selected');
      }

      return {
        amountPaise: plan.amount_paise,
        credits: plan.credits,
        planName: plan.name,
        description: plan.description,
      };
    }

    if (customAmountPaise && customCredits) {
      if (customAmountPaise < 100) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Minimum amount is INR 1');
      }

      return {
        amountPaise: customAmountPaise,
        credits: customCredits,
        planName: paymentContext === 'autopay' ? 'Autopay Recharge' : 'Custom',
        description: `${customCredits} credits`,
      };
    }

    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Please select a plan or provide custom amount');
  }

  private getPaymentLinkCallbackUrl(): string {
    const railwayDomain = normalizeEnvValue(process.env.RAILWAY_PUBLIC_DOMAIN);
    const publicBaseUrl =
      normalizeEnvValue(process.env.PUBLIC_BASE_URL) ||
      normalizeEnvValue(process.env.BACKEND_BASE_URL) ||
      (railwayDomain ? `https://${railwayDomain}` : '') ||
      `http://localhost:${process.env.PORT || 5000}`;

    return `${publicBaseUrl.replace(/\/+$/, '')}/billing/payment-link/callback`;
  }

  private resolveUsageCredits(source: TransactionSource, customCredits?: number): number {
    if (customCredits !== undefined) {
      return customCredits;
    }

    switch (source) {
      case 'ai_chat':
        return CREDIT_COSTS.AI_CHAT_MESSAGE;
      case 'sarvam_stt':
        return CREDIT_COSTS.SARVAM_STT_REQUEST;
      case 'voice_process':
        return CREDIT_COSTS.VOICE_PROCESS_ACTION;
      case 'voice_call':
      case 'inbound_call':
      case 'outbound_call':
        return CREDIT_COSTS.VOICE_CALL_MINUTE;
      case 'premium_call':
        return CREDIT_COSTS.PREMIUM_CALL_MINUTE;
      case 'recording_process':
        return CREDIT_COSTS.RECORDING_PROCESSING;
      case 'onboarding_ai_setup':
        return CREDIT_COSTS.ONBOARDING_AI_SETUP;
      default:
        return 1;
    }
  }

  private buildCheckoutFromPayment(payment: Payment, label: string = 'Autopay Recharge'): AutopayPendingCheckout {
    return {
      order_id: payment.razorpay_order_id,
      key_id: razorpayService.getKeyId(),
      amount: payment.amount_paise,
      currency: payment.currency,
      credits: payment.credits_to_add,
      name: 'Versafic',
      description: `${label} - ${payment.credits_to_add} credits`,
    };
  }

  private async getPendingCheckoutForUser(userId: number): Promise<AutopayPendingCheckout | null> {
    const pendingLog = await billingModel.getPendingAutopayLog(userId);
    if (!pendingLog?.razorpay_order_id) {
      return null;
    }

    const payment = await billingModel.getPaymentByOrderId(pendingLog.razorpay_order_id);
    if (!payment || payment.status !== 'created') {
      return null;
    }

    return this.buildCheckoutFromPayment(payment);
  }

  private async buildAutopayResponse(userId: number, settings?: AutopaySettings | null): Promise<AutopayStatusResponse> {
    await billingModel.expireStalePendingAutopayLogs(userId, STALE_PENDING_AUTOPAY_MINUTES);

    const autopaySettings =
      settings ?? (await billingModel.getAutopaySettings(userId)) ?? this.defaultAutopaySettings(userId);
    const logs = await billingModel.getRecentAutopayLogs(userId, 10);
    const pendingCheckout = await this.getPendingCheckoutForUser(userId);

    return {
      settings: autopaySettings,
      logs,
      pending_checkout: pendingCheckout,
    };
  }

  private async createCompliantAutopayOrder(
    userId: number,
    settings: AutopaySettings,
    triggeredReason: AutopayTriggeredReason
  ): Promise<{ log: AutopayLog; checkout: AutopayPendingCheckout }> {
    if (settings.mode !== 'real') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Real-mode checkout can only be created for real autopay settings');
    }

    if (!razorpayService.isConfigured()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Razorpay is not configured for real autopay');
    }

    await billingModel.expireStalePendingAutopayLogs(userId, STALE_PENDING_AUTOPAY_MINUTES);

    const existingPending = await billingModel.getPendingAutopayLog(userId);
    if (existingPending) {
      const checkout = await this.getPendingCheckoutForUser(userId);
      const blockedLog = await billingModel.createAutopayLog({
        userId,
        amount: settings.recharge_amount,
        credits: this.calculateCreditsFromAmount(settings.recharge_amount),
        status: 'blocked',
        triggeredReason,
        mode: settings.mode,
        metadata: {
          reason: 'pending_checkout_already_exists',
          pending_order_id: existingPending.razorpay_order_id,
        },
      });

      return {
        log: blockedLog,
        checkout: checkout ?? {
          order_id: existingPending.razorpay_order_id || '',
          key_id: razorpayService.getKeyId(),
          amount: settings.recharge_amount,
          currency: 'INR',
          credits: this.calculateCreditsFromAmount(settings.recharge_amount),
          name: 'Versafic',
          description: 'Autopay Recharge - pending confirmation',
        },
      };
    }

    const credits = this.calculateCreditsFromAmount(settings.recharge_amount);
    const checkout = await this.createOrder(
      userId,
      undefined,
      settings.recharge_amount,
      credits,
      'autopay',
      {
        autopay: true,
        triggered_reason: triggeredReason,
        mode: settings.mode,
      }
    );

    const log = await billingModel.createAutopayLog({
      userId,
      amount: settings.recharge_amount,
      credits,
      status: 'pending_checkout',
      triggeredReason,
      mode: settings.mode,
      razorpayOrderId: checkout.order_id,
      metadata: {
        requires_user_action: true,
      },
    });

    return { log, checkout };
  }

  private async maybeTriggerAutopay(params: {
    userId: number;
    balanceCredits?: number;
    triggeredBy: AutopayTriggeredReason;
  }): Promise<AutopayActionState> {
    const settings = await billingModel.getAutopaySettings(params.userId);

    if (!settings || !settings.enabled) {
      return {
        status: 'disabled',
        requires_user_action: false,
      };
    }

    const balanceCredits = params.balanceCredits ?? await this.getBalance(params.userId);

    if (balanceCredits >= settings.threshold_credits) {
      return {
        status: 'skipped',
        requires_user_action: false,
      };
    }

    const triggerResult = await this.triggerAutopay({
      userId: params.userId,
      triggeredBy: params.triggeredBy,
      force: true,
    });

    return {
      status: triggerResult.log.status === 'blocked'
        ? 'blocked'
        : triggerResult.requires_user_action
          ? 'pending_checkout'
          : 'completed',
      log: triggerResult.log,
      checkout: triggerResult.checkout ?? null,
      balance_credits: triggerResult.balance_credits,
      requires_user_action: triggerResult.requires_user_action,
    };
  }

  private async guardRepeatedTrigger(params: {
    userId: number;
    settings: AutopaySettings;
    balanceCredits: number;
    triggeredBy: AutopayTriggeredReason;
  }): Promise<AutopayExecutionResponse | null> {
    const latestLog = await billingModel.getLatestAutopayLog(params.userId);
    if (!latestLog) {
      return null;
    }

    const ageMs = Date.now() - new Date(latestLog.timestamp).getTime();
    const isRecentlyTriggered = ageMs >= 0 && ageMs < AUTOPAY_REPEAT_GUARD_MS;
    const shouldBlockRepeat =
      isRecentlyTriggered
      && ['pending_checkout', 'completed', 'blocked', 'skipped'].includes(latestLog.status);

    if (!shouldBlockRepeat) {
      return null;
    }

    const checkout = await this.getPendingCheckoutForUser(params.userId);

    const blockedLog = await billingModel.createAutopayLog({
      userId: params.userId,
      amount: params.settings.recharge_amount,
      credits: this.calculateCreditsFromAmount(params.settings.recharge_amount),
      status: 'blocked',
      triggeredReason: params.triggeredBy,
      mode: params.settings.mode,
      razorpayOrderId: checkout?.order_id ?? latestLog.razorpay_order_id ?? null,
      metadata: {
        reason: 'repeat_trigger_guard',
        previous_log_id: latestLog.id,
        cooldown_ms: AUTOPAY_REPEAT_GUARD_MS,
      },
    });

    return {
      settings: params.settings,
      log: blockedLog,
      balance_credits: params.balanceCredits,
      requires_user_action: Boolean(checkout),
      checkout,
    };
  }

  private async maybeSendLowCreditAlert(params: {
    userId: number;
    previousBalance: number;
    currentBalance: number;
  }): Promise<void> {
    const settings = await billingModel.getAutopaySettings(params.userId);
    const thresholdCredits = settings?.threshold_credits ?? DEFAULT_AUTOPAY_THRESHOLD;

    const crossedBelowThreshold =
      params.previousBalance >= thresholdCredits && params.currentBalance < thresholdCredits;

    if (!crossedBelowThreshold) {
      return;
    }

    const result = await emailService.sendLowCreditsAlertToUser({
      userId: params.userId,
      balanceCredits: params.currentBalance,
      thresholdCredits,
    });

    if (!result.success) {
      logger.warn("Low credit alert email failed", {
        userId: params.userId,
        thresholdCredits,
        balanceCredits: params.currentBalance,
        reason: result.error,
      });
    }
  }

  /**
   * Get wallet info and recent transactions for a user
   */
  async getWalletInfo(userId: number): Promise<WalletResponse> {
    const wallet = await billingModel.getOrCreateWallet(userId);
    const transactions = await billingModel.getRecentTransactions(userId, 20);

    return {
      balance_credits: wallet.balance_credits,
      transactions,
    };
  }

  /**
   * Create a Razorpay order for credit top-up
   */
  async createOrder(
    userId: number,
    planId?: string,
    customAmountPaise?: number,
    customCredits?: number,
    paymentContext: PaymentContext = 'manual_topup',
    metadata: Record<string, unknown> = {}
  ): Promise<CreateOrderResponse> {
    if (!razorpayService.isConfigured()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Payment service is not configured');
    }

    const { amountPaise, credits, planName, description } = this.resolveCheckoutPricing(
      planId,
      customAmountPaise,
      customCredits,
      paymentContext
    );

    const receipt = `rcpt_${paymentContext}_${userId}_${Date.now()}`;

    const razorpayOrder = await razorpayService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        user_id: String(userId),
        credits: String(credits),
        plan: planName,
        context: paymentContext,
      },
    });

    await billingModel.createPayment({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amountPaise,
      creditsToAdd: credits,
      currency: 'INR',
      paymentContext,
      metadata,
    });

    logger.info('Order created', {
      userId,
      orderId: razorpayOrder.id,
      amount: amountPaise,
      credits,
      paymentContext,
    });

    return {
      order_id: razorpayOrder.id,
      key_id: razorpayService.getKeyId(),
      amount: amountPaise,
      currency: 'INR',
      credits,
      name: 'Versafic',
      description: `${planName} - ${description}`,
    };
  }

  /**
   * Create a Razorpay payment link for credit top-up.
   * This keeps billing working when embedded checkout is blocked by the browser.
   */
  async createPaymentLink(
    userId: number,
    planId?: string,
    customAmountPaise?: number,
    customCredits?: number,
    paymentContext: PaymentContext = 'manual_topup',
    metadata: Record<string, unknown> = {}
  ): Promise<CreatePaymentLinkResponse> {
    if (!razorpayService.isConfigured()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Payment service is not configured');
    }

    if (paymentContext === 'autopay') {
      const settings = await billingModel.getAutopaySettings(userId);
      if (!settings?.enabled || settings.mode !== 'real') {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Enable real autopay before creating an autopay payment link');
      }
    }

    const { amountPaise, credits, planName, description } = this.resolveCheckoutPricing(
      planId,
      customAmountPaise,
      customCredits,
      paymentContext
    );
    const referenceId = `vf_${paymentContext === 'autopay' ? 'ap' : 'mt'}_${userId}_${Date.now()}`;
    const linkDescription = `${planName} - ${description}`;

    const paymentLink = await razorpayService.createPaymentLink({
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      reference_id: referenceId,
      description: linkDescription,
      reminder_enable: true,
      notify: {
        sms: false,
        email: false,
      },
      callback_url: this.getPaymentLinkCallbackUrl(),
      callback_method: 'get',
      notes: {
        user_id: String(userId),
        credits: String(credits),
        plan: planName,
        context: paymentContext,
      },
    });

    await billingModel.createPayment({
      userId,
      razorpayOrderId: paymentLink.id,
      amountPaise,
      creditsToAdd: credits,
      currency: 'INR',
      paymentContext,
      metadata: {
        ...metadata,
        payment_link: true,
        payment_link_reference_id: referenceId,
        payment_link_short_url: paymentLink.short_url,
      },
    });

    if (paymentContext === 'autopay') {
      await billingModel.createAutopayLog({
        userId,
        amount: amountPaise,
        credits,
        status: 'pending_checkout',
        triggeredReason: 'manual_retry',
        mode: 'real',
        razorpayOrderId: paymentLink.id,
        metadata: {
          requires_user_action: true,
          payment_link: true,
          payment_link_reference_id: referenceId,
        },
      });
    }

    logger.info('Payment link created', {
      userId,
      paymentLinkId: paymentLink.id,
      amount: amountPaise,
      credits,
      paymentContext,
    });

    return {
      payment_link_id: paymentLink.id,
      short_url: paymentLink.short_url,
      reference_id: referenceId,
      amount: amountPaise,
      currency: 'INR',
      credits,
      name: 'Versafic',
      description: linkDescription,
    };
  }

  /**
   * Verify payment and add credits to wallet
   */
  async verifyPaymentAndAddCredits(
    userId: number,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    skipSignatureVerification: boolean = false
  ): Promise<{ success: boolean; wallet: Wallet; message: string }> {
    const payment = await billingModel.getPaymentByOrderId(razorpayOrderId);

    if (!payment) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Payment order not found');
    }

    if (payment.user_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Unauthorized to verify this payment');
    }

    if (payment.status === 'paid') {
      const wallet = await billingModel.getOrCreateWallet(userId);
      return {
        success: true,
        wallet,
        message: 'Payment already processed',
      };
    }

    if (!skipSignatureVerification) {
      const isValid = razorpayService.verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isValid) {
        await billingModel.updatePaymentStatus(razorpayOrderId, 'failed', razorpayPaymentId);

        if (payment.payment_context === 'autopay') {
          await billingModel.updateAutopayLogStatus({
            razorpayOrderId,
            status: 'failed',
            razorpayPaymentId,
            metadata: { reason: 'invalid_signature' },
          });
        }

        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid payment signature');
      }
    }

    await billingModel.updatePaymentStatus(
      razorpayOrderId,
      'paid',
      razorpayPaymentId,
      razorpaySignature
    );

    const creditSource = payment.payment_context === 'autopay' ? 'autopay' : 'razorpay';
    const result = await billingModel.addCredits(
      userId,
      payment.credits_to_add,
      payment.amount_paise,
      razorpayOrderId,
      payment.business_id,
      creditSource,
      payment.payment_context === 'autopay'
        ? `Autopay checkout confirmed: ${payment.credits_to_add} credits added after customer payment confirmation.`
        : `Credit top-up: ${payment.credits_to_add} credits added after successful payment.`
    );

    if (payment.payment_context === 'autopay') {
      await billingModel.updateAutopayLogStatus({
        razorpayOrderId,
        status: 'completed',
        razorpayPaymentId,
        metadata: {
          confirmed_at: new Date().toISOString(),
        },
      });

      const existingSettings = await billingModel.getAutopaySettings(userId);
      if (existingSettings) {
        await billingModel.upsertAutopaySettings({
          userId,
          enabled: existingSettings.enabled,
          thresholdCredits: existingSettings.threshold_credits,
          rechargeAmount: existingSettings.recharge_amount,
          mode: existingSettings.mode,
          status: 'active',
          failureReason: null,
        });
      }
    }

    logger.info('Payment verified and credits added', {
      userId,
      orderId: razorpayOrderId,
      credits: payment.credits_to_add,
      newBalance: result.wallet.balance_credits,
      paymentContext: payment.payment_context,
    });

    return {
      success: true,
      wallet: result.wallet,
      message: `Successfully added ${payment.credits_to_add} credits`,
    };
  }

  async refundCredits(
    userId: number,
    credits: number,
    referenceId: string,
    description: string
  ): Promise<void> {
    await billingModel.addCredits(
      userId,
      credits,
      0,
      referenceId,
      null,
      'system',
      description,
      'refund'
    );
  }

  /**
   * Deduct credits for product usage. If low-balance autopay is enabled in demo mode,
   * it will recharge first and then retry the deduction automatically.
   */
  async deductCreditsForUsage(
    userId: number,
    source: TransactionSource,
    description: string,
    referenceId?: string,
    customCredits?: number
  ): Promise<CreditDeductionResult> {
    const credits = this.resolveUsageCredits(source, customCredits);
    const startingBalance = await this.getBalance(userId);

    let result = await billingModel.deductCredits(
      userId,
      credits,
      source,
      description,
      referenceId
    );

    if (!result) {
      const currentBalance = await this.getBalance(userId);
      const autopay = await this.maybeTriggerAutopay({
        userId,
        balanceCredits: currentBalance,
        triggeredBy: 'insufficient_credits',
      });

      if (autopay.status === 'completed') {
        result = await billingModel.deductCredits(
          userId,
          credits,
          source,
          description,
          referenceId
        );
      }

      if (!result) {
        logger.warn('Insufficient credits', {
          userId,
          requiredCredits: credits,
          currentBalance,
          autopayStatus: autopay.status,
        });

        return {
          success: false,
          required: credits,
          autopay,
        };
      }
    }

    void this.maybeSendLowCreditAlert({
      userId,
      previousBalance: startingBalance,
      currentBalance: result.wallet.balance_credits,
    }).catch((error) => {
      logger.warn('Low credit email trigger failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    void this.maybeTriggerAutopay({
      userId,
      balanceCredits: result.wallet.balance_credits,
      triggeredBy: 'low_balance',
    }).catch((error) => {
      logger.warn('Low-balance autopay trigger failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      success: true,
      wallet: result.wallet,
      remaining: result.wallet.balance_credits,
    };
  }

  async hasCredits(userId: number, requiredCredits: number = 1): Promise<boolean> {
    return billingModel.hasSufficientBalance(userId, requiredCredits);
  }

  async getBalance(userId: number): Promise<number> {
    const wallet = await billingModel.getWalletByUserId(userId);
    return wallet?.balance_credits ?? 0;
  }

  async getAutopayStatus(userId: number): Promise<AutopayStatusResponse> {
    return this.buildAutopayResponse(userId);
  }

  async triggerAutopay(params: {
    userId: number;
    triggeredBy?: AutopayTriggeredReason;
    force?: boolean;
  }): Promise<AutopayExecutionResponse> {
    const settings = await billingModel.getAutopaySettings(params.userId);

    if (!settings || !settings.enabled) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Autopay is not enabled for this account');
    }

    const triggeredBy = params.triggeredBy ?? 'manual_retry';
    const balanceCredits = await this.getBalance(params.userId);

    const repeatedTrigger = await this.guardRepeatedTrigger({
      userId: params.userId,
      settings,
      balanceCredits,
      triggeredBy,
    });
    if (repeatedTrigger) {
      return repeatedTrigger;
    }

    if (!params.force && balanceCredits >= settings.threshold_credits) {
      const skippedLog = await billingModel.createAutopayLog({
        userId: params.userId,
        amount: settings.recharge_amount,
        credits: this.calculateCreditsFromAmount(settings.recharge_amount),
        status: 'skipped',
        triggeredReason: triggeredBy,
        mode: settings.mode,
        metadata: {
          reason: 'threshold_not_reached',
          balance_credits: balanceCredits,
          threshold_credits: settings.threshold_credits,
        },
      });

      return {
        settings,
        log: skippedLog,
        balance_credits: balanceCredits,
        requires_user_action: false,
        checkout: null,
      };
    }

    if (settings.mode === 'demo') {
      const creditsToAdd = this.calculateCreditsFromAmount(settings.recharge_amount);
      const creditResult = await billingModel.addCredits(
        params.userId,
        creditsToAdd,
        settings.recharge_amount,
        `AUTO-DEMO-${Date.now()}`,
        null,
        'demo_autopay',
        `Demo autopay recharge completed after ${triggeredBy.replace('_', ' ')} trigger.`
      );

      const log = await billingModel.createAutopayLog({
        userId: params.userId,
        amount: settings.recharge_amount,
        credits: creditsToAdd,
        status: 'completed',
        triggeredReason: triggeredBy,
        mode: settings.mode,
        metadata: {
          source: 'demo_autopay',
        },
      });

      const updatedSettings = await billingModel.upsertAutopaySettings({
        userId: params.userId,
        enabled: true,
        thresholdCredits: settings.threshold_credits,
        rechargeAmount: settings.recharge_amount,
        mode: settings.mode,
        status: 'active',
        failureReason: null,
      });

      logger.info('Demo autopay recharge completed', {
        userId: params.userId,
        creditsAdded: creditsToAdd,
        balanceCredits: creditResult.wallet.balance_credits,
      });

      return {
        settings: updatedSettings,
        log,
        balance_credits: creditResult.wallet.balance_credits,
        requires_user_action: false,
        checkout: null,
      };
    }

    try {
      const { log, checkout } = await this.createCompliantAutopayOrder(
        params.userId,
        settings,
        triggeredBy
      );

      const updatedSettings = await billingModel.upsertAutopaySettings({
        userId: params.userId,
        enabled: true,
        thresholdCredits: settings.threshold_credits,
        rechargeAmount: settings.recharge_amount,
        mode: settings.mode,
        status: 'needs_attention',
        failureReason: 'Customer confirmation is required to complete this autopay checkout.',
      });

      return {
        settings: updatedSettings,
        log,
        balance_credits: balanceCredits,
        requires_user_action: true,
        checkout,
      };
    } catch (error) {
      const failureLog = await billingModel.createAutopayLog({
        userId: params.userId,
        amount: settings.recharge_amount,
        credits: this.calculateCreditsFromAmount(settings.recharge_amount),
        status: 'failed',
        triggeredReason: triggeredBy,
        mode: settings.mode,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      await billingModel.upsertAutopaySettings({
        userId: params.userId,
        enabled: true,
        thresholdCredits: settings.threshold_credits,
        rechargeAmount: settings.recharge_amount,
        mode: settings.mode,
        status: 'needs_attention',
        failureReason: error instanceof Error ? error.message : 'Autopay checkout failed',
      });

      throw new AppError(
        500,
        ErrorCode.PAYMENT_ERROR,
        `Failed to create compliant autopay checkout. Reference log ${failureLog.id}`
      );
    }
  }

  async enableAutopay(params: {
    userId: number;
    thresholdCredits: number;
    rechargeAmount?: number;
    mode: AutopayMode;
    selectedPlan?: string;
  }): Promise<AutopayStatusResponse> {
    const selectedPlan = params.selectedPlan
      ? PRICING_PLANS.find((item) => item.id === params.selectedPlan)
      : undefined;

    const rechargeAmount = params.rechargeAmount ?? selectedPlan?.amount_paise ?? DEFAULT_AUTOPAY_RECHARGE_AMOUNT;

    if (params.thresholdCredits < 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Threshold credits must be zero or greater');
    }

    if (rechargeAmount < 100) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Recharge amount must be at least INR 1');
    }

    if (params.mode === 'real' && !razorpayService.isConfigured()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Razorpay is not configured for real autopay');
    }

    const settings = await billingModel.upsertAutopaySettings({
      userId: params.userId,
      enabled: true,
      thresholdCredits: params.thresholdCredits,
      rechargeAmount,
      mode: params.mode,
      status: 'active',
      failureReason: null,
    });

    logger.info('Autopay enabled', {
      userId: params.userId,
      thresholdCredits: params.thresholdCredits,
      rechargeAmount,
      mode: params.mode,
    });

    return this.buildAutopayResponse(params.userId, settings);
  }

  async disableAutopay(userId: number): Promise<AutopayStatusResponse> {
    const existing = await billingModel.getAutopaySettings(userId);
    const fallback = existing ?? this.defaultAutopaySettings(userId);

    const settings = await billingModel.upsertAutopaySettings({
      userId,
      enabled: false,
      thresholdCredits: fallback.threshold_credits,
      rechargeAmount: fallback.recharge_amount,
      mode: fallback.mode,
      status: 'paused',
      failureReason: null,
    });

    logger.info('Autopay disabled', { userId });

    return this.buildAutopayResponse(userId, settings);
  }
}

export const walletService = new WalletService();
