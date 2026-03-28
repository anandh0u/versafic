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

