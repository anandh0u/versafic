/**
 * Wallet Service
 * Business logic for wallet operations, credit management, and billing
 */

import { billingModel } from '../models/billing.model';
import { razorpayService } from './razorpay.service';
import { 
  Wallet, 
  CreditTransaction, 
  CreateOrderResponse,
  WalletResponse,
  PRICING_PLANS,
  CREDIT_COSTS,
  TransactionSource
} from '../types/billing.types';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';

export class WalletService {
  /**
   * Get wallet info and recent transactions for a user
   */
  async getWalletInfo(userId: number): Promise<WalletResponse> {
    // Get or create wallet
    const wallet = await billingModel.getOrCreateWallet(userId);
    
    // Get recent transactions
    const transactions = await billingModel.getRecentTransactions(userId, 20);

    return {
      balance_credits: wallet.balance_credits,
      transactions
    };
  }

  /**
   * Create a Razorpay order for credit top-up
   */
  async createOrder(
    userId: number, 
    planId?: string, 
    customAmountPaise?: number,
    customCredits?: number
  ): Promise<CreateOrderResponse> {
    // Check if Razorpay is configured
    if (!razorpayService.isConfigured()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Payment service is not configured');
    }

    let amountPaise: number;
    let credits: number;
    let planName: string;
    let description: string;

    // Determine pricing based on plan or custom amount
    if (planId) {
      const plan = PRICING_PLANS.find(p => p.id === planId);
      if (!plan) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid plan selected');
      }
      amountPaise = plan.amount_paise;
      credits = plan.credits;
      planName = plan.name;
      description = plan.description;
    } else if (customAmountPaise && customCredits) {
      // Custom amount validation
      if (customAmountPaise < 100) { // Minimum ₹1
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Minimum amount is ₹1');
      }
      amountPaise = customAmountPaise;
      credits = customCredits;
      planName = 'Custom';
      description = `${credits} credits`;
    } else {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Please select a plan or provide custom amount');
    }

    // Generate unique receipt ID
    const receipt = `rcpt_${userId}_${Date.now()}`;

    // Create Razorpay order
    const razorpayOrder = await razorpayService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        user_id: String(userId),
        credits: String(credits),
        plan: planName
      }
    });

    // Store payment record in database
    await billingModel.createPayment({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amountPaise,
      creditsToAdd: credits,
      currency: 'INR'
    });

    logger.info('Order created', { 
      userId, 
      orderId: razorpayOrder.id, 
      amount: amountPaise,
      credits 
    });

    return {
      order_id: razorpayOrder.id,
      key_id: razorpayService.getKeyId(),
      amount: amountPaise,
      currency: 'INR',
      credits,
      name: 'Versafic',
      description: `${planName} Plan - ${description}`
    };
  }

  /**
   * Verify payment and add credits to wallet
   * This is idempotent - calling multiple times with same order won't double-credit
   */
  async verifyPaymentAndAddCredits(
    userId: number,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<{ success: boolean; wallet: Wallet; message: string }> {
    // Get the payment record
    const payment = await billingModel.getPaymentByOrderId(razorpayOrderId);
    
    if (!payment) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Payment order not found');
    }

    // Check if already processed (idempotency)
    if (payment.status === 'paid') {
      logger.info('Payment already processed', { orderId: razorpayOrderId });
      const wallet = await billingModel.getOrCreateWallet(userId);
      return {
        success: true,
        wallet,
        message: 'Payment already processed'
      };
    }

    // Verify the user owns this payment
    if (payment.user_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Unauthorized to verify this payment');
    }

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      // Mark payment as failed
      await billingModel.updatePaymentStatus(razorpayOrderId, 'failed', razorpayPaymentId);
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid payment signature');
    }

    // Update payment status
    await billingModel.updatePaymentStatus(
      razorpayOrderId,
      'paid',
      razorpayPaymentId,
      razorpaySignature
    );

    // Add credits to wallet
    const result = await billingModel.addCredits(
      userId,
      payment.credits_to_add,
      payment.amount_paise,
      razorpayOrderId,
      payment.business_id
    );

    logger.info('Payment verified and credits added', {
      userId,
      orderId: razorpayOrderId,
      credits: payment.credits_to_add,
      newBalance: result.wallet.balance_credits
    });

    return {
      success: true,
      wallet: result.wallet,
      message: `Successfully added ${payment.credits_to_add} credits`
    };
  }

  /**
   * Deduct credits for service usage
   * Returns the updated wallet or null if insufficient balance
   */
  async deductCreditsForUsage(
    userId: number,
    source: TransactionSource,
    description: string,
    referenceId?: string,
    customCredits?: number
  ): Promise<{ success: boolean; wallet?: Wallet; remaining?: number }> {
    // Determine credit cost based on source
    let credits: number;
    
    if (customCredits !== undefined) {
      credits = customCredits;
    } else {
      switch (source) {
        case 'ai_chat':
          credits = CREDIT_COSTS.AI_CHAT_MESSAGE;
          break;
        case 'voice_call':
          credits = CREDIT_COSTS.VOICE_CALL_BASE;
          break;
        default:
          credits = 1;
      }
    }

    const result = await billingModel.deductCredits(
      userId,
      credits,
      source,
      description,
      referenceId
    );

    if (!result) {
      logger.warn('Insufficient credits', { userId, requiredCredits: credits });
      return { success: false };
    }

    return {
      success: true,
      wallet: result.wallet,
      remaining: result.wallet.balance_credits
    };
  }

  /**
   * Check if user has sufficient credits
   */
  async hasCredits(userId: number, requiredCredits: number = 1): Promise<boolean> {
    return billingModel.hasSufficientBalance(userId, requiredCredits);
  }

  /**
   * Get current credit balance
   */
  async getBalance(userId: number): Promise<number> {
    const wallet = await billingModel.getWalletByUserId(userId);
    return wallet?.balance_credits ?? 0;
  }
}

// Export singleton instance
export const walletService = new WalletService();
