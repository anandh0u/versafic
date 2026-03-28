# Versafic Insomnia Testing Guide

The frontend `Endpoint Lab` has been removed. Use the imported Insomnia collection instead:

- Collection file: `backend/insomnia-collection.json`
- Guide: `docs/INSOMNIA_TESTING_GUIDE.md`

## Import The Collection

1. Open Insomnia.
2. Click `Create` or `Import`.
3. Choose `File`.
4. Select `backend/insomnia-collection.json`.
5. Insomnia will create the `Versafic Backend API` workspace.

## One-Click Automatic Run

If you want Insomnia to run the safe demo flow automatically:

1. Open the folder `00 Select All And Run`.
2. Right-click the folder.
3. Click `Run`.
4. Set `Iterations` to `1`.
5. If Insomnia shows a delay option, set `1000 ms`.
6. Start the run.

This folder already runs the core requests in the correct order and skips the manual-only steps like Razorpay payment verification and Twilio webhook replay.

The latest `00 Select All And Run` folder now includes real `after-response` assertions, so Insomnia will show pass or fail results instead of `no test was detected`.
On the current production backend, the auto-run also treats the known OpenAI and Sarvam credential errors as expected demo outcomes, so those third-party provider issues do not fail the whole run.
Repeated production runs can also hit the backend auth rate limiter. The auto-run now treats those rerun `429` responses on the auth steps as expected instead of failing the whole sequence.

## Choose The Right Environment

The collection includes two ready-made environments:

- `Local Dev`
  Use when your backend is running on `http://localhost:5000`.
- `Vercel Prod`
  Use when you want to test the deployed backend on Vercel.

Shared variables already exist in the base environment:

- `email`
- `password`
- `name`
- `phone`
- `access_token`
- `refresh_token`
- `session_id`
- `business_id`
- `call_sid`
- `order_id`
- `payment_id`
- `payment_signature`
- `audio_base64`
- `language`
- `plan_id`
- `autopay_plan`
- `purpose`

Update `email`, `password`, and `phone` before you begin if you want to use your own demo account.
If you leave the imported values unchanged, the collection now defaults to the seeded production demo user for `Vercel Prod`.

## What Saves Automatically

The collection writes these variables for you after successful requests:

- `access_token` and `refresh_token` after `Register`, `Login`, or `Refresh Token`
- `session_id` after `Customer Service -> Start Session`
- `business_id` after `Business -> Onboard Business`
- `order_id` after billing order creation or autopay trigger checkout creation
- `call_sid` after `Calls -> Trigger Outbound Call`

## Best Order To Check Endpoints

Use this order for a smooth demo from setup to billing:

1. `System -> Root`
2. `System -> Health`
3. `System -> Ops Health`
4. `Auth -> Register` or `Auth -> Login`
5. `Auth -> Get Current User`
6. `Auth -> Update Call Preferences`
7. `Setup -> Save Business Profile`
8. `Setup -> Get Setup Status`
9. `Billing -> Get Plans`
10. `Billing -> Get Wallet`
11. `AI -> Chat`
12. `AI -> Chat History`
13. `AI -> Chat Stats`
14. `AI -> Extract Structured Data`
15. `AI -> Detect Intent`
16. `Customer Service -> Start Session`
17. `Customer Service -> Chat`
18. `Customer Service -> Session History`
19. `Voice -> Text To Speech`
20. `Voice -> Statistics`
21. `Business -> Onboard Business`
22. `Business -> List Businesses`
23. `Calls -> Trigger Outbound Call`
24. `Calls -> List Recordings`
25. `Billing -> Create Plan Order`
26. `Billing -> Enable Autopay Demo` or `Enable Autopay Real`
27. `Billing -> Trigger Autopay`

## Important Notes While Testing

### Auth And Consent

Before testing outbound calls, run `Auth -> Update Call Preferences` with:

- `phone_number`
- `call_consent: true`
- `call_opt_out: false`

Without that, `/call/outbound` is supposed to block the request.

### Outbound Call Rules

`POST /call/outbound` only works when all of these are true:

- the target phone belongs to a registered user
- that user has `call_consent = true`
- that user has not opted out
- allowed purpose is one of:
  - `enquiry_follow_up`
  - `missed_call_callback`
  - `support_call`
  - `booking_confirmation`

The system also enforces:

- max `2` outbound calls per day
- `24` hour cooldown to the same number

### Billing And Razorpay

- `Billing -> Create Plan Order` stores `order_id` automatically.
- `Billing -> Verify Payment` needs a real `payment_id` and `payment_signature` from Razorpay checkout.
- `Enable Autopay Real` does not silently debit UPI or bank accounts. It only creates a checkout flow that still needs user confirmation.

### AI And Voice Providers

Some routes depend on provider keys and may return backend errors if those providers are not configured:

- OpenAI-dependent routes:
  - `/ai/chat`
  - `/ai/customer-service-response`
  - `/ai/extract`
  - `/ai/intent`
  - `/customer-service/chat`
- Sarvam-dependent routes:
  - `/voice/process`
  - `/voice/stt`
  - `/voice/tts`

### Twilio Webhook Requests

The collection includes the Twilio webhook endpoints for completeness:

- `/call/incoming`
- `/call/outbound/twiml`
- `/call/outbound/respond`
- `/call/status`
- `/call/recording`

Use them like this:

- test them against local or ngrok-backed development first
- on production, unsigned webhook calls can be rejected because `X-Twilio-Signature` validation is enforced

## Fast Insomnia Walkthrough

### 1. Login And Save Tokens

- Open `Auth -> Login`
- Click `Send`
- The collection stores `access_token` and `refresh_token` automatically

### 2. Check Auth Works

- Run `Auth -> Get Current User`
- If it returns your user, the bearer token is wired correctly

### 3. Prepare Outbound Calls

- Run `Auth -> Update Call Preferences`
- Run `Setup -> Save Business Profile`
- Make sure the phone number you use is attached to a registered user

### 4. Test Core Product Flows

- AI flow: run requests in the `AI` folder
- Voice flow: run requests in the `Voice` folder
- Session flow: run requests in the `Customer Service` folder
- Billing flow: run requests in the `Billing` folder
- Calls flow: run requests in the `Calls` folder

### 5. Verify Real Recharge Flow

To show the compliant autopay story:

1. Run `Billing -> Enable Autopay Real`
2. Run `Billing -> Trigger Autopay`
3. Check whether the response contains `checkout.order_id`
4. Use the returned order in Razorpay checkout
5. Put the resulting `payment_id` and `payment_signature` into the environment
6. Run `Billing -> Verify Payment`

## If Something Fails

Check these first:

- wrong environment selected in Insomnia
- expired `access_token`
- missing OpenAI, Sarvam, Razorpay, or Twilio credentials in backend env
- outbound call target is not a registered user with consent
- webhook endpoint tested on production without Twilio signature

If Insomnia still says `no test was detected`, re-import `backend/insomnia-collection.json`. That message means Insomnia is still using an older copy of the collection without the new response test scripts.
