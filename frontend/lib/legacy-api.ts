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
  phoneNumber?: string | null;
  phone_number?: string | null;
  callConsent?: boolean;
  call_consent?: boolean;
  callOptOut?: boolean;
  call_opt_out?: boolean;
  is_onboarded?: boolean;
  isOnboarded?: boolean;
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
  pending_checkout?: RazorpayCheckoutOrder | null;
};

export type RazorpayCheckoutOrder = {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  credits: number;
  name: string;
  description: string;
};

export type AutopayTriggerResponse = {
  settings: NonNullable<AutopayStatus["settings"]>;
  log: Record<string, unknown>;
  balance_credits: number;
  requires_user_action: boolean;
  checkout?: RazorpayCheckoutOrder | null;
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
  provider?: string;
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

export type SmsConfig = {
  configured: boolean;
  provider?: string;
  senderId?: string | null;
  route?: string;
  apiBaseUrl?: string;
};

export type SimulatedIncomingCall = {
  session_id: string | null;
  call_id: string;
  customer_number: string;
  business_id: string | null;
  business_name: string | null;
  status: "calling" | "connected" | "completed";
  statuses: Array<{
    status: "calling" | "connected" | "completed";
    at: string;
    message: string;
  }>;
  ai_response: string;
  voice_xml: string;
  route_source: string;
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

export type VoiceStatistics = {
  total: number;
  with_name: number;
  with_phone: number;
  with_email: number;
  today: number;
};

export type VoiceConversation = {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  request?: string | null;
  ai_response: string;
  transcript?: string | null;
  created_at: string;
  updated_at?: string;
};

export type CustomerSentimentStats = {
  positive: number;
  negative: number;
  neutral: number;
};

export type CustomerResolutionStats = {
  resolved: number;
  unresolved: number;
  rate: number;
};

export type CustomerServiceInteraction = {
  id: string;
  session_id: string;
  customer_message: string;
  ai_response: string;
  sentiment: "positive" | "negative" | "neutral";
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  is_resolved: boolean;
  created_at: string;
};

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

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "https://backend-production-a176.up.railway.app")
).replace(/\/+$/, "");

const SESSION_KEY = "versafic.legacy.session";
const PREFERRED_PLAN_KEY = "versafic.legacy.selected-plan";
const DATA_CHANGED_EVENT = "versafic:data-changed";

const notifyDataChanged = (reason: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(DATA_CHANGED_EVENT, {
      detail: {
        reason,
        at: Date.now(),
      },
    })
  );
};

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

const normalizeAuthUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const phone =
    typeof raw.phone_number === "string"
      ? raw.phone_number
      : typeof raw.phoneNumber === "string"
        ? raw.phoneNumber
        : null;
  const callConsent =
    typeof raw.call_consent === "boolean"
      ? raw.call_consent
      : typeof raw.callConsent === "boolean"
        ? raw.callConsent
        : false;
  const callOptOut =
    typeof raw.call_opt_out === "boolean"
      ? raw.call_opt_out
      : typeof raw.callOptOut === "boolean"
        ? raw.callOptOut
        : false;
  const isOnboarded =
    typeof raw.is_onboarded === "boolean"
      ? raw.is_onboarded
      : typeof raw.isOnboarded === "boolean"
        ? raw.isOnboarded
        : false;

  return {
    id: raw.id as string | number,
    email: String(raw.email || ""),
    name: typeof raw.name === "string" ? raw.name : null,
    phoneNumber: phone,
    phone_number: phone,
    callConsent,
    call_consent: callConsent,
    callOptOut: callOptOut,
    call_opt_out: callOptOut,
    is_onboarded: isOnboarded,
    isOnboarded: isOnboarded,
  };
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

export const storeSession = (session: SessionShape) => {
  writeSession(session);
};

export const getStoredSession = () => readSession();

export const getStoredUser = (): AuthUser | null => {
  const session = readSession();
  return normalizeAuthUser(session?.user ?? null);
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

  const normalizedUser = normalizeAuthUser(data.user);
  if (!normalizedUser) {
    throw new LegacyApiError("Login succeeded but the user payload was invalid.", 500, data.user);
  }

  writeSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: normalizedUser,
  });

  return normalizedUser;
};

