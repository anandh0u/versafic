import type {
  AutopayTriggerApiResponse,
  AutopayStatusApiResponse,
  AuthResponse,
  BalanceCheckResponse,
  BusinessProfileResponse,
  BusinessStatusResponse,
  CallConfigResponse,
  CallSessionsResponse,
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

export const systemApi = {
  health: () => apiRequest<unknown>('/health'),
  observabilityHealth: () => apiRequest<unknown>('/ops/health'),
  observabilityStatus: () => apiRequest<unknown>('/ops/status'),
};

export const billingApi = {
  getPlans: () => apiRequest<PlansApiResponse>('/billing/plans'),

  getWallet: () => apiRequest<WalletApiResponse>('/billing/wallet'),

  createOrder: (planId: string) =>
    apiRequest<CreateOrderResponse>('/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    }),

  createCustomOrder: (amountPaise: number, credits: number) =>
    apiRequest<CreateOrderResponse>('/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({
        amount_paise: amountPaise,
        credits,
      }),
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
  getConfig: () => apiRequest<CallConfigResponse>('/call/config'),

  getSessions: (limit = 12) =>
    apiRequest<CallSessionsResponse>(`/call/sessions?limit=${limit}`),

  triggerOutboundCall: (payload: {
    phone_number: string;
    purpose: CallPurpose;
  }) =>
    apiRequest<OutboundCallResponse>('/call/outbound', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRecordings: (params?: { phoneNumber?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.phoneNumber) search.set('phoneNumber', params.phoneNumber);
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    const query = search.toString();

    return apiRequest<unknown>(`/call/recordings${query ? `?${query}` : ''}`);
  },

  getRecordingByCallSid: (callSid: string) =>
    apiRequest<unknown>(`/call/recordings/${callSid}`),
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

export const aiApi = {
  chat: (message: string) =>
    apiRequest<unknown>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  getHistory: (params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    const query = search.toString();

    return apiRequest<unknown>(`/ai/chat/history${query ? `?${query}` : ''}`);
  },

  getStats: () => apiRequest<unknown>('/ai/chat/stats'),

  clearHistory: () =>
    apiRequest<unknown>('/ai/chat/history', {
      method: 'DELETE',
    }),

  extractData: (text: string) =>
    apiRequest<unknown>('/ai/extract', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  understandIntent: (message: string) =>
    apiRequest<unknown>('/ai/intent', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  customerServiceResponse: (message: string) =>
    apiRequest<unknown>('/ai/customer-service-response', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};

export const voiceApi = {
  process: (payload: { audioBase64: string; language?: string }) =>
    apiRequest<unknown>('/voice/process', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  speechToText: (payload: { audioBase64: string; language?: string }) =>
    apiRequest<unknown>('/voice/stt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  textToSpeech: (payload: { text: string; language?: string }) =>
    apiRequest<unknown>('/voice/tts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getConversationsByPhone: (phone: string) =>
    apiRequest<unknown>(`/voice/conversations/phone/${encodeURIComponent(phone)}`),

  getStatistics: () => apiRequest<unknown>('/voice/statistics'),
};

export const customerServiceApi = {
  startSession: () =>
    apiRequest<unknown>('/customer-service/start', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  chat: (payload: {
    sessionId?: string;
    textMessage?: string;
    audioBase64?: string;
    languageCode?: string;
  }) =>
    apiRequest<unknown>('/customer-service/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getHistory: (sessionId: string) =>
    apiRequest<unknown>(`/customer-service/history/${encodeURIComponent(sessionId)}`),

  getSession: (sessionId: string) =>
    apiRequest<unknown>(`/customer-service/session/${encodeURIComponent(sessionId)}`),

  endSession: (sessionId: string) =>
    apiRequest<unknown>(`/customer-service/end/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getInteractionsByPhone: (phone: string) =>
    apiRequest<unknown>(`/customer-service/interactions/phone/${encodeURIComponent(phone)}`),

  getResolvedInteractions: (limit?: number) =>
    apiRequest<unknown>(`/customer-service/interactions/resolved${limit ? `?limit=${limit}` : ''}`),

  getSentimentStats: () =>
    apiRequest<unknown>('/customer-service/stats/sentiment'),

  getResolutionStats: () =>
    apiRequest<unknown>('/customer-service/stats/resolution'),

  getActiveSessions: () =>
    apiRequest<unknown>('/customer-service/active-sessions'),
};

export const businessDirectoryApi = {
  onboard: (payload: {
    business_name: string;
    business_type: string;
    owner_name: string;
    phone: string;
    email: string;
  }) =>
    apiRequest<unknown>('/business/onboard', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getByEmail: (email: string) =>
    apiRequest<unknown>(`/business/${encodeURIComponent(email)}`),

  getAll: (params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    const query = search.toString();

    return apiRequest<unknown>(`/business${query ? `?${query}` : ''}`);
  },

  update: (id: string, payload: Partial<{
    business_name: string;
    business_type: string;
    owner_name: string;
    phone: string;
    email: string;
  }>) =>
    apiRequest<unknown>(`/business/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

export const apiConfig = {
  baseUrl: API_BASE_URL,
  billingMode: (import.meta.env.VITE_BILLING_MODE || 'hybrid') as 'mock' | 'hybrid' | 'live',
};
