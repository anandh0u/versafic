export type BillingMode = 'mock' | 'hybrid' | 'live';

export type AutopayTriggerType = 'low_balance' | 'plan_expiry';
export type WalletHealth = 'healthy' | 'low' | 'empty';
export type TransactionKind = 'topup' | 'usage' | 'autopay' | 'refund' | 'adjustment';
export type TransactionStatus = 'completed' | 'pending' | 'failed';
export type PreferredPaymentMethod = 'upi' | 'card' | 'netbanking';

export interface User {
  id: number;
  email: string;
  name?: string;
  phoneNumber?: string;
  callConsent?: boolean;
  callOptOut?: boolean;
  isOnboarded: boolean;
}

export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface AuthResponse extends ApiResponse<{
  user: User;
  accessToken: string;
  refreshToken: string;
}> {}

export interface PricingPlan {
  id: string;
  name: string;
  amount: number;
  amountPaise: number;
  credits: number;
  description: string;
  idealFor: string;
  monthlyCapacity: string;
  autopayEligible: boolean;
  highlight?: string;
}

export interface CreditPack {
  id: string;
  label: string;
  amount: number;
  amountPaise: number;
  credits: number;
  description: string;
}

export interface UsageRule {
  id: string;
  label: string;
  credits: number;
  unit: string;
  description: string;
  accent: 'mint' | 'amber' | 'sky' | 'rose' | 'violet';
}

export interface SimulationAction {
  id: string;
  label: string;
  description: string;
  credits: number;
  source: string;
  sourceLabel: string;
  quantityLabel: string;
  referencePrefix: string;
  outcome: string;
  minutes?: number;
}

