# Versafic

Versafic is an AI customer support platform with:

- a Node.js + Express + TypeScript backend
- a React + Vite frontend
- credit-based billing with Razorpay
- Twilio-powered calling flows
- AI chat and voice processing support

## Project Structure

- `backend/` API, database migrations, and integrations
- `frontend/` dashboard and client-facing UI

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
cp .env.example .env
npm run dev
```

## Build

### Backend

```bash
cd backend
npm run build
```

### Frontend

```bash
cd frontend
npm run build
```

## Environment Templates

- `backend/.env.example`
- `frontend/.env.example`

## Deployment

- frontend uses `frontend/vercel.json`
- backend uses `backend/vercel.json`
- backend can also be deployed on Render with `render.yaml`

## Backend On Render

```bash
1. Push this repo to GitHub
2. In Render, create a new Blueprint or Web Service
3. Point Render to this repo root
4. If using Blueprint, it will read render.yaml automatically
5. Set backend environment variables from backend/.env.example
6. Make sure PUBLIC_BASE_URL is your Render backend URL
7. Make sure CORS_ORIGINS includes your frontend domain
8. Deploy and verify /health
```

Notes:

- `DATABASE_URL` is supported, so Render Postgres or any managed Postgres URL can be used directly.
- If you keep Aiven, you can still use the split `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` variables.
- For Twilio webhooks on Render, set `PUBLIC_BASE_URL=https://your-service.onrender.com`.
- For the first deploy, run `npm run db:migrate:aiven` from Render Shell, or temporarily set `RUN_DB_MIGRATIONS_ON_STARTUP=true`.
