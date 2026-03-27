/**
 * Billing Model
 * Database operations for wallets, payments, and credit transactions
 */

import { pool } from '../config/database';
import { 
  AutopayLog,
  AutopayLogStatus,
  AutopayMode,
  AutopaySettings,
  AutopayStatus,
  AutopayTriggeredReason,
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
    paymentContext?: 'manual_topup' | 'autopay';
    metadata?: Record<string, unknown>;
  }): Promise<Payment> {
    const result = await pool.query<Payment>(
      `INSERT INTO payments 
       (user_id, business_id, razorpay_order_id, amount_paise, credits_to_add, currency, status, payment_context, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'created', $7, $8::jsonb)
       RETURNING *`,
      [
        params.userId,
        params.businessId || null,
        params.razorpayOrderId,
        params.amountPaise,
        params.creditsToAdd,
        params.currency || 'INR',
        params.paymentContext || 'manual_topup',
        JSON.stringify(params.metadata || {})
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
   * Get autopay settings for a user
   */
  async getAutopaySettings(userId: number): Promise<AutopaySettings | null> {
    const result = await pool.query<AutopaySettings>(
      'SELECT * FROM autopay_settings WHERE user_id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create or update autopay settings
   */
  async upsertAutopaySettings(params: {
    userId: number;
    enabled: boolean;
    thresholdCredits: number;
    rechargeAmount: number;
    mode: AutopayMode;
    status?: AutopayStatus;
    failureReason?: string | null;
  }): Promise<AutopaySettings> {
    const result = await pool.query<AutopaySettings>(
      `INSERT INTO autopay_settings (
         user_id,
         enabled,
         threshold_credits,
         recharge_amount,
         mode,
         selected_plan,
         trigger_type,
         payment_method_reference,
         status,
         failure_reason
       )
       VALUES ($1, $2, $3, $4, $5, 'custom', 'low_balance', 'Razorpay checkout', $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         threshold_credits = EXCLUDED.threshold_credits,
         recharge_amount = EXCLUDED.recharge_amount,
         mode = EXCLUDED.mode,
         selected_plan = EXCLUDED.selected_plan,
         trigger_type = EXCLUDED.trigger_type,
         payment_method_reference = EXCLUDED.payment_method_reference,
         status = EXCLUDED.status,
         failure_reason = EXCLUDED.failure_reason,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        params.userId,
        params.enabled,
        params.thresholdCredits,
        params.rechargeAmount,
        params.mode,
        params.status ?? 'active',
        params.failureReason ?? null,
      ]
    );

    return result.rows[0]!;
  }

  /**
   * Store an autopay log for audit visibility
   */
  async createAutopayLog(params: {
    userId: number;
    amount: number;
    credits: number;
    status: AutopayLogStatus;
    triggeredReason: AutopayTriggeredReason;
    mode: AutopayMode;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AutopayLog> {
    const result = await pool.query<AutopayLog>(
      `INSERT INTO autopay_logs (
         user_id,
         amount,
         credits,
         status,
         triggered_reason,
         mode,
         razorpay_order_id,
         razorpay_payment_id,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        params.userId,
        params.amount,
        params.credits,
        params.status,
        params.triggeredReason,
        params.mode,
        params.razorpayOrderId ?? null,
        params.razorpayPaymentId ?? null,
        JSON.stringify(params.metadata || {})
      ]
    );

    return result.rows[0]!;
  }

  /**
   * Update autopay log status
   */
  async updateAutopayLogStatus(params: {
    logId?: number;
    razorpayOrderId?: string;
    status: AutopayLogStatus;
    razorpayPaymentId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<AutopayLog | null> {
    const filter = params.logId ? "id = $1" : "razorpay_order_id = $1";
    const identifier = params.logId ?? params.razorpayOrderId;
    const result = await pool.query<AutopayLog>(
      `UPDATE autopay_logs
       SET status = $2,
           razorpay_payment_id = COALESCE($3, razorpay_payment_id),
           metadata = metadata || $4::jsonb
       WHERE ${filter}
       RETURNING *`,
      [
        identifier,
        params.status,
        params.razorpayPaymentId ?? null,
        JSON.stringify(params.metadata || {})
      ]
    );

    return result.rows[0] || null;
  }

  /**
   * Get recent autopay logs for a user
   */
  async getRecentAutopayLogs(userId: number, limit: number = 10): Promise<AutopayLog[]> {
    const result = await pool.query<AutopayLog>(
      `SELECT * FROM autopay_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get the latest autopay log for a user
   */
  async getLatestAutopayLog(userId: number): Promise<AutopayLog | null> {
    const result = await pool.query<AutopayLog>(
      `SELECT * FROM autopay_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get the latest pending checkout log for a user
   */
  async getPendingAutopayLog(userId: number): Promise<AutopayLog | null> {
    const result = await pool.query<AutopayLog>(
      `SELECT * FROM autopay_logs
       WHERE user_id = $1
         AND status = 'pending_checkout'
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Expire stale pending checkout logs so a fresh checkout can be created
   */
  async expireStalePendingAutopayLogs(userId: number, olderThanMinutes: number): Promise<number> {
    const result = await pool.query(
      `UPDATE autopay_logs
       SET status = 'failed',
           metadata = metadata || '{"reason":"stale_pending_checkout"}'::jsonb
       WHERE user_id = $1
         AND status = 'pending_checkout'
         AND timestamp < NOW() - ($2 * INTERVAL '1 minute')`,
      [userId, olderThanMinutes]
    );

    return result.rowCount ?? 0;
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
    businessId?: number | null,
    source: TransactionSource = 'razorpay',
    description?: string,
    transactionType: Extract<TransactionType, 'topup' | 'refund' | 'adjustment'> = 'topup'
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          businessId || null,
          transactionType,
          credits,
          amountPaise,
          source,
          razorpayOrderId,
          description
            || (transactionType === 'refund'
              ? `Credit refund: ${credits} credits returned to the wallet.`
              : `Credit top-up: ${credits} credits for ₹${(amountPaise / 100).toFixed(2)}`)
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
