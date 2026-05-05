# Versafic System Validation Test Guide

## System Ready for Complete Validation

This guide provides step-by-step instructions to validate that all features are working correctly.

---

## Prerequisites

- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:3000`
- Test phone number: `9876543210`
- Test email: `test@example.com`
- Valid Google account (for OAuth testing)

---

## Phase 1: Backend Endpoint Validation

### 1.1 Health Check
```bash
curl http://localhost:5000/health
# Expected: 200 OK with database connection status
```

### 1.2 Exotel Configuration
```bash
curl http://localhost:5000/exotel/config
# Expected: 200 OK with Exotel settings summary
```

### 1.3 SMS Configuration
```bash
curl http://localhost:5000/sms/config
# Expected: 200 OK with MSG91 settings
```

### 1.4 Email Test Endpoint (with auth)
```bash
# First, get auth token from login or use test token
curl -X GET "http://localhost:5000/email/test?to=test@example.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 200 OK with email sent confirmation
```

### 1.5 SMS Send Endpoint (with auth)
```bash
curl -X POST http://localhost:5000/sms/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "phoneNumber": "9876543210",
    "message": "Test from Versafic"
  }'
# Expected: 200 OK with message ID
```

### 1.6 SMS Test Endpoint (new - with auth & rate limit)
```bash
curl -X POST http://localhost:5000/sms/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "phoneNumber": "9876543210",
    "message": "Test SMS"
  }'
# Expected: 200 OK with provider: "MSG91"
```

### 1.7 Call Start Endpoint (with auth)
```bash
curl -X POST http://localhost:5000/call/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerNumber": "9876543210"
  }'
# Expected: 200 OK with session_id and call_id
```

### 1.8 Simulate Incoming Call (with auth)
```bash
curl -X POST http://localhost:5000/exotel/simulate-incoming \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "customerNumber": "9876543210"
  }'
# Expected: 200 OK with call status and AI response
```

---

## Phase 2: Frontend Feature Validation

### 2.1 Login Flow
1. Navigate to `http://localhost:3000/login`
2. Enter email: `test@example.com`
3. Enter password: `TestPassword123!`
4. Click "Login"
5. **Expected:** Redirect to `/dashboard` with authenticated session

### 2.2 Google OAuth Flow
1. Navigate to `http://localhost:3000/login`
2. Click "Continue with Google"
3. Complete Google authentication
4. **Expected:** Redirect to `/dashboard` with new/existing account

### 2.3 Onboarding Flow
1. Navigate to `http://localhost:3000/onboarding`
2. Fill in all fields:
   - Username: `testuser`
   - Password: `TestPassword123!`
   - Phone: `9876543210`
   - Email: `test@example.com`
3. Select business type
4. **Expected:** Redirect to `/dashboard` with setup complete

### 2.4 Dashboard Navigation
1. Login successfully
2. Navigate through all tabs:
   - Overview
   - Calls
   - Chats
   - Bookings
   - Customers
   - Analytics
   - Credits
   - AI Settings
3. **Expected:** All pages load without errors

---

## Phase 3: Demo Features Validation

### 3.1 Call to Assistant
1. Go to Dashboard → AI Settings
2. Find "Call to Assistant" section
3. Enter phone: `9876543210`
4. Click "Call"
5. **Expected:**
   - Button shows "Calling..." state
   - Success toast appears
   - Session ID displayed
   - Status shows "Calling..."

### 3.2 Simulate Incoming AI Call
1. In AI Settings, find "Simulate Incoming AI Call"
2. Leave phone blank or enter test number
3. Click "Simulate"
4. **Expected:**
   - Button shows "Simulating..." state
   - Call log appears with:
     - 📞 Call from number
     - ⏱️ Status (calling/connected/completed)
     - 🤖 AI Response preview
   - Success toast shows "Simulation started"

### 3.3 Send Test Email
1. In AI Settings, find "Send Test Email"
2. Enter email: `your-test-email@gmail.com`
3. Click "Send"
4. **Expected:**
   - Button shows "Sending..." state
   - Success toast: "Test email sent to..."
   - Status div shows:
     - Provider: Mailgun
     - Status: Email queued for delivery
   - Email arrives in inbox (check spam folder)

