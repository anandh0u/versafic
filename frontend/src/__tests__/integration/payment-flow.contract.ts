/**
 * Payment contract reference.
 *
 * This file documents the Razorpay request/response contract the UI expects.
 * It is intentionally not an executable test suite.
 */

export const PAYMENT_FLOW_CONTRACT = {
  createOrder: {
    name: 'Create a Razorpay order for a plan purchase',
    request: {
      endpoint: 'POST /billing/create-order',
      body: { plan_id: 'pro' },
    },
    response: {
      order_id: 'order_XXXXXXXXXX',
      key_id: 'rzp_test_XXXXXXXXXX',
      amount: 49900,
      currency: 'INR',
      credits: 4990,
      name: 'Versafic',
      description: 'Pro - 4990 credits for enterprises',
    },
  },

  verifyPayment: {
    name: 'Verify Razorpay payment signature before adding credits',
    request: 'POST /billing/verify-payment',
    requires: [
      'razorpay_order_id',
      'razorpay_payment_id',
      'razorpay_signature',
    ],
    success: {
      status: 'success',
      data: {
        balance_credits: 'previous balance + purchased credits',
      },
    },
    failure: {
      status: 'error',
      message: 'Invalid payment signature',
    },
    safeguards: [
      'Signature verification happens server-side only.',
      'The payment order must belong to the authenticated user.',
      'Already-paid orders must stay idempotent.',
    ],
  },

  cancellation: {
    name: 'Handle checkout dismissal cleanly',
    expectations: [
      'Closing the Razorpay modal does not add credits.',
      'The order remains in created state until a valid payment is verified.',
      'The same pending checkout can be resumed without silently charging the user.',
    ],
  },

  realModeAutopay: {
    name: 'Trigger-based compliant autopay recharge',
    flow: [
      'Balance drops below threshold.',
      'Backend creates an autopay log and, in real mode, a Razorpay order.',
      'Frontend receives { requires_user_action: true, checkout }. ',
      'User completes checkout explicitly.',
      'Backend verifies payment and marks the autopay log completed.',
    ],
    exampleRecharge: {
      amount: 19900,
      credits: 1990,
      mode: 'real',
      log_status: 'pending_checkout -> completed',
    },
  },

  demoModeAutopay: {
    name: 'Instant demo recharge',
    expectations: [
      'Credits are added immediately in demo mode.',
      'The recharge is logged as demo_autopay in the wallet ledger and completed in autopay_logs.',
      'No Razorpay checkout is opened and no real money is charged.',
    ],
  },
};

