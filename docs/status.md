# Project Status (whole system)

A snapshot of the entire SevenOne Housekeeping project so work can resume cold.
Last updated: 2026-07-02.

> This doc lives in the hotel (operations) app repo but covers **all four apps**.
> Each repo's README points here.

---

## The system: four repos

| Repo                            | What it is                                     | Runs on (dev) | Status                            |
| ------------------------------- | ---------------------------------------------- | ------------- | --------------------------------- |
| `sevenone-housekeeping-service` | FastAPI + PostgreSQL (Neon) backend            | :8000         | Built; deployed to Railway = TODO |
| `sevenone-housekeeping-login`   | Shared login app (cookie SSO)                  | :5174         | Built                             |
| `sevenone-housekeeping-web`     | Hotel operations app (managers + housekeepers) | :5173         | MVP built                         |
| `sevenone-housekeeping-admin`   | Platform/owner console (cross-tenant admins)   | :5175         | MVP built                         |

All four are on `main` and pushed to GitHub (`tmwlmt19/...`).

## Auth model (cookie SSO)

- Users sign in **only** at the login app. The backend sets an **httpOnly session
  cookie**; the login app then redirects by role (admin → admin app; manager /
  housekeeper → hotel app).
- Hotel & admin apps have **no login screen**: on load they call `GET /auth/me`
  (cookie sent via `credentials: 'include'`); on `401` they redirect to the login
  app. No token in JS/localStorage.
- `POST /auth/logout` clears the cookie. `PUT /auth/me/password` = self-service
  password change (the only way passwords change).

## Role model

- **Admin = platform owner** (cross-tenant): manages all hotels + all users; lives
  in the admin app. Not a hotel employee.
- **Manager** (hotel): rooms + tasks CRUD; views staff (read-only).
- **Housekeeper** (hotel): own tasks only; reads rooms.
- Self-protection: nobody can change their own role or delete their own account.
  New users get a **temporary password** at creation; there's no password field on
  the edit-user screen.

## Backend surface

`/api/v1`: `auth` (login/logout/me/me·password), `hotels` (list all + CRUD,
admin-only for writes; cross-tenant reads for admins), `hotels/{id}/{rooms|users|
tasks}` (tenant-scoped; housekeepers limited to their own tasks). Tests: cookie +
bearer paths, RBAC, self-protection — **green**. Runs against a shared **Neon**
cloud DB (no local Postgres needed).

## Feature state per app

- **Hotel app:** login-free (SSO), Dashboard (room grid + open tasks), Rooms CRUD,
  Staff (admin-only writes; managers read), Tasks board + assignee filter +
  create/edit (date-only due dates), housekeeper My Tasks (one-tap status),
  Hotel settings (admin), Account (password change). Route-aware modals.
- **Admin app:** Hotels list, Create hotel, Hotel detail (edit + staff
  onboarding with temp passwords), Account.
- **Login app:** email/password → role-based redirect (validated `?redirect=`).

## Verified / not verified

- ✅ All four build, type-check, lint clean. Backend tests green.
- ✅ Cross-origin cookie mechanics checked with real origins (login sets cookie w/
  `ACAC: true`; `/auth/me` + `/hotels` authenticate by cookie from :5173/:5175 w/
  correct `ACAO`).
- ❌ **Full browser click-through not yet done** (login → redirect → app → CRUD →
  logout across all UIs). Top of the list.

## Open / TODO

- **Browser + automated tests** (Playwright E2E; Vitest for auth/role logic).
- **Deploy**: Vercel for the three frontends; Railway custom domain for the API.
  Requires a shared parent domain (`login./app./admin./api.<domain>`) with
  `COOKIE_DOMAIN` + `COOKIE_SECURE=true`, and prod origins in `CORS_ORIGINS`.
- **Deferred auth work:** rotating **refresh tokens** (currently 24h cookie,
  re-login on expiry) and **forgot-password** (needs email/reset flow).
- **Polish:** route-level code-splitting (bundle > 500 kB advisory).

## How to resume locally

1. Backend: in `sevenone-housekeeping-service`, `.venv/bin/uvicorn app.main:app --reload` (:8000). See its `docs/local-development.md`.
2. `pnpm install && pnpm dev` in each of login (:5174), web (:5173), admin (:5175). Each needs `.env.local` (copy `.env.example`).
3. Sign in at the **login app** (:5174) as `admin@demo.com` / `DemoAdmin123!` → routed to the admin app. Create a hotel + a manager there; sign in as that manager to use the hotel app.

## Security reminders (pre-production)

- Backend `.env` (live Neon creds) and the dev admin password are committed for
  MVP convenience — rotate and gitignore before real data.
- CSRF currently relies on `SameSite` + same-site subdomains; consider a
  double-submit token when hardening. Tighten CSP; audit deps.
