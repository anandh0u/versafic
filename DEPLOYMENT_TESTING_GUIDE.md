# Production Deployment & Testing Guide

## 1. Pre-Deployment Checklist

### Database Migrations

```bash
# Verify all migrations are in place
ls -la backend/migrations/

# Required:
# 001_create_users_table.sql
# 002_create_business_profiles_table.sql
# 003_create_chat_history_table.sql
# 004_create_call_recordings_table.sql
# 005_create_call_sessions_table.sql
# 006_create_ai_interactions_table.sql
# 007_create_billing_tables.sql
# 008_add_autopay_tables.sql
# 009_upgrade_autopay_and_call_compliance.sql

# Run migrations
npm run db:init

# Verify tables
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT tablename FROM pg_tables 
  WHERE schemaname='public' 
  ORDER BY tablename;
"
```

### Environment Variables (Complete List)

```bash
# === DATABASE ===
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DB_HOST=aiven-host
DB_PORT=5432
DB_USER=default_user
DB_PASSWORD=password
DB_NAME=defaultdb

# === RAZORPAY ===
RAZORPAY_KEY_ID=rzp_live_ABC123xyz
RAZORPAY_KEY_SECRET=secret_xyz_ABC123
RAZORPAY_WEBHOOK_SECRET=webhook_secret_xyz

# === TWILIO ===
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=auth_token_xxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_URL=https://yourdomain.com/call

# === OPENAI ===
OPENAI_API_KEY=sk-proj-xxx
OPENAI_OUTBOUND_MODEL=gpt-4o-mini

# === SARVAM AI ===
SARVAM_API_KEY=sarvam_key_xxx
SARVAM_API_URL=https://api.sarvam.ai

# === GOOGLE OAUTH ===
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# === JWT ===
JWT_SECRET=very_long_random_string_min_32_chars_required
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# === APP CONFIG ===
NODE_ENV=production
PORT=5000
APP_NAME=Versafic
PUBLIC_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# === LOGGING ===
LOG_LEVEL=info
LOG_FORMAT=json

# === OPTIONAL ===
SENTRY_DSN=https://xxx@sentry.io/xxx
REDIS_URL=redis://localhost:6379
```

### Code Review Checklist

✅ **Payment Security**:
- [ ] All payments verified with signature
- [ ] No amount from frontend is trusted
- [ ] HMAC-SHA256 verification implemented
- [ ] Webhook signature check active

✅ **Credit System**:
- [ ] Credit deduction happens BEFORE action
- [ ] Insufficient credit returns 402 with autopay option
- [ ] Demo autopay instantly adds credits
- [ ] Real autopay creates order awaiting payment

✅ **Call System**:
- [ ] call_consent check enforced
- [ ] call_opt_out check enforced
- [ ] Daily limit (2 calls) enforced
- [ ] 24h cooldown enforced
- [ ] STOP detection implemented
- [ ] TwiML validation active
- [ ] Recording stored

✅ **Database**:
- [ ] Parameterized queries (no SQL injection)
- [ ] Proper indexing (frequent queries)
- [ ] Foreign keys enforced
- [ ] Timestamps on all tables

✅ **Error Handling**:
- [ ] All endpoints have try-catch
- [ ] Proper error codes returned
- [ ] No sensitive data in error messages
- [ ] Logging comprehensive

---

## 2. Local Development Testing

### Start Development Environment

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

### Test Credit Deduction

```bash
# 1. Login
# 2. GET /billing/wallet → Check balance
# 3. POST /billing/deduct
{
  "credits": 10,
  "source": "ai_chat",
  "description": "Test deduction"
}
# 4. Verify balance decreased

curl -X POST http://localhost:5000/billing/deduct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "credits": 10,
    "source": "ai_chat",
    "description": "Test deduction"
  }'
```

### Test Autopay (Demo Mode)

