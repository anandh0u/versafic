# Complete Implementation Checklist & Quick Reference

## Phase 1: Core Foundation (Week 1)

### Database & Migrations
- [x] Migration 008 - Autopay tables created
- [x] Migration 009 - Call compliance fields added
- [ ] Run migrations: `npm run db:init`
- [ ] Verify tables exist in production DB

### Backend Services Setup
- [x] RazorpayService implemented
- [x] WalletService implemented (credit logic)
- [x] OutboundCallService implemented
- [x] CallScriptService implemented
- [ ] Verify all imports compile: `npm run typecheck`
- [ ] Run tests: `npm run test`

### Environment Configuration
- [ ] `.env` file created with all variables
- [ ] RAZORPAY_KEY_ID set
- [ ] RAZORPAY_KEY_SECRET set
- [ ] TWILIO_ACCOUNT_SID set
- [ ] TWILIO_AUTH_TOKEN set
- [ ] TWILIO_PHONE_NUMBER set
- [ ] OPENAI_API_KEY set
- [ ] JWT_SECRET set (32+ characters)

---

## Phase 2: API Endpoints (Week 2)

### Billing Endpoints
- [x] POST /billing/create-order (Razorpay order)
- [x] POST /billing/verify-payment (payment verification)
- [x] GET /billing/wallet (balance & history)
- [x] GET /billing/plans (list plans)
- [x] POST /billing/deduct (test endpoint)
- [x] POST /billing/check-balance (quick check)
- [x] GET /billing/autopay/status (settings)
- [x] POST /billing/autopay/enable (activate)
- [x] POST /billing/autopay/disable (deactivate)
- [x] POST /billing/autopay/trigger (demo/test)
- [ ] Test each endpoint with curl

### Call Endpoints  
- [x] POST /call/outbound (initiate call)
- [x] POST /call/incoming (Twilio webhook)
- [x] POST /call/outbound/twiml (TwiML response)
- [x] POST /call/outbound/respond (user response)
- [x] POST /call/status (status webhook)
- [x] POST /call/recording (recording webhook)
- [x] GET /call/recordings (list)
- [x] GET /call/recordings/:callSid (details)
- [ ] Test call flow with Twilio sandbox

### Credit Deduction Points
- [ ] AI chat endpoint deducts credits
- [ ] Voice processing deducts credits
- [ ] Inbound call deducts credits (from business)
- [ ] Outbound call deducts credits (from business)
- [ ] All deductions logged

---

## Phase 3: Call System (Week 2)

### Consent Management
- [x] call_consent field in users table
- [x] call_opt_out field in users table
- [x] Verify endpoint checks call_consent
- [ ] Verify endpoint checks call_opt_out
- [ ] Update endpoint for user to set consent
- [ ] Update endpoint for user to opt-in/out

### Call Validation Rules  
- [ ] Reject if call_consent = false (403)
- [ ] Reject if call_opt_out = true (403)
- [ ] Reject if > 2 calls today (429)
- [ ] Reject if < 24h since last call (429)
- [ ] Log all validation attempts

### Script Generation
- [x] OpenAI integration for scripts
- [x] Fallback scripts for all purposes
- [ ] Test script generation with different inputs
- [ ] Verify scripts are < 80 words
- [ ] Verify natural tone

### TwiML Flow
- [x] Greeting message
- [x] Script playback
- [x] Gather DTMF (keypress)
- [x] STOP detection
- [x] Hangup handling
- [ ] Test with actual call (Twilio sandbox)

### Recording & Storage
- [ ] Enable call recording in Twilio
- [ ] Webhook receives recording URL
- [ ] Store URL in call_sessions
- [ ] Verify recording accessible
- [ ] Implement retention policy

---

## Phase 4: Autopay System (Week 3)

### Demo Mode Autopay
- [x] Service implementation
- [ ] Enable demo autopay UI
- [ ] Test: Enable autopay with low threshold
- [ ] Test: Deduct credits below threshold
- [ ] Verify: Credits instantly added
- [ ] Verify: Logs show "demo_autopay"

### Real Mode Autopay
- [x] Service creates Razorpay order
- [ ] Order creation when balance < threshold
- [ ] Return pending checkout to frontend
- [ ] Frontend opens Razorpay modal
- [ ] User completes payment
- [ ] Webhook verifies payment
- [ ] Credits automatically added
- [ ] Log marks as 'completed'
- [ ] Retry original request

