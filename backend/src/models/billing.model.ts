/**
 * Billing Model
 * Database operations for wallets, payments, and credit transactions
 */

import { pool } from '../config/database';
import { 
  Wallet, 
  Payment, 
  CreditTransaction, 
  PaymentStatus, 
  TransactionType, 
  TransactionSource 
} from '../types/billing.types';

export class BillingModel {
  /**
   * Get wallet by user ID, creates one if it doesn't exist
   */
  async getOrCreateWallet(userId: number, businessId?: number | null): Promise<Wallet> {
    const client = await pool.connect();
    try {
      // Try to get existing wallet
      const existingResult = await client.query<Wallet>(
        'SELECT * FROM wallets WHERE user_id = $1',
        [userId]
      );

      if (existingResult.rows.length > 0) {
        return existingResult.rows[0]!;
      }

      // Create new wallet with 0 balance
      const createResult = await client.query<Wallet>(
        `INSERT INTO wallets (user_id, business_id, balance_credits)
         VALUES ($1, $2, 0)
         RETURNING *`,
        [userId, businessId || null]
      );

      return createResult.rows[0]!;
    } finally {
      client.release();
    }
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: number): Promise<Wallet | null> {
    const result = await pool.query<Wallet>(
      'SELECT * FROM wallets WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update wallet balance (atomic operation)
   */
  async updateWalletBalance(userId: number, creditsToAdd: number): Promise<Wallet> {
    const result = await pool.query<Wallet>(
      `UPDATE wallets 
       SET balance_credits = balance_credits + $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, creditsToAdd]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Wallet not found');
    }
    
    return result.rows[0]!;
  }

  /**
   * Create a payment record
   */
  async createPayment(params: {
    userId: number;
    businessId?: number | null;
    razorpayOrderId: string;
    amountPaise: number;
    creditsToAdd: number;
    currency?: string;
  }): Promise<Payment> {
    const result = await pool.query<Payment>(
      `INSERT INTO payments 
       (user_id, business_id, razorpay_order_id, amount_paise, credits_to_add, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'created')
       RETURNING *`,
      [
        params.userId,
        params.businessId || null,
        params.razorpayOrderId,
        params.amountPaise,
        params.creditsToAdd,
        params.currency || 'INR'
      ]
    );
    return result.rows[0]!;
  }

  /**
   * Get payment by Razorpay order ID
   */
  async getPaymentByOrderId(razorpayOrderId: string): Promise<Payment | null> {
    const result = await pool.query<Payment>(
      'SELECT * FROM payments WHERE razorpay_order_id = $1',
      [razorpayOrderId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update payment status after verification
   */
  async updatePaymentStatus(
    razorpayOrderId: string,
    status: PaymentStatus,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<Payment> {
    const result = await pool.query<Payment>(
      `UPDATE payments 
       SET status = $2, 
           razorpay_payment_id = COALESCE($3, razorpay_payment_id),
           razorpay_signature = COALESCE($4, razorpay_signature),
           updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = $1
       RETURNING *`,
      [razorpayOrderId, status, razorpayPaymentId, razorpaySignature]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Payment not found');
    }
    
    return result.rows[0]!;
  }

  /**
   * Create a credit transaction record
   */
  async createTransaction(params: {
    userId: number;
    businessId?: number | null;
    type: TransactionType;
    credits: number;
    amountPaise?: number | null;
    source: TransactionSource;
    referenceId?: string | null;
    description?: string | null;
  }): Promise<CreditTransaction> {
    const result = await pool.query<CreditTransaction>(
      `INSERT INTO credit_transactions 
       (user_id, business_id, type, credits, amount_paise, source, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.userId,
        params.businessId || null,
        params.type,
        params.credits,
        params.amountPaise || null,
        params.source,
        params.referenceId || null,
        params.description || null
      ]
    );
    return result.rows[0]!;
  }

  /**
   * Get recent transactions for a user
   */
  async getRecentTransactions(userId: number, limit: number = 20): Promise<CreditTransaction[]> {
    const result = await pool.query<CreditTransaction>(
      `SELECT * FROM credit_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /**
   * Check if wallet has sufficient balance
   */
  async hasSufficientBalance(userId: number, creditsRequired: number): Promise<boolean> {
    const wallet = await this.getWalletByUserId(userId);
    if (!wallet) return false;
    return wallet.balance_credits >= creditsRequired;
  }

  /**
   * Deduct credits (atomic operation with balance check)
   * Returns null if insufficient balance
   */
  async deductCredits(
    userId: number,
    credits: number,
    source: TransactionSource,
    description: string,
    referenceId?: string
  ): Promise<{ wallet: Wallet; transaction: CreditTransaction } | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Lock the wallet row and check balance
      const walletResult = await client.query<Wallet>(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const wallet = walletResult.rows[0]!;
      
      if (wallet.balance_credits < credits) {
        await client.query('ROLLBACK');
        return null;
      }

      // Deduct credits
      const updatedWalletResult = await client.query<Wallet>(
        `UPDATE wallets 
         SET balance_credits = balance_credits - $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING *`,
        [userId, credits]
      );

      // Record transaction
      const transactionResult = await client.query<CreditTransaction>(
        `INSERT INTO credit_transactions 
         (user_id, business_id, type, credits, source, reference_id, description)
         VALUES ($1, $2, 'usage_deduction', $3, $4, $5, $6)
         RETURNING *`,
        [userId, wallet.business_id, -credits, source, referenceId, description]
      );

      await client.query('COMMIT');

      return {
        wallet: updatedWalletResult.rows[0]!,
        transaction: transactionResult.rows[0]!
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add credits to wallet (with transaction record)
   * Used after successful payment verification
   */
  async addCredits(
    userId: number,
    credits: number,
    amountPaise: number,
    razorpayOrderId: string,
    businessId?: number | null
  ): Promise<{ wallet: Wallet; transaction: CreditTransaction }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get or create wallet
      let walletResult = await client.query<Wallet>(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletResult.rows.length === 0) {
        // Create wallet if doesn't exist
        walletResult = await client.query<Wallet>(
          `INSERT INTO wallets (user_id, business_id, balance_credits)
           VALUES ($1, $2, 0)
           RETURNING *`,
          [userId, businessId || null]
        );
      }

      // Add credits
      const updatedWalletResult = await client.query<Wallet>(
        `UPDATE wallets 
         SET balance_credits = balance_credits + $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING *`,
        [userId, credits]
      );

      // Record transaction
      const transactionResult = await client.query<CreditTransaction>(
        `INSERT INTO credit_transactions 
         (user_id, business_id, type, credits, amount_paise, source, reference_id, description)
         VALUES ($1, $2, 'topup', $3, $4, 'razorpay', $5, $6)
         RETURNING *`,
        [
          userId, 
          businessId || null, 
          credits, 
          amountPaise, 
          razorpayOrderId,
          `Credit top-up: ${credits} credits for ₹${(amountPaise / 100).toFixed(2)}`
        ]
      );

      await client.query('COMMIT');

      return {
        wallet: updatedWalletResult.rows[0]!,
        transaction: transactionResult.rows[0]!
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const billingModel = new BillingModel();
