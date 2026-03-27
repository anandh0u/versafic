# 🎯 VERSAFIC - QUICK REFERENCE CARD

**Keep this handy during deployment and Razorpay signup**

---

## 🚀 DEPLOYMENT COMMANDS

### Backend (Render)
```bash
# Deploy via dashboard:
# 1. Connect GitHub repo
# 2. Root: backend
# 3. Build: npm install && npm run build
# 4. Start: npm start
```

### Frontend (Vercel)
```bash
cd frontend
vercel login
vercel --prod
```

---

## 🔐 ENVIRONMENT VARIABLES

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=min-32-chars-random-string
JWT_REFRESH_SECRET=min-32-chars-random-string
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
CORS_ORIGINS=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
PUBLIC_BASE_URL=https://your-backend.onrender.com
```

### Frontend (.env)
```env
VITE_API_URL=https://your-backend.onrender.com
VITE_BILLING_MODE=live
```

---

## 💳 RAZORPAY TEST CARDS

**Success:**
- Card: `4111 1111 1111 1111`
- CVV: `123`
- Expiry: `12/25`

**Failure:**
- Card: `4000 0000 0000 0002`

---

## 📝 RAZORPAY SIGNUP COPY

### Product Description (50 words)
```
Versafic is an AI-powered customer communication platform for 
restaurants, hotels, clinics, and service businesses. It automates 
phone calls, voice interactions, and chat support using AI. 
Businesses purchase credits (₹1 = 10 credits), and usage is tracked 
per call, chat, or voice process with transparent billing.
```

### Company Description (100 words)
```
Versafic is a B2B SaaS platform that enables restaurants, hotels, 
clinics, and service companies to automate customer communications 
using AI. Our platform handles customer phone calls, voice queries, 
and chat support 24/7. We operate on a transparent credit-based 
billing model where businesses purchase credits (₹1 = 10 credits) 
and consumption is tracked per usage. Target customers are SMBs 
and enterprises in hospitality, healthcare, retail, and professional 
services who need scalable, affordable AI customer support.

Revenue Model: Credit-based SaaS with usage billing
Average Transaction: ₹99 - ₹499 per top-up
```

### Website Use Case (100 words)
```
Versafic is an AI customer service platform for businesses to 
automate phone calls, voice interactions, and chat support. 
Businesses register, add their profile, purchase credits via 
Razorpay, and our AI handles customer queries 24/7. 

Website provides:
- Public landing page explaining AI service
- Pricing plans (₹99, ₹199, ₹499 credit packs)
- User dashboard showing balance and usage
- Razorpay integration for instant top-ups
- Auto-recharge for uninterrupted service

Target: Restaurants, hotels, clinics, SMBs in India.
```

---

## 💰 PRICING PLANS

| Plan | Price | Credits | Usage |
|------|-------|---------|-------|
| Starter | ₹99 | 990 | ~49 call mins OR ~198 chats |
| Growth | ₹199 | 1,990 | ~99 call mins OR ~398 chats |
| Pro | ₹499 | 4,990 | ~249 call mins OR ~998 chats |

**Conversion**: ₹1 = 10 credits

**Usage Costs**:
- Chat: 5 credits (₹0.50)
- Call/min: 20 credits (₹2)
- STT: 2 credits (₹0.20)
- Recording: 5 credits (₹0.50)

---

## 🗄️ DATABASE MIGRATIONS

Run in order:
```bash
psql $DATABASE_URL -f backend/migrations/001_create_users_table.sql
psql $DATABASE_URL -f backend/migrations/002_create_business_profiles_table.sql
psql $DATABASE_URL -f backend/migrations/003_create_chat_history_table.sql
psql $DATABASE_URL -f backend/migrations/004_create_call_recordings_table.sql
psql $DATABASE_URL -f backend/migrations/005_create_call_sessions_table.sql
psql $DATABASE_URL -f backend/migrations/006_create_ai_interactions_table.sql
psql $DATABASE_URL -f backend/migrations/007_create_billing_tables.sql
psql $DATABASE_URL -f backend/migrations/008_add_autopay_tables.sql
psql $DATABASE_URL -f backend/migrations/009_upgrade_autopay_and_call_compliance.sql
```

Or use script:
```bash
cd backend
npm run db:init
```

---

## 🧪 TESTING FLOW

### 1. Test Backend
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status":"ok"}
```

### 2. Test Frontend
```bash
# Open in browser
https://your-frontend.vercel.app
# Should load landing page
```

### 3. Test Auth
```bash
# Register at /register
# Login at /login
# Should redirect to /dashboard
```

### 4. Test Billing
```bash
# Go to /dashboard/billing
# Click "Buy Starter Plan"
# Use test card: 4111 1111 1111 1111
# Complete payment
# Should see balance: 990 credits
```

---

## 🔧 TROUBLESHOOTING

### Backend not connecting
```bash
# Check CORS
CORS_ORIGINS=https://your-frontend.vercel.app

# Restart backend
```

### Razorpay not working
```bash
# Check keys format
RAZORPAY_KEY_ID=rzp_test_xxxxx  # Must start with rzp_test_
RAZORPAY_KEY_SECRET=xxxxx       # Must match dashboard
```