### Pending Checkout Management
- [ ] Only one pending checkout per user
- [ ] Expired checkouts cleaned up (30min)
- [ ] Frontend shows pending checkout
- [ ] User can reopen checkout
- [ ] Can't stack multiple orders

### Autopay Logs
- [ ] All autopay attempts logged
- [ ] Status tracked: pending_checkout, completed, failed, blocked, skipped
- [ ] Metadata stored (reason, mode, amount)
- [ ] Query autopay history

---

## Phase 5: Payments & Verification (Week 3)

### Razorpay Integration
- [x] Orders created successfully
- [ ] Test with Razorpay test mode
- [ ] Signature generation works
- [ ] Signature verification works
- [ ] Webhook URL configured
- [ ] Webhook events received

### Payment Verification
- [ ] Signature verification before crediting
- [ ] Order/payment ID validation
- [ ] User ownership verification
- [ ] Only credit once (idempotency)
- [ ] Log all verifications

### Test Payments
- [ ] Test card: 4111111111111111 (success)
- [ ] Test card: 4111111111111110 (failure)
- [ ] Verify success payments credit user
- [ ] Verify failed payments don't credit
- [ ] Check payment records in DB

### Error Handling  
- [ ] Invalid signature → reject
- [ ] Duplicate payment → idempotent
- [ ] Bad amount → reject
- [ ] User mismatch → reject
- [ ] Razorpay down → 503 error

---

## Phase 6: Frontend Integration (Week 4)

### Components Built
- [ ] BillingPage.tsx (main page)
- [ ] CreditBalance.tsx (display balance)
- [ ] PlanCard.tsx (plan selection)
- [ ] AutopayPanel.tsx (autopay settings)
- [ ] RazorpayCheckout.tsx (payment modal)
- [ ] OutboundCallDemo.tsx (call trigger)

### Context & Hooks
- [ ] BillingProvider setup
- [ ] useBilling hook
- [ ] useAuth hook (if needed)
- [ ] API service layer (callApi.)

### UI/UX
- [ ] Display current balance clearly
- [ ] Show autopay status
- [ ] Allow threshold/amount configuration
- [ ] Show pending checkout in UI
- [ ] Buy credits button → order → payment
- [ ] Demo button for testing
- [ ] Error messages clear
- [ ] Loading states visible
- [ ] Success notifications

### Razorpay Integration
- [ ] Frontend loads Razorpay script
- [ ] Checkout modal opens with correct amount
- [ ] Payment successfully completes
- [ ] Failure handling graceful
- [ ] Credits update after success
- [ ] Conversions successful

### Call Consent UI
- [ ] Phone number input field
- [ ] Call consent checkbox
- [ ] Consent message clear
- [ ] Save preferences button
- [ ] Display current settings
- [ ] Opt-out option visible

### Call Triggering
- [ ] Phone number input
- [ ] Purpose selector
- [ ] Trigger button
- [ ] Call status display
- [ ] Success/error messages
- [ ] Rate limit messages

---

## Phase 7: Testing & QA (Week 4)

### Manual Testing Flows
- [ ] User registration → wallet created with 0 balance
- [ ] Purchase plan → Razorpay order created
- [ ] Complete payment → credits added
- [ ] Check balance → updated correctly
- [ ] Buy another plan → different amount works
- [ ] Demo button → instant credits (demo mode)

### Autopay Testing
- [ ] Enable autopay (demo mode)
- [ ] Deduct credits below threshold
- [ ] Verify autopay triggers
- [ ] Credits instantly restored
- [ ] Logs show correct status
- [ ] Can disable autopay
- [ ] Enable autopay (real mode)
- [ ] Deduct credits below threshold
- [ ] Checkout created with correct amount
- [ ] Frontend shows pending payment
- [ ] User completes Razorpay
- [ ] Credits added after payment

### Call Testing
- [ ] User without consent → call rejected (403)
- [ ] User with consent → call allowed
- [ ] Trigger 2 calls → success
- [ ] Trigger 3rd call → limit error (429)
- [ ] Call opt-out → future calls rejected
- [ ] Call within 24h to same number → cooldown error
- [ ] Script generation → sensible output
- [ ] TwiML response valid
- [ ] Recording URL stored

### Error Scenarios
- [ ] Insufficient credits → 402 with autopay option
- [ ] Invalid signature → payment rejected
- [ ] Razorpay down → 503 error
- [ ] Twilio down → call fails gracefully
- [ ] DB connection lost → error page
- [ ] Invalid token → 401 redirect to login
- [ ] Rate limit exceeded → 429 error

