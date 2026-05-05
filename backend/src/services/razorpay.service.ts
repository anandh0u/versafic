/**
 * Razorpay Service
 * Handles all Razorpay API interactions for payment processing
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

// Razorpay types
interface RazorpayOrderParams {
  amount: number;      // Amount in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

interface RazorpayPaymentLinkParams {
  amount: number;
  currency: string;
  accept_partial: boolean;
  reference_id: string;
  description: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notify?: {
    sms?: boolean;
    email?: boolean;
  };
  reminder_enable?: boolean;
  notes?: Record<string, string>;
  callback_url?: string;
  callback_method?: 'get' | 'post';
}

interface RazorpayPaymentLink {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  reference_id: string;
  description: string;
  short_url: string;
  status: string;
  created_at: number;
}

interface PaymentLinkSignatureParams {
  paymentLinkId: string;
  paymentLinkReferenceId: string;
  paymentLinkStatus: string;
  paymentId: string;
  signature: string;
}

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private baseUrl: string = 'https://api.razorpay.com/v1';

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!this.keyId || !this.keySecret) {
      logger.warn('Razorpay credentials not configured. Payment features will be disabled.');
    }
  }

  /**
   * Check if Razorpay is properly configured
   */
  isConfigured(): boolean {
    return !!(this.keyId && this.keySecret);
  }

  /**
   * Get the public key ID for frontend checkout
   */
  getKeyId(): string {
    return this.keyId;
  }

  /**
   * Create a Razorpay order
   * This is the first step in the payment flow
   */
  async createOrder(params: RazorpayOrderParams): Promise<RazorpayOrder> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured');
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Razorpay order creation failed', undefined, { 
        status: response.status, 
        error: errorData 
      });
      throw new Error(`Failed to create Razorpay order: ${response.status}`);
    }

    const order = await response.json() as RazorpayOrder;
    
    logger.info('Razorpay order created', { 
      orderId: order.id, 
      amount: order.amount,
      currency: order.currency 
    });

    return order;
  }

  /**
   * Create a Razorpay payment link.
   * Used as a reliable fallback when browser extensions block embedded checkout.js.
   */
  async createPaymentLink(params: RazorpayPaymentLinkParams): Promise<RazorpayPaymentLink> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured');
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Razorpay payment link creation failed', undefined, {
        status: response.status,
        error: errorData
      });
      throw new Error(`Failed to create Razorpay payment link: ${response.status}`);
    }

    const paymentLink = await response.json() as RazorpayPaymentLink;

    logger.info('Razorpay payment link created', {
      paymentLinkId: paymentLink.id,
      amount: paymentLink.amount,
      currency: paymentLink.currency
    });

    return paymentLink;
  }

  /**
   * Verify payment signature using HMAC SHA256
   * This ensures the payment callback is authentic and from Razorpay
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured');
    }

    // Create the signature verification string
    const signatureString = `${razorpayOrderId}|${razorpayPaymentId}`;
    
    // Generate expected signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(signatureString)
      .digest('hex');

    // Compare signatures
    const isValid = razorpaySignature === expectedSignature;

    if (!isValid) {
      logger.warn('Payment signature verification failed', {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId
      });
    }

    return isValid;
  }

  /**
   * Verify Razorpay payment link callback signature.
   */
  verifyPaymentLinkSignature(params: PaymentLinkSignatureParams): boolean {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured');
    }

    const signatureString = [
      params.paymentLinkId,
      params.paymentLinkReferenceId,
      params.paymentLinkStatus,
      params.paymentId,
    ].join('|');

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(signatureString)
      .digest('hex');

    const isValid = params.signature === expectedSignature;

    if (!isValid) {
      logger.warn('Payment link signature verification failed', {
        paymentLinkId: params.paymentLinkId,
        paymentId: params.paymentId,
      });
    }

    return isValid;
  }

  /**
   * Verify webhook signature
   * Used for server-to-server payment confirmation
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.warn('Razorpay webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Fetch payment details from Razorpay (optional - for additional verification)
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured');
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch payment details: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const razorpayService = new RazorpayService();
