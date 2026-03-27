# Versafic SaaS Platform - Complete Architecture Guide

## System Overview

Versafic is an AI-powered customer service assistant platform combining:
- **AI**: OpenAI for intelligent responses
- **Telephony**: Twilio for voice calls (inbound/outbound)
- **Billing**: Razorpay for compliant credit-based payments
- **Speech-to-Text**: Sarvam AI for transcription

The system uses a **credit-based model** with compliant **trigger-based autopay** (no silent debits).

---

## 1. Credit System (Core Billing Model)

### Credit Costs
```typescript
// src/types/billing.types.ts
export const CREDIT_COSTS = {
  AI_CHAT_MESSAGE: 2,           // Per message
  SARVAM_STT_REQUEST: 1,        // Per transcription
  VOICE_PROCESS_ACTION: 1,      // Per voice action
  VOICE_CALL_MINUTE: 20,        // Per minute
  INBOUND_CALL_MINUTE: 20,      // Per minute (charged to business)
  OUTBOUND_CALL_MINUTE: 20,     // Per minute
  PREMIUM_CALL_MINUTE: 50,      // High-value calls
  RECORDING_PROCESSING: 5,      // Per recording
  ONBOARDING_AI_SETUP: 10,      // Setup cost
};
```

### Usage Deduction Flow

```
User Action (Call/Chat/AI)
    ↓
Check Credit Balance
    ↓
Balance < Cost?
    ├─→ YES → Insufficient Credits
    │         └─→ Check Autopay Settings
    │            ├─→ Autopay Disabled → Reject Request (402)
    │            ├─→ Autopay Enabled → Trigger Compliant Checkout
    │            │   └─→ Create ORDER (awaiting user confirmation)
    │            └─→ Return Response with Pending Checkout URL
    │
    └─→ NO  → Deduct Credits → Log Transaction → Allow Action
```

### Key Implementation Points

1. **Credit Enforcement is Mandatory**
   - All usage must be checked BEFORE execution
   - No over-the-limit operations permitted
   - Log ALL deductions

2. **Deduction Sources** (TransactionSource):
   ```typescript
   'ai_chat'
   'sarvam_stt'
   'voice_process'
   'voice_call'
   'inbound_call'
   'outbound_call'
   'premium_call'
   'recording_process'
   'onboarding_ai_setup'
   'razorpay'
   'autopay'
   'demo_autopay'
   'admin'
   'system'
   ```

---

## 2. Compliant Autopay System

### Design Principles

✅ **ALLOWED**:
- Trigger-based (user action initiates)
- Preset amounts & thresholds
- User confirmation required
- Log all attempts

❌ **NOT ALLOWED**:
- Silent automatic deduction
- Without explicit user action
- Cold card charging

### Autopay Settings Table

```sql
CREATE TABLE autopay_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    enabled BOOLEAN DEFAULT FALSE,
    threshold_credits INTEGER DEFAULT 100,      -- Trigger level
    recharge_amount INTEGER DEFAULT 19900,      -- In paise (₹199)
    mode VARCHAR(10) DEFAULT 'demo',            -- 'demo' | 'real'
    status VARCHAR(30) DEFAULT 'active',        -- 'active' | 'paused' | 'needs_attention'
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Autopay Flow

```
Credit Deduction Request
    ↓
Balance < Threshold?
    ├─→ NO → Allow Request, Skip Autopay
    └─→ YES → Check if Autopay Enabled
        ├─→ DISABLED → Reject (402 - Insufficient Credits)
        └─→ ENABLED
            ├─→ Pending Checkout Exists → Return Existing Checkout
            ├─→ No Pending → Create Razorpay Order
            │   └─→ Store in autopay_logs (status='pending_checkout')
            │   └─→ Return Checkout URL to Frontend
            └─→ Frontend Opens Checkout
                └─→ User Fills Razorpay Payment Form
                    └─→ Confirms Payment
                        └─→ Payment Webhook Verifies
                            └─→ Add Credits
                            └─→ Update autopay_logs (status='completed')
                            └─→ Retry Original Request
