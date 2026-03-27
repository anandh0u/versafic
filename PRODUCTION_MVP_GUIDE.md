# Versafic - Production MVP Guide

## 🎯 Project Overview

**Versafic** is an AI-powered customer communication platform for businesses like restaurants, hotels, clinics, and service companies. It provides:

- **AI Customer Call Assistant** - Automated phone support
- **Voice Processing** - Speech-to-text and voice workflows
- **AI Chat Responses** - Intelligent chat automation
- **Business Onboarding** - Easy setup for new clients
- **Credit-Based Billing** - Transparent, usage-based pricing
- **Razorpay Integration** - Secure payment processing with auto-recharge
- **Professional SaaS Website** - Production-ready frontend

---

## 📁 Project Structure

```
Versafic/
├── backend/                    # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── controllers/       # billing.controller.ts ✅
│   │   ├── routes/            # billing.routes.ts ✅
│   │   ├── services/          # razorpay.service.ts, wallet.service.ts ✅
│   │   ├── models/            # billing.model.ts ✅
│   │   ├── middleware/        # jwt-auth.ts, error-handler.ts ✅
│   │   └── types/             # billing.types.ts ✅
│   ├── migrations/            # Database schema ✅
│   │   ├── 007_create_billing_tables.sql
│   │   ├── 008_add_autopay_tables.sql
│   │   └── 009_upgrade_autopay_and_call_compliance.sql
│   └── .env.example           # Environment template ✅
│
└── frontend/                   # React + Vite + Tailwind CSS
    ├── src/
    │   ├── pages/             # HomePage.tsx, BillingPage.tsx ✅
    │   ├── components/        # Navbar, Hero, Features, Pricing ✅
    │   ├── hooks/             # useBilling.tsx, useAuth.tsx ✅
    │   └── services/          # API client ✅
    ├── vercel.json            # Vercel config ✅
    └── .env.example           # Environment template ✅
```

**✅ Status: All components are implemented and production-ready**

---

## 🗄️ Database Schema

### 1. `wallets` Table
```sql
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    business_id INTEGER REFERENCES business_profiles(id),
    balance_credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT balance_non_negative CHECK (balance_credits >= 0)
);
```

### 2. `payments` Table
```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    business_id INTEGER REFERENCES business_profiles(id),
    razorpay_order_id VARCHAR(255) NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(255),
    amount_paise INTEGER NOT NULL,
    credits_to_add INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    payment_context VARCHAR(30) NOT NULL DEFAULT 'manual_topup',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3. `credit_transactions` Table
```sql
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    business_id INTEGER REFERENCES business_profiles(id),
    type VARCHAR(30) NOT NULL,
    credits INTEGER NOT NULL,
    amount_paise INTEGER,
    source VARCHAR(50) NOT NULL,
    reference_id VARCHAR(255),
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Transaction Types:**
- `topup` - Credit purchase
- `usage_deduction` - Service usage
- `refund` - Credit refund
- `adjustment` - Manual adjustment

**Transaction Sources:**
- `razorpay` - Payment gateway
- `autopay` - Auto-recharge
- `ai_chat` - Chat message (5 credits)
- `voice_call` - Call minute (20 credits)
- `sarvam_stt` - Speech-to-text (2 credits)
- `recording_process` - Recording processing (5 credits)
- `admin` - Manual adjustment

---

## 🔧 Backend API Endpoints

### 1. **GET /billing/plans**
Get available pricing plans (public route)

**Response:**
```json
{
  "status": "success",
  "data": {
    "plans": [
      {
        "id": "starter",
        "name": "Starter",
        "amount": 99,
        "amount_paise": 9900,
        "credits": 990,
        "description": "Perfect for small businesses testing AI support"
      }
    ]
  }
}
```

### 2. **POST /billing/create-order** (Protected)
Create Razorpay order for credit purchase

**Request:**
```json
{
  "plan_id": "starter"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_id": "order_xxxxx",
    "key_id": "rzp_test_xxxxx",
    "amount": 9900,
    "currency": "INR",
    "credits": 990
  }
}
```

### 3. **POST /billing/verify-payment** (Protected)
Verify payment and add credits to wallet

**Request:**
```json
{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature_xxxxx"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payment verified and credits added",
  "data": {
    "balance_credits": 990
  }
}
```

### 4. **GET /billing/wallet** (Protected)
Get wallet balance and recent transactions

