# 🚀 VERSAFIC - QUICK START DEPLOYMENT GUIDE

**Goal**: Get your production MVP live on Vercel in 30 minutes and ready for Razorpay signup.

---

## ⚡ PREREQUISITES (5 minutes)

1. **Razorpay Test Account**
   - Sign up: https://dashboard.razorpay.com/signup
   - Go to Settings → API Keys → Generate Test Key
   - Save: `rzp_test_xxxxx` (Key ID) and secret

2. **PostgreSQL Database**
   - Use Aiven (free): https://console.aiven.io/signup
   - Or Neon: https://neon.tech
   - Or Supabase: https://supabase.com
   - Get connection string: `postgresql://user:password@host:5432/dbname`

3. **Vercel Account**
   - Sign up: https://vercel.com/signup
   - Install CLI: `npm install -g vercel`

4. **Render Account** (for backend)
   - Sign up: https://dashboard.render.com/register
   - Or use Railway: https://railway.app

---

## 📦 STEP 1: Database Setup (5 minutes)

### Option A: Using PostgreSQL Client

```bash
cd backend/migrations

# Run migrations in order
psql YOUR_DATABASE_URL -f 001_create_users_table.sql
psql YOUR_DATABASE_URL -f 002_create_business_profiles_table.sql
psql YOUR_DATABASE_URL -f 003_create_chat_history_table.sql
psql YOUR_DATABASE_URL -f 004_create_call_recordings_table.sql
psql YOUR_DATABASE_URL -f 005_create_call_sessions_table.sql
psql YOUR_DATABASE_URL -f 006_create_ai_interactions_table.sql
psql YOUR_DATABASE_URL -f 007_create_billing_tables.sql
psql YOUR_DATABASE_URL -f 008_add_autopay_tables.sql
psql YOUR_DATABASE_URL -f 009_upgrade_autopay_and_call_compliance.sql
```

### Option B: Using SQL Client (DBeaver, pgAdmin)

1. Connect to your database
2. Open each `.sql` file in `backend/migrations/`
3. Execute them in order (001, 002, 003... 009)

### Verify Tables Created

```sql
-- Run this query to check
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show:
-- users, business_profiles, wallets, payments, credit_transactions, etc.
```

---

## 🔴 STEP 2: Backend Deployment (10 minutes)

### Deploy to Render

1. **Go to Render**: https://dashboard.render.com

2. **Create Web Service**:
   - Click "New+" → "Web Service"
   - Connect GitHub repository
   - Select `backend` directory

3. **Configure**:
   - **Name**: `versafic-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

4. **Add Environment Variables**:

```env
NODE_ENV=production
PORT=5000

# Database - YOUR actual connection string
DATABASE_URL=postgresql://user:password@host:5432/versafic

# JWT - Generate random strings
JWT_SECRET=generate-a-very-long-random-string-here-min-32-characters
JWT_REFRESH_SECRET=another-different-long-random-string-here-min-32-chars

# Razorpay - YOUR test keys
RAZORPAY_KEY_ID=rzp_test_your_actual_key_here
RAZORPAY_KEY_SECRET=your_actual_secret_key_here
RAZORPAY_WEBHOOK_SECRET=optional_webhook_secret

# CORS - Will update after frontend deployment
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Public URL - Your Render URL
PUBLIC_BASE_URL=https://versafic-backend.onrender.com
```

5. **Deploy**: Click "Create Web Service"

6. **Wait for deployment** (3-5 minutes)

7. **Test backend**: Visit `https://versafic-backend.onrender.com/health`

**✅ Save your backend URL**: `https://versafic-backend.onrender.com`

---

## 🔵 STEP 3: Frontend Deployment (10 minutes)

### Deploy to Vercel

**Option A: Vercel CLI (Recommended)**

```bash
# Navigate to frontend
cd frontend

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - What's your project's name? versafic
# - In which directory is your code located? ./
# - Want to override the settings? No

# Deploy to production
vercel --prod
```

