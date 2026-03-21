// API Types

export interface User {
  id: number;
  email: string;
  name?: string;
  isOnboarded: boolean;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface WalletResponse {
  status: string;
  data: {
    balance_credits: number;
    transactions: Transaction[];
  };
}

export interface Transaction {
  id: number;
  type: 'topup' | 'usage_deduction' | 'refund' | 'adjustment';
  credits: number;
  source: string;
  description: string;
  created_at: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  amount: number;
  amount_paise: number;
  credits: number;
  description: string;
}

export interface CreateOrderResponse {
  status: string;
  data: {
    order_id: string;
    key_id: string;
    amount: number;
    currency: string;
    credits: number;
    name: string;
    description: string;
  };
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
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

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Extend Window for Razorpay
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}
