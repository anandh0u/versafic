# Integration Testing Guide

## Overview

This guide provides step-by-step instructions for testing the complete AI SaaS platform integration, covering all three major flows:
1. **Credit & Wallet Flow** - Balance checks and credit management
2. **Payment & Razorpay Flow** - Order creation and payment verification
3. **Outbound Call Flow** - Call triggering with AI script generation

---

## Setup Requirements

### Environment Variables
Ensure these are set in `.env.local` (frontend) and `.env` (backend):

```
# Frontend
VITE_API_URL=http://localhost:5000
VITE_BILLING_MODE=hybrid

# Backend
DATABASE_URL=postgresql://...
RAZORPAY_KEY_SECRET=...
TWILIO_AUTH_TOKEN=...
OPENAI_API_KEY=...
```

### Test Data Preparation

1. **Create Test User Account**
   - Register at http://localhost:5173/auth/register
   - Use: `test@example.com` / `testpass123`
   - Confirm email (if email verification enabled)

2. **Create Test Business Profile**
   - Navigate to /setup/business
   - Fill in business details (can be dummy)
   - Enable "I own this number" for call_consent

3. **Top Up Test Balance (Demo Mode)**
   - Go to /billing page
   - Click "Instant demo top-up" on any plan
   - This adds credits without real payment

---

## Test Flow 1: Credit & Wallet Management

### Test 1.1: Verify Wallet Balance Display

**Steps:**
1. Log in and navigate to `/billing`
2. Open Network tab in DevTools
3. Observe request: `GET /billing/wallet`
4. Verify response includes:
   - `balance_credits`: number (>= 0)
   - `transactions`: array of objects
5. Check CreditBalance component displays:
   - Credit count (upper left)
   - Conversion rate (₹ amount = credits ÷ 10)
   - "Buy Credits" button
   - Live status indicator

**Expected Behavior:**
- Request completes within 1 second
- Balance updates in real-time
- Transaction history shows all topups and deductions

---

### Test 1.2: Verify Balance Check Before Action

**Steps:**
1. In billing dashboard, try to run a simulation action that costs credits
2. Observe Network request: `GET /billing/check-balance?required=X`
3. Verify response:
   - If sufficient: `has_sufficient_credits: true` → action proceeds
   - If insufficient: `has_sufficient_credits: false` → error shown

**Test Case A: Sufficient Balance**
- Have 500 credits
- Try action requiring 100 credits
- Expected: Action proceeds, balance checked successfully

**Test Case B: Insufficient Balance**
- Have 50 credits
- Try action requiring 100 credits
- Expected: Error popup shows "You have 50 credits, need 100"
- Action does NOT proceed

---

### Test 1.3: Verify Pricing Plans Display

**Steps:**
1. Navigate to `/billing` → "Pricing Plans" section
2. Observe `GET /billing/plans` request in Network
3. Verify response includes >= 2 plans with:
   - `id`: string (e.g., "plan_starter")
   - `name`: string
   - `amount`: number in paise (e.g., 99900 = ₹999)
   - `credits`: number
4. Check rendering:
   - Each plan shows price, credit count, description
   - "Buy" and "Instant demo top-up" buttons visible
   - Current plan has "Active plan" badge

**Expected Behavior:**
- All plans load within 1 second
- Prices display with proper INR formatting
- Demo button works for testing

---

## Test Flow 2: Payment & Razorpay Integration

### Test 2.1: Create Razorpay Order

**Steps:**
1. Click "Buy Starter" button on any plan
2. Observe `POST /billing/create-order` in Network tab
3. Request payload: `{ plan_id: "plan_starter" }`
4. Verify response includes:
   - `order_id`: string starting with "order_"
   - `key_id`: Razorpay publishable key
   - `amount`: number in paise
   - `currency`: "INR"
   - `credits`: number
5. Razorpay modal should open automatically

**Expected Behavior:**
- Order created instantly (< 500ms)
- Modal opens with correct amount
- Modal shows payment options (Card, UPI, Wallet)

