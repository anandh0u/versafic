# Staging Deployment & Production Readiness Guide

## Overview

This guide covers deploying the complete AI SaaS platform to staging for final testing before production release.

**Key Components:**
- Backend: Node.js/Express/TypeScript
- Frontend: React/Vite/TypeScript  
- Database: PostgreSQL (Aiven)
- Payments: Razorpay
- Telephony: Twilio
- AI: OpenAI + Sarvam AI

---

## Pre-Deployment Checklist

### 1. Code Quality

**Backend:**
```bash
# Check TypeScript compilation
cd backend
npm run build
# Should complete without errors

# Run linting
npm run lint
# Should have no critical errors

# Run tests
npm test
# All tests must pass
```

**Frontend:**
```bash
# Check TypeScript compilation
cd frontend
npm run build
# Should complete without errors (check for dist/ folder)

# Run linting
npm run lint
# Should have no critical errors
```

### 2. Environment Configuration

**Prepare `.env` file for staging (backend):**

```bash
# Server
NODE_ENV=staging
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@host:port/staging_db

# JWT
JWT_SECRET=staging_secret_change_in_production
REFRESH_SECRET=staging_refresh_change_in_production
JWT_EXPIRY=15m
REFRESH_EXPIRY=7d

# Razorpay (Use test keys)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_SECRET=test_secret_xxxxxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI
OPENAI_API_KEY=sk-test-xxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Sarvam AI
SARVAM_API_KEY=your_sarvam_key
SARVAM_LANGUAGE_CODE=en-IN

# Vercel (for serverless deployment)
VERCEL_URL=staging.yourdomain.com

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

**Prepare `.env.local` file for staging (frontend):**

```bash
VITE_API_URL=https://staging-api.yourdomain.com
VITE_BILLING_MODE=hybrid
VITE_ENVIRONMENT=staging
```

### 3. Database Migration

**Ensure all migrations are ready:**

```bash
cd backend
# Check migration status
npm run db:status

# Run migrations
npm run db:migrate

# Verify migration results
npm run db:verify
```

**Migrations to verify:**
- [ ] 001_create_users_table.sql
- [ ] 002_create_business_profiles_table.sql
- [ ] 003_create_chat_history_table.sql
- [ ] 004_create_call_recordings_table.sql
- [ ] 005_create_call_sessions_table.sql
- [ ] 006_create_ai_interactions_table.sql
- [ ] 007_create_billing_tables.sql
- [ ] 008_add_autopay_tables.sql
- [ ] 009_upgrade_autopay_and_call_compliance.sql

---

## Backend Deployment

### Option 1: Vercel (Recommended for serverless)

**Steps:**

1. **Connect GitHub repository:**
   ```bash
   cd backend
   npm install -g vercel
   vercel login
   vercel link  # Select project or create new
   ```

2. **Configure Environment Variables in Vercel:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add all variables from `.env` above
   - Mark sensitive vars (secrets) appropriately

3. **Deploy:**
   ```bash
   vercel --prod --env staging
   ```

4. **Verify Deployment:**
   - Check Vercel dashboard for successful deployment
   - Test: `curl https://staging-backend.yourdomain.com/health`
   - Expected response: `{ "status": "ok" }`

### Option 2: Self-Hosted (AWS EC2, DigitalOcean, etc.)

**Steps:**

1. **SSH to server:**
   ```bash
   ssh user@staging-server.yourdomain.com
   ```

2. **Clone and setup:**
   ```bash
   git clone <your-repo> /apps/versafic
   cd /apps/versafic/backend
   npm install
   npm run build
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   vim .env  # Edit with your staging values
   ```

4. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start service (with PM2):**
   ```bash
   npm install -g pm2
   pm2 start "npm run start" --name versafic-backend
   pm2 save
   pm2 startup
   ```

6. **Setup nginx reverse proxy:**
   ```nginx
   server {
     listen 443 ssl http2;
     server_name staging-api.yourdomain.com;
     
     ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
     
     location / {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

### Post-Deployment Checks

```bash
# Health check
curl https://staging-api.yourdomain.com/health

# Auth endpoint check
curl -X POST https://staging-api.yourdomain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Billing endpoint check
curl https://staging-api.yourdomain.com/billing/plans \
  -H "Authorization: Bearer <test_token>"

# Call endpoint check
curl -X POST https://staging-api.yourdomain.com/call/outbound \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+919876543210","purpose":"enquiry_follow_up"}'
```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

**Steps:**

1. **Connect to Vercel:**
   ```bash
   cd frontend
   vercel link
   ```

2. **Set Environment Variables:**
   - Vercel Dashboard → Settings → Environment Variables
   - Add `VITE_API_URL=https://staging-api.yourdomain.com`
   - Add `VITE_BILLING_MODE=hybrid`

3. **Deploy:**
   ```bash
   vercel --prod --env staging
   ```

4. **Verify:**
   - Visit: `https://staging-frontend.yourdomain.com`
   - Should load React app
   - Check console for no errors

