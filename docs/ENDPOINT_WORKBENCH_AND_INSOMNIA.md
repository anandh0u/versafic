# Versafic Endpoint Workbench And Insomnia Guide

## Frontend Coverage

The dashboard now covers the presentation-critical backend surface in two ways:

- `Billing`, `Calls`, `Chat`, `Workflows`, and `Business` remain the polished demo lanes.
- `Endpoint Lab` is the live backend workbench for the remaining routes that need raw request/response proof during presentations.

### Covered In The Frontend

- `/health`
- `/ops/health`
- `/ops/status`
- `/auth/me`
- `/setup/business`
- `/setup/status`
- `/ai/chat`
- `/ai/chat/history`
- `/ai/chat/stats`
- `/ai/chat/history` `DELETE`
- `/ai/extract`
- `/ai/intent`
- `/ai/customer-service-response`
- `/voice/process`
- `/voice/stt`
- `/voice/tts`
- `/voice/conversations/phone/:phone`
- `/voice/statistics`
- `/customer-service/start`
- `/customer-service/chat`
- `/customer-service/history/:sessionId`
- `/customer-service/session/:sessionId`
- `/customer-service/end/:sessionId`
- `/customer-service/interactions/phone/:phone`
- `/customer-service/interactions/resolved`
- `/customer-service/stats/sentiment`
- `/customer-service/stats/resolution`
- `/customer-service/active-sessions`
- `/business/onboard`
- `/business/:email`
- `/business`
- `/business/:id`
- `/call/outbound`
- `/call/recordings`
- `/call/recordings/:callSid`
- Billing endpoints already used by the billing flow and recharge UI

### Integration-Only Endpoints

These are backend or third-party integration endpoints and are not meant to be used from the browser UI:

- `/call/incoming`
- `/call/outbound/twiml`
- `/call/outbound/respond`
- `/call/status`
- `/call/recording`
- `/ops/metrics`
- Google auth routes can be tested in Insomnia, but the polished frontend still uses email/password login for the demo

### Future UI Items

- AI provider key management screen
- Google OAuth frontend button flow
- Twilio webhook simulator UI
- Admin control panel for long-term provider configuration and secrets

## Insomnia Environment

Create an environment with these variables:

```json
{
  "base_url": "https://backend-pink-three-22.vercel.app",
  "access_token": "",
  "refresh_token": "",
  "email": "demo@example.com",
  "password": "DemoPass123!",
  "phone": "+919876543210",
  "session_id": "",
  "call_sid": "",
  "business_id": "",
  "order_id": "",
  "payment_id": "",
  "payment_signature": ""
}
```

Use `Authorization: Bearer {{ _.access_token }}` for protected routes.

## Recommended Insomnia Check Order

1. `POST /auth/register`
2. `POST /auth/login`
3. Copy `accessToken` into `access_token`
4. `GET /auth/me`
5. `GET /billing/plans`
6. `GET /billing/wallet`
7. `POST /setup/business`
8. `GET /setup/status`
9. `POST /ai/chat`
10. `GET /ai/chat/history`
11. `GET /ai/chat/stats`
12. `POST /ai/extract`
13. `POST /ai/intent`
14. `POST /customer-service/start`
15. Copy returned `sessionId` into `session_id`
16. `POST /customer-service/chat`
17. `GET /customer-service/history/{{ _.session_id }}`
18. `GET /voice/statistics`
19. `POST /call/outbound`
20. `GET /call/recordings`
21. `POST /billing/create-order`

## Sample Request Bodies

### Auth

`POST /auth/register`

```json
{
  "email": "{{ _.email }}",
  "password": "{{ _.password }}",
  "name": "Demo User"
}
```

`POST /auth/login`

```json
{
  "email": "{{ _.email }}",
  "password": "{{ _.password }}"
}
```

`POST /auth/refresh`

```json
{
  "refreshToken": "{{ _.refresh_token }}"
}
```

`PATCH /auth/me`

```json
{
  "name": "Demo User",
  "phone_number": "{{ _.phone }}",
  "call_consent": true,
  "call_opt_out": false
}
```

### Setup

`POST /setup/business`

```json
{
  "businessName": "Versafic Demo Clinic",
  "businessType": "Customer Support",
  "industry": "Healthcare",
  "website": "https://example.com",
  "country": "India",
  "phone": "{{ _.phone }}"
}
```

### AI

`POST /ai/chat`

```json
{
  "message": "Write a polite support reply for a customer asking to reschedule tomorrow."
}
```

`POST /ai/extract`

```json
{
  "text": "My name is Priya, phone +91 9876543210, email priya@example.com, and I need a booking for Friday."
}
```

