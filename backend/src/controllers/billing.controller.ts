/**
 * Billing Controller
 * HTTP handlers for billing endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { PRICING_PLANS } from '../types/billing.types';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';
import { logger } from '../utils/logger';

// Extended request type with authenticated user
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

/**
 * GET /billing/plans
 * Get available pricing plans
 */
export const getPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        plans: PRICING_PLANS.map(plan => ({
          id: plan.id,
          name: plan.name,
          amount: plan.amount_paise / 100, // Convert to rupees
          amount_paise: plan.amount_paise,
          credits: plan.credits,
          description: plan.description
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /billing/create-order
 * Create a Razorpay order for credit purchase
 */
export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    const { plan_id, amount_paise, credits } = req.body;

    // Validate request
    if (!plan_id && (!amount_paise || !credits)) {
      throw new AppError(
        400, 
        ErrorCode.VALIDATION_ERROR, 
        'Please provide plan_id or both amount_paise and credits'
      );
    }

    const orderResponse = await walletService.createOrder(
      userId,
      plan_id,
      amount_paise,
      credits
    );

    logger.info('Order created for user', { userId, orderId: orderResponse.order_id });

    res.status(201).json({
      status: 'success',
      data: orderResponse
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /billing/verify-payment
 * Verify Razorpay payment and add credits
 */
export const verifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Missing required payment verification fields'
      );
    }

    const result = await walletService.verifyPaymentAndAddCredits(
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    logger.info('Payment verified', { 
      userId, 
      orderId: razorpay_order_id,
      newBalance: result.wallet.balance_credits
    });

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        balance_credits: result.wallet.balance_credits
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /billing/wallet
 * Get wallet balance and recent transactions
 */
export const getWallet = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    const walletInfo = await walletService.getWalletInfo(userId);

    res.status(200).json({
      status: 'success',
      data: walletInfo
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /billing/deduct
 * Internal endpoint to deduct credits (for testing/admin)
 * In production, this should be protected with admin auth or internal service key
 */
export const deductCredits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    const { credits, source, description, reference_id } = req.body;

    // Validate
    if (!credits || credits <= 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Credits must be a positive number');
    }

    const validSources = ['ai_chat', 'voice_call', 'admin', 'system'];
    if (!source || !validSources.includes(source)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Source must be one of: ${validSources.join(', ')}`);
    }

    const result = await walletService.deductCreditsForUsage(
      userId,
      source,
      description || `Manual deduction: ${credits} credits`,
      reference_id,
      credits
    );

    if (!result.success) {
      throw new AppError(402, ErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credit balance');
    }

    res.status(200).json({
      status: 'success',
      message: `Successfully deducted ${credits} credits`,
      data: {
        balance_credits: result.remaining
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /billing/check-balance
 * Quick check if user has sufficient credits
 */
export const checkBalance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
    }

    const requiredCredits = parseInt(req.query.required as string) || 1;
    const balance = await walletService.getBalance(userId);
    const hasCredits = balance >= requiredCredits;

    res.status(200).json({
      status: 'success',
      data: {
        balance_credits: balance,
        required_credits: requiredCredits,
        has_sufficient_credits: hasCredits
      }
    });
  } catch (error) {
    next(error);
  }
};