### Option 2: Netlify

**Steps:**

1. **Connect repository:**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify link
   ```

2. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Env var: `VITE_API_URL=https://staging-api.yourdomain.com`

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

### Option 3: Self-Hosted

**Steps:**

1. **Build:**
   ```bash
   cd frontend
   npm run build
   # Creates dist/ folder
   ```

2. **Deploy to server:**
   ```bash
   rsync -avz dist/ user@staging-server:/var/www/versafic/
   ```

3. **Configure nginx:**
   ```nginx
   server {
     listen 443 ssl http2;
     server_name staging.yourdomain.com;
     
     ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
     
     root /var/www/versafic;
     index index.html;
     
     location / {
       try_files $uri $uri/ /index.html;
     }
     
     # Proxy API calls
     location /api {
       proxy_pass https://staging-api.yourdomain.com;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
     }
   }
   ```

---

## Database Setup (Production-Grade)

### Aiven PostgreSQL

1. **Create Aiven account:**
   - Go to aiven.io
   - Sign up and create project
   - Create PostgreSQL service (staging tier)

2. **Get connection string:**
   ```
   postgresql://user:password@db-host:5432/staging_db
   ```

3. **Run migrations:**
   ```bash
   psql DATABASE_URL < migrations/001_create_users_table.sql
   psql DATABASE_URL < migrations/002_create_business_profiles_table.sql
   # ... run all migrations in order
   ```

4. **Verify tables:**
   ```bash
   psql DATABASE_URL -c "\dt"
   # Should list all tables created
   ```

### Backup Strategy

```bash
# Daily backup
pg_dump DATABASE_URL > backup-$(date +%Y%m%d).sql

# Store in S3
aws s3 cp backup-$(date +%Y%m%d).sql s3://your-bucket/backups/
```

---

## Third-Party Service Setup

### Razorpay

1. **Create Razorpay account:**
   - Go to razorpay.com/create-account
   - Complete KYC verification
   - Get test credentials from Dashboard

2. **Configure in backend .env:**
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_SECRET=test_secret_xxxxxxxx
   ```

3. **Test payment flow:**
   - Create order: `POST /billing/create-order`
   - Test card: 4111 1111 1111 1111
   - Verify signature validation works

### Twilio

1. **Create Twilio account:**
   - Go to twilio.com/try-twilio
   - Verify phone number
   - Get account credentials

2. **Configure in backend .env:**
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

3. **Test call flow:**
   - `POST /call/outbound` with test number
   - Should initiate call via Twilio

### OpenAI

1. **Create OpenAI account:**
   - Go to platform.openai.com
   - Create API key
   - Set usage limits

2. **Configure in backend .env:**
   ```
   OPENAI_API_KEY=sk-test-xxxxxxxx
   OPENAI_MODEL=gpt-4o-mini
   ```

3. **Test script generation:**
   - Call service should generate scripts for all purposes

### Sarvam AI

1. **Create Sarvam AI account:**
   - Register on sarvam.ai
   - Get API key for transcription

2. **Configure in backend .env:**
   ```
   SARVAM_API_KEY=your_sarvam_key
   SARVAM_LANGUAGE_CODE=en-IN
   ```

3. **Test transcription:**
   - Trigger call, wait for recording webhook
   - Verify transcription appears in database

---

## Monitoring & Logging

### Backend Logging Setup

1. **Install logging service (e.g., Logtail):**
   ```bash
   npm install @logtail/node
   ```

2. **Configure in index.ts:**
   ```typescript
   const logtail = new Logtail(process.env.LOGTAIL_TOKEN);
   
   app.use((req, res, next) => {
     logtail.log(`${req.method} ${req.path}`);
     next();
   });
   ```

3. **Critical events to log:**
   - Payment verification failures
   - Call initiation failures
   - Autopay triggers
   - Failed API requests
   - Authorization failures

### Application Monitoring

**Set up Sentry for error tracking:**

1. **Backend setup:**
   ```bash
   npm install @sentry/node
   ```

2. **Initialize:**
   ```typescript
   import * as Sentry from "@sentry/node";
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: "staging",
     tracesSampleRate: 1.0,
   });
   
   app.use(Sentry.Handlers.errorHandler());
   ```

3. **Frontend setup:**
   ```bash
   npm install @sentry/react
   ```

### Database Monitoring

**Set up Aiven monitoring:**
- Go to Aiven dashboard → Monitoring
- Track: CPU, Memory, Disk, Query performance
- Set alerts for: CPU > 80%, Disk > 85%, Failed connections

---

## Security Hardening

### SSL/TLS Certificates

```bash
# Use Let's Encrypt for free SSL
sudo apt-get install certbot nginx-certbot
certbot certonly --nginx -d staging-api.yourdomain.com
certbot certonly --nginx -d staging.yourdomain.com

