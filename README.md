# sevenone-housekeeping-web

Frontend (React) for the SevenOne hotel housekeeping SaaS platform.

The backend API lives in a separate repo: `sevenone-housekeeping-service`
(FastAPI + PostgreSQL/Neon).

This repo is the **hotel operations app** (manager desktop + housekeeper
mobile/tablet, one responsive role-gated app). The owner/platform console is a
separate, later app — see PLAN.md §0.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # set VITE_API_BASE_URL (defaults to local backend)
pnpm dev                     # start the dev server
```

Other scripts: `pnpm build` (typecheck + production build), `pnpm lint`
(oxlint), `pnpm format` (Prettier), `pnpm typecheck`, and `pnpm gen:api`
(regenerate API types from the backend's `/openapi.json` — run with the backend
up).

Stack: Vite + React + TypeScript, Tailwind v4 + shadcn/ui, TanStack Query, React
Router, React Hook Form + Zod, openapi-fetch.

## Status

Requirements agreed; scaffold in place (login + routing + role guards; feature
pages are placeholders). See:

- [PLAN.md](PLAN.md) — requirements, API contract, role matrix, and build phases.
- [docs/site-map.md](docs/site-map.md) — routes, per-role navigation, and the
  API calls behind each page.
- [docs/ui-stack-comparison.md](docs/ui-stack-comparison.md) — component-library
  options and recommendation.
- [docs/hosting-comparison.md](docs/hosting-comparison.md) — hosting options and
  recommendation.