```

### Autopay Modes

#### DEMO MODE
- Simulates successful autopay
- Instantly adds credits
- Logged as 'demo_autopay' source
- **Use for testing/sandbox**

**Implementation**:
```typescript
async demoPay(userId: number, plan: PricingPlan) {
  const credits = plan.credits;
  
  // Create demo log
  const log = await billingModel.createAutopayLog({
    userId,
    amount: plan.amount_paise,
    credits,
    status: 'completed',
    mode: 'demo',
    triggeredReason: 'low_balance'
  });
  
  // Add credits directly
  const wallet = await billingModel.updateWalletBalance(userId, credits);
  
  return { log, wallet };
}
```

#### REAL MODE
- Creates Razorpay order
- Requires user payment confirmation
- Logs payment details
- **Use for production**

**Implementation**:
```typescript
async triggerRealAutopay(
  userId: number,
  settings: AutopaySettings
) {
  // Create Razorpay order
  const order = await razorpayService.createOrder({
    amount: settings.recharge_amount,
    currency: 'INR',
    receipt: `AP-${userId}-${Date.now()}`
  });
  
  // Store pending log
  const log = await billingModel.createAutopayLog({
    userId,
    amount: settings.recharge_amount,
    credits: calculateCredits(settings.recharge_amount),
    status: 'pending_checkout',
    mode: 'real',
    razorpay_order_id: order.id
  });
  
  // Return checkout info
  return {
    order_id: order.id,
    key_id: razorpayService.getKeyId(),
    amount: settings.recharge_amount,
    currency: 'INR',
    // Frontend opens Razorpay with this
  };
}
```

### Autopay Logs Table

```sql
CREATE TABLE autopay_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,                    -- In paise
    credits INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL,                -- See below
    triggered_reason VARCHAR(50) NOT NULL,      -- 'low_balance' | 'manual'
    mode VARCHAR(10) NOT NULL,                  -- 'demo' | 'real'
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Status Values:
-- 'pending_checkout'     - Awaiting user payment
-- 'completed'            - Successfully charged
-- 'failed'               - Payment failed
-- 'skipped'              - Balance was sufficient
-- 'blocked'              - Another checkout pending
```

---

## 3. Call Consent & Safety (Anti-Spam)

### User Fields

```sql
ALTER TABLE users ADD COLUMN (
    call_consent BOOLEAN DEFAULT FALSE,         -- Explicit consent
    call_opt_out BOOLEAN DEFAULT FALSE,         -- User said "STOP"
    name VARCHAR(255),
    phone_number VARCHAR(20) UNIQUE
);
```

### Rules for Outbound Calls

**ALLOW ONLY IF:**
```typescript
if (user.call_consent && !user.call_opt_out) {
  // Safe to call
} else {
  // FORBIDDEN
  throw new AppError(403, 'Call not consented');
}
```

**RATE LIMITS:**
- Max 2 calls per day per number
- 24-hour cooldown between calls to same number
- Log all attempts

**ALLOWED PURPOSES:**
```typescript
type CallPurpose = 
  | 'enquiry_follow_up'
  | 'missed_call_callback'
  | 'support_call'
  | 'booking_confirmation';
```

**BLOCKED:**
- Cold calling
- Unknown users
- Random promotions

### Call Intro (Mandatory)

```
AI Must Say:
"Hello, this is an AI assistant from [Business Name]"

Must Offer Opt-Out:
"You can say STOP to avoid future calls"

If User Says STOP:
→ Set call_opt_out = TRUE
→ Stop all future outbound calls
→ Confirm: "You've been added to our do-not-call list"
```

---

## 4. Outbound Call System

### API Endpoint

**POST** `/call/outbound`

```typescript
Request:
{
  phone_number: "+919876543210",
  purpose: "support_call"
}