`POST /ai/intent`

```json
{
  "message": "I missed your call and need help with my booking."
}
```

`POST /ai/customer-service-response`

```json
{
  "message": "A customer is upset because their appointment was moved. Write a calm reply."
}
```

### Voice

`POST /voice/process`

```json
{
  "audioBase64": "PASTE_AUDIO_BASE64_HERE",
  "language": "en-IN"
}
```

`POST /voice/stt`

```json
{
  "audioBase64": "PASTE_AUDIO_BASE64_HERE",
  "language": "en-IN"
}
```

`POST /voice/tts`

```json
{
  "text": "Hello, this is a test from the Versafic voice endpoint.",
  "language": "en-IN"
}
```

### Customer Service

`POST /customer-service/chat`

```json
{
  "sessionId": "{{ _.session_id }}",
  "textMessage": "Hello, I need help confirming my appointment for tomorrow.",
  "languageCode": "en-IN"
}
```

### Business Directory

`POST /business/onboard`

```json
{
  "business_name": "Versafic Demo Clinic",
  "business_type": "Customer Support",
  "owner_name": "Demo Owner",
  "phone": "{{ _.phone }}",
  "email": "{{ _.email }}"
}
```

`PUT /business/{{ _.business_id }}`

```json
{
  "business_name": "Versafic Updated Demo Clinic",
  "business_type": "Support Operations",
  "owner_name": "Demo Owner",
  "phone": "{{ _.phone }}",
  "email": "{{ _.email }}"
}
```

### Calls

`POST /call/outbound`

```json
{
  "phone_number": "{{ _.phone }}",
  "purpose": "support_call"
}
```

### Billing

`POST /billing/create-order`

```json
{
  "plan_id": "growth"
}
```

`POST /billing/verify-payment`

```json
{
  "razorpay_order_id": "{{ _.order_id }}",
  "razorpay_payment_id": "{{ _.payment_id }}",
  "razorpay_signature": "{{ _.payment_signature }}"
}
```

`POST /billing/deduct`

```json
{
  "credits": 2,
  "source": "ai_chat",
  "description": "Manual Insomnia deduction test",
  "reference_id": "INSOMNIA-DEDUCT-1"
}
```

`POST /billing/autopay/enable`

```json
{
  "threshold_credits": 100,
  "recharge_amount": 19900,
  "mode": "real",
  "selected_plan": "growth"
}
```

`POST /billing/autopay/trigger`

```json
{
  "triggered_by": "manual_retry",
  "force": true
}
```

## Full Endpoint Matrix

### System

- `GET /`
- `GET /health`
- `GET /ops/health`
- `GET /ops/metrics`
- `GET /ops/status`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/google`
- `POST /auth/google/idtoken`
- `GET /auth/me`
- `PATCH /auth/me`

### Setup

- `POST /setup/business`
- `GET /setup/business`
- `GET /setup/status`

### AI

- `POST /ai/chat`
- `GET /ai/chat/history`
- `GET /ai/chat/stats`
- `DELETE /ai/chat/history`
- `POST /ai/extract`
- `POST /ai/intent`
- `POST /ai/customer-service-response`

### Voice

- `POST /voice/process`
- `POST /voice/stt`
- `POST /voice/tts`
- `GET /voice/conversations/phone/:phone`
- `GET /voice/statistics`

### Customer Service

- `POST /customer-service/start`
- `POST /customer-service/chat`
- `GET /customer-service/history/:sessionId`
- `GET /customer-service/session/:sessionId`
- `POST /customer-service/end/:sessionId`
- `GET /customer-service/interactions/phone/:phone`
- `GET /customer-service/interactions/resolved`
- `GET /customer-service/stats/sentiment`
- `GET /customer-service/stats/resolution`
- `GET /customer-service/active-sessions`

### Business Directory

- `POST /business/onboard`
- `GET /business/:email`
- `GET /business`
- `PUT /business/:id`

### Calls

- `POST /call/incoming`
- `POST /call/outbound/twiml`
- `POST /call/outbound/respond`
- `POST /call/status`
- `POST /call/recording`
- `POST /call/outbound`
- `GET /call/recordings`
- `GET /call/recordings/:callSid`

### Billing

- `GET /billing/plans`
- `POST /billing/create-order`
- `POST /billing/verify-payment`
- `GET /billing/wallet`
- `POST /billing/deduct`
- `GET /billing/check-balance`
- `GET /billing/autopay/status`
- `POST /billing/autopay/enable`
- `POST /billing/autopay/disable`
- `POST /billing/autopay/trigger`
