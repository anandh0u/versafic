# Agent Handoff

This file is the working memory for any future Copilot/agent session on this repo.

## Non-Negotiable Rules

- Do not change the accepted UI/UX design unless the user explicitly asks.
- Do not redesign layouts or rename accepted sections casually.
- Fix logic, integrations, stability, validation, and data flow without changing the visual product.
- Before stopping, update this file.

## Source Of Truth

- Frontend active source: [frontend](./frontend)
- Backend active source: [backend](./backend)
- Frontend deploy target: Vercel
- Backend deploy target: Railway

## Current Architecture

### Frontend
- Next.js / TypeScript app
- Active route tree lives under `frontend/app`
- Shared logic/components live under `frontend/components` and `frontend/lib`
- The accepted UI must remain visually the same

### Backend
- Express + TypeScript
- Main provider path:
  - Exotel for calling
  - Mailgun for email
- PostgreSQL-backed app

## Current Live Services

- Frontend production:
  - `https://frontend-anandh0us-projects.vercel.app`
- Backend production:
  - `https://backend-production-a176.up.railway.app`

## Current Known Constraints / Caveats

1. Exotel
- Exotel is the primary provider path.
- Outbound calling may still be blocked by Exotel account/KYC restrictions outside the app.

2. Mailgun
- Mailgun is implemented.
- If still using a sandbox domain, sending only works to authorized recipients.

3. Frontend structure
- The current accepted frontend is the newer Next/TS app.
- Do not revert to old standalone HTML source as the active frontend path.

4. Bookings
- Keep Bookings as Bookings.
- Do not rename/mutate it into Workflow.
- Do not replace its calendar/schedule/holidays sections with backend notice panels.

## Recently Fixed

- Restored the accepted Bookings page behavior/layout language on the active Next/TS frontend.
- Prevented runtime logic from rewriting Bookings into Workflow/backend-notices.
- Added `frontend/vercel.json` so Vercel treats the current frontend as a Next app.
- Cleaned stale `.html` route targets out of the active Next frontend pages.
- Added missing Next route files for `/login`, `/dashboard/[section]`, and `/profile/[id]`.
- Fixed profile binding so dynamic profile routes can render through the live backend-driven binding layer.
- Fixed dashboard back navigation to point to `/search`.

## Current Open Tasks

- Add new user-requested work here before starting.
- Remove completed tasks after recording them in session notes below.

### Assigned By User
- None recorded yet in this file.

## Session Notes

### 2026-04-12 Beta Hardening Pass

#### Work Completed
- Audited the active frontend/backend for remaining fake values, random graphs, demo behaviors, and spam-sensitive flows.
- Fixed the biggest frontend regression source: the dashboard/search/profile pages were still booting old demo scripts on the client.
- Kept the accepted UI intact, but changed those pages to use minimal helper scripts only, while the real runtime behavior stays in `frontend/components/legacy/legacy-bindings.tsx`.
- Added first-paint dashboard safety:
  - `frontend/app/dashboard/page.tsx` now starts with `data-dashboard-ready="false"`
  - main content stays hidden until live backend bindings finish syncing
  - sidebar fake identity/badges start neutral instead of `Alex Johnson` / `12` / `5`
- Removed remaining leaked demo copy from delivered HTML for the main audited pages:
  - dashboard no longer ships `Alex Johnson`, `Bookings Split`, `Grand Horizon Hotel`, `Sarah Connor`, or demo payment-editor strings in live HTML
  - search no longer ships `Showing 8 results`, `8 verified results`, or `Grand Horizon Hotel` in live HTML
  - home no longer ships `2.4M+`, `50K+`, or `Grand Horizon Hotel` in live HTML
- Tightened Exotel anti-spam safeguards:
  - only signed-in businesses can start their own outbound Exotel calls
  - recipient must be a registered user
  - recipient must have consent and not be opted out
  - outbound daily limit and cooldown now apply on the Exotel path too
  - internal `/internal/call/start` is no longer open when `EXOTEL_INTERNAL_API_KEY` is missing
- Tightened Mailgun demo email safety:
  - `/email/test` now requires auth
  - added lightweight per-user guard: minimum delay between demo sends + hourly cap
  - frontend demo email call now sends with auth
  - Mailgun send payload now includes safer transactional headers/tracking-off defaults
- Switched the Bookings queue heading icon treatment from emoji to Lucide-based output in runtime bindings.
- Used a second independent audit agent (`Socrates`) as a cross-check to catch remaining fake/demo values and spam-risk gaps.