### Database Integrity
- [ ] Wallets created for all users
- [ ] Transactions logged correctly
- [ ] Credit calculations accurate
- [ ] No double-crediting
- [ ] Foreign key constraints working
- [ ] Indexes performing well

---

## Phase 8: Monitoring & Logging (Week 4)

### Logging
- [ ] Payment logs: "Payment verified", "Order created", "Credits added"
- [ ] Call logs: "Call initiated", "STOP detected", "Recording saved"
- [ ] Autopay logs: "Autopay triggered", "Demo mode", "Pending checkout"
- [ ] Error logs: All exceptions logged with context
- [ ] Access logs: API requests tracked

### Metrics to Track
- [ ] Daily revenue (₹ and count)
- [ ] Payment success rate (%)
- [ ] Average transaction value (₹)
- [ ] Autopay trigger rate
- [ ] Call success rate (%)
- [ ] Credit depletion rate (credits/day)
- [ ] Error rates

### Alerts
- [ ] Payment failures > 5% → investigate
- [ ] Razorpay API down → alert team
- [ ] Twilio API down → alert team
- [ ] High error rate → investigate
- [ ] DB connection issues → alert ops

### Dashboard Metrics
- [ ] Total users with payments
- [ ] Active usage (calls/day)
- [ ] Revenue trend (daily/weekly)
- [ ] Credit flow (in/out)
- [ ] Call success rate
- [ ] Popular call purposes

---

## Phase 9: Security Review (Week 5)

### Payment Security
- [ ] Signature verification active
- [ ] No card details in logs
- [ ] No card details in DB
- [ ] HTTPS enforced
- [ ] API keys in env variables
- [ ] Secrets not in code

### API Security
- [ ] JWT validation on all protected endpoints
- [ ] Rate limiting active
  - [ ] General: 20 req/min
  - [ ] Auth: 5 req/min
  - [ ] Call initiation: 2/day limit
- [ ] CORS properly configured
- [ ] Request validation on all inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize outputs)

### Database Security
- [ ] Parameterized queries everywhere
- [ ] Row-level security (users see own data)
- [ ] Foreign keys enforced
- [ ] Encryption at rest (if required)
- [ ] Regular backups
- [ ] Backup restoration tested

### Third-party Security
- [ ] Razorpay: Signature verification
- [ ] Twilio: Request validation
- [ ] OpenAI: API key secured
- [ ] Google OAuth: Redirect URI whitelisted

---

## Phase 10: Documentation (Week 5)

- [x] System architecture guide (SYSTEM_ARCHITECTURE_GUIDE.md)
- [x] Wallet service implementation (IMPLEMENTATION_WALLET_SERVICE.md)
- [x] Call system guide (IMPLEMENTATION_CALL_SYSTEM.md)
- [x] Razorpay & Frontend guide (IMPLEMENTATION_RAZORPAY_FRONTEND.md)
- [x] Deployment & testing guide (DEPLOYMENT_TESTING_GUIDE.md)
- [ ] API documentation (endpoint reference)
- [ ] Database schema diagram
- [ ] Architecture diagram
- [ ] User guide (for businesses using platform)
- [ ] Admin guide (monitoring, troubleshooting)

---

## Phase 11: Staging Deployment (Week 5)

- [ ] Code deployed to staging
- [ ] Migrations run on staging DB
- [ ] All environment variables set
- [ ] Health checks passing
- [ ] Staging test flow completed
- [ ] Payment processing working
- [ ] Call system working
- [ ] No console errors
- [ ] Performance acceptable

---

## Phase 12: Production Launch (Week 6)

### Pre-Launch
- [ ] Database backed up
- [ ] DNS ready
- [ ] SSL certificates valid
- [ ] Load balancer configured
- [ ] Monitoring alerts configured
- [ ] Error tracking (Sentry) ready
- [ ] Rollback plan documented
- [ ] Incident response team ready
- [ ] Support team trained

### Launch
- [ ] Notify users of launch
- [ ] Monitor error rates closely
- [ ] Watch payment processing
- [ ] Check call success rates
- [ ] Monitor database performance
- [ ] Review logs for issues

### Post-Launch
- [ ] Celebrate! 🎉
- [ ] Review metrics after 24h
- [ ] Document lessons learned
- [ ] Plan phase 2 enhancements

---

## Integration Points Summary