# Auto-renew
sudo systemctl start certbot-renew.timer
```

### Security Headers

**Add to nginx:**
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Rate Limiting

**Backend already implements:**
- 100 requests/min per IP for /auth endpoints
- 50 requests/min per user for /call endpoints
- Verify in middleware/rate-limit.ts

### API Key Management

- [ ] Razorpay keys stored in env, never in code
- [ ] Twilio keys stored in env, never in code
- [ ] OpenAI keys stored in env, never in code
- [ ] JWT secret stored securely in env
- [ ] No secrets in git history

---

## Load Testing

### Using Apache Bench

```bash
# Test authentication endpoint
ab -n 1000 -c 10 -p login.json -T 'application/json' \
  https://staging-api.yourdomain.com/auth/login

# Test billing endpoint
ab -n 1000 -c 10 \
  -H "Authorization: Bearer <token>" \
  https://staging-api.yourdomain.com/billing/wallet
```

### Results to Monitor

- **Requests/sec:** Should handle > 100 RPS
- **Response time:** Should be < 500ms (p95)
- **Failed requests:** Should be 0
- **Connection errors:** Should be 0

---

## Smoke Test (Post-Deployment)

Run these tests immediately after deployment:

```bash
#!/bin/bash

API_URL="https://staging-api.yourdomain.com"
FRONTEND_URL="https://staging.yourdomain.com"

# 1. Backend health
echo "Testing backend health..."
curl -s $API_URL/health | grep -q "ok" && echo "✓ Backend health OK" || echo "✗ Backend health FAILED"

# 2. Frontend loads
echo "Testing frontend..."
curl -s $FRONTEND_URL | grep -q "<title>" && echo "✓ Frontend loads OK" || echo "✗ Frontend FAILED"

# 3. Database connection
echo "Testing database..."
curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@test.com","password":"testpass123"}' \
  | grep -q "status" && echo "✓ Database OK" || echo "✗ Database FAILED"

# 4. Razorpay integration
echo "Testing Razorpay..."
curl -s $API_URL/billing/plans \
  | grep -q "data" && echo "✓ Razorpay API OK" || echo "✗ Razorpay FAILED"

# 5. Twilio integration
echo "Testing Twilio..."
curl -s $API_URL/call/validate \
  | grep -q "twilio" && echo "✓ Twilio API OK" || echo "✗ Twilio FAILED"

echo "Smoke test complete!"
```

---

## Rollback Plan

If issues occur in staging:

**Immediate rollback:**
```bash
# Vercel
vercel rollback

# Self-hosted with git
git revert <commit_hash>
npm run build
pm2 restart versafic-backend
```

**Database rollback:**
```bash
# If migration caused issues
psql DATABASE_URL < rollback.sql
# or restore from backup
pg_restore -d staging_db backup-20240118.sql
```

**Communication:**
1. Notify team of rollback
2. Log issue in issue tracker
3. Create fix
4. Re-deploy with fix

---

## Go/No-Go Criteria for Production

Before promoting staging builds to production:

### Required Passes
- [ ] All integration tests pass
- [ ] Load test: > 100 RPS sustained
- [ ] Security audit: No critical issues
- [ ] Performance: API p95 < 500ms
- [ ] Availability: 99.9% uptime in staging
- [ ] Payment flow: 100% signature verification success
- [ ] Call flow: < 2% failure rate
- [ ] Autopay: 100% compliance (manual confirmation)

### Deployment Sign-Off
- [ ] Tech lead approval
- [ ] Product manager approval
- [ ] DevOps/infrastructure approval
- [ ] Security review approval

### Production Preparation
- [ ] Switch Razorpay to production keys
- [ ] Switch Twilio to production account
- [ ] Scale database to production tier
- [ ] Enable all monitoring/alerting
- [ ] Brief support team on new features
- [ ] Prepare rollback plan
- [ ] Prepare incident response playbook

---

## Production Deployment

Once staging passes all criteria:

```bash
# Frontend
vercel --prod --env production
# OR
npm run build && deploy to production server

# Backend
vercel --prod --env production
# OR
git tag v1.0.0
npm run build
Deploy to production cluster

# Switch database to production tier
# Switch API URLs in frontend
# Smoke test production environment
# Monitor for 24 hours
```

---

## Post-Deployment Monitoring (7 Days)

First week in production, monitor closely:

- [ ] Error rate: Should stay < 0.1%
- [ ] API latency: Should stay < 500ms p95
- [ ] Database queries: Should stay < 100ms avg
- [ ] Failed payments: Should be < 0.5%
- [ ] Failed calls: Should be < 2%
- [ ] Autopay success: Should be > 99%
- [ ] User feedback: Check support channels

Create daily reports and share with team.

---

## Questions?

For deployment-related questions, refer to:
1. This guide (primary)
2. Backend README.md (advanced topics)
3. Frontend README.md (build/deployment)
4. DEPLOYMENT.md at root (general checklist)
5. Contact DevOps team for infrastructure questions
