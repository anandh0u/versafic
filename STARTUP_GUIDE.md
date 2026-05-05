# 🚀 VERSAFIC - COMPLETE STARTUP & DEPLOYMENT GUIDE

**Ready to Go Live in 5 Minutes**

---

## 🔥 QUICK START (5 MINUTES)

### Step 1: Start Backend
```bash
cd backend
npm install
npm run dev
```
✅ **Backend runs on:** http://localhost:5000

### Step 2: Start Frontend (New Terminal)
```bash
cd frontend
npm install
npm run dev
```
✅ **Frontend runs on:** http://localhost:3000

### Step 3: Open Browser
```
Visit: http://localhost:3000
```

✅ **You're Live!**

---

## 📱 IMMEDIATE TESTING

### Login Options
1. **Email Login:**
   - Email: `test@example.com`
   - Password: `TestPassword123!`

2. **Google OAuth:**
   - Click "Continue with Google"
   - Use your personal Google account

### Navigate to AI Settings
1. Login successfully
2. Click **Dashboard** button
3. Find **"AI Settings"** in sidebar
4. Scroll down to see demo buttons

### Test All Features (2 Minutes)

#### 1️⃣ Test Email
```
1. Find "Send Test Email" section
2. Enter your email: your-email@gmail.com
3. Click "Send"
4. Check inbox (might be in spam)
✅ You should see test email within 10-30 seconds
```

#### 2️⃣ Test SMS
```
1. Find "Test SMS" section
2. Enter your phone: 9876543210
3. Leave message blank (default used)
4. Click "Send Test"
✅ You should receive SMS within 10-30 seconds
```

#### 3️⃣ Test Call (Simulation)
```
1. Find "Simulate Incoming AI Call" section
2. Leave phone blank or enter test number
3. Click "Simulate"
✅ See call status and AI response
```

#### 4️⃣ Test Outbound Call
```
1. Find "Call to Assistant" section
2. Enter phone: 9876543210
3. Click "Call"
✅ See session ID and call status
```

---

## 🔧 ENVIRONMENT SETUP

### Create `.env` Files

**Backend: `backend/.env`**
```env
NODE_ENV=development
PORT=5000

# Database (Aiven PostgreSQL)
DB_HOST=<YOUR_AIVEN_HOST>
DB_PORT=14340
DB_USER=<YOUR_DB_USER>
DB_PASSWORD=<YOUR_DB_PASSWORD>
DB_NAME=<YOUR_DB_NAME>
DB_SSL_REJECT_UNAUTHORIZED=false

# JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<YOUR_JWT_SECRET>
JWT_REFRESH_SECRET=<YOUR_JWT_REFRESH_SECRET>

# Google OAuth (from Google Console)
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Exotel (Voice API)
EXOTEL_SID=<YOUR_EXOTEL_SID>
EXOTEL_API_KEY=<YOUR_EXOTEL_API_KEY>
EXOTEL_API_TOKEN=<YOUR_EXOTEL_API_TOKEN>
EXOTEL_NUMBER=<YOUR_EXOTEL_NUMBER>
EXOTEL_CALL_FLOW_URL=<YOUR_EXOTEL_FLOW_URL>

# Mailgun (Email API)
MAILGUN_API_KEY=<YOUR_MAILGUN_API_KEY>
MAILGUN_DOMAIN=<YOUR_MAILGUN_DOMAIN>
MAILGUN_FROM=Versafic <noreply@yourdomain.com>

# MSG91 (SMS API)
MSG91_AUTH_KEY=<YOUR_MSG91_AUTH_KEY>
MSG91_SENDER_ID=VERSAFIC
MSG91_ROUTE=4

# URLs
PUBLIC_BASE_URL=http://localhost:5000
FRONTEND_BASE_URL=http://localhost:3000
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Frontend: `frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
```

> **Get your credentials from:**
> - Database: Aiven PostgreSQL panel
> - Google OAuth: Google Cloud Console
> - Exotel: Exotel dashboard
> - Mailgun: Mailgun dashboard
> - MSG91: MSG91 dashboard

---

## 📊 MONITORING & DEBUGGING

### Backend Logs
When running `npm run dev`, you'll see:
```
[INFO] Database initialized successfully
[INFO] Server running on http://localhost:5000
[INFO] Test SMS sent { userId: 1, phoneNumber: '9876543210' }
[INFO] Test Email sent successfully
```

### Frontend Console
Open DevTools (F12) to see:
- API calls
- Authentication status
- Error messages
- Demo feature logs

### Common Issues & Fixes

**Issue: "Cannot connect to database"**
- Check DB_HOST and credentials in .env
- Verify Aiven PostgreSQL is running
- Check internet connection

**Issue: "Email not received"**
- Check your spam folder
- Verify email address is correct
- Check Mailgun sandbox settings
- Wait 30 seconds for delivery

**Issue: "SMS not received"**
- Verify phone number format (10 digits)
- Check MSG91 account has credits
- Wait 30 seconds for delivery
- Check rate limit (5/hour)

**Issue: "Google OAuth fails"**
- Clear browser cache
- Check GOOGLE_CLIENT_ID in .env
- Verify callback URL matches
- Try incognito mode

**Issue: "Port 3000 or 5000 already in use"**
```bash
# Kill process using port
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