**Response:**
```json
{
  "status": "success",
  "data": {
    "wallet": {
      "balance_credits": 990,
      "user_id": 1
    },
    "recent_transactions": [
      {
        "id": 1,
        "type": "topup",
        "credits": 990,
        "source": "razorpay",
        "description": "Razorpay payment order_xxxxx",
        "created_at": "2024-03-21T10:30:00Z"
      }
    ]
  }
}
```

### 5. **POST /billing/deduct** (Protected)
Deduct credits for usage

**Request:**
```json
{
  "credits": 5,
  "source": "ai_chat",
  "description": "AI chat message",
  "reference_id": "chat_session_123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Successfully deducted 5 credits",
  "data": {
    "balance_credits": 985
  }
}
```

---

## 💳 Razorpay Integration Flow

### Frontend Flow:

1. **User clicks "Buy Credits"** → Selects a plan
2. **Frontend calls** `POST /billing/create-order` → Gets order details
3. **Razorpay Checkout opens** → User completes payment
4. **On success** → Frontend receives `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`
5. **Frontend calls** `POST /billing/verify-payment` → Backend verifies signature using HMAC SHA256
6. **Backend updates database** → Marks payment as paid, adds credits to wallet
7. **Frontend refreshes** → Shows updated balance

### Backend Verification Logic:

```typescript
// Generate expected signature
const signatureString = `${razorpayOrderId}|${razorpayPaymentId}`;
const expectedSignature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(signatureString)
  .digest('hex');

// Compare signatures
const isValid = razorpaySignature === expectedSignature;
```

### Idempotency Protection:

- Payment verification checks if `razorpay_payment_id` already exists
- Database transaction ensures atomic wallet update
- Prevents duplicate credit additions

---

## 🎨 Frontend Pages

### 1. **Home Page** (`/`)
Professional landing page with:
- Hero section: "AI Customer Support That Never Sleeps"
- Features showcase
- Billing model explanation
- Pricing cards (Starter, Growth, Pro)
- Demo CTA
- Contact section

### 2. **Dashboard** (`/dashboard`)
- **Overview** - Key metrics and quick actions
- **Billing** - Wallet balance, purchase plans, transaction history
- **Demo Lab** - Simulate AI usage and credit consumption
- **Business Profile** - Business setup and configuration

### 3. **Billing Page** (`/dashboard/billing`)
- Current balance display
- Active plan information
- Autopay status
- Pricing plans with "Buy Now" buttons
- Razorpay checkout integration
- Recharge history
- Usage history

---

## 🚀 Deployment Instructions

### Prerequisites

1. **Razorpay Account** (Test Mode)
   - Sign up at https://dashboard.razorpay.com
   - Get test API keys
   - Test Key ID: `rzp_test_xxxxx`
   - Test Key Secret: `xxxxx`

2. **PostgreSQL Database**
   - PostgreSQL 14+ hosted (Aiven, Neon, Supabase, or Railway)
   - Connection string format: `postgresql://user:password@host:5432/dbname`

3. **Deployment Platforms**
   - **Backend**: Render, Railway, or Vercel
   - **Frontend**: Vercel (recommended)

---

### 🔴 Backend Deployment (Render/Railway)

#### Step 1: Push Code to GitHub

```bash
cd backend
git init
git add .
git commit -m "Initial backend setup"
git remote add origin <your-github-repo-url>
git push -u origin main
```

#### Step 2: Deploy to Render

1. Go to https://render.com
2. Click "New+" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `versafic-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free tier is fine for testing

#### Step 3: Add Environment Variables

In Render dashboard, add these environment variables:

```env
NODE_ENV=production
PORT=5000

# Database (from your PostgreSQL provider)
DATABASE_URL=postgresql://user:password@host:5432/versafic

# JWT Secrets (generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this

# Razorpay Test Mode Keys
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# CORS (update with your Vercel frontend URL)
CORS_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app

