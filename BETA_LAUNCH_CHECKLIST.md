# Beta Launch Checklist

## Product-Critical

- Confirm Google OAuth uses live production credentials
- Confirm GitHub OAuth credentials are configured or hide the GitHub button
- Verify Razorpay checkout, verify-payment, and webhook flow in production
- Verify Twilio inbound and outbound flows with real verified numbers
- Confirm call consent is only enabled by explicit user action in AI Settings
- Confirm autopay UX is compliant and always user-approved

## Security

- Rotate any credentials that were exposed in local chat or terminal history
- Replace placeholder provider keys in all production environments
- Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` from Railway and use the proper Aiven CA certificate
- Audit CORS origins so only live frontend domains are allowed
- Confirm JWT secrets are unique and long enough in production

## Data / Billing

- Run the latest migrations on the production database
- Verify a new account starts with zeroed wallet and dashboard metrics
- Confirm credit deductions and refunds work for failed call attempts
- Confirm plan pricing, INR display, and wallet balances match Razorpay amounts

## AI / Telephony

- Test AI chat, stats, and history using live provider keys
- Test call script generation and fallback script behavior
- Verify Twilio webhook URLs point at the Railway backend
- Confirm consent and opt-out flags are enforced before outbound calling

## Frontend / UX

- Hard-refresh and smoke-test all routes after deploy:
  - `/`
  - `/login`
  - `/onboarding`
  - `/dashboard`
  - `/dashboard/billing`
  - `/dashboard/calls`
  - `/search`
- Test onboarding validation step by step
- Confirm `Other` shows custom description in both Business and Personal flows
- Confirm sidebar navigation updates correctly after login
- Confirm AI Settings saves AI number and consent state

## Ops / Monitoring

- Add uptime monitoring for:
  - Railway `/health`
  - frontend root
- Add error alerting for:
  - backend startup failures
  - Razorpay verification failures
  - Twilio webhook failures
- Add log retention and review process for beta incidents

## Launch Content

- Publish privacy policy
- Publish terms of service
- Publish billing/refund explanation
- Add support email/contact inside the UI
- Add onboarding help text for consent and call behavior

## Recommended Final Pre-Launch Tests

- New user signup
- New business onboarding
- Search and profile discovery
- Credit purchase
- AI chat request
- Outbound AI call with consent
- Inbound Twilio call
- Call session history and billing reflection