#### Files Changed
- `frontend/app/dashboard/page.tsx`
- `frontend/app/search/page.tsx`
- `frontend/app/page.tsx`
- `frontend/app/profile/page.tsx`
- `frontend/app/onboarding/page.tsx`
- `frontend/components/legacy/legacy-bindings.tsx`
- `frontend/lib/legacy-api.ts`
- `backend/src/modules/exotel/exotel.repository.ts`
- `backend/src/modules/exotel/exotel.service.ts`
- `backend/src/modules/exotel/exotel.controller.ts`
- `backend/src/routes/email.ts`
- `backend/src/services/email.service.ts`
- `AGENT_HANDOFF.md`

#### Validation Done
- `backend npm run typecheck`
- `backend npm run build`
- `frontend npm run build`
- live frontend routes:
  - `/` -> `200`
  - `/search` -> `200`
  - `/dashboard` -> `200`
  - `/dashboard/billing` -> `200`
  - `/dashboard/bookings` -> `200`
  - `/dashboard/agent` -> `200`
  - `/login` -> `200`
  - `/onboarding` -> `200`
- live backend routes:
  - `/health` -> `200`
  - `/exotel/config` -> `200`
  - `/call/public-config` -> `200`
- live backend protection checks:
  - `/email/test` without auth -> `401`
  - `/internal/call/start` without auth/api key -> `401`
- live HTML checks after deploy:
  - dashboard no longer contains `Alex Johnson`
  - dashboard no longer contains `Bookings Split`
  - dashboard no longer contains `Payment method editor opened (demo)`
  - dashboard no longer contains `Grand Horizon Hotel`
  - dashboard no longer contains `Sarah Connor`
  - search no longer contains `Grand Horizon Hotel`
  - search no longer contains `Showing 8 results`
  - search no longer contains `8 verified results`
  - home no longer contains `2.4M+`
  - home no longer contains `50K+`
  - home no longer contains `Grand Horizon Hotel`

#### Remaining Issues / Blockers
- `frontend npm run lint` still drops into Next.js interactive ESLint setup because this frontend does not yet have a committed ESLint config. This is not blocking builds/deploys, but a future agent should add a real lint config instead of relying on the prompt.
- Mailgun deliverability to inbox vs spam folder still depends on Mailgun account/domain setup outside code:
  - verified custom sending domain
  - SPF/DKIM/DMARC
  - sandbox recipients if still on sandbox
- Exotel outbound calling can still be blocked by Exotel account/KYC/provider policy even when app logic is correct.

#### Deployment / Runtime Notes
- Frontend production:
  - `https://frontend-anandh0us-projects.vercel.app`
- Latest frontend deploy in this pass:
  - `https://frontend-oa44286ys-anandh0us-projects.vercel.app`
- Backend production:
  - `https://backend-production-a176.up.railway.app`
- Railway backend was redeployed during this pass via CLI upload.

#### Next Agent Start Here
1. Read this file fully.
2. Treat the current accepted frontend as the Next/TS app under `frontend/app` and `frontend/components`.
3. Do not reintroduce page-level demo scripts or fake first-paint values.
4. If touching calls/email:
   - preserve Exotel as primary provider
   - preserve Mailgun auth/throttle protection on `/email/test`
5. Good next cleanup target:
   - add a committed ESLint config for the frontend
   - continue replacing any remaining non-live placeholder copy that is still user-visible after hydration
   - if requested, add clearer provider-state messaging for Exotel KYC and Mailgun sandbox restrictions

### 2026-04-12 Continuation Update

#### Work Completed
- Read this handoff fully and continued from current local state without frontend redesign changes.
- Ran `git status --short` and confirmed a large pre-existing dirty tree.
- Re-checked Bookings safety rules in active frontend paths:
  - no Bookings -> Workflow wording drift in active runtime bindings
  - Bookings tab/panels still present in the active dashboard route structure
- Preserved accepted UI/UX and made no layout or naming redesign changes.

#### Files Changed
- `AGENT_HANDOFF.md` (this update only)

#### Validation Done
- `git status --short`
- searched active frontend for forbidden workflow wording in Bookings runtime and app routes
- `frontend`: `npm run build` (passes)

#### Remaining Issues / Blockers
- Repository is already heavily dirty from prior work; continuation agents must avoid unintended cleanup/reverts.
- Mailgun delivery can still fail for non-authorized recipients if sandbox restrictions are active.
- Exotel remains primary provider path but external Exotel account/KYC limits may still block some call flows.