**Option B: Vercel Dashboard**

1. Go to: https://vercel.com/new
2. Import Git Repository
3. Select your `Versafic` repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Environment Variables** (Critical!):

```env
VITE_API_URL=https://versafic-backend.onrender.com
VITE_BILLING_MODE=live
```

6. Click "Deploy"

7. Wait for deployment (2-3 minutes)

**✅ Save your frontend URL**: `https://versafic.vercel.app`

---

## 🔗 STEP 4: Connect Frontend & Backend (2 minutes)

### Update Backend CORS

Go back to **Render Dashboard** → Your service → Environment:

Update these variables:

```env
CORS_ORIGINS=https://versafic.vercel.app,http://localhost:5173
FRONTEND_URL=https://versafic.vercel.app
```

**Save changes** → Render will automatically redeploy.

### Verify Connection

1. Open: `https://versafic.vercel.app`
2. Click "Register" → Sign up
3. If successful, connection works! ✅

---

## ✅ STEP 5: Test Payment Flow (5 minutes)

### Test Complete Integration

1. **Register User**:
   - Go to: `https://versafic.vercel.app/register`
   - Email: `test@example.com`
   - Password: `SecurePass123!`
   - Click "Register"

2. **Login**:
   - Email: `test@example.com`
   - Password: `SecurePass123!`

3. **Go to Billing**:
   - Click "Billing" in sidebar
   - You should see pricing plans

4. **Buy Credits**:
   - Click "Buy Now" on Starter Plan (₹99)
   - Razorpay checkout should open
   - Use test card: `4111 1111 1111 1111`
   - CVV: `123`
   - Expiry: `12/25`
   - Complete payment

5. **Verify Credits**:
   - After payment, you should see: "Balance: 990 credits"
   - Check "Recharge History" - should show ₹99 top-up
   - ✅ **Success!** Your billing system works!

### If Payment Fails

**Check Backend Logs**:
```bash
# In Render dashboard
Logs tab → Look for errors
```

**Common Issues**:
- Wrong Razorpay keys → Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- Database connection error → Check `DATABASE_URL`
- CORS error → Check `CORS_ORIGINS` includes your Vercel URL

---

## 🎉 YOU'RE LIVE!

**Your URLs**:
- **Frontend**: `https://versafic.vercel.app`
- **Backend**: `https://versafic-backend.onrender.com`

**What You Can Do Now**:

1. ✅ Use frontend URL for Razorpay business verification
2. ✅ Show clients a live, working demo
3. ✅ Test payment flows with Razorpay test mode
4. ✅ Complete Razorpay KYC with your website link

---

## 📝 RAZORPAY SIGNUP STEPS

Now that your website is live:

1. **Login to Razorpay**: https://dashboard.razorpay.com

2. **Complete KYC**:
   - Settings → Account & Settings
   - Fill business details

3. **Website URL**: `https://versafic.vercel.app`

4. **Business Type**: SaaS / Technology

5. **Product Description**:
```
Versafic is an AI-powered customer communication platform for businesses. 
We help restaurants, hotels, clinics, and service companies automate 
customer phone calls and chat support. Businesses purchase credits via 
Razorpay (₹99, ₹199, ₹499 plans) and credits are consumed based on usage. 
We operate on a transparent pay-per-use model.
```

6. **Documents Required**:
   - PAN card
   - Business proof (incorporation certificate / GST)
   - Bank account details
   - Authorized signatory ID

7. **Submit for Verification**

8. **Get Production Keys** (after approval):
   - Settings → API Keys → Generate Live Key
   - Replace test keys with live keys in backend environment

---

## 🔐 MOVING TO PRODUCTION

Once Razorpay approves your account:

### Update Backend Environment

```env
# Replace test keys with production keys
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=live_secret_key_here
```

### Update Frontend (if needed)

```env
# Already set to live
VITE_BILLING_MODE=live
```

