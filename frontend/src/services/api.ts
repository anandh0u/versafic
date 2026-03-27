import type {
  AutopayTriggerApiResponse,
  AutopayStatusApiResponse,
  AuthResponse,
  BalanceCheckResponse,
  BusinessProfileResponse,
  BusinessStatusResponse,
  CreateOrderResponse,
  CallPurpose,
  OutboundCallResponse,
  PaymentVerificationResponse,
  PlansApiResponse,
  UserProfileResponse,
  WalletApiResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type ApiErrorResponse = {
  message?: string;
};

const getToken = (): string | null => localStorage.getItem('accessToken');

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const ngrokHeaders: Record<string, string> = {};
  if (API_BASE_URL.includes('ngrok-free.app') || API_BASE_URL.includes('ngrok.app')) {
    ngrokHeaders['ngrok-skip-browser-warning'] = 'true';
  }
  const headers: HeadersInit = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...ngrokHeaders,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as T & ApiErrorResponse) : ({} as T & ApiErrorResponse);

  if (!response.ok) {
    throw new Error(parsed.message || 'API request failed');
  }

  return parsed;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name?: string) =>
    apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  getCurrentUser: () =>
    apiRequest<UserProfileResponse>('/auth/me'),

  updateCurrentUser: (payload: {
    name?: string;
    phone_number?: string;
    call_consent?: boolean;
    call_opt_out?: boolean;
  }) =>
    apiRequest<UserProfileResponse>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const billingApi = {
  getPlans: () => apiRequest<PlansApiResponse>('/billing/plans'),

  getWallet: () => apiRequest<WalletApiResponse>('/billing/wallet'),

  createOrder: (planId: string) =>
    apiRequest<CreateOrderResponse>('/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    }),

  verifyPayment: (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ) =>
    apiRequest<PaymentVerificationResponse>('/billing/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      }),
    }),

  checkBalance: (required?: number) =>
    apiRequest<BalanceCheckResponse>(
      `/billing/check-balance${required ? `?required=${required}` : ''}`
    ),

  getAutopayStatus: () =>
    apiRequest<AutopayStatusApiResponse>('/billing/autopay/status'),

  enableAutopay: (payload: {
    threshold_credits: number;
    recharge_amount?: number;
    mode: 'demo' | 'real';
    selected_plan?: string;
  }) =>
    apiRequest<AutopayStatusApiResponse>('/billing/autopay/enable', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  disableAutopay: () =>
    apiRequest<AutopayStatusApiResponse>('/billing/autopay/disable', {
      method: 'POST',
      body: JSON.stringify({ enabled: false }),
    }),

  triggerAutopay: (payload?: {
    triggered_by?: 'low_balance' | 'manual_retry' | 'insufficient_credits';
    force?: boolean;
  }) =>
    apiRequest<AutopayTriggerApiResponse>('/billing/autopay/trigger', {
      method: 'POST',
      body: JSON.stringify(payload ?? { triggered_by: 'manual_retry', force: true }),
    }),
};

export const callApi = {
  triggerOutboundCall: (payload: {
    phone_number: string;
    purpose: CallPurpose;
  }) =>
    apiRequest<OutboundCallResponse>('/call/outbound', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const userApi = {
  getProfile: () => apiRequest<BusinessProfileResponse>('/setup/business'),

  getStatus: () => apiRequest<BusinessStatusResponse>('/setup/status'),

  updateBusiness: (data: Record<string, unknown>) =>
    apiRequest<BusinessProfileResponse>('/setup/business', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const apiConfig = {
  baseUrl: API_BASE_URL,
  billingMode: (import.meta.env.VITE_BILLING_MODE || 'hybrid') as 'mock' | 'hybrid' | 'live',
};
