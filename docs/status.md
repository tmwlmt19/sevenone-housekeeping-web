# Project Status

A snapshot of where the operations app stands, so work can resume cold. Last
updated: 2026-06-30.

---

## Where we are

The **operations-app MVP feature set is built and pushed to `main`** (builds,
type-checks, lints, and formats clean). It has **not** yet been driven through a
real browser end-to-end — that's the main open verification gap (see below).

## Done

- **Planning & decisions** — see [../PLAN.md](../PLAN.md). Two separate repos
  (this = operations app; owner console deferred), Vite + TS + pnpm, shadcn/ui +
  Tailwind v4, TanStack Query, RHF + Zod, route-aware modals, localStorage JWT,
  Vercel hosting. Comparison docs for [UI](ui-stack-comparison.md) and
  [hosting](hosting-comparison.md); routes/journeys in [site-map.md](site-map.md);
  structure in [architecture.md](architecture.md).
- **Scaffold** — Vite/React/TS, Tailwind+shadcn, routing with auth + role guards,
  auth context (JWT in localStorage), typed openapi-fetch client with 401
  handling, env config.
- **API layer** — typed query/mutation hooks (hotel, rooms, staff, tasks) with
  tenant-scoped keys, `ApiError`/`unwrap`, and invalidation.
- **Features** — Login; Dashboard (client-side aggregation); Rooms CRUD; Staff
  CRUD; Tasks status board + assignee filter + create/edit; housekeeper My Tasks
  (one-tap status); Hotel settings (admin). Hotel name in the app-shell header.

## Not done / open

- **Browser verification.** The build and the API contract are verified, but the
  rendered UI has not been clicked through (login → CRUD → assign → complete).
  This is the first thing to do on resume.
- **Automated tests** (PLAN §11) — no Vitest/Playwright yet.
- **Deploy** (PLAN §8) — not deployed to Vercel; backend not on Railway yet.
- **Polish** — bundle is one ~620 kB chunk (Vite 500 kB advisory); route-level
  code-splitting is easy cleanup. No list/status-filter toggle on Tasks (board +
  assignee filter only) — intentional MVP trim.
- **Owner console** — separate future app, blocked on backend cross-tenant +
  registration endpoints (PLAN §10).

## How to resume

1. **Backend** (sibling `sevenone-housekeeping-service`): `.venv/bin/uvicorn
   app.main:app --reload` → <http://localhost:8000>. Runs against the shared Neon
   cloud DB; see that repo's `docs/local-development.md`.
2. **Frontend**: `pnpm install` then `pnpm dev` → <http://localhost:5173>.
3. **Log in**: `admin@demo.com` / `DemoAdmin123!` (admin). The demo DB has the
   hotel + admin but **no rooms/tasks yet**, so you'll start on empty states and
   can exercise the create flows.
4. If the backend API changed, regenerate types: `pnpm gen:api` (backend up).

## Suggested next steps (in order)

1. Manual/automated browser pass of the core flow (verify skill or Playwright).
2. Tests: Vitest for auth/role logic; Playwright for the happy path.
3. Deploy to Vercel; add preview/prod origins to backend `CORS_ORIGINS`.
4. Route-level code-splitting; revisit Tasks list view if wanted.

## Security reminders (pre-production)

- Backend `.env` (live Neon creds) and the dev admin password are committed for
  MVP convenience — rotate and gitignore before real data.
- JWT lives in localStorage (XSS-exposed); hardening path in PLAN §3.
