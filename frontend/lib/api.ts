'use client';

import { User, AuthResponse, BusinessProfile, Wallet, Plan, CallConfig } from '@/types/index';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(skipAuth = false): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // Auth endpoints
  async register(email: string, password: string, username?: string, accountType?: string) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: await this.getHeaders(true),
      body: JSON.stringify({ email, password, username, accountType }),
    });
    return this.handleResponse<AuthResponse>(response);
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: await this.getHeaders(true),
      body: JSON.stringify({ email, password }),
    });
    const data = await this.handleResponse<AuthResponse>(response);

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    }

    return data;
  }

  async validateEmail(email: string) {
    const response = await fetch(`${this.baseUrl}/auth/validate-email`, {
      method: 'POST',
      headers: await this.getHeaders(true),
      body: JSON.stringify({ email }),
    });
    return this.handleResponse(response);
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    const data = await this.handleResponse<{ user: User }>(response);
    return data.user;
  }

  async logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: await this.getHeaders(true),
      body: JSON.stringify({ refreshToken }),
    });
    const data = await this.handleResponse<AuthResponse>(response);

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }

    return data;
  }

  // Setup/Business endpoints
  async setupBusiness(businessData: Partial<BusinessProfile>) {
    const response = await fetch(`${this.baseUrl}/setup/business`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify(businessData),
    });
    return this.handleResponse<BusinessProfile>(response);
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    const response = await fetch(`${this.baseUrl}/setup/business`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse<BusinessProfile>(response);
  }

  async getSetupStatus() {
    const response = await fetch(`${this.baseUrl}/setup/status`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse(response);
  }

  // Billing endpoints
  async getPlans(): Promise<Plan[]> {
    const response = await fetch(`${this.baseUrl}/billing/plans`, {
      method: 'GET',
      headers: await this.getHeaders(true),
    });
    return this.handleResponse<Plan[]>(response);
  }

  async getWallet(): Promise<Wallet> {
    const response = await fetch(`${this.baseUrl}/billing/wallet`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse<Wallet>(response);
  }

  async createOrder(planId: string, amount: number) {
    const response = await fetch(`${this.baseUrl}/billing/create-order`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({ planId, amount }),
    });
    return this.handleResponse(response);
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string) {
    const response = await fetch(`${this.baseUrl}/billing/verify-payment`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({ orderId, paymentId, signature }),
    });
    return this.handleResponse(response);
  }

  async checkBalance() {
    const response = await fetch(`${this.baseUrl}/billing/check-balance`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse(response);
  }

  async getAutopayStatus() {
    const response = await fetch(`${this.baseUrl}/billing/autopay/status`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse(response);
  }

  async enableAutopay(threshold: number, amount: number) {
    const response = await fetch(`${this.baseUrl}/billing/autopay/enable`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({ threshold, amount }),
    });
    return this.handleResponse(response);
  }

  async disableAutopay() {
    const response = await fetch(`${this.baseUrl}/billing/autopay/disable`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({}),
    });
    return this.handleResponse(response);
  }

  // Call endpoints
  async getCallConfig(): Promise<CallConfig> {
    const response = await fetch(`${this.baseUrl}/call/config`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse<CallConfig>(response);
  }

  async getPublicCallConfig(businessId: string): Promise<CallConfig> {
    const response = await fetch(`${this.baseUrl}/call/public-config?businessId=${businessId}`, {
      method: 'GET',
      headers: await this.getHeaders(true),
    });
    return this.handleResponse<CallConfig>(response);
  }

  async initiateOutboundCall(phoneNumber: string) {
    const response = await fetch(`${this.baseUrl}/call/outbound`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({ phoneNumber }),
    });
    return this.handleResponse(response);
  }

  async getCallSessions() {
    const response = await fetch(`${this.baseUrl}/call/sessions`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse(response);
  }

  async getCallRecordings() {
    const response = await fetch(`${this.baseUrl}/call/recordings`, {
      method: 'GET',
      headers: await this.getHeaders(false),
    });
    return this.handleResponse(response);
  }

  // Business endpoints
  async searchBusinesses(page: number = 1, limit: number = 10) {
    const response = await fetch(
      `${this.baseUrl}/business?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: await this.getHeaders(true),
      }
    );
    return this.handleResponse(response);
  }

  async getBusinessByEmail(email: string): Promise<BusinessProfile> {
    const response = await fetch(`${this.baseUrl}/business/${email}`, {
      method: 'GET',
      headers: await this.getHeaders(true),
    });
    return this.handleResponse<BusinessProfile>(response);
  }
}

export const apiClient = new ApiClient();