export const requestPasswordReset = async (email: string) =>
  request<{ accepted: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = async (payload: { token: string; password: string }) =>
  request<{ reset: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getOAuthStartUrl = (provider: "google" | "github") => {
  if (typeof window === "undefined") {
    return `${API_BASE_URL}/auth/${provider}/start`;
  }

  const callbackUrl = `${window.location.origin}/auth/callback`;
  const url = new URL(`${API_BASE_URL}/auth/${provider}/start`);
  url.searchParams.set("return_to", callbackUrl);
  return url.toString();
};

export const completeOAuthCallback = async (currentUrl: string) => {
  const url = new URL(currentUrl);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const errorMessage = url.searchParams.get("error") || hashParams.get("error");

  if (errorMessage) {
    return {
      success: false as const,
      message: errorMessage,
    };
  }

  const accessToken = hashParams.get("accessToken");
  const refreshToken = hashParams.get("refreshToken");
  if (!accessToken || !refreshToken) {
    return {
      success: false as const,
      message: "OAuth login did not return a valid session.",
    };
  }

  writeSession({
    accessToken,
    refreshToken,
    user: null,
  });

  try {
    const user = await getCurrentUser();
    return {
      success: true as const,
      user,
    };
  } catch {
    return {
      success: true as const,
      user: null,
    };
  }
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

  const normalizedUser = normalizeAuthUser(data.user);
  if (!normalizedUser) {
    throw new LegacyApiError("Registration succeeded but the user payload was invalid.", 500, data.user);
  }

  writeSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: normalizedUser,
  });

  return normalizedUser;
};

export const validateRegistrableEmail = async (email: string) =>
  request<{
    email: string;
    valid: boolean;
    error?: string | null;
  }>("/auth/validate-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const getCurrentUser = async () => {
  const responseUser = await request<AuthUser>("/auth/me", undefined, { auth: true });
  const user = normalizeAuthUser(responseUser);
  if (!user) {
    throw new LegacyApiError("Current user payload was invalid.", 500, responseUser);
  }
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
  ).then((result) => {
    const normalizedUser = normalizeAuthUser(result);
    if (!normalizedUser) {
      throw new LegacyApiError("Updated user payload was invalid.", 500, result);
    }
    const session = readSession();
    if (session) {
      writeSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: normalizedUser,
      });
    }

    notifyDataChanged("user-updated");
    return normalizedUser;
  });

export const getPlans = async () =>
  request<{ plans: BillingPlan[] }>("/billing/plans");

export const getWallet = async () =>
  request<WalletInfo>("/billing/wallet", undefined, { auth: true });

export const getAutopayStatus = async () =>
  request<AutopayStatus>("/billing/autopay/status", undefined, { auth: true });

export const createOrder = async (payload: { plan_id?: string; amount_paise?: number; credits?: number }) =>
  request<RazorpayCheckoutOrder>(
    "/billing/create-order",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const enableAutopay = async (payload: {
  threshold_credits: number;
  recharge_amount?: number;
  mode?: "demo" | "real";
  selected_plan?: string;
}) =>
  request<AutopayStatus>(
    "/billing/autopay/enable",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("autopay-enabled");
    return result;
  });

export const disableAutopay = async () =>
  request<AutopayStatus>(
    "/billing/autopay/disable",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("autopay-disabled");
    return result;
  });

export const triggerAutopay = async (payload: { triggered_by?: "low_balance" | "manual_retry" | "insufficient_credits"; force?: boolean } = {}) =>
  request<AutopayTriggerResponse>(
    "/billing/autopay/trigger",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("autopay-triggered");
    return result;
  });

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
  ).then((result) => {
    notifyDataChanged("payment-verified");
    return result;
  });

export const getCallConfig = async () =>
  request<CallConfig>("/exotel/config");

export const getPublicCallConfig = async () =>
  request<CallConfig>("/exotel/config");

