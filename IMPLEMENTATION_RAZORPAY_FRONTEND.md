# Razorpay Integration & Frontend Billing - Complete Guide

## 1. Razorpay Integration Architecture

### Payment Flow Diagram

```
Frontend                        Backend                         Razorpay
   |                              |                               |
   |-- POST /create-order ------->|                               |
   |                              |--- Create Order Req ---------->|
   |                              |<--- Order Created {orderId} ---|
   |                              |                               |
   |<-- {orderId, keyId, amount}--|                               |
   |                              |                               |
   | Open Razorpay Checkout Modal |                               |
   |                              |                               |
   | User Fills Payment Form      |                               |
   |                              |                               |
   | User Confirms Payment        |                               |
   |------- Authorize Payment ---------->|                        |
   |                              |                               |
   |<-- Payment Successful -------|<-- Webhook (payment.captured)-|
   |                              |                               |
   |-- POST /verify-payment ----->|                               |
   |  {orderId, paymentId, sig}   |--- Verify Signature --------->|
   |                              |<--- Verified (✓) -------------|
   |                              |                               |
   |<-- Credits Added {newBalance}|                               |
   |                              |                               |
```

### Key Razorpay Endpoints

```
API Base: https://api.razorpay.com/v1
Auth: Basic {base64(keyId:keySecret)}

POST   /orders                    - Create order
GET    /orders/{orderId}         - Fetch order status
POST   /orders/{orderId}/receipt - Get receipt
GET    /payments/{paymentId}     - Fetch payment details
GET    /payments                 - List payments
```

---

## 2. Razorpay Service Implementation

### RazorpayService Class

```typescript
// src/services/razorpay.service.ts

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    
    if (!this.keyId || !this.keySecret) {
      logger.warn('Razorpay not configured');
    }
  }

  /**
   * Create Razorpay Order
   * Returns order ID for Razorpay Checkout frontend
   */
  async createOrder(params: {
    amount: number;        // In paise (₹1 = 100 paise)
    currency: string;      // Usually 'INR'
    receipt: string;       // Internal receipt ID
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`)
      .toString('base64');

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes || {}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('Razorpay order creation failed', undefined, {
        status: response.status,
        error
      });
      throw new Error(`Failed to create order: ${response.status}`);
    }

    const order = await response.json() as RazorpayOrder;
    logger.info('Order created', {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

    return order;
  }

  /**
   * Verify Payment Signature
   * HMAC-SHA256(order_id|payment_id, keySecret) === signature
   * 
   * Must verify to prevent fraud
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const signatureString = `${razorpayOrderId}|${razorpayPaymentId}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(signatureString)
      .digest('hex');

    const isValid = razorpaySignature === expectedSignature;

    if (!isValid) {
      logger.warn('Invalid payment signature', {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId
      });
    }

    return isValid;
  }

  /**
   * Verify Webhook Signature
   * Called when Razorpay sends webhook events
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('Webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Fetch Payment Details from Razorpay
   * For additional verification or dispute resolution
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`)
      .toString('base64');

    const response = await fetch(
      `${this.baseUrl}/payments/${paymentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch payment: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check if Razorpay is properly configured
   */
  isConfigured(): boolean {
    return !!(this.keyId && this.keySecret);
  }

  /**
   * Get public key for frontend Razorpay Checkout
   */
  getKeyId(): string {
    return this.keyId;
  }
}