# Public URL (your Render backend URL)
PUBLIC_BASE_URL=https://versafic-backend.onrender.com
```

#### Step 4: Run Database Migrations

After deployment, connect to your database and run:

```bash
psql $DATABASE_URL -f migrations/001_create_users_table.sql
psql $DATABASE_URL -f migrations/002_create_business_profiles_table.sql
# ... run all migration files in order
psql $DATABASE_URL -f migrations/009_upgrade_autopay_and_call_compliance.sql
```

Or use the built-in migration script:
```bash
npm run db:init
```

---

### 🔵 Frontend Deployment (Vercel)

#### Step 1: Prepare Frontend

```bash
cd frontend
```

Verify `vercel.json` exists:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Step 2: Deploy to Vercel

**Option A: Vercel CLI**

```bash
npm install -g vercel
vercel login
vercel
```

**Option B: Vercel Dashboard**

1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

#### Step 3: Add Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```env
VITE_API_URL=https://versafic-backend.onrender.com
VITE_BILLING_MODE=live
```

#### Step 4: Deploy

Click "Deploy" - Vercel will build and deploy your site.

**Your live URL**: `https://versafic.vercel.app` (or custom domain)

---

## 🔐 Razorpay Setup Guide

### Step 1: Create Razorpay Account

1. Go to https://dashboard.razorpay.com/signup
2. Sign up with email
3. Complete business verification

### Step 2: Get Test API Keys

1. Login to Razorpay Dashboard
2. Go to **Settings** → **API Keys**
3. Click **Generate Test Key**
4. Copy:
   - **Key ID**: `rzp_test_xxxxxxxxxxxxx`
   - **Key Secret**: `xxxxxxxxxxxxx`

### Step 3: Configure Webhook (Optional)

1. Go to **Settings** → **Webhooks**
2. Add webhook URL: `https://your-backend.onrender.com/api/webhooks/razorpay`
3. Generate webhook secret
4. Select events: `payment.captured`, `payment.failed`

### Step 4: Test Payment

Use Razorpay test cards:

**Success:**
- Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date

**Failure:**
- Card: `4000 0000 0000 0002`

---

## 🧪 Testing the Complete Flow

### 1. Register a User

```bash
POST https://your-backend.onrender.com/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```

### 2. Login

```bash
POST https://your-backend.onrender.com/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```

Save the `access_token` from response.

### 3. Check Wallet Balance

```bash
GET https://your-backend.onrender.com/billing/wallet
Authorization: Bearer <your_access_token>
```

### 4. Create Order

```bash
POST https://your-backend.onrender.com/billing/create-order
Authorization: Bearer <your_access_token>
Content-Type: application/json

{
  "plan_id": "starter"
}
```

### 5. Complete Payment on Frontend

Open frontend → Login → Go to Billing → Click "Buy Starter Plan"

### 6. Verify Credits Added

```bash
GET https://your-backend.onrender.com/billing/wallet
Authorization: Bearer <your_access_token>
```

Should show `balance_credits: 990`

---

## 📊 Pricing Plans

| Plan | Price | Credits | Ideal For |
|------|-------|---------|-----------|
| **Starter** | ₹99 | 990 credits | Small businesses, testing AI support |
| **Growth** | ₹199 | 1,990 credits | Growing businesses, moderate usage |
| **Pro** | ₹499 | 4,990 credits | Established businesses, high volume |

**Credit Conversion**: ₹1 = 10 credits

### Usage Costs

| Service | Cost | Description |
|---------|------|-------------|
| AI Chat Message | 5 credits | Each chat request/response |
| Voice Call (per minute) | 20 credits | Inbound/outbound call handling |
| Speech-to-Text | 2 credits | Sarvam STT processing |
| Recording Processing | 5 credits | Post-call transcription |
| AI Onboarding Setup | 50 credits | Initial business setup |

---

## 🎯 Marketing Copy for Razorpay Application

### Product Description (Short)

**Versafic - AI-Powered Customer Communication Platform**

An intelligent customer service platform that helps restaurants, hotels, clinics, and service businesses automate phone calls, voice interactions, and chat support using AI. Businesses purchase credits, and usage is transparently tracked per call, chat, or voice process. Our credit-based billing with auto-recharge ensures seamless service delivery.

---

### Company Description (For Razorpay Signup)

**Company Name**: Versafic  
**Business Type**: SaaS Platform  
**Industry**: AI-powered Customer Service & Communication Automation

**About Versafic**:

Versafic is a business-to-business SaaS platform that enables restaurants, hotels, clinics, and service companies to automate customer communications using artificial intelligence. Our platform handles customer phone calls, voice queries, and chat support 24/7, allowing businesses to provide better service while reducing operational costs.

