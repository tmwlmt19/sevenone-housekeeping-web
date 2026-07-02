# sevenone-housekeeping-web

The **hotel operations app** (React) for the SevenOne hotel housekeeping SaaS —
manager desktop + housekeeper mobile/tablet in one responsive, role-gated app.

Part of a four-app system (all separate repos):

- `sevenone-housekeeping-login` — shared login app (cookie SSO)
- `sevenone-housekeeping-web` — **this app** (hotel operations)
- `sevenone-housekeeping-admin` — platform/owner console (cross-tenant admins)
- `sevenone-housekeeping-service` — FastAPI + PostgreSQL/Neon backend

Auth is **cookie-based SSO**: this app has no login screen — unauthenticated
users are redirected to the login app; API calls send the shared session cookie.
See [docs/status.md](docs/status.md) for whole-system status.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # VITE_API_BASE_URL + VITE_LOGIN_URL
pnpm dev                     # http://localhost:5173
```

Needs the backend (:8000) and the login app (:5174) running to sign in.

Other scripts: `pnpm build` (typecheck + production build), `pnpm lint`
(oxlint), `pnpm format` (Prettier), `pnpm typecheck`, and `pnpm gen:api`
(regenerate API types from the backend's `/openapi.json` — run with the backend
up).

Stack: Vite + React + TypeScript, Tailwind v4 + shadcn/ui, TanStack Query, React
Router, React Hook Form + Zod, openapi-fetch.

## Status

MVP feature set built: SSO auth, role-gated routing, dashboard, rooms & staff
CRUD, task board with assign/status, housekeeper "My Tasks", hotel settings, and
account (password change) — all wired to the live API. Remaining: automated tests
(Vitest/Playwright) and deploy. See:

- [docs/status.md](docs/status.md) — **whole-system** status, open items, and how to resume.
- [PLAN.md](PLAN.md) — requirements, API contract, role matrix, and build phases.
- [docs/development.md](docs/development.md) — run it locally, scripts, env, dev
  login, regenerating API types.
- [docs/architecture.md](docs/architecture.md) — source tree, providers, auth,
  routing/guards, API layer, and conventions.
- [docs/site-map.md](docs/site-map.md) — routes, per-role navigation, user
  journeys, and the API calls behind each page.
- [docs/ui-stack-comparison.md](docs/ui-stack-comparison.md) — component-library
  options and recommendation.
- [docs/hosting-comparison.md](docs/hosting-comparison.md) — hosting options and
  recommendation.
