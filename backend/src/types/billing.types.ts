/**
 * Billing Types
 * Type definitions for the billing system
 */

// Wallet types
export interface Wallet {
  id: number;
  user_id: number;
  business_id: number | null;
  balance_credits: number;
  created_at: Date;
  updated_at: Date;
}

// Payment status enum
export type PaymentStatus = 'created' | 'paid' | 'failed';

// Payment types
export interface Payment {
  id: number;
  user_id: number;
  business_id: number | null;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount_paise: number;
  credits_to_add: number;
  currency: string;
  status: PaymentStatus;
  created_at: Date;
  updated_at: Date;
}

// Transaction types
export type TransactionType = 'topup' | 'usage_deduction' | 'refund' | 'adjustment';
export type TransactionSource = 'razorpay' | 'ai_chat' | 'voice_call' | 'admin' | 'system';

export interface CreditTransaction {
  id: number;
  user_id: number;
  business_id: number | null;
  type: TransactionType;
  credits: number;
  amount_paise: number | null;
  source: TransactionSource;
  reference_id: string | null;
  description: string | null;
  created_at: Date;
}

// API Request/Response types
export interface CreateOrderRequest {
  plan_id?: string;
  amount_paise?: number;
  credits?: number;
}

export interface CreateOrderResponse {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  credits: number;
  name: string;
  description: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface WalletResponse {
  balance_credits: number;
  transactions: CreditTransaction[];
}

// Pricing plans
export interface PricingPlan {
  id: string;
  name: string;
  amount_paise: number;
  credits: number;
  description: string;
}

// Predefined pricing plans
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    amount_paise: 9900, // ₹99
    credits: 990,
    description: '990 credits for small businesses'
  },
  {
    id: 'growth',
    name: 'Growth',
    amount_paise: 19900, // ₹199
    credits: 1990,
    description: '1990 credits for growing teams'
  },
  {
    id: 'pro',
    name: 'Pro',
    amount_paise: 49900, // ₹499
    credits: 4990,
    description: '4990 credits for enterprises'
  }
];

// Credit costs for different operations
export const CREDIT_COSTS = {
  AI_CHAT_MESSAGE: 1,      // 1 credit per AI chat message
  VOICE_CALL_MINUTE: 5,    // 5 credits per minute of voice call
  VOICE_CALL_BASE: 2       // 2 credits base cost per call
};
