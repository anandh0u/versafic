/**
 * Billing contract reference.
 *
 * This file documents the wallet and billing flows the frontend is built against.
 * It is intentionally not an executable test suite.
 */

export const BILLING_FLOW_CONTRACT = {
  walletOverview: {
    name: 'Fetch wallet balance and ledger',
    endpoint: 'GET /billing/wallet',
    expects: {
      balance_credits: 'number >= 0',
      transactions: 'credit transaction[]',
    },
    behavior: [
      'Show rupee equivalent as credits / 10.',
      'Render top-ups, usage deductions, refunds, and autopay activity in history.',
      'Warn when balance drops below the configured low-balance threshold.',
    ],
  },

  balanceGuard: {
    name: 'Block protected actions when credits are too low',
    endpoint: 'GET /billing/check-balance?required=<credits>',
    examples: [
      'Outbound or inbound call: required=20 for the one-minute call window.',
      'AI chat request: required=2.',
    ],
    expects: {
      balance_credits: 'number',
      required_credits: 'number',
      has_sufficient_credits: 'boolean',
    },
    edgeCases: [
      'Exactly equal balance should still pass.',
      'Concurrent deductions must remain atomic on the backend.',
      'If real-mode autopay creates a checkout, the action stays blocked until the user completes payment.',
    ],
  },

  insufficientCredits: {
    name: 'Return a clear low-balance recovery path',
    scenario: 'User has 10 credits and tries to place a 20-credit call.',
    expects: [
      'The action is blocked before Twilio or OpenAI work begins.',
      'The response can include autopay checkout information when compliant real-mode autopay is enabled.',
      'The UI should offer top-up or autopay recovery instead of retrying blindly.',
    ],
  },

  pricingPlans: {
    name: 'Load plan catalog',
    endpoint: 'GET /billing/plans',
    plans: [
      { id: 'starter', amount_paise: 9900, credits: 990 },
      { id: 'growth', amount_paise: 19900, credits: 1990 },
      { id: 'pro', amount_paise: 49900, credits: 4990 },
    ],
    uiRules: [
      'Display amount_paise / 100 as INR.',
      'Keep buy-now and demo-top-up actions separate.',
      'Autopay preset selection should map back to the same plan amounts.',
    ],
  },
};

