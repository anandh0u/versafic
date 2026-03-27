/**
 * Billing Types
 * Type definitions for the billing system
 */

export interface Wallet {
  id: number;
  user_id: number;
  business_id: number | null;
  balance_credits: number;
  created_at: Date;
  updated_at: Date;
}

export type PaymentStatus = 'created' | 'paid' | 'failed';

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
  payment_context: 'manual_topup' | 'autopay';
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type TransactionType = 'topup' | 'usage_deduction' | 'refund' | 'adjustment';
export type TransactionSource =
  | 'razorpay'
  | 'autopay'
  | 'demo_autopay'
  | 'ai_chat'
  | 'sarvam_stt'
  | 'voice_process'
  | 'voice_call'
  | 'inbound_call'
  | 'outbound_call'
  | 'premium_call'
  | 'recording_process'
  | 'onboarding_ai_setup'
  | 'admin'
  | 'system';

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

export type AutopayMode = 'demo' | 'real';
export type AutopayStatus = 'active' | 'paused' | 'needs_attention';
export type AutopayLogStatus = 'pending_checkout' | 'completed' | 'failed' | 'skipped' | 'blocked';
export type AutopayTriggeredReason = 'low_balance' | 'manual_retry' | 'insufficient_credits';

export interface AutopaySettings {
  id: number;
  user_id: number;
  enabled: boolean;
  threshold_credits: number;
  recharge_amount: number;
  mode: AutopayMode;
  status: AutopayStatus;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AutopayLog {
  id: number;
  user_id: number;
  amount: number;
  credits: number;
  status: AutopayLogStatus;
  triggered_reason: AutopayTriggeredReason;
  mode: AutopayMode;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface AutopayPendingCheckout {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  credits: number;
  name: string;
  description: string;
}

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

export interface PricingPlan {
  id: string;
  name: string;
  amount_paise: number;
  credits: number;
  description: string;
}

export interface AutopayStatusResponse {
  settings: AutopaySettings;
  logs: AutopayLog[];
  pending_checkout?: AutopayPendingCheckout | null;
}

export interface AutopayExecutionResponse {
  settings: AutopaySettings;
  log: AutopayLog;
  balance_credits: number;
  requires_user_action: boolean;
  checkout?: AutopayPendingCheckout | null;
}

export interface UsageSummaryResponse {
  month_credits_used: number;
  total_calls_handled: number;
  ai_chats_used: number;
  sarvam_requests: number;
  voice_processes: number;
  recordings_processed: number;
  onboarding_automations: number;
  premium_call_minutes: number;
  standard_call_minutes: number;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    amount_paise: 9900,
    credits: 990,
    description: '990 credits for small businesses'
  },
  {
    id: 'growth',
    name: 'Growth',
    amount_paise: 19900,
    credits: 1990,
    description: '1990 credits for growing teams'
  },
  {
    id: 'pro',
    name: 'Pro',
    amount_paise: 49900,
    credits: 4990,
    description: '4990 credits for enterprises'
  }
];

export const CREDIT_COSTS = {
  AI_CHAT_MESSAGE: 2,
  SARVAM_STT_REQUEST: 10,
  VOICE_PROCESS_ACTION: 10,
  VOICE_CALL_MINUTE: 20,
  PREMIUM_CALL_MINUTE: 30,
  RECORDING_PROCESSING: 5,
  ONBOARDING_AI_SETUP: 10,
};