export const getCallSessions = async (limit = 12) =>
  request<{ sessions: CallSession[]; credit_cost: number }>(`/call/sessions?limit=${limit}`, undefined, { auth: true });

export const initiateOutboundCall = async (payload: { phone_number: string; purpose: string }) =>
  request<Record<string, unknown>>(
    "/call/outbound",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("outbound-call-started");
    return result;
  });

export const startExotelCall = async (payload: { customer_number: string; business_id?: string }) =>
  request<Record<string, unknown>>(
    "/call/start",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("exotel-call-started");
    return result;
  });

export const simulateExotelIncoming = async (payload: { customer_number?: string; business_id?: string }) =>
  request<SimulatedIncomingCall>(
    "/exotel/simulate-incoming",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("exotel-incoming-simulated");
    return result;
  });

export const sendTestEmail = async (to: string) =>
  request<{
    provider: string;
    id?: string | null;
    recipient?: string | null;
  }>(`/email/test?to=${encodeURIComponent(to)}`, undefined, { auth: true });

export const getSmsConfig = async () =>
  request<SmsConfig>("/sms/config", undefined, { auth: true });

export const sendSmsDemo = async (payload: { phoneNumber: string; message: string }) =>
  request<{ messageId?: string | null; phoneNumber: string }>(
    "/sms/send",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  );

export const getChatHistory = async (limit = 12) =>
  request<{ messages: ChatHistoryItem[]; count: number }>(`/ai/chat/history?limit=${limit}`, undefined, { auth: true });

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
  ).then((result) => {
    notifyDataChanged("ai-chat-sent");
    return result;
  });

export const startCustomerServiceSession = async () =>
  request<CustomerServiceSession>("/customer-service/start", {
    method: "POST",
  }, { auth: true });

export const sendCustomerServiceChat = async (payload: { sessionId: string; textMessage: string; languageCode?: string }) =>
  request<CustomerServiceReply>(
    "/customer-service/chat",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("customer-service-chat");
    return result;
  });

export const getVoiceStats = async () =>
  request<{ success: boolean; stats?: VoiceStatistics }>("/voice/statistics").then((result) => result.stats ?? {
    total: 0,
    with_name: 0,
    with_phone: 0,
    with_email: 0,
    today: 0,
  });

export const getRecentVoiceConversations = async (limit = 25) =>
  request<{ success: boolean; conversations?: VoiceConversation[] }>(`/voice/conversations/recent?limit=${limit}`, undefined, {
    auth: true,
  }).then((result) => result.conversations ?? []);

export const getCustomerSentimentStats = async () =>
  request<{ sentiment?: CustomerSentimentStats }>("/customer-service/stats/sentiment").then((result) => result.sentiment ?? {
    positive: 0,
    negative: 0,
    neutral: 0,
  });

export const getCustomerResolutionStats = async () =>
  request<{ resolution?: CustomerResolutionStats }>("/customer-service/stats/resolution").then((result) => result.resolution ?? {
    resolved: 0,
    unresolved: 0,
    rate: 0,
  });

export const getResolvedInteractions = async (limit = 50) =>
  request<{ interactions?: CustomerServiceInteraction[] }>(`/customer-service/interactions/resolved?limit=${limit}`).then(
    (result) => result.interactions ?? []
  );

export const getCustomerServiceActiveSessions = async () =>
  request<{ sessionIds?: string[] }>("/customer-service/active-sessions").then((result) => result.sessionIds ?? []);

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
  ).then((result) => {
    notifyDataChanged("business-created");
    return result;
  });

export const getSetupBusiness = async () => {
  try {
    return await request<SetupProfile>("/setup/business", undefined, { auth: true });
  } catch (error) {
    if (error instanceof LegacyApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const saveSetupBusiness = async (payload: SetupProfile) =>
  request<SetupProfile>(
    "/setup/business",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { auth: true }
  ).then((result) => {
    notifyDataChanged("setup-saved");
    return result;
  });

export const getSetupStatus = async () =>
  request<Record<string, unknown>>("/setup/status", undefined, { auth: true });