### 3.4 Send Test SMS
1. In AI Settings, find "Test SMS"
2. Enter phone: `9876543210`
3. Leave message blank or enter custom message
4. Click "Send Test"
5. **Expected:**
   - Button shows "Sending..." state
   - Success toast: "Test SMS sent to..."
   - Status div shows:
     - Provider: MSG91
     - Status: SMS queued
   - SMS received on phone within seconds

---

## Phase 4: Error Handling Validation

### 4.1 Phone Number Validation
1. In "Call to Assistant" section
2. Leave phone number blank
3. Click "Call"
4. **Expected:** Error toast: "❌ Please enter a phone number"

### 4.2 Email Validation
1. In "Send Test Email" section
2. Leave email blank
3. Click "Send"
4. **Expected:** Error toast: "❌ Please enter an email address"

### 4.3 SMS Rate Limiting
1. Send 6 test SMS in quick succession
2. On 6th attempt:
3. **Expected:** Error toast: "Test SMS limit reached for this hour"

### 4.4 Email Rate Limiting
1. Send 4 test emails in quick succession
2. On 4th attempt:
3. **Expected:** Error toast: "Demo email limit reached for this hour"

### 4.5 Authentication Required
1. Open browser DevTools
2. Clear localStorage
3. Try to send test email
4. **Expected:** Error toast with authentication error

### 4.6 Invalid Message Length
1. In SMS test, enter a message > 160 characters
2. Click "Send Test"
3. **Expected:** Error toast about message length

### 4.7 Service Unavailable
1. Stop MSG91 service (if possible)
2. Try to send SMS
3. **Expected:** Error: "MSG91 SMS service not configured"

---

## Phase 5: Integration Validation

### 5.1 End-to-End Call Flow
```
User clicks "Call to Assistant"
  → Frontend validates phone
  → Frontend gets JWT token
  → POST /call/start
  → Backend validates auth
  → Backend initiates Exotel call
  → Exotel dials phone
  → Webhook /exotel/incoming received
  → AI voice response initiated
  → Session logged in database
```
**Expected:** Call connects and AI responds

### 5.2 End-to-End Email Flow
```
User clicks "Send Test Email"
  → Frontend validates email
  → Frontend gets JWT token
  → GET /email/test?to=email
  → Backend enforces rate limit
  → Backend calls Mailgun API
  → Mailgun queues email
  → Email delivered to inbox
```
**Expected:** Email arrives within 1 minute

### 5.3 End-to-End SMS Flow
```
User clicks "Send Test SMS"
  → Frontend validates phone
  → Frontend gets JWT token
  → POST /sms/test
  → Backend enforces rate limit & auth
  → Backend calls MSG91 API
  → MSG91 queues SMS
  → SMS delivered to phone
```
**Expected:** SMS arrives within 1 minute

### 5.4 Authentication Flow
```
User clicks "Continue with Google"
  → Frontend redirects to /auth/google/start
  → Backend redirects to Google OAuth consent
  → User completes Google auth
  → Google redirects to /auth/google/callback
  → Backend exchanges code for profile
  → Backend creates/updates user
  → Backend generates JWT token
  → Frontend stores token in localStorage
  → Frontend redirects to /dashboard
```
**Expected:** User logged in with Google account

---

## Phase 6: Load Testing (Optional)

### 6.1 Concurrent API Calls
```bash
# Test 10 concurrent SMS requests
for i in {1..10}; do
  curl -X POST http://localhost:5000/sms/send \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"phoneNumber":"9876543210","message":"Test"}' &
done
# Expected: All requests processed, rate limits enforced
```

### 6.2 Rapid Button Clicks
1. In AI Settings, rapidly click "Send Test SMS" 5 times
2. **Expected:** First request succeeds, others show rate limit error

---

## Phase 7: Security Validation

### 7.1 Authentication Required
1. Try to access `/email/test` without Authorization header
2. **Expected:** 401 Unauthorized

### 7.2 Invalid Token
1. Send request with invalid JWT token
2. **Expected:** 401 Unauthorized with "Invalid token" message

### 7.3 Expired Token
1. Use old/expired JWT token
2. **Expected:** 401 Unauthorized with "Token expired" message

### 7.4 CORS Headers
```bash
curl -H "Origin: http://malicious.com" \
  http://localhost:5000/health
# Expected: Either allowed (if in whitelist) or 403 CORS error
```

### 7.5 Input Injection Prevention
1. Try to send SMS with special characters: `'; DROP TABLE users; --`
2. **Expected:** Message sent safely without SQL injection

---

## Phase 8: Logging Validation

