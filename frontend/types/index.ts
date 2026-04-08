export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  accountType?: 'personal' | 'business';
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface BusinessProfile {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  website?: string;
  country: string;
  phone: string;
  description?: string;
  logo?: string;
}

export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  balance: number;
  credits: number;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  currency: string;
}

export interface CallConfig {
  phoneNumber: string;
  aiEnabled: boolean;
  recordingEnabled: boolean;
}

export interface ApiError {
  success: false;
  error: string;
  statusCode?: number;
}