---

### Test 2.2: Complete Payment (Test Mode)

**Steps:**
1. Razorpay modal is open
2. Click on payment method (e.g., "Card")
3. Use Razorpay test credentials:
   - Card Number: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: `123`
4. Click "Pay"
5. Wait for response

**Expected Behavior - Success:**
- Payment completes
- Modal closes
- Network shows `POST /billing/verify-payment` request
- CreditBalance updates with new balance
- Success notification appears
- Transaction appears in history

**What Happens Behind Scenes:**
1. Razorpay returns: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
2. Frontend POSTs these to `/billing/verify-payment`
3. Backend verifies HMAC signature (critical security step)
4. If valid: Credits added to wallet
5. If invalid: Returns 400 "Invalid payment signature"

---

### Test 2.3: Payment Cancellation

**Steps:**
1. Click any "Buy" button to open Razorpay modal
2. Click "X" button in top-right or press Escape
3. Modal closes

**Expected Behavior:**
- Modal closes cleanly without error
- No credits added to balance
- No error notification shown
- User can retry clicking "Buy" again
- Same order can be retried (frontend allows retry)

---

### Test 2.4: Verify Failed Signature (Security Test)

**Note:** This requires backend testing. For frontend, we can simulate:

**Steps:**
1. Open DevTools → Network tab
2. Set Network throttling to "Offline" after payment succeeds
3. Manually trigger verify request with modified signature
4. Observe error response

**Expected Behavior:**
- Backend rejects request with 400 error
- No credits added
- Frontend shows error: "Payment verification failed"

---

## Test Flow 3: Outbound Call Triggering

### Test 3.1: Basic Call Triggering

**Steps:**
1. Navigate to `/billing` → "Outbound Call Demo" section (if visible) or create separate call page
2. Enter phone number: `+91 9876543210` (test number)
3. Select "Enquiry Follow-up" as purpose
4. Check "I own this number" consent checkbox
5. Click "Trigger Call" button
6. Observe `POST /call/outbound` in Network tab

**Request Payload:**
```json
{
  "phone_number": "+919876543210",
  "purpose": "enquiry_follow_up"
}
```

**Expected Response - Success:**
```json
{
  "status": "success",
  "data": {
    "callSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "to": "+919876543210",
    "purpose": "enquiry_follow_up",
    "script": "Hello, I'm calling to follow up...",
    "balance_credits": 475
  }
}
```