#### Deployment / Runtime Notes
- Active frontend still compiles cleanly on current local state.
- No new deploy performed in this continuation step.

#### Next Agent Start Here
1. Read this file first.
2. Run `git status --short` and treat existing changes as baseline context.
3. If touching Bookings, keep the exact accepted Bookings semantics and panel model:
   - Bookings
   - Back to Calendar
   - Weekly Schedule
   - Blocked Dates & Holidays
4. Prioritize logic/integration fixes only; avoid UI redesign.
5. Re-run `frontend npm run build` before handoff.

### 2026-04-12 Common Backend Push Session

#### Work Completed
- Prepared the current workspace state for a push to the `common-backend` remote.
- Kept the active frontend/backend accepted structure intact and did not introduce any new UI changes.

#### Files Changed
- `AGENT_HANDOFF.md` (this note)

#### Validation Done
- `git remote get-url common-backend`
- `git branch --show-current`
- `git status --short`

#### Remaining Issues / Blockers
- Local scratch artifacts still exist in the workspace and should not be confused with committed code state.

#### Deployment / Runtime Notes
- Push target remote: `common-backend` -> `https://github.com/Vtroninternal/common-backend.git`

#### Next Agent Start Here
1. Read this file first.
2. If continuing backend work, push meaningful code changes to the `common-backend` remote only after build/type validation.
3. Keep the accepted UI/UX unchanged unless explicitly asked.

### Latest Completed Work
- Fixed Bookings regression on the new TS/Next frontend.
- Kept the provided original frontend UI in `frontend/app` and `frontend/components`, while preserving live backend integration through `components/legacy/legacy-bindings.tsx`.
- Cleaned the active Overview page so its top metrics and donut charts render zero-safe server values instead of baked-in demo numbers.
- Tightened the Overview volume chart so it stays empty with a `No backend data available yet.` state until real call/chat activity exists.
- Removed stale `.html` links from the active frontend pages:
  - home search now routes to `/search`
  - search/profile links now route to `/profile/:id`
  - onboarding final redirect now routes to `/dashboard`
  - search navbar section links now route to `/#features`, `/#discover`, `/#pricing`
- Added missing ids for session-aware top-right actions on home/search.
- Added live Next route files:
  - `frontend/app/login/page.tsx`
  - `frontend/app/dashboard/[section]/page.tsx`
  - `frontend/app/profile/[id]/page.tsx`
- Updated profile rendering and page initialization so `/profile/:id` works with legacy bindings.
- Updated dashboard back navigation to `/search`.
- Deployment:
  - `https://frontend-ficslqqxo-anandh0us-projects.vercel.app`
  - aliased production: `https://frontend-anandh0us-projects.vercel.app`

### Files Touched In Latest Session
- `frontend/components/legacy/legacy-bindings.tsx`
- `frontend/vercel.json`
- `frontend/app/page.tsx`
- `frontend/app/search/page.tsx`
- `frontend/app/onboarding/page.tsx`
- `frontend/app/profile/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/[section]/page.tsx`
- `frontend/app/profile/[id]/page.tsx`

### Validation Done
- `frontend npm run build`
- production `/login` -> `200`
- production `/dashboard` -> `200`
- production `/dashboard/bookings` -> `200`
- production `/profile/1` -> `200`
- production `/search` -> `200`
- production HTML checks:
  - Overview server block no longer contains `4,267`, `2,847`, `1,420`, `384`, or old donut percentages
  - `Bookings`
  - `Back to Calendar`
  - `/#features`
  - `/#pricing`
  - `searchDashboardButton`

## Next Agent Start Here

When a new task arrives:
1. Read this file fully.
2. Run `git status`.
3. Inspect the exact route/component/service related to the task.
4. Preserve the existing accepted UI.
5. After changes, update this file before stopping.

## Handoff Template

Copy/update this section before ending a session:

### Work Completed
- 

### Files Changed
- 

### Validation
- 

### Remaining Issues / Blockers
- The frontend still preserves the original UI via large inline TSX strings/scripts. This is intentional right now to keep the accepted design stable.
- Mailgun delivery is still limited by Mailgun sandbox rules unless a production sending domain / authorized recipient is configured.
- Exotel outbound calling may still be blocked by provider-side KYC/account status.

### Deployment / Runtime Notes
- Current frontend production:
  - `https://frontend-anandh0us-projects.vercel.app`
- Current backend production:
  - `https://backend-production-a176.up.railway.app`