```bash
# 1. Enable Demo Autopay
curl -X POST http://localhost:5000/billing/autopay/enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "threshold_credits": 50,
    "recharge_amount": 19900,
    "mode": "demo"
  }'

# 2. Get current balance
curl -X GET http://localhost:5000/billing/wallet \
  -H "Authorization: Bearer $TOKEN"

# 3. Deduct down to < 50
curl -X POST http://localhost:5000/billing/deduct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "credits": 100,
    "source": "ai_chat"
  }'

# 4. Check if autopay triggered
# Response should include "autopay.status=completed"

# 5. Verify balance increased
curl -X GET http://localhost:5000/billing/wallet \
  -H "Authorization: Bearer $TOKEN"
# Should show recharge amount added
```

### Test Razorpay Order Creation

```bash
# With Razorpay configured

# 1. Create order
curl -X POST http://localhost:5000/billing/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "plan_id": "plan_100_credits"
  }'

# Response:
{
  "order_id": "order_ABC123",
  "key_id": "rzp_test_ABC123",
  "amount": 500,
  "currency": "INR"
}

# 2. Use order_id in frontend Razorpay checkout
# 3. Complete payment with test card: 4111111111111111
```

### Test Call Consent

```bash
# 1. Create user without consent
# call_consent = false

# 2. Try to trigger outbound call
curl -X POST http://localhost:5000/call/outbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "phone_number": "+919876543210",
    "purpose": "support_call"
  }'

# Response: 403 Forbidden
# "Recipient has not consented to AI calls"

# 3. Update user to give consent
curl -X PATCH http://localhost:5000/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "call_consent": true,
    "phone_number": "+919876543210"
  }'

# 4. Try call again
# Should succeed
```

### Test Call Rate Limits

```bash
# 1. Trigger outbound call → Success

# 2. Trigger 2nd call same day → Success

# 3. Trigger 3rd call same day → 429 Error
# "Daily outbound call limit reached"

# 4. Trigger call to same number within 24h → 429 Error
# "Cooldown active"
```

---

## 3. Staging Environment Testing

### Deploy to Staging

```bash
# 1. Build backend
cd backend
npm run build

# 2. Build frontend
cd frontend
npm run build

# 3. Deploy to staging server
# git push staging main
# or use your CI/CD pipeline

# 4. Run migrations on staging DB
npm run db:init

# 5. Verify environment variables set
env | grep -i razorpay
env | grep -i twilio
```

### Smoke Tests (Staging)

```bash
# Health check
curl https://staging-api.yourdomain.com/health

# Get public plans
curl https://staging-api.yourdomain.com/billing/plans

# Login
curl -X POST https://staging-api.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password"
  }'

# Get wallet
curl https://staging-api.yourdomain.com/billing/wallet \
  -H "Authorization: Bearer $TOKEN"
```

### Full Workflow Test (Staging)

1. **User Registration**
   - Sign up with new email
   - Verify account creation in DB

2. **Purchase Credits**
   - Go to Billing page
   - Select plan
   - Click "Buy"
   - Enter test card: 4111111111111111
   - Complete payment
   - Verify credits added to wallet

3. **Enable Demo Autopay**
   - Go to Autopay settings
   - Enable DEMO mode
   - Set threshold to 50
   - Save configuration

4. **Trigger Autopay**
   - Deduct credits below threshold
   - Verify autopay triggered
   - Check credits restored

5. **Outbound Call (Demo)**
   - Update phone & consent
   - Trigger AI call
   - Verify call session created
   - Check credits deducted

---

## 4. Production Deployment

### Pre-Launch

1. **Database Backup**
   ```bash
   pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup.sql
   ```

2. **DNS & SSL**
   ```bash
   # Ensure DNS points to new server
   nslookup api.yourdomain.com
   
   # Verify SSL cert valid
   curl -I https://api.yourdomain.com
   # Should show 200 and valid cert
   ```