export const razorpayService = new RazorpayService();
```

### Security Checklist

✅ **Signature Verification**:
- Always verify `razorpay_signature` before crediting user
- Use HMAC-SHA256
- Prevent replay attacks

✅ **Order Verification**:
- Verify order belongs to user
- Verify amount matches
- Check order status

✅ **Error Handling**:
- Never credit without verification
- Log all payment attempts
- Alert on suspicious patterns

❌ **Never Do**:
- Trust amount from frontend
- Skip signature verification
- Credit before webhook confirmation
- Store payment details (use Razorpay)

---

## 3. Billing Controller - Complete Endpoints

### POST /billing/create-order

Creates a Razorpay order for credit purchase.

```typescript
export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, ErrorCode.UNAUTHORIZED, '');

    const { plan_id, amount_paise, credits } = req.body;

    // Validate input
    if (!plan_id && (!amount_paise || !credits)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Provide plan_id or (amount_paise + credits)'
      );
    }

    // Create order via wallet service
    const orderResponse = await walletService.createOrder(
      userId,
      plan_id,
      amount_paise,
      credits
    );

    logger.info('Order created', { userId, orderId: orderResponse.order_id });

    res.status(201).json({
      status: 'success',
      data: orderResponse
    });
  } catch (error) {
    next(error);
  }
};
```

### POST /billing/verify-payment

Verifies Razorpay signature and adds credits.

```typescript
export const verifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, ErrorCode.UNAUTHORIZED, '');

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Missing payment fields');
    }

    // Verify and add credits
    const result = await walletService.verifyPaymentAndAddCredits(
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    logger.info('Payment verified', {
      userId,
      orderId: razorpay_order_id,
      newBalance: result.wallet.balance_credits
    });

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        balance_credits: result.wallet.balance_credits
      }
    });
  } catch (error) {
    next(error);
  }
};
```

### GET /billing/plans

Lists available pricing plans.

```typescript
export const getPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        plans: PRICING_PLANS.map(plan => ({
          id: plan.id,
          name: plan.name,
          amount: plan.amount_paise / 100,
          amount_paise: plan.amount_paise,
          credits: plan.credits,
          description: plan.description,
          savings_percent: plan.savings_percent || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
```

### POST /billing/autopay/trigger

Triggers demo or real autopay.

```typescript
export const triggerAutopay = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, ErrorCode.UNAUTHORIZED, '');

    const { triggered_by, force } = req.body;

    const result = await walletService.triggerAutopay({
      userId,
      triggeredBy: triggered_by || 'manual',
      force: force || false
    });

    logger.info('Autopay triggered', {
      userId,
      logId: result.log.id,
      status: result.log.status
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
```

---

## 4. Frontend Billing Page Components

### BillingPage.tsx

```typescript
// frontend/src/pages/BillingPage.tsx

import React, { useState, useEffect } from 'react';
import { useBilling } from '../hooks/useBilling';
import { useAuth } from '../hooks/useAuth';

export default function BillingPage() {
  const { user } = useAuth();
  const { workspace, purchasePlan, demoTopUp, triggerAutopay } = useBilling();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!workspace) {
    return <div>Loading billing information...</div>;
  }

  const handleBuy = async (planId: string) => {
    try {
      setError(null);
      setBusyPlanId(planId);
      await purchasePlan(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleDemo = async (planId: string) => {
    try {
      setError(null);
      setBusyPlanId(planId);
      await demoTopUp(planId);
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <div className="billing-container">
      <h1>Billing & Credits</h1>

      {/* Current Balance */}
      <CreditBalance
        balance={workspace.wallet.balance_credits}
        onBuyClick={() => document.getElementById('plans')?.scrollIntoView()}
      />

      {/* Autopay Panel */}
      <AutopayPanel
        enabled={workspace.autopay.settings.enabled}
        threshold={workspace.autopay.settings.threshold_credits}
        rechargeAmount={workspace.autopay.settings.recharge_amount}
        mode={workspace.autopay.settings.mode}
        pendingCheckout={workspace.autopay.pending_checkout}
        onEnable={triggerAutopay}
        onDisable={triggerAutopay}
      />

      {/* Plans */}
      <div id="plans" className="plans-section">
        <h2>Buy Credits</h2>
        <div className="plans-grid">
          {workspace.plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isBusy={busyPlanId === plan.id}
              onBuy={() => handleBuy(plan.id)}
              onDemo={() => handleDemo(plan.id)}
            />
          ))}
        </div>
      </div>

      {/* Usage History */}
      <UsageHistoryTable transactions={workspace.wallet.transactions} />

      {error && <ErrorAlert message={error} />}
    </div>
  );
}
```

### CreditBalance.tsx

```typescript
interface Props {
  balance: number;
  onBuyClick: () => void;
}

export function CreditBalance(props: Props) {
  const rupees = props.balance / 10;

  return (
    <div className="credit-card">
      <div className="credit-amount">
        <div className="amount-display">
          ₹{rupees.toFixed(2)}
        </div>
        <div className="credit-count">
          {props.balance} Credits
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={props.onBuyClick}
      >
        Buy Credits
      </button>

      <p className="info">
        1 Credit = ₹0.10 (1 Paise)
      </p>
    </div>
  );
}
```

### PlanCard.tsx

```typescript
interface Plan {
  id: string;
  name: string;
  amount: number;           // In rupees
  amount_paise: number;     // In paise
  credits: number;
  description: string;
  savings_percent?: number;
}

interface Props {
  plan: Plan;
  isBusy: boolean;
  onBuy: () => void;
  onDemo: () => void;
}

export function PlanCard(props: Props) {
  const { plan } = props;

  return (
    <div className="plan-card">
      <h3>{plan.name}</h3>

      <div className="plan-price">
        ₹{plan.amount.toFixed(2)}
      </div>

      <div className="plan-credits">
        <strong>{plan.credits}</strong> Credits
      </div>

      {plan.savings_percent > 0 && (
        <div className="badge-savings">
          Save {plan.savings_percent}%
        </div>
      )}

      <p className="plan-description">
        {plan.description}
      </p>

      <div className="plan-actions">
        <button
          className="btn-primary"
          onClick={props.onBuy}
          disabled={props.isBusy}
        >
          {props.isBusy ? 'Loading...' : 'Buy Now'}
        </button>

        <button
          className="btn-secondary"
          onClick={props.onDemo}
          disabled={props.isBusy}
        >
          Demo (Test Only)
        </button>
      </div>

      <p className="plan-info">
        Per Credit: ₹{(plan.amount / plan.credits).toFixed(3)}
      </p>
    </div>
  );
}
```

### AutopayPanel.tsx

```typescript
interface Props {
  enabled: boolean;
  threshold: number;
  rechargeAmount: number;
  mode: 'demo' | 'real';
  pendingCheckout?: {
    order_id: string;
    key_id: string;
    amount: number;
  };
  onEnable: (threshold: number, amount: number) => void;
  onDisable: () => void;
}

export function AutopayPanel(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [threshold, setThreshold] = useState(props.threshold);
  const [rechargeAmount, setRechargeAmount] = useState(props.rechargeAmount);

  return (
    <div className="autopay-panel">
      <h2>Smart Autopay</h2>

      <div className="autopay-status">
        {props.enabled ? (
          <>
            <span className="badge-active">✓ Active</span>
            <p>When credits fall below {props.threshold}, a payment will be triggered.</p>
            <p>Mode: <strong>{props.mode === 'demo' ? 'Demo (Test)' : 'Real'}</strong></p>
          </>
        ) : (
          <>
            <span className="badge-inactive">○ Disabled</span>
            <p>Enable autopay to get automatic credit recharge.</p>
          </>
        )}
      </div>

      {props.pendingCheckout && (
        <div className="pending-checkout">
          <h3>Complete Payment</h3>
          <p>A payment is awaiting your confirmation.</p>
          <RazorpayCheckout
            orderId={props.pendingCheckout.order_id}
            keyId={props.pendingCheckout.key_id}
            amount={props.pendingCheckout.amount}
          />
        </div>
      )}

      {isOpen && !props.pendingCheckout && (
        <div className="autopay-settings">
          <div className="setting-group">
            <label>Trigger Threshold (Credits)</label>
            <input
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
            />
          </div>

          <div className="setting-group">
            <label>Recharge Amount (₹)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={(rechargeAmount / 100).toFixed(2)}
              onChange={(e) =>
                setRechargeAmount(Math.round(parseFloat(e.target.value) * 100))
              }
            />
          </div>

          <div className="action-buttons">
            {props.enabled ? (
              <button
                className="btn-danger"
                onClick={() => {
                  props.onDisable();
                  setIsOpen(false);
                }}
              >
                Disable Autopay
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => {
                  props.onEnable(threshold, rechargeAmount);
                  setIsOpen(false);
                }}
              >
                Enable Autopay
              </button>
            )}

            <button
              className="btn-secondary"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        className="btn-secondary"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Hide Settings' : 'Configure'}
      </button>
    </div>
  );
}
```

### RazorpayCheckout.tsx

```typescript
interface Props {
  orderId: string;
  keyId: string;
  amount: number;           // In paise
  description?: string;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
}

export function RazorpayCheckout(props: Props) {
  const handlePayment = async () => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      const options = {
        key: props.keyId,
        order_id: props.orderId,
        amount: props.amount,
        currency: 'INR',
        name: 'Versafic',
        description: props.description || 'Credit Purchase',
        handler: async (response: any) => {
          // Verify payment on backend
          try {
            const verifyResponse = await fetch('/billing/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                razorpay_order_id: options.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (verifyResponse.ok) {
              const data = await verifyResponse.json();
              props.onSuccess?.(response.razorpay_payment_id);
              alert(`Payment successful! Credits added.`);
            } else {
              props.onError?.('Payment verification failed');
            }
          } catch (error) {
            props.onError?.(error instanceof Error ? error.message : 'Error');
          }
        },
        prefill: {
          email: localStorage.getItem('userEmail') || '',
          contact: localStorage.getItem('userPhone') || ''
        },
        theme: {
          color: '#3399cc'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    };
  };

  return (
    <button
      className="btn-primary btn-large"
      onClick={handlePayment}
    >
      Complete Payment
    </button>
  );
}
```

---

## 5. BillingProvider Context

```typescript
// frontend/src/hooks/BillingProvider.tsx

import React, { createContext, useEffect, useState } from 'react';
import { callApi } from '../services/api';

type BillingContextType = {
  workspace?: {
    plans: any[];
    wallet: {
      balance_credits: number;
      transactions: any[];
    };
    autopay: any;
  };
  purchasePlan: (planId: string) => Promise<{ order_id: string }>;
  demoTopUp: (planId: string) => Promise<void>;
  triggerAutopay: () => Promise<void>;
  refreshWallet: () => Promise<void>;
};

export const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<BillingContextType['workspace']>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillingInfo();
  }, []);

  const loadBillingInfo = async () => {
    try {
      setLoading(true);
      const [plans, wallet, autopay] = await Promise.all([
        callApi.getPlans(),
        callApi.getWallet(),
        callApi.getAutopayStatus()
      ]);

      setWorkspace({ plans, wallet, autopay });
    } catch (error) {
      console.error('Failed to load billing info', error);
    } finally {
      setLoading(false);
    }
  };

  const purchasePlan = async (planId: string) => {
    const order = await callApi.createOrder({ plan_id: planId });
    // Frontend will open Razorpay checkout with order.order_id
    return order;
  };

  const demoTopUp = async (planId: string) => {
    await callApi.demoPlan(planId);
    await loadBillingInfo(); // Refresh wallet
  };

  const triggerAutopay = async () => {
    await callApi.triggerAutopay();
    await loadBillingInfo();
  };

  const refreshWallet = async () => {
    const wallet = await callApi.getWallet();
    if (workspace) {
      setWorkspace({ ...workspace, wallet });
    }
  };

  return (
    <BillingContext.Provider
      value={{
        workspace,
        purchasePlan,
        demoTopUp,
        triggerAutopay,
        refreshWallet
      }}
    >
      {children}
    </BillingContext.Provider>
  );
}
```

---

## 6. API Service Layer

```typescript
// frontend/src/services/api.ts

export const callApi = {
  // Plans
  getPlans: async () => {
    const res = await fetch('/billing/plans');
    const data = await res.json();
    return data.data.plans;
  },

  // Orders
  createOrder: async (params: { plan_id?: string }) => {
    const res = await fetch('/billing/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  // Payment Verification
  verifyPayment: async (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const res = await fetch('/billing/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  // Wallet
  getWallet: async () => {
    const res = await fetch('/billing/wallet', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await res.json();
    return data.data;
  },

  // Autopay
  getAutopayStatus: async () => {
    const res = await fetch('/billing/autopay/status', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await res.json();
    return data.data;
  },

  triggerAutopay: async () => {
    const res = await fetch('/billing/autopay/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  // Demo
  demoPlan: async (planId: string) => {
    const res = await fetch('/billing/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ plan_id: planId, is_demo: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  }
};
```

---

## 7. Frontend Types

```typescript
// frontend/src/types/index.ts

export interface User {
  id: number;
  email: string;
  name?: string;
  phoneNumber?: string;
  callConsent: boolean;
  callOptOut: boolean;
}

export interface Plan {
  id: string;
  name: string;
  amount: number;           // In rupees
  amount_paise: number;
  credits: number;
  description: string;
}

export interface Wallet {
  balance_credits: number;
  transactions: Transaction[];
}

export interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  credits: number;
  source: string;
  description: string;
  created_at: string;
}

export interface AutopaySettings {
  enabled: boolean;
  threshold_credits: number;
  recharge_amount: number;
  mode: 'demo' | 'real';
  status: string;
}

export type CallPurpose =
  | 'enquiry_follow_up'
  | 'missed_call_callback'
  | 'support_call'
  | 'booking_confirmation';
```

---

## 8. Testing Payment Flow

### Test Razorpay Cards (Test Mode)

```
Success:   4111111111111111, CVV: 123, Exp: 12/25
Failed:    4111111111111110, CVV: 123, Exp: 12/25
Decline:   5105105105105100, CVV: 123, Exp: 12/25
```

### Test Flow

1. Go to BillingPage
2. Click "Buy Credits"
3. Select any plan
4. Click "Buy Now"
5. Razorpay modal opens
6. Enter test card (4111111111111111)
7. Fill CVV (123) and date (any future)
8. Click Pay
9. Notification: "Payment successful"
10. Credits added to wallet

### Verify Payment

```bash
# Check payment in Razorpay Dashboard
# https://dashboard.razorpay.com

# Check in database
SELECT * FROM payments 
WHERE razorpay_order_id = 'order_ABC123'
AND status = 'captured';
```

---

## 9. Deployment Checklist

✅ **Environment Setup**:
- [ ] `RAZORPAY_KEY_ID` set  
- [ ] `RAZORPAY_KEY_SECRET` set
- [ ] `RAZORPAY_WEBHOOK_SECRET` set

✅ **Webhook Configuration**:
- [ ] Razorpay dashboard: Add webhook URL
- [ ] URL: `https://yourdomain.com/billing/webhook`
- [ ] Events: `payment.captured`, `payment.failed`

✅ **Frontend Build**:
- [ ] Razorpay script loads correctly
- [ ] Checkout modal opens
- [ ] Payment verified on success

✅ **Security**:
- [ ] HTTPS enforced
- [ ] Signature verification active
- [ ] Rate limiting enabled
- [ ] CORS configured

---

## 10. Monitoring

### Metrics to Track

- **Success Rate**: % of completed payments
- **Avg Transaction Value**: ₹ per payment
- **Failed Payments**: Monitor decline reasons
- **Autopay Triggers**: How often triggered
- **Credit Depletion Rate**: Average daily burn

### Logs to Monitor

```bash
# Payment logs
grep "Payment verified" logs/*.log

# Order creation
grep "Order created" logs/*.log

# Errors
grep "ERROR.*payment\|ERROR.*razorpay" logs/*.log
```

---

**Version**: 1.0  
**Last Updated**: March 28, 2026
