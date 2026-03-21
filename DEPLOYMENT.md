# Versafic - Deployment Guide

Complete deployment guide for the Versafic AI Customer Service Platform.

---

## Project Structure

```
Versafic/
├── backend/                 # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic (Razorpay, Wallet)
│   │   ├── models/          # Database operations
│   │   ├── middleware/      # Auth, error handling
│   │   ├── utils/           # Helpers (logger, email, etc.)
│   │   ├── config/          # Database config
│   │   └── types/           # TypeScript types
│   ├── migrations/          # PostgreSQL migrations
│   └── .env.example         # Environment template
│
└── frontend/                # React + Vite + Tailwind
    ├── src/
    │   ├── components/      # UI components
    │   ├── pages/           # Page components
    │   ├── services/        # API client
    │   ├── hooks/           # React hooks
    │   └── types/           # TypeScript types
    ├── vercel.json          # Vercel deployment config
    └── .env.example         # Environment template
```

---

## Backend Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Razorpay account (test mode)

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

**Required variables:**

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/versafic

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# CORS
CORS_ORIGINS=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
```

### Step 3: Run Database Migrations

```bash
npm run migrate
```

This will create all necessary tables including:
- `wallets` - User credit balances
- `payments` - Razorpay payment records
- `credit_transactions` - Credit usage history

### Step 4: Build and Start

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Deployment Options

**Railway / Render:**
1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. The service will auto-deploy on push

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Frontend Deployment (Vercel)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Configure Environment

Create `.env` file:

```env
VITE_API_URL=https://your-backend-url.com
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

### Step 3: Test Local Build

```bash
npm run build
npm run preview
```

### Step 4: Deploy to Vercel

**Option A: Vercel CLI**

```bash
npm i -g vercel
vercel login
vercel --prod
```

**Option B: Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Set root directory to `frontend`
5. Add environment variables:
   - `VITE_API_URL` = Your backend URL
   - `VITE_RAZORPAY_KEY_ID` = Your Razorpay test key
6. Click "Deploy"

### Vercel Configuration

The `vercel.json` file is already configured with:
- SPA routing (all routes → index.html)
- Security headers
- API proxy support (optional)

---

## Razorpay Setup

### Step 1: Create Account

1. Go to [razorpay.com](https://razorpay.com)
2. Sign up for a business account
3. Complete KYC verification

### Step 2: Get Test Keys

1. Login to Razorpay Dashboard
2. Go to Settings → API Keys
3. Generate Test Mode keys
4. Copy `Key ID` (starts with `rzp_test_`)
5. Copy `Key Secret`

### Step 3: Configure Webhook (Optional)

1. Go to Settings → Webhooks
2. Add webhook URL: `https://your-backend/api/billing/webhook`
3. Select events: `payment.captured`, `payment.failed`
4. Copy webhook secret to `RAZORPAY_WEBHOOK_SECRET`

### Test Card Details

For testing payments in test mode:
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits
- OTP: Use "success" or "failure" as needed

---

## Connect Frontend and Backend

### 1. CORS Configuration

In backend `.env`:
```env
CORS_ORIGINS=https://your-frontend.vercel.app
```

### 2. API URL

In frontend `.env`:
```env
VITE_API_URL=https://your-backend-url.com
```

### 3. Test the Connection

1. Open frontend in browser
2. Try to register/login
3. Check browser Network tab for API calls
4. Verify calls go to your backend URL

---

## Billing System Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/billing/plans` | GET | No | Get available pricing plans |
| `/api/billing/create-order` | POST | Yes | Create Razorpay order |
| `/api/billing/verify-payment` | POST | Yes | Verify payment & add credits |
| `/api/billing/wallet` | GET | Yes | Get wallet balance & transactions |
| `/api/billing/check-balance` | GET | Yes | Check if sufficient balance |
| `/api/billing/deduct` | POST | Yes | Deduct credits for usage |

### Create Order Request

```json
{
  "planId": "starter",
  "amount": 9900,
  "credits": 990
}
```

### Verify Payment Request

```json
{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "xxxxx"
}
```

---

## Production Checklist

- [ ] Use production database
- [ ] Set secure JWT secrets (32+ characters)
- [ ] Switch to Razorpay live keys
- [ ] Enable HTTPS everywhere
- [ ] Set proper CORS origins
- [ ] Configure rate limiting
- [ ] Set up monitoring/logging
- [ ] Enable database backups
- [ ] Test payment flow end-to-end

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` includes your frontend URL
- Check for trailing slashes in URLs

### Payment Failures
- Verify Razorpay keys are correct
- Check webhook secret matches
- Look at Razorpay dashboard logs

### Database Connection
- Verify `DATABASE_URL` format
- Check SSL requirements for cloud DBs
- Ensure migrations have run

### Build Failures
- Run `npm ci` for clean install
- Check Node.js version (18+)
- Review TypeScript errors

---

## Support

For issues or questions:
- Check the [GitHub Issues](https://github.com/your-repo/issues)
- Review API documentation
- Contact support@versafic.com
