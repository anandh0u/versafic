# Versafic Billing Demo Architecture

## Updated Frontend Structure

Core demo billing files now live in:

```text
frontend/src/
├── App.tsx
├── config/
│   └── billing.ts
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx
│   ├── billing/
│   │   ├── AutopayPanel.tsx
│   │   ├── PlanCard.tsx
│   │   └── SimulationActionCard.tsx
│   ├── layout/
│   │   └── DashboardShell.tsx
│   └── shared/
│       ├── BrandMark.tsx
│       ├── MetricCard.tsx
│       ├── Panel.tsx
│       ├── StatusBadge.tsx
│       └── UsageHistoryTable.tsx
├── hooks/
│   ├── BillingProvider.tsx
│   ├── billing-context.ts
│   └── useBilling.tsx
├── lib/
│   └── formatters.ts
├── pages/
│   ├── BillingPage.tsx
│   ├── BusinessProfilePage.tsx
│   ├── DemoLabPage.tsx
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── OverviewPage.tsx
│   └── RegisterPage.tsx
├── services/
│   ├── api.ts
│   └── billing-experience.ts
├── styles.css
└── types/
    └── index.ts
```

## What Was Built

- Public SaaS landing page with hero, billing story, pricing, contact CTA, and professional positioning.
- Authenticated SaaS dashboard shell with overview, billing, demo lab, and business profile areas.
- Hybrid billing state engine:
  - real auth
  - real wallet/plans/payment flow where backend endpoints exist
  - local simulation for autopay, demo usage, low-balance states, and advanced billing storytelling
- Dedicated billing page with:
  - current balance
  - active plan
  - Razorpay purchase buttons
  - instant demo top-up buttons
  - recharge history
  - usage history
  - autopay UX
- Demo lab page with usage simulation buttons for:
  - AI chat
  - Sarvam STT
  - voice processing
  - 1-minute call
  - 5-minute call
  - premium AI call
  - recording processing
  - onboarding AI setup
- Business profile view with workflow readiness and onboarding/AI setup status.

## Credit Model

- INR 1 = 10 credits
- AI chat request = 5 credits
- Sarvam STT request = 10 credits
- Voice processing action = 10 credits
- Standard call minute = 20 credits
- Premium AI call minute = 30 credits
- Recording processing = 5 credits
- Onboarding AI setup action = 10 credits

All of these values are configurable in:

```text
frontend/src/config/billing.ts
```

## Frontend Integration Approach

The demo uses a hybrid billing model:

- `live`
  - use backend billing endpoints for everything practical
- `hybrid`
  - use backend auth, wallet, plans, and Razorpay top-up where available
  - use local demo state for simulation, autopay, richer billing history, and client storytelling
- `mock`
  - run the full billing story without depending on backend billing data

Set this in:

```text
frontend/.env.example
```

## Suggested Backend API Contracts

Recommended frontend-facing contracts:

### `GET /billing/wallet`

```json
{
  "status": "success",
  "data": {
    "balance_credits": 1990,
    "transactions": []
  }
}
```

### `GET /billing/transactions`

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "txn_123",
        "type": "usage",
        "credits_delta": -20,
        "source": "voice_call",
        "reference_id": "CALL_324",
        "status": "completed",
        "created_at": "2026-03-22T10:00:00.000Z"
      }
    ]
  }
}
```

### `POST /billing/create-order`

Existing backend flow already supports this:

```json
{
  "plan_id": "growth"
}
```

### `POST /billing/verify-payment`

Existing backend flow already supports this:

```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "sig_xxx"
}
```

### `POST /billing/autopay/enable`

```json
{
  "selected_plan": "growth",
  "trigger_type": "low_balance",
  "threshold_credits": 100,
  "payment_method_reference": "pm_razorpay_4242"
}
```

### `POST /billing/autopay/disable`

```json
{
  "enabled": false
}
```

### `POST /billing/autopay/trigger`

```json
{
  "triggered_by": "manual_retry",
  "force": true
}
```

This endpoint is useful for demos. It runs a real backend autopay recharge, records an autopay attempt, and updates wallet history immediately.

### `GET /billing/autopay/status`

```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "selected_plan": "growth",
    "trigger_type": "low_balance",
    "threshold_credits": 100,
    "status": "active",
    "last_autopay_at": "2026-03-20T12:00:00.000Z",
    "next_autopay_attempt_at": "2026-03-23T12:00:00.000Z"
  }
}
```

### `POST /billing/demo/simulate-usage`

```json
{
  "action": "simulate-call-5m"
}
```

Suggested response:

```json
{
  "status": "success",
  "data": {
    "balance_credits": 890,
    "transaction_id": "txn_demo_456",
    "autopay_triggered": false
  }
}
```

### `GET /billing/plans`

Already present in the backend.

### `GET /billing/usage-summary`

```json
{
  "status": "success",
  "data": {
    "month_credits_used": 1240,
    "total_calls_handled": 38,
    "ai_chats_used": 124,
    "sarvam_requests": 18,
    "voice_processes": 24,
    "recordings_processed": 11
  }
}
```

## Suggested DB Tables

### `autopay_settings`

```sql
CREATE TABLE autopay_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  selected_plan VARCHAR(50) NOT NULL,
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('low_balance', 'plan_expiry')),
  threshold_credits INTEGER NOT NULL DEFAULT 100,
  payment_method_reference VARCHAR(255),
  last_autopay_at TIMESTAMPTZ,
  next_autopay_attempt_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `usage_events`

```sql
CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id BIGINT,
  source VARCHAR(50) NOT NULL,
  source_label VARCHAR(100) NOT NULL,
  credits_burned INTEGER NOT NULL,
  reference_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `autopay_attempts`

```sql
CREATE TABLE autopay_attempts (
  id BIGSERIAL PRIMARY KEY,
  autopay_settings_id BIGINT NOT NULL REFERENCES autopay_settings(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_plan VARCHAR(50) NOT NULL,
  credits_added INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL,
  razorpay_payment_id VARCHAR(255),
  failure_reason TEXT,
  triggered_by VARCHAR(30) NOT NULL CHECK (triggered_by IN ('low_balance', 'plan_expiry', 'manual_retry')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Build / Run

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Recommended env

```env
VITE_API_URL=http://localhost:5000
VITE_BILLING_MODE=hybrid
```

## Vercel Readiness

- Vite production build passes.
- SPA routing already exists via `frontend/vercel.json`.
- Frontend environment values can be set in Vercel:
  - `VITE_API_URL`
  - `VITE_BILLING_MODE`
- For real client sharing:
  - deploy backend to a public URL
  - set backend `CORS_ORIGINS` to the frontend domain
  - set frontend `VITE_API_URL` to the public backend URL

## Demo Flow

1. Open landing page.
2. Register or log in.
3. Show Overview page metrics and burn rules.
4. Open Billing page and point out balance, active plan, and autopay status.
5. Use Razorpay top-up or instant demo top-up.
6. Open Demo Lab and simulate AI chat, call minutes, STT, or recordings.
7. Show usage history update immediately.
8. Let balance drop low enough to trigger low-balance messaging or autopay.
9. Open Business page to reinforce this is a full product, not just a payment screen.