3. **Load Balancer**
   - Configure health check: GET /health
   - Set upstream servers
   - Enable HTTPS
   - Configure sticky sessions (if needed)

4. **Monitoring**
   - Set up error alerts (Sentry/similar)
   - Set up performance monitoring
   - Configure log aggregation
   - Set up payment monitoring

### Deployment Steps

```bash
# 1. Build services
docker build -t versafic-backend:v1.0 backend/
docker build -t versafic-frontend:v1.0 frontend/

# 2. Push to registry
docker tag versafic-backend:v1.0 registry.yourdomain.com/backend:v1.0
docker push registry.yourdomain.com/backend:v1.0

# 3. Deploy (blue-green)
# Deploy new version to new servers
# Run migrations
npm run db:init

# 4. Health checks
# Verify /health endpoint
# Verify database connectivity network
# Verify Razorpay connectivity
# Verify Twilio connectivity

# 5. Switch traffic
# Update load balancer to point to new servers
# Monitor error rates

# 6. Rollback plan
# Keep old version running for 1 hour
# If errors, revert load balancer
```

### Post-Deployment

```bash
# 1. Verify critical endpoints
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/billing/plans

# 2. Test payment flow
# Complete test payment in production (small amount)
# Verify credits added

# 3. Monitor logs
# Watch for errors in first 30 minutes
# Check payment webhook processing

# 4. Database verification
# Confirm data integrity
# Run sample queries

# 5. Notify team
# Send deployment confirmation
# Share monitoring links
```

---

## 5. Ongoing Monitoring & Maintenance

### Daily Checks

```bash
# 1. Error rate
# Check Sentry for new errors
# Investigate any > 1% error rate

# 2. Payment processing
# SELECT COUNT(*) FROM payments 
#   WHERE created_at > NOW() - INTERVAL '1 day'
#   AND status = 'captured';

# 3. Call success rate
# SELECT 
#   COUNT(*) FILTER (WHERE status = 'completed'),
#   COUNT(*) FILTER (WHERE status = 'failed')
# FROM call_sessions
# WHERE created_at > NOW() - INTERVAL '1 day';

# 4. Database size
# SELECT pg_size_pretty(pg_database_size(current_database()));

# 5. Disk space
# df -h /mnt/data
```

### Weekly Maintenance

```bash
# 1. Review error logs
# Look for patterns, recurring issues

# 2. Performance review
# Check query performance
# Identify slow endpoints

# 3. Database optimization
# VACUUM ANALYZE;

# 4. Backup verification
# Verify backups running successfully
# Test restoration process

# 5. Security updates
# Check for package updates
# npm outdated
# docker images --digests
```

### Monthly Tasks

```bash
# 1. Update dependencies
npm update

# 2. Review user metrics
- New users
- Active users
- Churn rate
- Total credits purchased

# 3. Payment reconciliation
- Compare Razorpay balance with DB records
- Investigate discrepancies

# 4. Call metrics
- Success rate
- Avg duration
- Cost per call

# 5. Cleanup
- Delete old recordings (if needed)
- Archive old logs
- Delete abandoned sessions
```

---

## 6. Troubleshooting Guide

### Payment Not Crediting

```bash
# 1. Check payment record
SELECT * FROM payments 
WHERE razorpay_payment_id = 'pay_ABC';

# 2. Check transaction
SELECT * FROM credit_transactions 
WHERE reference_id = 'pay_ABC';

# 3. Check Razorpay Dashboard
# https://dashboard.razorpay.com
# Look for payment status

# 4. Manual credit if needed
-- Admin SQL (use with caution)
INSERT INTO credit_transactions 
  (user_id, type, credits, source, description)
VALUES (user_id, 'credit', 100, 'admin', 'Manual adjustment');

UPDATE wallets 
SET balance_credits = balance_credits + 100 
WHERE user_id = user_id;
```

### Call Not Initiating