### 8.1 Check Backend Logs
1. Start backend with: `npm run dev`
2. Perform test SMS send
3. **Expected:** Log entry like:
   ```
   [INFO] Test SMS sent { userId: 1, phoneNumber: '9876543210' }
   ```

### 8.2 Check Error Logs
1. Send SMS without auth token
2. **Expected:** Log entry like:
   ```
   [ERROR] Test SMS send error { error: 'Sign in to send a test SMS.' }
   ```

### 8.3 Check API Metrics
1. Make 10 API requests
2. Check `/ops/metrics` endpoint
3. **Expected:** Request count increased

---

## Test Checklist

### Backend Endpoints
- [ ] `/health` returns 200
- [ ] `/exotel/config` returns config
- [ ] `/sms/config` returns config
- [ ] `/email/test` sends email
- [ ] `/sms/send` sends SMS
- [ ] `/sms/test` sends test SMS with auth
- [ ] `/call/start` initiates call
- [ ] `/exotel/simulate-incoming` simulates call

### Frontend Features
- [ ] Login with email/password works
- [ ] Google OAuth flow works
- [ ] Onboarding completes
- [ ] Dashboard loads
- [ ] All nav tabs work
- [ ] Call to Assistant button works
- [ ] Simulate Incoming Call button works
- [ ] Send Test Email button works
- [ ] Send Test SMS button works

### Demo Features
- [ ] Call initiated with session ID
- [ ] Incoming call simulated with status
- [ ] Email sent and received
- [ ] SMS sent and received
- [ ] Success toasts show
- [ ] Error messages appear

### Error Handling
- [ ] Phone validation works
- [ ] Email validation works
- [ ] Rate limiting enforced
- [ ] Auth required enforced
- [ ] Service unavailable handled
- [ ] Network errors handled

### Security
- [ ] No auth = 401 error
- [ ] Invalid token = 401 error
- [ ] Expired token = 401 error
- [ ] CORS properly configured
- [ ] No SQL injection possible
- [ ] Input sanitized

### Logging
- [ ] Success logged
- [ ] Errors logged
- [ ] User ID tracked
- [ ] Metrics collected

---

## Common Test Scenarios

### Scenario 1: New User Full Flow
1. Open browser (incognito mode)
2. Visit `http://localhost:3000`
3. Click "Continue with Google"
4. Complete Google auth
5. Fill onboarding form
6. Complete setup
7. Navigate to AI Settings
8. Test all demo features
9. **Expected:** All features work for new user

### Scenario 2: Returning User
1. Login with email/password
2. Navigate to AI Settings
3. Test demo features
4. Logout
5. Login with Google OAuth
6. Test features again
7. **Expected:** Both auth methods work

### Scenario 3: Stress Test
1. Open dashboard
2. Rapidly click all demo buttons
3. Test with different numbers/emails
4. Monitor for errors
5. **Expected:** System handles gracefully with rate limits

### Scenario 4: Offline Testing
1. Disconnect from network
2. Try to send email
3. **Expected:** Clear error: "Network error"

---

## Success Criteria

### Minimum Requirements ✅
- [ ] All 8 backend endpoints respond correctly
- [ ] All 5 frontend pages load
- [ ] All 4 demo buttons functional
- [ ] Auth (email + Google) working
- [ ] Rate limiting enforced
- [ ] Errors handled gracefully

### Recommended ✅
- [ ] All test scenarios pass
- [ ] All error cases validated
- [ ] Logging working properly
- [ ] Security checks passed
- [ ] Response times < 2 seconds
- [ ] No console errors

### Production Ready ✅
- [ ] All success criteria met
- [ ] Load testing passed
- [ ] Security audit passed
- [ ] Performance optimized
- [ ] Monitoring enabled
- [ ] Backup/recovery tested

---

## Notes

- **Test Phone:** Any 10-digit number works for testing
- **Test Email:** Use your real email to verify delivery
- **Test Date:** Run full validation before each deployment
- **Rate Limits:** Reset after 1 hour, not per session
- **Logs:** Check `/var/log/versafic.log` on production

---

## Support

If any test fails:
1. Check error message in toast
2. Review backend logs: `npm run dev`
3. Check network tab in DevTools
4. Verify environment variables
5. Review error traceback
6. Check provider (Exotel/Mailgun/MSG91) status

---

**Last Updated:** 2026-05-05
**Status:** Complete & Ready for Testing