We operate on a transparent credit-based billing model where businesses purchase credits (₹1 = 10 credits) and consumption is tracked per service usage: AI chat messages (5 credits), call minutes (20 credits), and voice processing (2-5 credits). Businesses can top up credits instantly via Razorpay or enable auto-recharge for uninterrupted service.

Our target customers are SMBs and enterprises in hospitality, healthcare, retail, and professional services who need scalable, affordable AI customer support without hiring additional staff.

**Revenue Model**: Credit-based SaaS subscription with usage-based billing  
**Payment Frequency**: On-demand top-ups and optional auto-recharge  
**Average Transaction**: ₹99 - ₹499 per top-up

---

### Business Model Explanation

**How Versafic Makes Money:**

Versafic operates a B2B SaaS model with credit-based billing:

1. **Credit Purchase**: Businesses buy credit packs (Starter: ₹99 = 990 credits, Growth: ₹199 = 1,990 credits, Pro: ₹499 = 4,990 credits)

2. **Usage Consumption**: Credits are deducted based on actual service usage:
   - AI chat support: 5 credits per message
   - Voice call handling: 20 credits per minute
   - Voice processing: 2-5 credits per action
   - Onboarding: 50 credits one-time

3. **Auto-Recharge**: Businesses can enable autopay to automatically purchase credits when balance falls below a threshold

4. **Transparent Billing**: Every action is logged and businesses see exactly where credits are spent

5. **Scalable Revenue**: As businesses grow their customer interactions, credit consumption increases naturally

This model ensures predictable pricing for customers while aligning our revenue with actual value delivered. Businesses love the transparency and pay-as-you-use flexibility.

---

### Website/Use Case Description (For Razorpay)

**What is Versafic used for?**

Versafic is an AI customer service platform for businesses to automate phone calls, voice interactions, and chat support. Businesses register, add their profile, purchase credits via Razorpay, and our AI handles customer queries 24/7. Credits are consumed based on usage (calls, chats, voice processing). The website provides:

- Public landing page explaining our AI service
- Pricing plans (₹99, ₹199, ₹499 credit packs)
- User dashboard showing credit balance and usage history
- Razorpay payment integration for instant credit top-ups
- Auto-recharge feature for uninterrupted service
- Demo environment for businesses to test before committing

**Target customers**: Restaurants, hotels, clinics, service companies, and SMBs in India needing AI phone/chat support without hiring staff.

---

## 🌐 Website Copy & Headlines

### Hero Section

**Headline**: AI Customer Support That Never Sleeps

**Subheadline**: Automate customer calls, voice queries, and chat support for your restaurant, hotel, clinic, or service business. Pay only for what you use with transparent credit-based billing.

**CTA Buttons**: 
- "Start Free Trial" → `/register`
- "Book Demo" → `/contact`
- "View Pricing" → `#pricing`

---

### Features Section

**Title**: Why Businesses Choose Versafic

1. **24/7 AI Call Handling**
   - Never miss a customer call again. Our AI assistant handles inbound calls, takes orders, books appointments, and answers questions round-the-clock.

2. **Voice + Chat Automation**
   - Unified platform for phone calls, voice messages, and text chat. One credit balance powers all your customer communication channels.

3. **Credit-Based Pricing**
   - Complete transparency: ₹1 = 10 credits. See exactly how many credits each call, chat, or voice process consumes. No hidden fees.

4. **Auto-Recharge Protection**
   - Enable autopay to automatically purchase credits when balance runs low. Your AI service stays online without manual intervention.

5. **Multi-Language Support**
   - Serve customers in Hindi, English, and regional languages. AI understands accents and context.

6. **Easy Onboarding**
   - Set up in 10 minutes. Add your business details, train the AI with your FAQs, and start receiving calls.

---

### How It Works

**Title**: From Signup to AI Support in 4 Steps

1. **Sign Up & Add Business Details**
   - Create your account and tell us about your business. Add your menu, services, or products.

2. **Buy Credits**
   - Purchase a starter pack (₹99 = 990 credits) or choose Growth/Pro plans. Instant activation via Razorpay.

3. **Configure AI Assistant**
   - Train the AI with your FAQs, business hours, and response templates. Connect your phone number.

4. **AI Handles Customer Calls**
   - Customers call, AI responds intelligently. Credits are consumed transparently per minute/message.

---

### Pricing Section

**Title**: Simple, Transparent Pricing

**Starter Plan - ₹99**
- 990 credits
- ~198 AI chat messages OR
- ~49 call minutes
- Perfect for small businesses testing AI support
- Razorpay payment, instant activation