---

## 🚀 DEPLOYMENT TO PRODUCTION

### Deploy Backend (Railway)

**1. Push to Railway:**
```bash
cd backend
railway login
railway up --service backend
```

**2. Update Environment Variables on Railway:**
- Go to Railway project dashboard
- Add all production .env variables
- Set NODE_ENV=production

**3. Verify Deployment:**
```bash
curl https://your-backend-url/health
# Should return: { status: "success", database: "connected" }
```

### Deploy Frontend (Vercel)

**1. Push to Vercel:**
```bash
cd frontend
npm run build
vercel deploy --prod
```

**2. Update Environment on Vercel:**
- Go to Vercel project settings
- Update NEXT_PUBLIC_API_URL to production backend URL
- Redeploy

**3. Verify Deployment:**
```bash
Visit: https://your-frontend-url
# Should load login page
```

### Update Production URLs

**After deploying both:**

**Backend .env (update):**
```env
PUBLIC_BASE_URL=https://your-backend-url
GOOGLE_CALLBACK_URL=https://your-backend-url/auth/google/callback
FRONTEND_BASE_URL=https://your-frontend-url
APP_URL=https://your-frontend-url
CORS_ORIGINS=https://your-frontend-url
```

**Frontend .env.local (update):**
```env
NEXT_PUBLIC_API_URL=https://your-backend-url
```

**Redeploy both services with new URLs**

---

## ✅ FULL TEST CHECKLIST

### Pre-Launch Tests (30 Minutes)

**Authentication (5 min)**
- [ ] Email login works
- [ ] Google OAuth works
- [ ] Password reset works
- [ ] Logout works
- [ ] Token refresh works

**Dashboard (5 min)**
- [ ] All 8 tabs load
- [ ] No console errors
- [ ] Data displays correctly
- [ ] Navigation smooth
- [ ] Responsive design works

**Demo Features (15 min)**
- [ ] Call to Assistant button works
- [ ] Simulate Incoming Call works
- [ ] Send Test Email works & receives
- [ ] Send Test SMS works & receives
- [ ] All error messages show
- [ ] Rate limiting enforced
- [ ] Status updates display

**API Endpoints (5 min)**
```bash
# Test each endpoint
curl http://localhost:5000/health
curl http://localhost:5000/exotel/config
curl http://localhost:5000/sms/config
# etc.
```

---

## 🎯 PRODUCTION CHECKLIST

Before going live:

### Code & Build
- [ ] Backend builds without errors
- [ ] Frontend builds without errors
- [ ] No console errors
- [ ] TypeScript strict mode passes
- [ ] Tests pass

### Deployment
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set
- [ ] URLs updated
- [ ] DNS configured (if needed)

### Security
- [ ] HTTPS enforced
- [ ] API keys secured in env
- [ ] No credentials in code
- [ ] CORS whitelist correct
- [ ] Rate limiting active

### Integrations
- [ ] Exotel configured
- [ ] Mailgun configured
- [ ] MSG91 configured
- [ ] Google OAuth configured
- [ ] Database connected

### Monitoring
- [ ] Error logging setup
- [ ] Request logging setup
- [ ] Metrics collection active
- [ ] Uptime monitoring enabled
- [ ] Alert notifications setup

### Testing
- [ ] Demo flow tested end-to-end
- [ ] All endpoints tested
- [ ] All features tested
- [ ] Error handling tested
- [ ] Load testing done

---

## 📞 IMMEDIATE SUPPORT

### Quick Fixes

**If backend won't start:**
```bash
cd backend
npm install
npm run build
npm run dev
```

**If frontend won't start:**
```bash
cd frontend
rm -rf node_modules .next
npm install
npm run dev
```

**If port is busy:**
```bash
# Kill process and restart
ps aux | grep node  # or use tasklist on Windows
kill -9 <PID>
npm run dev
```

**If database won't connect:**
- Verify .env has correct DB credentials
- Check database is running on Aiven
- Test connection: `psql <DB_HOST> -U <DB_USER> -d <DB_NAME>`

---

## 📈 NEXT STEPS AFTER LAUNCH

1. **Monitor** - Watch error logs for issues
2. **Gather Feedback** - Collect user feedback
3. **Iterate** - Make improvements based on feedback
4. **Scale** - Handle increased load
5. **Enhance** - Add new features

---

## 🎉 YOU'RE READY!

### The System Includes:
✅ Complete AI calling (Exotel)
✅ Email testing (Mailgun)
✅ SMS testing (MSG91)
✅ User authentication (Email + Google OAuth)
✅ 8-section dashboard
✅ Business search & profiles
✅ 4 demo features
✅ Comprehensive error handling
✅ Full logging & monitoring
✅ Production-ready code

### Start Now:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Browser
Visit http://localhost:3000
```

---

**That's it! You have a fully functional AI business communication platform ready to demo and deploy.** 🚀

**Questions?** Check:
- README_DEMO.md (quick overview)
- VALIDATION_TEST_GUIDE.md (detailed testing)
- SYSTEM_FINALIZATION_SUMMARY.md (complete docs)
- COMPLETION_REPORT.md (final status)

**Built with ❤️ for Versafic**
