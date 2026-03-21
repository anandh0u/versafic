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