### Users Table
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS (
  call_consent BOOLEAN DEFAULT FALSE,
  call_opt_out BOOLEAN DEFAULT FALSE,
  name VARCHAR(255),
  phone_number VARCHAR(20) UNIQUE
);
```

### Credit Deduction Points
1. **AI Chat**: `POST /ai/chat` → deduct 2 credits
2. **Voice Call**: `POST /voice/process` → deduct 20 credits/min
3. **Inbound Call**: `POST /call/incoming` → deduct 20 from business
4. **Outbound Call**: `POST /call/outbound` → deduct 20 from business
5. **All must check balance.md before executing**

### Payment Flow
1. Frontend: Request order `POST /billing/create-order`
2. Backend: Create Razorpay order, return order_id + key_id
3. Frontend: Open Razorpay checkout modal
4. User: Complete payment
5. Frontend: Send payment details `POST /billing/verify-payment`
6. Backend: Verify signature, credit user
7. Return: New balance to frontend

### Autopay Flow
1. **Demo Mode**: Enable → Deduct below threshold → Instantly add credits
2. **Real Mode**: Enable → Deduct below threshold → Create Razorpay order → User pays → Verify → Add credits

### Call Flow
1. Check consent: `call_consent = true` && `call_opt_out = false`
2. Check limits: Daily < 2, Cooldown > 24h
3. Generate script via OpenAI
4. Initiate Twilio call with TwiML endpoint
5. Collect DTMF for STOP command
6. If STOP: Set `call_opt_out = true`
7. Record call, store URL
8. Deduct credits

---

## File References

### Backend Implementation Files
- `src/services/wallet.service.ts` - Credit logic ✅
- `src/services/outbound-call.service.ts` - Call logic ✅
- `src/services/call-script.service.ts` - Script generation ✅
- `src/services/razorpay.service.ts` - Payment integration ✅
- `src/controllers/billing.controller.ts` - API handlers ✅
- `src/models/billing.model.ts` - Database queries
- `src/modules/call/call.controller.ts` - Call handlers ✅
- `src/modules/call/call.routes.ts` - Call routes ✅
- `src/routes/billing.routes.ts` - Billing routes ✅

### Frontend Files
- `src/pages/BillingPage.tsx` - Main billing UI (partial)
- `src/hooks/BillingProvider.tsx` - Context provider
- `src/hooks/useBilling.tsx` - Hook
- `src/services/api.ts` - API layer
- Component files to create:
  - `CreditBalance.tsx`
  - `PlanCard.tsx`
  - `AutopayPanel.tsx`
  - `RazorpayCheckout.tsx`
  - `OutboundCallDemo.tsx`

### Database Migrations
- ✅ `008_add_autopay_tables.sql`
- ✅ `009_upgrade_autopay_and_call_compliance.sql`

### Documentation
- ✅ SYSTEM_ARCHITECTURE_GUIDE.md
- ✅ IMPLEMENTATION_WALLET_SERVICE.md
- ✅ IMPLEMENTATION_CALL_SYSTEM.md
- ✅ IMPLEMENTATION_RAZORPAY_FRONTEND.md
- ✅ DEPLOYMENT_TESTING_GUIDE.md

---

## Quick Command Reference

```bash
# Database
npm run db:init                    # Run migrations
psql -h $DB_HOST -U $DB_USER -d $DB_NAME  # Connect

# Backend
npm run dev                        # Start dev server
npm run build                      # Build production
npm run test                       # Run tests
npm run typecheck                  # TypeScript check

# Frontend
npm run dev                        # Start dev server
npm run build                      # Build production

# Testing
curl -X GET http://localhost:5000/health
curl -X GET http://localhost:5000/billing/plans
curl -X POST http://localhost:5000/billing/create-order \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan_id": "plan_id"}'

# Deployment
docker build -t versafic-backend .
docker run -e DATABASE_URL=$DATABASE_URL versafic-backend
```

---

## Success Criteria

✅ **Phase 1-2**: Core services running, endpoints responding  
✅ **Phase 3**: Calls with consent validation working  
✅ **Phase 4**: Autopay (demo) triggering automatically  
✅ **Phase 5**: Payments processing, credits added  
✅ **Phase 6**: Frontend UI complete, smooth UX  
✅ **Phase 7**: All flows tested, no critical bugs  
✅ **Phase 8**: Logging comprehensive, metrics tracked  
✅ **Phase 9**: Security reviewed, no vulnerabilities  
✅ **Phase 10**: Documentation complete, maintainable  
✅ **Phase 11**: Staging stable, ready for launch  
✅ **Phase 12**: Production live, monitoring active  

---

**Last Updated**: March 28, 2026  
**Status**: Implementation in progress  
**Next Milestone**: Phase 6 - Frontend Integration