```bash
# 1. Check user consent
SELECT call_consent, call_opt_out FROM users WHERE id = user_id;

# 2. Check daily limit
SELECT COUNT(*) FROM call_sessions 
WHERE user_id = user_id 
AND type = 'outgoing'
AND created_at > NOW() - INTERVAL '1 day';

# 3. Check Twilio connectivity
curl -X GET https://api.twilio.com/2010-04-01/Accounts/{SID} \
  -u ${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}

# 4. Check logs
tail -f logs/app.log | grep "outbound_call"
```

### Autopay Not Triggering

```bash
# 1. Check autopay enabled
SELECT * FROM autopay_settings WHERE user_id = user_id;

# 2. Check balance vs threshold
SELECT balance_credits FROM wallets WHERE user_id = user_id;

# 3. Check autopay logs
SELECT * FROM autopay_logs 
WHERE user_id = user_id 
ORDER BY timestamp DESC LIMIT 10;

# 4. Check if pending checkout exists
SELECT * FROM autopay_logs 
WHERE user_id = user_id 
AND status = 'pending_checkout';

# 5. Manual trigger
curl -X POST https://api.yourdomain.com/billing/autopay/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 7. Security & Compliance

### Regular Security Checks

- [ ] SQL injection tests
- [ ] CORS policy review
- [ ] JWT expiry verification
- [ ] Rate limiting active
- [ ] HTTPS enforced
- [ ] Secrets not in code
- [ ] API authentication working
- [ ] Payment signature verification

### Compliance Checklist

- [ ] Terms of Service (Razorpay compliant)
- [ ] Privacy Policy (data usage disclosed)
- [ ] Call recording consent (logged)
- [ ] GDPR (if EU users)
  - [ ] Data export capability
  - [ ] Deletion capability
  - [ ] Consent management
- [ ] Twilio compliance
  - [ ] Do-not-call list
  - [ ] Call recording disclosure
- [ ] PCI compliance
  - [ ] Never store card details
  - [ ] Use Razorpay for all payments

---

## 8. Incident Response

### Payment Processing Failure

```
1. Alert: Error rate > 5%
2. Check:
   - Razorpay status page
   - Database connectivity
   - Application logs
3. Actions:
   - If Razorpay down: Notify users, maintenance message
   - If DB issue: Restart service, check disk space
   - If app issue: Rollback last deployment
4. Recovery:
   - Fix underlying issue
   - Manually process failed payments if needed
   - Send credit to affected users
5. Post-incident:
   - Review logs
   - Document root cause
   - Implement fix
```

### Call Service Failure

```
1. Check Twilio status
2. Verify credentials still valid
3. Check phone number active
4. Review recent changes
5. Rollback if needed
6. Use failover method (SMS/email)
```

---

## 9. Rollback Procedure

```bash
# If production has critical issues

# 1. Switch load balancer to previous version
# (if using blue-green deployment)

# 2. Or rollback docker containers
docker service update --image registry.yourdomain.com/backend:v0.9 \
  versafic-backend

# 3. Verify health
curl https://api.yourdomain.com/health

# 4. Investigate issue
# Review new code
# Run tests
# Fix in development

# 5. Re-deploy fixed version
```

---

## 10. Performance Optimization

### Database Queries

```sql
-- Add indexes for frequent queries
CREATE INDEX idx_calls_user_id_created 
  ON call_sessions(user_id, created_at DESC);

CREATE INDEX idx_transactions_user_created 
  ON credit_transactions(user_id, created_at DESC);

CREATE INDEX idx_autopay_user_status 
  ON autopay_logs(user_id, status, timestamp DESC);
```

### Caching

```typescript
// Cache plans (rarely change)
const PLANS_CACHE_DURATION = 3600; // 1 hour

// User wallet (check on each request)
// Don't cache - must be real-time

// Autopay settings (cache 5 mins)
const AUTOPAY_CACHE_DURATION = 300;
```

---

**Version**: 1.0  
**Last Updated**: March 28, 2026