**Growth Plan - ₹199** (Most Popular)
- 1,990 credits
- ~398 AI chat messages OR
- ~99 call minutes
- Ideal for growing businesses with moderate call volume
- Auto-recharge available

**Pro Plan - ₹499**
- 4,990 credits
- ~998 AI chat messages OR
- ~249 call minutes
- For established businesses with high customer interaction
- Priority support included

**Enterprise**: Custom pricing for 10,000+ credits/month

---

### Contact/Demo Section

**Title**: See Versafic in Action

**Copy**: Book a 15-minute live demo where we'll show you:
- How the AI handles real customer calls
- Credit consumption in real-time
- Dashboard for tracking usage and balance
- Auto-recharge and billing transparency
- Integration with your existing systems

**Form Fields**:
- Business Name
- Contact Person
- Email
- Phone Number
- Business Type (Restaurant / Hotel / Clinic / Other)
- Preferred Demo Time

**CTA**: "Book Demo Call" / "Contact Sales"

---

### Footer

**About Versafic**  
AI-powered customer communication platform for businesses. Automate calls, chat, and voice support with transparent credit-based billing.

**Product**
- Features
- Pricing
- How It Works
- Demo

**Legal**
- Privacy Policy
- Terms of Service
- Refund Policy

**Support**
- Help Center
- Contact Us
- API Documentation

**Contact**
- Email: support@versafic.com
- Phone: +91 XXXXX XXXXX
- Address: Your Business Address

---

## 📱 Social Media & Meta Tags

### Meta Description
"AI customer service platform for restaurants, hotels, and clinics. Automate calls and chat with transparent credit billing. ₹99 starter plan."

### Twitter Card
**Title**: Versafic - AI Customer Support for Businesses  
**Description**: Automate phone calls and chat support with AI. Pay-per-use credits. ₹1 = 10 credits.  
**Image**: Screenshot of dashboard showing credit balance

### LinkedIn Description
"Versafic helps restaurants, hotels, clinics, and service businesses automate customer communications using AI. Our credit-based SaaS platform handles phone calls, voice queries, and chat support 24/7. Transparent pricing: ₹1 = 10 credits. Consumption tracked per call, chat, or voice action. Enable autopay for seamless operation. Built for Indian SMBs seeking affordable AI customer service."

---

## 🎬 Demo Script (For Client Presentations)

### Act 1: The Problem (30 seconds)
"Most small businesses miss customer calls because staff is busy or it's after hours. Every missed call is lost revenue."

### Act 2: The Solution (1 minute)
"Versafic's AI answers every call, 24/7. Let me show you the dashboard. Here's my live credit balance: 1,990 credits. I'll simulate an AI chat request... watch the balance update instantly. Each message costs 5 credits. Now let me trigger an AI call... and here's the transaction history showing exactly where credits went."

### Act 3: The Economics (1 minute)
"Pricing is dead simple: ₹1 = 10 credits. A chat message is 5 credits (₹0.50). A call minute is 20 credits (₹2). Compare that to hiring staff. And if your balance runs low, autopay kicks in automatically."

### Act 4: The Proof (30 seconds)
"This is a real Razorpay integration. I'll buy credits right now... payment done, credits added instantly. This exact flow is what your finance team will see."

### Act 5: The Close (30 seconds)
"You can start with ₹99, test it for a week, see real usage data. If it works, enable autopay and never think about it again. Your customers get answered, you save money, everyone wins."

---

## 🛠️ Environment Variables Reference

### Backend `.env`

```env
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@host:5432/versafic

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# CORS
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
FRONTEND_URL=https://your-app.vercel.app

# Public URL
PUBLIC_BASE_URL=https://your-backend.onrender.com

# Optional: AI Services
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
SARVAM_API_KEY=xxxxxxxxxxxxx

# Optional: Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Frontend `.env`

```env
# API Configuration
VITE_API_URL=https://your-backend.onrender.com

# Billing Mode (live | hybrid | mock)
VITE_BILLING_MODE=live

