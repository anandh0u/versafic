/**
 * Complete Wallet Service Implementation
 * Handles credit deductions, autopay triggers, and payment processing
 * 
 * Key Flows:
 * 1. Credit Deduction with Autopay Trigger
 * 2. Autopay Configuration Management
 * 3. Wallet Balance Operations
 * 4. Payment Verification and Credit Addition
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

const DEFAULT_AUTOPAY_THRESHOLD = 100;
const DEFAULT_AUTOPAY_RECHARGE_AMOUNT = 19900; // ₹199
const CREDITS_PER_RUPEE = 10; // 1 paise = 0.1 credit, 100 paise (₹1) = 10 credits
const STALE_PENDING_AUTOPAY_MINUTES = 30;

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

export class WalletService {
  /**
   * Get default autopay settings for new users
   */
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

  /**
   * Calculate credits from amount in paise (1 paise = 0.1 credit)
   */
  private calculateCreditsFromAmount(amountPaise: number): number {
    return Math.max(1, Math.floor(amountPaise / CREDITS_PER_RUPEE));
  }

  /**
   * Resolve credit cost based on transaction source
   */
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

  /**
   * Build checkout object from payment record
   */
  private buildCheckoutFromPayment(
    payment: Payment,
    label: string = 'Autopay Recharge'
  ): AutopayPendingCheckout {
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

  /**
   * Get pending checkout for user
   */
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

  /**
   * Build complete autopay status response
   */
  private async buildAutopayResponse(
    userId: number,
    settings?: AutopaySettings | null
  ): Promise<AutopayStatusResponse> {
    // Expire stale pending checkouts
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

  /**
   * Create compliant autopay order (REAL mode only)
   * Returns order ready for Razorpay payment
   */
  private async createCompliantAutopayOrder(
    userId: number,
    settings: AutopaySettings,
    triggeredReason: AutopayTriggeredReason
  ): Promise<{ log: AutopayLog; checkout: AutopayPendingCheckout }> {
    if (settings.mode !== 'real') {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Real-mode checkout can only be created for real autopay settings'
      );
    }

    if (!razorpayService.isConfigured()) {
      throw new AppError(
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
        'Razorpay is not configured for real autopay'
      );
    }

    // Check for existing pending checkout (prevent duplicate orders)
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
    const checkoutData = await this.createOrder(
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
      razorpayOrderId: checkoutData.order_id,
      metadata: {
        requires_user_action: true,
      },
    });

    return {
      log,
      checkout: this.buildCheckoutFromPayment(
        {
          razorpay_order_id: checkoutData.order_id,
          amount_paise: settings.recharge_amount,
          credits_to_add: credits,
          currency: 'INR',
        } as Payment,
        'Autopay Recharge'
      ),
    };
  }

  /**
   * Maybe trigger autopay if balance falls below threshold
   * Called internally during credit deduction
   */
  private async maybeTriggerAutopay(params: {
    userId: number;
    balanceCredits?: number;
    triggeredBy: AutopayTriggeredReason;
  }): Promise<AutopayActionState> {
    const settings = await billingModel.getAutopaySettings(params.userId);

    // Autopay disabled
    if (!settings || !settings.enabled) {
      return {
        status: 'disabled',
        requires_user_action: false,
      };
    }

    const balanceCredits = params.balanceCredits ?? (await this.getBalance(params.userId));

    // Balance is still OK, no trigger needed
    if (balanceCredits >= settings.threshold_credits) {
      return {
        status: 'skipped',
        requires_user_action: false,
      };
    }

    // Balance below threshold - trigger autopay
    const triggerResult = await this.triggerAutopay({
      userId: params.userId,
      triggeredBy: params.triggeredBy,
      force: true,
    });

    return {
      status:
        triggerResult.log.status === 'blocked'
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

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Get wallet balance
   */
  async getBalance(userId: number): Promise<number> {
    const wallet = await billingModel.getOrCreateWallet(userId);
    return wallet.balance_credits;
  }

  /**
   * Get wallet info with transaction history
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
   * Create Razorpay order for credit purchase
   */
  async createOrder(
    userId: number,
    planId?: string,
    customAmountPaise?: number,
    customCredits?: number,
    paymentContext: 'manual_topup' | 'autopay' = 'manual_topup',
    metadata: Record<string, unknown> = {}
  ): Promise<CreateOrderResponse> {
    if (!razorpayService.isConfigured()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Payment service is not configured');
    }

    let amountPaise: number;
    let credits: number;
    let planName: string;
    let description: string;

    // Plan-based order
    if (planId) {
      const plan = PRICING_PLANS.find((item) => item.id === planId);
      if (!plan) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid plan selected');
      }

      amountPaise = plan.amount_paise;
      credits = plan.credits;
      planName = plan.name;
      description = plan.description;
    }
    // Custom amount order
    else if (customAmountPaise && customCredits) {
      if (customAmountPaise < 100) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Minimum purchase is ₹1');
      }

      amountPaise = customAmountPaise;
      credits = customCredits;
      planName = `Custom Purchase (${credits} credits)`;
      description = `Custom credit purchase - ${credits} credits`;
    } else {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'planId or (customAmountPaise + customCredits) required');
    }

    // Create Razorpay order
    const razorpayOrder = await razorpayService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: `RCP-${userId}-${Date.now()}`,
      notes: {
        userId: String(userId),
        planName,
        credits: String(credits),
      },
    });

    // Store payment record
    const payment = await billingModel.createPayment({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amountPaise,
      creditsToAdd: credits,
      paymentContext,
      metadata,
    });

    logger.info('Order created', {
      userId,
      orderId: razorpayOrder.id,
      amount: amountPaise,
      credits,
      planName,
    });

    return {
      order_id: razorpayOrder.id,
      key_id: razorpayService.getKeyId(),
      amount: amountPaise,
      currency: 'INR',
      credits,
      name: 'Versafic',
      description,
    };
  }

  /**
   * Verify payment signature and add credits
   */
  async verifyPaymentAndAddCredits(
    userId: number,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<{
    message: string;
    wallet: Wallet;
  }> {
    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid payment signature');
    }

    // Get payment record
    const payment = await billingModel.getPaymentByOrderId(razorpayOrderId);
    if (!payment) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Payment not found');
    }

    // Verify user
    if (payment.user_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Payment does not belong to this user');
    }

    // Update payment status
    await billingModel.updatePaymentStatus(razorpayOrderId, 'captured', razorpayPaymentId, razorpaySignature);

    // Add credits to wallet
    await billingModel.createTransaction({
      userId,
      type: 'credit',
      credits: payment.credits_to_add,
      source: payment.payment_context === 'autopay' ? 'autopay' : 'razorpay',
      description: `Payment received: ₹${payment.amount_paise / 100}`,
      referenceId: razorpayPaymentId,
      metadata: {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      },
    });

    const wallet = await billingModel.updateWalletBalance(userId, payment.credits_to_add);

    logger.info('Payment verified and credits added', {
      userId,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      creditsAdded: payment.credits_to_add,
      newBalance: wallet.balance_credits,
    });

    return {
      message: 'Payment successful. Credits added to your account.',
      wallet,
    };
  }

  /**
   * Deduct credits for usage (with autopay trigger on insufficient balance)
   *
   * CRITICAL PATH: This enforces the credit system
   */
  async deductCreditsForUsage(
    userId: number,
    source: TransactionSource,
    description?: string,
    referenceId?: string,
    customCredits?: number
  ): Promise<CreditDeductionResult> {
    const creditsRequired = this.resolveUsageCredits(source, customCredits);

    // Get current balance
    const currentBalance = await this.getBalance(userId);

    // Insufficient balance
    if (currentBalance < creditsRequired) {
      logger.warn('Insufficient credits', {
        userId,
        available: currentBalance,
        required: creditsRequired,
        source,
      });

      // Try to trigger autopay
      const autopayState = await this.maybeTriggerAutopay({
        userId,
        balanceCredits: currentBalance,
        triggeredBy: 'low_balance',
      });

      return {
        success: false,
        required: creditsRequired,
        remaining: currentBalance,
        autopay: autopayState,
      };
    }

    // Deduct credits
    await billingModel.createTransaction({
      userId,
      type: 'debit',
      credits: creditsRequired,
      source,
      description: description || `${source} usage`,
      referenceId,
      metadata: {
        requested_at: new Date().toISOString(),
      },
    });

    const newWallet = await billingModel.updateWalletBalance(userId, -creditsRequired);

    logger.info('Credits deducted', {
      userId,
      source,
      debited: creditsRequired,
      remaining: newWallet.balance_credits,
    });

    // Check if autopay should trigger (balance just fell below threshold)
    const autopayState = await this.maybeTriggerAutopay({
      userId,
      balanceCredits: newWallet.balance_credits,
      triggeredBy: 'low_balance',
    });

    return {
      success: true,
      wallet: newWallet,
      remaining: newWallet.balance_credits,
      autopay: autopayState.status !== 'disabled' ? autopayState : undefined,
    };
  }

  /**
   * Get autopay status and settings
   */
  async getAutopayStatus(userId: number): Promise<AutopayStatusResponse> {
    return this.buildAutopayResponse(userId);
  }

  /**
   * Enable autopay for user
   */
  async enableAutopay(params: {
    userId: number;
    thresholdCredits: number;
    rechargeAmount?: number;
    mode: AutopayMode;
    selectedPlan?: string;
  }): Promise<AutopayStatusResponse> {
    if (params.thresholdCredits < 1) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Threshold must be at least 1 credit');
    }

    const rechargeAmount = params.rechargeAmount || DEFAULT_AUTOPAY_RECHARGE_AMOUNT;
    if (rechargeAmount < 100) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Recharge amount must be at least ₹1 (100 paise)');
    }

    // Update or create settings
    const settings = await billingModel.upsertAutopaySettings({
      userId: params.userId,
      enabled: true,
      thresholdCredits: params.thresholdCredits,
      rechargeAmount,
      mode: params.mode,
      status: 'active',
    });

    logger.info('Autopay enabled', {
      userId: params.userId,
      threshold: params.thresholdCredits,
      rechargeAmount,
      mode: params.mode,
    });

    return this.buildAutopayResponse(params.userId, settings);
  }

  /**
   * Disable autopay for user
   */
  async disableAutopay(userId: number): Promise<AutopayStatusResponse> {
    await billingModel.updateAutopaySettings(userId, {
      enabled: false,
      status: 'paused',
    });

    logger.info('Autopay disabled', { userId });
    return this.buildAutopayResponse(userId);
  }

  /**
   * Trigger autopay recharge (demo or real)
   */
  async triggerAutopay(params: {
    userId: number;
    triggeredBy: AutopayTriggeredReason;
    force?: boolean;
  }): Promise<{
    log: AutopayLog;
    checkout: AutopayPendingCheckout | null;
    balance_credits?: number;
    requires_user_action: boolean;
  }> {
    const settings = await billingModel.getAutopaySettings(params.userId);

    if (!settings || !settings.enabled) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Autopay is not enabled');
    }

    // DEMO MODE
    if (settings.mode === 'demo') {
      const credits = this.calculateCreditsFromAmount(settings.recharge_amount);

      // Log the demo autopay
      const log = await billingModel.createAutopayLog({
        userId: params.userId,
        amount: settings.recharge_amount,
        credits,
        status: 'completed',
        triggeredReason: params.triggeredBy,
        mode: 'demo',
        metadata: {
          demo_mode: true,
          forced: params.force || false,
        },
      });

      // Add credits directly (no payment needed in demo)
      const transaction = await billingModel.createTransaction({
        userId: params.userId,
        type: 'credit',
        credits,
        source: 'demo_autopay',
        description: 'Demo autopay recharge',
        metadata: {
          autopay_log_id: log.id,
          triggered_by: params.triggeredBy,
        },
      });

      const wallet = await billingModel.updateWalletBalance(params.userId, credits);

      logger.info('Demo autopay completed', {
        userId: params.userId,
        credits,
        newBalance: wallet.balance_credits,
      });

      return {
        log,
        checkout: null,
        balance_credits: wallet.balance_credits,
        requires_user_action: false,
      };
    }

    // REAL MODE
    const { log, checkout } = await this.createCompliantAutopayOrder(params.userId, settings, params.triggeredBy);

    logger.info('Real autopay triggered', {
      userId: params.userId,
      orderId: log.razorpay_order_id,
      amount: settings.recharge_amount,
      status: log.status,
    });

    return {
      log,
      checkout,
      requires_user_action: log.status === 'pending_checkout',
    };
  }

  /**
   * Apply admin credit adjustment (for testing/support)
   */
  async adminAdjustCredits(
    userId: number,
    creditsToAdd: number,
    reason: string
  ): Promise<Wallet> {
    if (creditsToAdd === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Adjustment must be non-zero');
    }

    const type = creditsToAdd > 0 ? 'credit' : 'debit';

    await billingModel.createTransaction({
      userId,
      type,
      credits: Math.abs(creditsToAdd),
      source: 'admin',
      description: `Admin adjustment: ${reason}`,
      metadata: {
        adjusted_at: new Date().toISOString(),
    },
    });

    const wallet = await billingModel.updateWalletBalance(userId, creditsToAdd);

    logger.info('Admin credit adjustment', {
      userId,
      amount: creditsToAdd,
      reason,
      newBalance: wallet.balance_credits,
    });

    return wallet;
  }
}

// Export singleton instance
export const walletService = new WalletService();
