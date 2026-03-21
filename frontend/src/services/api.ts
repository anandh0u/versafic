import type { AuthResponse, CreateOrderResponse, WalletResponse } from '../types';

// API Service - Handles all backend API calls

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type ApiErrorResponse = {
  message?: string;
};

type ApiMessageResponse = {
  status: string;
  message: string;
};

// Get token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

// Generic fetch wrapper with auth
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = (await response.json()) as T & ApiErrorResponse;

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}

// Auth API
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

  googleAuth: (credential: string) =>
    apiRequest<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
};

// Billing API
export const billingApi = {
  getPlans: () => apiRequest('/billing/plans'),

  getWallet: () => apiRequest<WalletResponse>('/billing/wallet'),

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
    apiRequest<ApiMessageResponse>('/billing/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      }),
    }),

  checkBalance: (required?: number) =>
    apiRequest(`/billing/check-balance${required ? `?required=${required}` : ''}`),
};

// User/Setup API
export const userApi = {
  getProfile: () => apiRequest('/setup/business'),
  
  getStatus: () => apiRequest('/setup/status'),
  
  updateBusiness: (data: Record<string, unknown>) =>
    apiRequest('/setup/business', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export default {
  auth: authApi,
  billing: billingApi,
  user: userApi,
};