**Frontend Behavior:**
- Success message shows call SID, recipient number, and generated script
- Balance updates immediately (20 credits deducted)
- Call initiates via Twilio (audio plays to user's device)

---

### Test 3.2: Consent Enforcement

**Steps:**
1. Try to enter phone number without checking consent
2. Observe "Trigger Call" button is DISABLED (grayed out)
3. Check consent checkbox
4. Button becomes ENABLED
5. Uncheck consent
6. Button becomes DISABLED again

**Expected Behavior:**
- Consent is mandatory, enforced at UI level
- Button stays disabled until checked
- Prevents accidental calls without consent

---

### Test 3.3: Balance Check Before Call

**Test Case A: Sufficient Balance**
- Have 500 credits, call costs 25
- Call should succeed

**Test Case B: Insufficient Balance**
- Have 10 credits, call costs 25
- Error: "Insufficient balance. You have 10 credits, need 25."
- "Top Up Now" button shown
- Call NOT initiated

**Expected Behavior:**
- Balance check happens before Twilio call
- If fails, user is informed clearly
- No partial charges

---

### Test 3.4: Daily Call Limit

**Steps:**
1. Trigger call to different number
2. Trigger 2nd call to another number
3. Attempt 3rd call

**Expected Behavior - After 2 Calls:**
- 3rd call attempt shows error: "Daily limit reached. Max 2 calls per day."
- Reset time shown: "Reset at 00:00 UTC"
- Call NOT initiated
- No credits deducted

**To Reset for Testing:**
- Wait until next day (UTC midnight)
- Or manually set user's last_call_date to previous day in database

---

### Test 3.5: 24-Hour Cooldown Per Number

**Steps:**
1. Call `+919876543210`
2. Immediately try to call same number again
3. Different number should work, same should fail

**Expected Behavior - Same Number:**
- Error: "Can call this number again at [timestamp]"
- Shows exact time when retry allowed
- No credits deducted

**Expected Behavior - Different Number:**
- Call succeeds (if < 2 daily calls and balance sufficient)
- No cooldown error

---

### Test 3.6: AI Script Generation

**Steps:**
1. Trigger 4 calls with different purposes:
   - "Enquiry Follow-up"
   - "Missed Call Callback"
   - "Support Call"
   - "Booking Confirmation"
2. Observe script in success message

**Expected Behavior:**
- Each generates unique, purpose-specific script
- All scripts < 80 words
- All scripts are service-oriented (no selling)
- Script varies based on purpose

**If OpenAI Fails:**
- Fallback template used for purpose
- Call still succeeds
- Message shows: "Using default script due to service momentarily unavailable"

---

## Test Flow 4: Autopay Integration

### Test 4.1: Enable Autopay (Demo Mode)

**Steps:**
1. Navigate to AutopayPanel
2. Set "Threshold Credits" to 200
3. Set "Recharge Amount (INR)" to 499 (= 4990 credits)
4. Select "Demo mode"
5. Click "Turn On"

**Expected Behavior:**
- AutopayPanel shows "Enabled" badge
- Settings saved
- History shows enable event

---

### Test 4.2: Trigger Autopay (Demo Mode)

**Steps:**
1. Have 250 credits (above threshold)
2. Use credits until balance drops to 150 (below threshold of 200)
3. Observe autopay triggers automatically OR
4. Manually click "Trigger Autopay" button
5. Observe Network request

**Expected Response:**
- Demo mode: Credits added instantly (250 + 1000 = 1250)
- History shows autopay entry with "demo mode"
- No Razorpay modal (instant demo)
- No amount_paise stored (no real money)

---

### Test 4.3: Trigger Autopay (Real Mode)

**Steps:**
1. Switch AutopayPanel to "Real mode"
2. Drop balance below threshold
3. Autopay triggers: `POST /billing/autopay/trigger`
4. Response includes: `{ requires_user_action: true, checkout: {...} }`
5. Razorpay modal opens automatically with recharge amount
6. Complete payment like in Test 2.2

**Expected Behavior - Real Mode:**
- Modal opens (unlike demo)
- User MUST confirm Razorpay checkout (compliant, not silent)
- Only after confirmation are credits added
- History shows: mode="real", razorpay_payment_id stored
- Amount shows real ₹ value

**Compliance Check:**
- Autopay is NOT automatic/silent debit
- User must confirm Razorpay checkout
- Transaction logged with payment ID

---

## Network Monitoring Checklist

Use DevTools Network tab to verify:

### Billing Endpoints
- [ ] `GET /billing/wallet` - Returns balance + transactions
- [ ] `GET /billing/plans` - Returns all plans
- [ ] `GET /billing/check-balance` - Balance validation
- [ ] `POST /billing/create-order` - Order creation
- [ ] `POST /billing/verify-payment` - Payment verification
- [ ] `GET /billing/autopay/status` - Current autopay settings
- [ ] `POST /billing/autopay/enable` - Enable autopay
- [ ] `POST /billing/autopay/trigger` - Trigger recharge

### Call Endpoints
- [ ] `POST /call/outbound` - Trigger outbound call
- [ ] `GET /call/sessions` - View call history (if implemented)

### auth Endpoints
- [ ] `GET /auth/me` - Current user profile
- [ ] `PATCH /auth/me` - Update call_consent, call_opt_out

---

## Staging Deployment Checklist

Before deploying to production:

### Database
- [ ] All migrations run successfully
- [ ] autopay_settings table exists
- [ ] autopay_logs table exists with proper indexes
- [ ] call_sessions table exists with recording_url column
- [ ] users table has call_consent, call_opt_out columns

### Backend Services
- [ ] WalletService can deduct credits atomically
- [ ] OutboundCallService validates all constraints
- [ ] RazorpayService verifies HMAC signatures correctly
- [ ] CallScriptService generates varied scripts

### Frontend Build
- [ ] `npm run build` completes without errors
- [ ] No TypeScript errors in compiled output
- [ ] All components import successfully
- [ ] No console errors on load

### Environment
- [ ] Razorpay test credentials configured
- [ ] Twilio test credentials configured
- [ ] OpenAI test key configured
- [ ] Database connection working
- [ ] Redis cache working (if used)

### Security Verification
- [ ] JWT tokens validate correctly
- [ ] Rate limiting is active
- [ ] HMAC signature verification works
- [ ] Balance checks prevent overspending
- [ ] Consent checks prevent unwanted calls

### Monitoring Setup
- [ ] Error logging configured
- [ ] API response time tracking enabled
- [ ] Failed payment attempts logged
- [ ] Call failures logged
- [ ] Autopay events logged

---

## Troubleshooting Common Issues

### Issue: Razorpay Modal Doesn't Open
**Solutions:**
1. Check Razorpay script loads: DevTools → Network → look for `checkout.razorpay.com`
2. Verify `key_id` is set (not null)
3. Check for CORS issues in console
4. Refresh page, clear cache

### Issue: Payment Verification Fails
**Solutions:**
1. Check signature verification: `HMAC(razorpay_secret, order_amount|order_id|razorpay_payment_id)`
2. Verify secret key matches Razorpay dashboard
3. Check for extra whitespace in order_id, payment_id
4. Test with Razorpay test credentials first

### Issue: Call Not Initiating
**Solutions:**
1. Verify Twilio account has active credits
2. Check phone number format (must start with +country_code)
3. Verify user has call_consent = true
4. Check balance >= 20 credits
5. Verify daily call count < 2

### Issue: Autopay Not Triggering
**Solutions:**
1. Verify autopay is enabled
2. Check threshold is set and reasonable
3. Ensure balance actually dropped below threshold
4. Check autopay_settings table in database
5. Review autopay_logs for errors

---

## Test Report Template

Use this template to document test results:

```
Date: 2024-01-18
Tester: [Your Name]
Environment: staging
Build Version: 1.0.0

Test Results:
[ ] Credit Balance Display - PASS/FAIL
[ ] Balance Check Before Action - PASS/FAIL
[ ] Pricing Plans Display - PASS/FAIL
[ ] Create Razorpay Order - PASS/FAIL
[ ] Complete Payment - PASS/FAIL
[ ] Payment Cancellation - PASS/FAIL
[ ] Trigger Outbound Call - PASS/FAIL
[ ] Consent Enforcement - PASS/FAIL
[ ] Daily Call Limit - PASS/FAIL
[ ] 24h Cooldown - PASS/FAIL
[ ] Autopay Demo Mode - PASS/FAIL
[ ] Autopay Real Mode - PASS/FAIL

Issues Found:
1. [Issue description with steps to reproduce]

Performance:
- API response times: [Range]
- Page load time: [Time]
- Modal open time: [Time]

Security:
- JWT validation: PASS/FAIL
- HMAC verification: PASS/FAIL
- Balance atomicity: PASS/FAIL

Recommendation: Ready for production / Needs fixes
```

---

## Continuous Testing

After deployment:

### Daily Monitoring
- Check API error rates
- Monitor failed payments
- Review call failure logs
- Check autopay success rate

### Weekly Regression
- Run full test flow manually
- Spot-check 5-10 transactions
- Review any new issues reported

### Monthly Review
- Performance metrics
- Cost analysis
- User feedback
- Security audit

---

## Contact & Escalation

For issues during testing:
1. Check this guide's Troubleshooting section
2. Review app error logs
3. Check database query logs
4. Contact backend team for API issues
5. Contact DevOps for infrastructure issues