# Optional: Google OAuth
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
```

---

## ✅ Pre-Deployment Checklist

### Backend
- [ ] Database migrations run successfully
- [ ] Razorpay test keys configured
- [ ] JWT secrets are strong random strings
- [ ] CORS origins include frontend URL
- [ ] Environment variables set in hosting platform
- [ ] Backend accessible via HTTPS
- [ ] `/billing/plans` endpoint returns data (test without auth)
- [ ] `/auth/register` and `/auth/login` work

### Frontend
- [ ] `VITE_API_URL` points to deployed backend
- [ ] `VITE_BILLING_MODE=live` set
- [ ] `vercel.json` exists for SPA routing
- [ ] Build completes without errors (`npm run build`)
- [ ] Frontend accessible via HTTPS
- [ ] Can register new user
- [ ] Can login and access dashboard
- [ ] Can see pricing plans on billing page

### Razorpay
- [ ] Test API keys obtained
- [ ] Keys added to backend environment
- [ ] Test payment completes successfully
- [ ] Credits added to wallet after payment
- [ ] Webhook configured (optional)

### Integration Test
- [ ] Register user on frontend
- [ ] Login to dashboard
- [ ] Go to billing page
- [ ] Click "Buy Starter Plan"
- [ ] Complete Razorpay test payment
- [ ] See balance update to 990 credits
- [ ] Check transaction history shows topup

---

## 🐛 Troubleshooting

### Issue: "Razorpay is not configured"

**Solution**: Check backend logs. Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set correctly.

```bash
# Verify environment variable
echo $RAZORPAY_KEY_ID
# Should output: rzp_test_xxxxx
```

### Issue: Payment verification fails

**Solution**: Signature mismatch. Ensure:
1. `RAZORPAY_KEY_SECRET` matches your Razorpay dashboard
2. Frontend sends correct `razorpay_signature`, `razorpay_order_id`, `razorpay_payment_id`
3. Check backend logs for verification details

### Issue: CORS error on frontend

**Solution**: Add frontend URL to backend CORS whitelist:

```env
CORS_ORIGINS=https://versafic.vercel.app
FRONTEND_URL=https://versafic.vercel.app
```

Restart backend after changing environment variables.

### Issue: Credits not added after payment

**Solution**: Check:
1. Payment status is "paid" in database: `SELECT * FROM payments WHERE razorpay_payment_id='pay_xxxxx';`
2. Wallet exists: `SELECT * FROM wallets WHERE user_id=1;`
3. Transaction logged: `SELECT * FROM credit_transactions WHERE user_id=1;`

### Issue: Frontend shows "Network Error"

**Solution**:
1. Check backend is running: `curl https://your-backend.onrender.com/health`
2. Verify `VITE_API_URL` in frontend environment
3. Check browser console for actual error

---

## 📞 Support & Next Steps

### Immediate Actions

1. **Deploy Backend** → Get live backend URL
2. **Deploy Frontend** → Get Vercel URL for Razorpay signup
3. **Test Payment Flow** → Complete one test transaction
4. **Apply to Razorpay** → Submit business verification with website URL

### Razorpay Business Verification

Once your website is live:

1. Login to Razorpay Dashboard
2. Go to **Settings** → **Account & Settings**
3. Complete KYC:
   - Business details
   - Website URL: `https://versafic.vercel.app`
   - Business type: SaaS/Technology
   - Product description: Use the marketing copy above
4. Submit for verification
5. Move to production keys once approved

### Production Readiness

Before going live with real customers:

- [ ] Switch from test keys to production Razorpay keys
- [ ] Set up proper database backups
- [ ] Add monitoring (Sentry, Datadog, or similar)
- [ ] Set up error alerting
- [ ] Configure webhook for payment confirmations
- [ ] Add refund policy page
- [ ] Add privacy policy and terms
- [ ] Set up customer support email
- [ ] Test payment failures and edge cases

---

## 🎉 Congratulations!

You now have a **production-ready AI customer service platform** with:

✅ Full Razorpay payment integration  
✅ Credit-based billing system  
✅ Wallet management with transactions  
✅ Auto-recharge capability  
✅ Professional SaaS website  
✅ User authentication  
✅ Dashboard with real-time data  
✅ Deployment-ready frontend and backend  

**Your website is ready for Razorpay signup and client demos!**

---

## 📚 Additional Resources

- **Razorpay Docs**: https://razorpay.com/docs/
- **Vercel Deployment**: https://vercel.com/docs
- **Render Deployment**: https://render.com/docs
- **PostgreSQL on Aiven**: https://aiven.io/postgresql

**Need help?** Contact: support@versafic.com

---

*Last Updated: March 2024*  
*Version: 1.0.0 - Production MVP*
