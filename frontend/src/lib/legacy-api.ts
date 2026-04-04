"use client";

export class LegacyApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "LegacyApiError";
    this.status = status;
    this.payload = payload ?? null;
  }
}

type ApiEnvelope<T> = {
  status?: string;
  statusCode?: number;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    limit?: number;
    offset?: number;
    count?: number;
  };
  timestamp?: string;
};

type SessionShape = {
  accessToken: string;
  refreshToken: string;
  user?: Record<string, unknown> | null;
};

export type AuthUser = {
  id: number | string;
  email: string;
  name?: string | null;
  phone_number?: string | null;
  call_consent?: boolean;
  call_opt_out?: boolean;
};

export type BillingPlan = {
  id: string;
  name: string;
  amount: number;
  amount_paise: number;
  credits: number;
  description: string;
};

export type WalletTransaction = {
  id: number;
  type: string;
  source: string;
  credits: number;
  amount_paise: number | null;
  description: string | null;
  reference_id: string | null;
  created_at: string;
};

export type WalletInfo = {
  balance_credits: number;
  transactions: WalletTransaction[];
};

export type AutopayStatus = {
  settings?: {
    enabled: boolean;
    threshold_credits: number;
    recharge_amount: number;
    mode: string;
    status: string;
  } | null;
  logs?: Array<Record<string, unknown>>;
  pending_checkout?: Record<string, unknown> | null;
};

export type BusinessRecord = {
  id: string;
  business_name: string;
  business_type: string;
  owner_name: string;
  phone: string;
  email: string;
  created_at?: string;
  updated_at?: string;
};

export type CallConfig = {
  configured: boolean;
  ai_number: string | null;
  call_credit_cost: number;
  account_mode?: string;
  demo_mode?: boolean;
  cooldown_enabled?: boolean;
  daily_limit_enabled?: boolean;
  app_name?: string;
  intro_message?: string;
  trial_guidance?: string;
};

export type CallSession = {
  id: string;
  call_sid: string;
  phone_number?: string | null;
  type?: "incoming" | "outgoing";
  purpose?: string | null;
  from_number: string;
  to_number: string;
  status: string;
  direction: string;
  cost_credits?: number;
  callback_requested?: boolean;
  duration_seconds?: number | null;
  ai_response?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type ChatHistoryItem = {
  id?: number;
  user_id?: number;
  userId?: number;
  message: string;
  response: string;
  tokens_used?: number;
  tokensUsed?: number;
  created_at?: string;
  createdAt?: string;
};

export type ChatStats = {
  totalMessages: number;
  totalTokens: number;
};

export type VoiceStats = Record<string, number | string | null>;

export type CustomerServiceSession = {
  sessionId: string;
  message?: string;
};

export type CustomerServiceReply = {
  sessionId: string;
  customerMessage: string;
  aiResponse: string;
  extractedData?: Record<string, unknown>;
  sentiment?: string;
  isResolved?: boolean;
};

export type SetupProfile = {
  businessName?: string;
  businessType?: string;
  industry?: string;
  website?: string;
  country?: string;
  phone?: string;
};

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend-pink-three-22.vercel.app").replace(/\/+$/, "");

const SESSION_KEY = "versafic.legacy.session";
const PREFERRED_PLAN_KEY = "versafic.legacy.selected-plan";

const parseJson = async <T>(response: Response): Promise<ApiEnvelope<T> | null> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    return null;
  }
};

const readSession = (): SessionShape | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionShape;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