### Test Live Payment

1. Use real card
2. Buy smallest plan (₹99)
3. Verify credits added
4. Check Razorpay dashboard for transaction

---

## 🛠️ TROUBLESHOOTING

### "Cannot connect to backend"

**Solution**: Check `VITE_API_URL` in Vercel environment variables.

```bash
# Should be
VITE_API_URL=https://versafic-backend.onrender.com
```

Redeploy frontend after fixing.

---

### "Razorpay is not configured"

**Solution**: Check backend environment variables:

```bash
# In Render dashboard
RAZORPAY_KEY_ID=rzp_test_xxxxx  # Must start with rzp_test_
RAZORPAY_KEY_SECRET=xxxxx       # Must match dashboard
```

Backend auto-restarts after changing env vars.

---

### "Payment verification failed"

**Solution**: 
1. Check `RAZORPAY_KEY_SECRET` matches your dashboard
2. Check backend logs for signature verification error
3. Ensure frontend sends all 3 fields: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`

---

### "CORS error" in browser console

**Solution**: Add Vercel URL to backend CORS:

```env
CORS_ORIGINS=https://versafic.vercel.app,http://localhost:5173
```

Save and wait for backend to redeploy.

---

### Database migration errors

**Solution**: Check if tables already exist:

```sql
-- Run this to see existing tables
\dt

-- If tables exist, skip that migration
-- If not, run migrations one by one
```

---

## 📊 MONITORING YOUR APP

### Check Backend Health

```bash
curl https://versafic-backend.onrender.com/health
# Should return: { "status": "ok" }
```

### Check Database Connection

```bash
curl https://versafic-backend.onrender.com/billing/plans
# Should return list of plans
```

### Check Frontend

```bash
curl -I https://versafic.vercel.app
# Should return: HTTP/2 200
```

---

## 🎯 NEXT STEPS

### Immediate (Today)

- [x] Backend deployed
- [x] Frontend deployed
- [x] Razorpay test payment works
- [ ] Submit Razorpay KYC
- [ ] Add custom domain (optional)
- [ ] Set up error monitoring (Sentry)

### Short Term (This Week)

- [ ] Complete Razorpay verification
- [ ] Switch to production keys
- [ ] Test live payment
- [ ] Add privacy policy page
- [ ] Add refund policy page
- [ ] Set up customer support email

### Medium Term (This Month)

- [ ] Add Google Analytics
- [ ] Set up email notifications
- [ ] Add WhatsApp support (optional)
- [ ] Create demo video
- [ ] Launch on Product Hunt
- [ ] Start marketing campaigns

---

## 📞 SUPPORT

**Need Help?**

- Email: support@versafic.com
- Documentation: See `PRODUCTION_MVP_GUIDE.md`
- Marketing Copy: See `MARKETING_COPY_REFERENCE.md`

**Deployment Issues?**

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Razorpay Docs: https://razorpay.com/docs

---

## 🎉 CONGRATULATIONS!

You now have a **fully functional production MVP**:

✅ Professional SaaS website  
✅ Complete Razorpay integration  
✅ Credit-based billing system  
✅ User authentication  
✅ Real-time wallet management  
✅ Transaction history  
✅ Auto-recharge capability  
✅ Production-ready backend  
✅ Vercel-deployed frontend  

**Time to close deals!** 🚀

---

## 📸 SCREENSHOTS FOR RAZORPAY

When submitting to Razorpay, provide these screenshots:

1. **Homepage**: `https://versafic.vercel.app`
2. **Pricing Page**: Scroll to pricing section
3. **Payment Flow**: Razorpay checkout modal
4. **Dashboard**: After login, billing page
5. **Transaction History**: Shows successful payment

These prove your business is legitimate and operational.

---

**Last Updated**: March 2024  
**Version**: 1.0 - Quick Start  

*Deploy fast. Ship faster. Scale fastest.* 🚀