Response:
{
  status: "success",
  data: {
    call_sid: "CA1234567890abcdef",
    status: "initiated",
    created_at: "2026-03-28T10:30:00Z"
  }
}
```

### Call Session Table

```sql
CREATE TABLE call_sessions (
    id SERIAL PRIMARY KEY,
    call_sid VARCHAR(64) UNIQUE NOT NULL,      -- Twilio ID
    user_id INTEGER REFERENCES users(id),
    phone_number VARCHAR(20),
    type VARCHAR(20) NOT NULL,                  -- 'incoming' | 'outgoing'
    purpose VARCHAR(50),                        -- See CallPurpose type
    status VARCHAR(30) NOT NULL,                -- See below
    cost_credits INTEGER NOT NULL DEFAULT 0,
    callback_requested BOOLEAN DEFAULT FALSE,
    parent_call_sid VARCHAR(64),               -- For callbacks
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Status Values:
-- 'initiated'      - Call starting
-- 'ringing'        - Calling party
-- 'in-progress'    - Connected
-- 'completed'      - Call finished
-- 'failed'         - No connection
-- 'rejected'       - Declined
```

### Call Flow (Outbound)

```
1. Frontend: User clicks "Trigger AI Call"
   └─→ Request: POST /call/outbound
       - phone_number: "+919876543210"
       - purpose: "support_call"

2. Backend: Validate Call
   - User has call_consent? ✓
   - User opted out? ✗
   - Count calls today < 2? ✓
   - 24h cooldown elapsed? ✓
   - Get business profile
   - Get call history

3. Generate Script (OpenAI)
   - Input: business name, type, purpose, history
   - Output: 30-60 second greeting

4. Initiate Twilio Call
   - Call user's phone number
   - Play AI intro
   - Execute script via TwiML endpoint

5. TwiML Endpoint: /call/outbound/twiml
   - Validate request signature (security)
   - Play greeting: "Hello, this is AI from [Business]"
   - Play generated script
   - Collect DTMF (keypresses)
   - Listen for "STOP" command

6. Response Handler: /call/outbound/respond
   - If "STOP" detected
     └─→ Set user.call_opt_out = TRUE
     └─→ Confirm opt-out via voice
   - Else → Log response

7. Webhook: /call/status
   - Track call progress (ringing → in-progress → completed)
   - Record final status

8. Webhook: /recording
   - Save recording URL
   - Store in call_sessions
   - Deduct call credits
```

### Call Script Generation

```typescript
// src/services/call-script.service.ts

async generateOutboundScript(params: {
  businessName: string;
  businessType: string;
  purpose: CallPurpose;
  recipientName?: string;
  callHistory: string[];
}): Promise<string>

// Example Output:
"Hi {name}, thanks for your interest in insurance. 
We wanted to follow up on your recent inquiry. 
Can you confirm if you'd still like to proceed with a quote?"
```

**Prompt Engineering**:
- Keep under 80 words
- Service-oriented (no sales pitch)
- Personalized (use history)
- Natural tone
- Ask for simple response

---

## 5. API Endpoints Reference

### Authentication
```
POST /auth/register        - Register user
POST /auth/login           - Login (JWT)
POST /auth/google          - Google OAuth
GET  /auth/verify          - Verify token
```

### Billing
```
GET  /billing/plans                    - List pricing plans
POST /billing/create-order             - Create Razorpay order
POST /billing/verify-payment           - Verify payment signature
GET  /billing/wallet                   - Get wallet balance & history
POST /billing/deduct                   - Deduct credits (testing)
GET  /billing/check-balance            - Quick balance check
GET  /billing/autopay/status           - Get autopay config
POST /billing/autopay/enable           - Enable autopay
POST /billing/disable                  - Disable autopay
POST /billing/autopay/trigger          - Trigger demo/test autopay
```

### Calls
```
POST /call/incoming                    - Twilio webhook (inbound)
POST /call/outbound                    - Initiate outbound
POST /call/outbound/twiml              - Twilio TwiML endpoint
POST /call/outbound/respond            - Handle DTMF/user response
POST /call/status                      - Call status webhook
POST /call/recording                   - Recording storage webhook
GET  /call/recordings                  - List user's recordings
GET  /call/recordings/:callSid         - Get specific recording
```

### Voice
```
POST /voice/process        - Process voice input
POST /voice/transcribe     - STT transcription
```

### AI
```
POST /ai/chat              - Chat API
```

### Business
```
POST /business/profile     - Create/update profile
GET  /business/profile     - Get profile
```

---

## 6. Database Schema (Complete)

### Users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    provider VARCHAR(50),                      -- 'password', 'google'
    provider_id VARCHAR(255),
    is_onboarded BOOLEAN DEFAULT FALSE,
    call_consent BOOLEAN DEFAULT FALSE,
    call_opt_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Wallets
```sql
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    business_id INTEGER REFERENCES business_profiles(id),
    balance_credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Payments (Razorpay)
```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    business_id INTEGER REFERENCES business_profiles(id),
    razorpay_order_id VARCHAR(255) UNIQUE,
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(255),
    amount_paise INTEGER NOT NULL,
    credits_to_add INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(30),                        -- 'created' | 'captured' | 'failed'
    payment_context VARCHAR(30) DEFAULT 'manual_topup',  -- 'manual_topup' | 'autopay'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Credit Transactions
```sql
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL,                 -- 'debit' | 'credit'
    credits INTEGER NOT NULL,
    source VARCHAR(50) NOT NULL,               -- See CREDIT_COSTS
    description TEXT,
    reference_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Autopay Settings
```sql
CREATE TABLE autopay_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    enabled BOOLEAN DEFAULT FALSE,
    threshold_credits INTEGER DEFAULT 100,
    recharge_amount INTEGER DEFAULT 19900,
    mode VARCHAR(10) DEFAULT 'demo',           -- 'demo' | 'real'
    status VARCHAR(30) DEFAULT 'active',
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Autopay Logs
```sql
CREATE TABLE autopay_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount INTEGER NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    triggered_reason VARCHAR(50) NOT NULL,
    mode VARCHAR(10) NOT NULL,
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

### Call Sessions
```sql
CREATE TABLE call_sessions (
    id SERIAL PRIMARY KEY,
    call_sid VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    phone_number VARCHAR(20),
    type VARCHAR(20) NOT NULL,
    purpose VARCHAR(50),
    status VARCHAR(30) NOT NULL,
    cost_credits INTEGER DEFAULT 0,
    callback_requested BOOLEAN DEFAULT FALSE,
    parent_call_sid VARCHAR(64),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. Frontend Integration

### Key Components

#### BillingPage
- Display current credits
- Show autopay status
- Manage autopay settings (threshold, amount)
- Buy credits (quick purchase)
- Trigger demo topup
- Demo outbound call triggers

#### Components

**CreditBalance.tsx**
```typescript
interface Props {
  balance: number;
  onBuyClick: () => void;
}

// Displays: ₹500 | 5000 Credits | Buy More Button
```

**AutopayPanel.tsx**
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

// Toggle autopay, set threshold, confirm pending checkout
```

**OutboundCallDemo.tsx**
```typescript
// Input: phone number, purpose
// Shows call status
// Handles consent management
```

### Context/Hooks

**BillingProvider**
```typescript
{
  workspace?: {
    plans: PricingPlan[];
    wallet: {
      balance_credits: number;
      transactions: CreditTransaction[];
    };
    autopay: AutopayStatusResponse;
  };
  purchasePlan(planId: string): Promise<void>;
  demoTopUp(planId: string): Promise<void>;
  updateAutopay(settings: AutopaySettings): Promise<void>;
  triggerAutopay(): Promise<void>;
  triggerOutboundCall(phone: string, purpose: CallPurpose): Promise<void>;
}
```

---

## 8. Error Handling

### HTTP Status Codes

- **200 OK**: Success
- **201 CREATED**: Resource created
- **400 BAD REQUEST**: Invalid input
- **401 UNAUTHORIZED**: Missing/invalid JWT
- **402 PAYMENT REQUIRED**: Insufficient credits
  - Response includes pending autopay checkout
- **403 FORBIDDEN**: Call not consented / Opt-out active
- **404 NOT FOUND**: Resource not found
- **429 TOO MANY REQUESTS**: Rate limit (call limits)
- **500 INTERNAL SERVER ERROR**: Server error
- **503 SERVICE UNAVAILABLE**: Razorpay/Twilio down

### Error Response Format

```typescript
{
  status: 'error',
  statusCode: 402,
  errorCode: 'INSUFFICIENT_CREDITS',
  message: 'Insufficient credits. Autopay checkout created.',
  data: {
    required_credits: 20,
    autopay: {
      status: 'pending_checkout',
      checkout: {
        order_id: 'order_ABC123',
        key_id: 'rzp_test_ABC',
        amount: 19900,
        currency: 'INR'
      }
    }
  },
  timestamp: '2026-03-28T10:30:00Z'
}
```

---

## 9. Security Checklist

✅ **JWT Authentication**
- Verify token on protected endpoints
- Refresh token rotation
- Token expiry (15 min | 7 day refresh)

✅ **Razorpay Signature Verification**
- HMAC-SHA256 on order_id|payment_id
- Webhook signature validation
- No silent debits without user signature

✅ **Twilio Request Validation**
- Verify X-Twilio-Signature header
- Webhook signature check
- Only accept from Twilio IPs

✅ **Rate Limiting**
- 20 req/min per user (general)
- 5 req/min per user (auth)
- 2 calls/day per number (call limit)

✅ **Database**
- Parameterized queries (SQL injection)
- Row-level security (users see own data)
- Encrypt sensitive fields
- Backup strategy

✅ **Data Privacy**
- Phone numbers encrypted
- Recordings secured
- Log sensitivity filtering
- GDPR compliance (delete on request)

---

## 10. Deployment Checklist

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@aiven-host:5432/db
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# Razorpay
RAZORPAY_KEY_ID=rzp_live_ABC...
RAZORPAY_KEY_SECRET=secret...
RAZORPAY_WEBHOOK_SECRET=webhook...

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_URL=https://yourdomain.com/call/incoming

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_OUTBOUND_MODEL=gpt-4o-mini

# Sarvam AI
SARVAM_API_KEY=...
SARVAM_API_URL=https://api.sarvam.ai

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# App
JWT_SECRET=very-long-random-string
NODE_ENV=production
PORT=5000
APP_NAME=Versafic
PUBLIC_URL=https://yourdomain.com
```

### Pre-Production Checks

- [ ] Database migrations run successfully
- [ ] Razorpay test mode working
- [ ] Twilio sandbox tested
- [ ] Email notifications (if enabled)
- [ ] Logging configured
- [ ] Error monitoring (Sentry/similar)
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] HTTPS enforced
- [ ] JWT tokens rotating

### Production Deploy

1. **Backup database**
2. **Run migrations** (downtime: ~10s)
3. **Deploy backend** (blue-green recommended)
4. **Deploy frontend** (CDN cache clear)
5. **Test critical paths**:
   - Payment flow
   - Call initiation
   - Credit deduction
   - Autopay trigger

---

## 11. Monitoring & Observability

### Key Metrics to Track

- **Billing**: Daily revenue, successful payments, failed payments
- **Credits**: Average balance, depletion rate, autopay trigger rate
- **Calls**: Success rate, average duration, cost per call
- **Errors**: Credit deduction failures, payment errors, Twilio failures

### Logging

```typescript
logger.info('User action', { userId, action, details });
logger.warn('Unusual activity', { userId, reason });
logger.error('Critical failure', error, { context });
```

### Alerts

Set up alerts for:
- Payment failures > 5% of transactions
- Razorpay API down
- Twilio API down
- Database connection issues
- High error rates

---

## 12. Testing Strategy

### Unit Tests
- Credit deduction logic
- Autopay trigger conditions
- Call consent validation
- Razorpay signature verification

### Integration Tests
- Full payment flow
- Credit deduction + autopay trigger
- Outbound call with consent check
- Call history retrieval

### E2E Tests
- User registration → Payment → Call
- Autopay demo mode flow
- Call opt-out functionality

---

## 13. Production Readiness

### Before Going Live

1. **Load Testing**
   - Can handle 100 concurrent users
   - Payment processing latency < 2s
   - Call initialization < 1s

2. **Security Audit**
   - Code review (especially payment code)
   - Penetration testing (if applicable)
   - OWASP Top 10 check

3. **Data Safety**
   - Backup restoration tested
   - Encryption at rest enabled
   - PII handling verified

4. **Compliance**
   - Terms of service (Razorpay, Twilio)
   - Privacy policy (data usage)
   - Call recording consent logged
   - GDPR (if EU users)

---

## 14. Future Enhancements

### Phase 2
- **Analytics Dashboard**: Revenue graphs, call metrics
- **Advanced Script Generation**: ML-based personalization
- **Call Recording Transcription**: Integration with Sarvam/Deepgram
- **Multiple Payment Methods**: Google Pay, Apple Pay
- **Webhook Retries**: Reliable event delivery

### Phase 3
- **SMS Fallback**: For failed calls
- **Email Billing**: Invoices, payment reminders
- **Batch Calling**: Schedule campaigns
- **CRM Integration**: Salesforce, HubSpot sync
- **Custom Branding**: White-label support

---

## Quick Reference: Credit Flow

```
User Makes Call (Cost: 20 credits)
    ↓
Check Balance: 50 credits
    ├→ 50 < 20? NO → Allow Call → Deduct 20 → Remaining: 30
    └→ 50 < 100 (Autopay Threshold)? NO → Skip Autopay

User Spends Down to 30 Credits
Takes Another Call (Cost: 20)
    ↓
Check Balance: 30 credits
    ├→ 30 < 20? NO → Allow Call → Deduct 20 → Remaining: 10
    └→ 10 < 100 (Autopay Threshold)? YES
        ├→ Autopay Enabled? YES
        │   └→ Pending Checkout? NO
        │       └→ Create Razorpay Order
        │           └→ Return Checkout
        │           └→ Frontend Opens Razorpay Modal
        │               └→ User Fills Payment Form
        │                   └→ Payment Success
        │                       └→ Add ₹199 (1990 credits)
        │                       └→ New Balance: 1800 credits
        │                       └→ Retry Original Call
        │                           └→ Success
        └→ Autopay Disabled? YES
            └→ Return 402 Error (Insufficient Credits)
```

---

## Files to Review

**Backend Architecture:**
- `/backend/src/services/wallet.service.ts` - Credit logic
- `/backend/src/services/outbound-call.service.ts` - Call logic
- `/backend/src/services/call-script.service.ts` - Script generation
- `/backend/src/services/razorpay.service.ts` - Payment integration
- `/backend/src/controllers/billing.controller.ts` - API handlers
- `/backend/src/models/billing.model.ts` - Database queries
- `/backend/migrations/008_add_autopay_tables.sql` - Schema
- `/backend/migrations/009_upgrade_autopay_and_call_compliance.sql` - Compliance fields

**Frontend:**
- `/frontend/src/pages/BillingPage.tsx` - Billing UI
- `/frontend/src/hooks/useBilling.tsx` - Context hook
- `/frontend/src/hooks/billing-context.ts` - Context definition
- `/frontend/src/types/index.ts` - TypeScript definitions

---

**Last Updated**: March 28, 2026  
**Version**: 1.0 (Production Ready)
