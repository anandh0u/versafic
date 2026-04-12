# Versafic

Versafic is an AI customer support platform with:

- a Node.js + Express + TypeScript backend
- a Next.js frontend that preserves the approved legacy design
- credit-based billing with Razorpay
- Twilio-backed call flows
- AI chat, voice, onboarding, and business directory features

## Project Structure

- `backend/` API, database migrations, telephony, billing, and auth
- `frontend/` customer-facing and dashboard UI

## Local Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Build Checks

### Backend

```bash
cd backend
npm run build
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

## Runtime Environments

- Frontend production: Vercel
- Backend production: Railway
- Database: Aiven PostgreSQL

## Deployment Targets

### Frontend on Vercel

- Project root: `frontend/`
- Required env:
  - `NEXT_PUBLIC_API_BASE_URL=https://backend-production-a176.up.railway.app`
  - `NEXT_PUBLIC_API_URL=https://backend-production-a176.up.railway.app` if you are using the legacy env name

### Backend on Railway

- Service root: `backend/`
- Config file: `backend/railway.json`
- Health check path: `/health`

Required backend envs:

- `NODE_ENV=production`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PUBLIC_BASE_URL`
- `FRONTEND_BASE_URL`
- `APP_URL`
- `CORS_ORIGINS`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Feature envs:

- `OPENAI_API_KEY`
- `SARVAM_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (must match the backend public callback URL exactly)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`

OAuth callback values for the current Railway backend:

- Google redirect URI: `https://backend-production-a176.up.railway.app/auth/google/callback`
- GitHub callback URL: `https://backend-production-a176.up.railway.app/auth/github/callback`

If Google shows `Error 400: redirect_uri_mismatch`, check both places:

- Google Cloud Console -> OAuth client -> Authorized redirect URIs
- Railway env `GOOGLE_CALLBACK_URL` (or leave it empty and rely on `PUBLIC_BASE_URL`)

## Operations Notes

- Railway is currently the live backend host: `https://backend-production-a176.up.railway.app`
- Vercel is currently the live frontend host: `https://frontend-anandh0us-projects.vercel.app`
- Twilio webhook URLs depend on `PUBLIC_BASE_URL`
- Run `npm run db:migrate:aiven` from the backend when deploying schema changes

## Beta Launch Readiness

See [`BETA_LAUNCH_CHECKLIST.md`](./BETA_LAUNCH_CHECKLIST.md) for the full launch checklist and remaining production gaps.