const writeSession = (session: SessionShape) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  document.cookie = `versafic_session=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
};

export const clearSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  document.cookie = "versafic_session=; path=/; max-age=0; SameSite=Lax";
};

export const getStoredSession = () => readSession();

export const getStoredUser = (): AuthUser | null => {
  const session = readSession();
  return (session?.user as AuthUser | null) ?? null;
};

export const getPreferredPlanId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(PREFERRED_PLAN_KEY);
};

export const setPreferredPlanId = (planId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PREFERRED_PLAN_KEY, planId);
};

const refreshSession = async (): Promise<string | null> => {
  const session = readSession();
  if (!session?.refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  const payload = await parseJson<{ accessToken: string; refreshToken: string }>(response);
  if (!response.ok || !payload?.data?.accessToken || !payload.data.refreshToken) {
    clearSession();
    return null;
  }

  writeSession({
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
    user: session.user ?? null,
  });

  return payload.data.accessToken;
};

const request = async <T>(
  path: string,
  init: RequestInit = {},
  options?: {
    auth?: boolean;
    retryOnUnauthorized?: boolean;
  }
): Promise<T> => {
  const auth = options?.auth ?? false;
  const retryOnUnauthorized = options?.retryOnUnauthorized ?? true;
  const session = readSession();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const nextToken = await refreshSession();
    if (nextToken) {
      return request<T>(path, init, { auth, retryOnUnauthorized: false });
    }
  }

  const payload = await parseJson<T>(response);
  if (!response.ok) {
    throw new LegacyApiError(
      payload?.message || payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return (payload?.data ?? (payload as T)) as T;
};

export const login = async (email: string, password: string) => {
  const data = await request<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  writeSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });

  return data.user;
};

export const register = async (payload: { email: string; password: string; name: string }) => {
  const data = await request<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  writeSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });

  return data.user;
};

export const getCurrentUser = async () => {
  const user = await request<AuthUser>("/auth/me", undefined, { auth: true });
  const session = readSession();
  if (session) {
    writeSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user,
    });
  }
  return user;
};

export const updateCurrentUser = async (payload: Record<string, unknown>) =>
  request<AuthUser>(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const getPlans = async () =>
  request<{ plans: BillingPlan[] }>("/billing/plans");

export const getWallet = async () =>
  request<WalletInfo>("/billing/wallet", undefined, { auth: true });

export const getAutopayStatus = async () =>
  request<AutopayStatus>("/billing/autopay/status", undefined, { auth: true });

export const createOrder = async (payload: { plan_id?: string; amount_paise?: number; credits?: number }) =>
  request<{
    order_id: string;
    key_id: string;
    amount: number;
    currency: string;
    credits: number;
    name: string;
    description: string;
  }>(
    "/billing/create-order",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const verifyPayment = async (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) =>
  request<{ balance_credits: number }>(
    "/billing/verify-payment",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const getCallConfig = async () =>
  request<CallConfig>("/call/config", undefined, { auth: true });

export const getPublicCallConfig = async () =>
  request<CallConfig>("/call/public-config");

export const getCallSessions = async () =>
  request<{ sessions: CallSession[]; credit_cost: number }>("/call/sessions?limit=25", undefined, { auth: true });

export const initiateOutboundCall = async (payload: { phone_number: string; purpose: string }) =>
  request<Record<string, unknown>>(
    "/call/outbound",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const getChatHistory = async () =>
  request<{ messages: ChatHistoryItem[]; count: number }>("/ai/chat/history?limit=25", undefined, { auth: true });

export const getChatStats = async () =>
  request<ChatStats>("/ai/chat/stats", undefined, { auth: true });

export const sendAiChat = async (message: string) =>
  request<{ response: string; tokensUsed?: number; model?: string }>(
    "/ai/chat",
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
    { auth: true }
  );

export const startCustomerServiceSession = async () =>
  request<CustomerServiceSession>("/customer-service/start", {
    method: "POST",
  });

export const sendCustomerServiceChat = async (payload: { sessionId: string; textMessage: string; languageCode?: string }) =>
  request<CustomerServiceReply>(
    "/customer-service/chat",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

export const getVoiceStats = async () =>
  request<VoiceStats>("/voice/statistics");

export const getBusinessList = async (limit = 50) =>
  request<BusinessRecord[]>(`/business?limit=${limit}&offset=0`);

export const getBusinessByEmail = async (email: string) =>
  request<BusinessRecord>(`/business/${encodeURIComponent(email)}`);

export const updateBusiness = async (id: string, payload: Partial<BusinessRecord>) =>
  request<BusinessRecord>(
    `/business/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

export const createBusinessRecord = async (payload: {
  business_name: string;
  business_type: string;
  owner_name: string;
  phone: string;
  email: string;
}) =>
  request<BusinessRecord>(
    "/business/onboard",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

export const getSetupBusiness = async () =>
  request<SetupProfile>("/setup/business", undefined, { auth: true });

export const saveSetupBusiness = async (payload: SetupProfile) =>
  request<SetupProfile>(
    "/setup/business",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const getSetupStatus = async () =>
  request<Record<string, unknown>>("/setup/status", undefined, { auth: true });