### Payment fails
```bash
# Check backend logs
# Verify signature verification code
# Ensure all 3 params sent from frontend
```

### Database errors
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Check tables exist
psql $DATABASE_URL -c "\dt"
```

---

## 🎯 API ENDPOINTS

### Public
```
GET /billing/plans
```

### Protected (require Bearer token)
```
POST /auth/register
POST /auth/login
POST /billing/create-order
POST /billing/verify-payment
GET  /billing/wallet
POST /billing/deduct
GET  /billing/check-balance
```

---

## 📱 FRONTEND PAGES

```
/                    - Landing page
/login               - User login
/register            - User registration
/dashboard           - Main dashboard
/dashboard/billing   - Billing & payments ⭐
/dashboard/demo      - Usage demo
/dashboard/business  - Business profile
```

---

## 🎨 BRAND ASSETS

**Colors**:
- Primary: Emerald (#2EC4B6)
- Secondary: Amber (#FBBF24)
- Accent: Sky (#0EA5E9)
- Background: Slate (#0F172A)

**Tagline**:
"AI Customer Support That Never Sleeps"

**Value Props**:
- 24/7 AI call handling
- Transparent credit billing
- Pay only for usage
- ₹1 = 10 credits

---

## 📧 SUPPORT EMAIL TEMPLATES

### Welcome Email
```
Subject: Welcome to Versafic - ₹99 Starter Plan

Hi [Name],

Your account is ready! Start with:
1. Buy ₹99 starter pack (990 credits)
2. Configure your AI
3. Test your first call

Get Started: [dashboard_link]
```

### Low Balance
```
Subject: Credit Balance Low - Top Up Now

Hi [Name],

Balance: [X] credits (~[Y] days remaining)

Top up: [link]
Enable autopay: [link]
```

---

## 🔗 USEFUL LINKS

**Deployment**:
- Render: https://dashboard.render.com
- Vercel: https://vercel.com/dashboard
- Razorpay: https://dashboard.razorpay.com

**Documentation**:
- QUICK_DEPLOY_GUIDE.md
- PRODUCTION_MVP_GUIDE.md
- MARKETING_COPY_REFERENCE.md
- BUILD_COMPLETE_SUMMARY.md
- VERIFICATION_CHECKLIST.md

**Resources**:
- Razorpay Docs: https://razorpay.com/docs/
- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs

---

## ✅ DEPLOYMENT CHECKLIST

### Before Deploy
- [ ] Database created and accessible
- [ ] Razorpay test keys obtained
- [ ] GitHub repo ready
- [ ] Read QUICK_DEPLOY_GUIDE.md

### Backend
- [ ] Deployed to Render/Railway
- [ ] Environment variables set
- [ ] Health endpoint returns 200
- [ ] Plans endpoint works
- [ ] Database migrations ran

### Frontend
- [ ] Deployed to Vercel
- [ ] VITE_API_URL set correctly
- [ ] Can access landing page
- [ ] Can register/login
- [ ] Billing page loads

### Integration
- [ ] Backend CORS includes frontend URL
- [ ] Frontend can call backend APIs
- [ ] Register/login works
- [ ] Test payment completes
- [ ] Credits added to wallet

### Razorpay
- [ ] Applied with website URL
- [ ] Submitted product description
- [ ] KYC documents uploaded
- [ ] Waiting for approval

---

## 🎉 SUCCESS METRICS

**Technical**:
- [ ] Backend: 99.9% uptime
- [ ] Frontend: < 2s load time
- [ ] Payment: < 5s to complete
- [ ] API: < 200ms response time

**Business**:
- [ ] 10 test users registered
- [ ] 5 successful test payments
- [ ] 0 payment failures
- [ ] Razorpay KYC approved

---

## 🚀 NEXT STEPS AFTER DEPLOY

### Day 1
- Deploy backend & frontend
- Test complete flow
- Submit Razorpay KYC

### Week 1
- Get Razorpay approval
- Switch to production keys
- Add legal pages
- Set up analytics

### Week 2
- First customer tests
- Collect feedback
- Marketing materials
- Social media launch

### Month 1
- Product Hunt launch
- Content marketing
- SEO optimization
- Customer support setup

---

## 💰 REVENUE PROJECTIONS

**Per Customer**:
- Small: ₹99-199/month
- Medium: ₹499-999/month
- Large: ₹2,000+/month

**Target: 100 customers**:
- Conservative: ₹20,000/month
- Realistic: ₹50,000/month
- Optimistic: ₹1,00,000/month

**Costs**:
- Hosting: ₹2,000/month
- OpenAI API: ~30% of revenue
- Twilio: ~20% of revenue
- Net margin: ~45%

---

## 📞 ELEVATOR PITCH (30 sec)

"Versafic helps restaurants, hotels, and clinics automate 
customer calls using AI. Never miss a customer call again. 
Pay only for what you use: ₹1 = 10 credits. A chat costs 
5 credits (50 paise), a call minute costs 20 credits (₹2). 
Start with ₹99. We serve Indian SMBs who need affordable 
24/7 AI customer support."

---

## 🎯 ONE-LINER

"AI Customer Support for ₹2 per call minute - Never miss a customer again"

---

**Print this page and keep it on your desk during deployment!** 📄

---

*Last Updated: March 2024*
*Quick Ref v1.0*