export interface BillingTransaction {
  id: string;
  kind: TransactionKind;
  creditsDelta: number;
  amountPaise?: number;
  source: string;
  sourceLabel: string;
  description: string;
  status: TransactionStatus;
  createdAt: string;
  referenceId?: string;
  featureKey?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface WalletSnapshot {
  baseBalanceCredits: number;
  baseTransactions: BillingTransaction[];
}

export interface WalletApiResponse extends ApiResponse<{
  balance_credits: number;
  transactions: Array<{
    id: number;
    type: 'topup' | 'usage_deduction' | 'refund' | 'adjustment';
    credits: number;
    source: string;
    description: string;
    created_at: string;
    amount_paise?: number | null;
    reference_id?: string | null;
  }>;
}> {}

export interface PlansApiResponse extends ApiResponse<{
  plans: Array<{
    id: string;
    name: string;
    amount: number;
    amount_paise: number;
    credits: number;
    description: string;
  }>;
}> {}

export interface CreateOrderResponse extends ApiResponse<{
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  credits: number;
  name: string;
  description: string;
}> {}

export interface PaymentVerificationResponse extends ApiResponse<{
  balance_credits: number;
}> {}

export interface BalanceCheckResponse extends ApiResponse<{
  balance_credits: number;
  required_credits: number;
  has_sufficient_credits: boolean;
}> {}

export interface BusinessProfile {
  businessName: string;
  businessType: string;
  industry: string;
  website: string;
  country: string;
  phone: string;
  supportWorkflowStatus: string;
  aiSetupStatus: string;
  onboardingStage: string;
  lastSyncAt: string;
}

export interface BusinessProfileApiPayload {
  id?: number;
  business_name?: string;
  business_type?: string;
  industry?: string;
  website?: string;
  country?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessProfileResponse extends ApiResponse<BusinessProfileApiPayload> {}

export interface BusinessStatusResponse extends ApiResponse<{
  isOnboarded: boolean;
  hasBusinessProfile: boolean;
  profile: BusinessProfileApiPayload | null;
}> {}

export interface AutopaySettings {
  enabled: boolean;
  selectedPlanId: string;
  triggerType: AutopayTriggerType;
  thresholdCredits: number;
  rechargeAmount: number;
  mode: 'demo' | 'real';
  preferredPaymentMethod: PreferredPaymentMethod;
  upiId?: string;
  paymentMethodLabel: string;
  status: 'active' | 'paused' | 'needs_attention';
  lastAutopayAt?: string;
  nextAutopayAttemptAt?: string;
  failedReason?: string;
  pendingCheckout?: PendingCheckout | null;
}

export interface PendingCheckout {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  credits: number;
  name: string;
  description: string;
}

export interface AutopayLogApiItem {
  id: number;
  amount: number;
  credits: number;
  status: 'pending_checkout' | 'completed' | 'failed' | 'skipped' | 'blocked';
  triggered_reason: 'low_balance' | 'manual_retry' | 'insufficient_credits';
  mode: 'demo' | 'real';
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AutopayStatusApiResponse extends ApiResponse<{
  settings: {
    enabled: boolean;
    threshold_credits: number;
    recharge_amount: number;
    mode: 'demo' | 'real';
    status: 'active' | 'paused' | 'needs_attention';
    failure_reason?: string | null;
  };
  logs: AutopayLogApiItem[];
  pending_checkout?: PendingCheckout | null;
}> {}

export interface AutopayTriggerApiResponse extends ApiResponse<{
  settings: {
    enabled: boolean;
    threshold_credits: number;
    recharge_amount: number;
    mode: 'demo' | 'real';
    status: 'active' | 'paused' | 'needs_attention';
    failure_reason?: string | null;
  };
  log: AutopayLogApiItem;
  balance_credits: number;
  requires_user_action: boolean;
  checkout?: PendingCheckout | null;
}> {}

export interface UserProfileResponse extends ApiResponse<User> {}

export type CallPurpose =
  | 'enquiry_follow_up'
  | 'missed_call_callback'
  | 'support_call'
  | 'booking_confirmation';

export interface OutboundCallResponse extends ApiResponse<{
  callSid: string;
  to: string;
  purpose: CallPurpose;
  script: string;
  balance_credits?: number;
}> {}

export interface CallConfigResponse extends ApiResponse<{
  configured: boolean;
  ai_number: string | null;
  call_credit_cost: number;
  account_mode: 'trial' | 'paid';
  app_name: string;
  intro_message: string;
  trial_guidance: string;
  webhooks: {
    incoming: string;
    status: string;
    recording: string;
    outboundTwiml: string;
  };
  auto_sync_enabled: boolean;
}> {}

export interface CallSessionItem {
  id: string;
  call_sid: string;
  phone_number?: string | null;
  type?: 'incoming' | 'outgoing';
  purpose?: string | null;
  from_number: string;
  to_number: string;
  status: string;
  direction: string;
  duration_seconds?: number | null;
  recording_url?: string | null;
  callback_requested?: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface CallSessionsResponse extends ApiResponse<{
  sessions: CallSessionItem[];
  credit_cost: number;
}> {}

export interface UsageSummary {
  monthCreditsUsed: number;
  totalCallsHandled: number;
  aiChatsUsed: number;
  sarvamRequests: number;
  voiceProcesses: number;
  recordingsProcessed: number;
  onboardingAutomations: number;
  premiumCallMinutes: number;
  standardCallMinutes: number;
  estimatedNextRecharge: string;
}

export interface CreditBreakdownItem {
  label: string;
  credits: number;
  share: number;
  volume: string;
}

export interface BillingAlert {
  severity: 'info' | 'warning' | 'danger';
  title: string;
  body: string;
}

export interface BillingWorkspace {
  mode: BillingMode;
  pricingPlans: PricingPlan[];
  usageRules: UsageRule[];
  simulationActions: SimulationAction[];
  currentPlan: PricingPlan;
  currentPlanStatus: string;
  balanceCredits: number;
  baseBalanceCredits: number;
  lowBalanceThreshold: number;
  walletHealth: WalletHealth;
  autopay: AutopaySettings;
  transactions: BillingTransaction[];
  usageHistory: BillingTransaction[];
  rechargeHistory: BillingTransaction[];
  autopayHistory: BillingTransaction[];
  usageSummary: UsageSummary;
  businessProfile: BusinessProfile;
  alerts: BillingAlert[];
  consumptionBreakdown: CreditBreakdownItem[];
  paymentReadiness: {
    canUseRazorpay: boolean;
    message: string;
  };
}

export interface DemoState {
  localTransactions: BillingTransaction[];
  activePlanId: string;
  autopay: AutopaySettings;
  seededCreditsGranted: boolean;
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void | Promise<void>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface PurchasePlanOptions {
  autopaySetup?: Partial<AutopaySettings> | null;
}

export interface BillingContextType {
  workspace: BillingWorkspace | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  purchasePlan: (planId: string, options?: PurchasePlanOptions) => Promise<void>;
  purchaseCredits: (amountPaise: number, credits: number) => Promise<void>;
  demoTopUp: (planId: string) => Promise<void>;
  simulateUsage: (actionId: string) => Promise<void>;
  updateAutopay: (patch: Partial<AutopaySettings>) => Promise<void>;
  triggerAutopay: () => Promise<void>;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}
