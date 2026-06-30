# Development

How to run the SevenOne Housekeeping **operations app** locally and work on it
day to day.

> Architecture and source-tree conventions live in
> [architecture.md](architecture.md). Product requirements and decisions live in
> [../PLAN.md](../PLAN.md).

---

## Prerequisites

- **Node** (v20+; developed on v25) and **pnpm** (`npm i -g pnpm`).
- The **backend** running locally so the app has an API to talk to — see the
  service repo's
  [local-development.md](../../sevenone-housekeeping-service/docs/local-development.md).
  In short, from `sevenone-housekeeping-service`:
  ```bash
  .venv/bin/uvicorn app.main:app --reload   # http://localhost:8000
  ```

## Setup & run

```bash
pnpm install
cp .env.example .env.local        # VITE_API_BASE_URL, defaults to http://localhost:8000
pnpm dev                          # http://localhost:5173
```

The backend's `CORS_ORIGINS` already allows `http://localhost:5173`, so no extra
config is needed.

### Dev login (MVP only)

Log in with the seeded demo admin:

| Email            | Password        | Role  |
| ---------------- | --------------- | ----- |
| `admin@demo.com` | `DemoAdmin123!` | admin |

These are documented (and can be reset) in the service repo's
[local-development.md](../../sevenone-housekeeping-service/docs/local-development.md#dev-credentials-mvp-only).
Committing credentials is a temporary MVP exception, not a habit.

---

## Scripts

| Command             | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `pnpm dev`          | Start the Vite dev server (HMR).                                   |
| `pnpm build`        | Type-check (`tsc -b`) then production build to `dist/`.            |
| `pnpm preview`      | Serve the production build locally.                                |
| `pnpm typecheck`    | Type-check without emitting.                                       |
| `pnpm lint`         | Run oxlint.                                                        |
| `pnpm format`       | Format with Prettier.                                              |
| `pnpm format:check` | Check formatting without writing.                                  |
| `pnpm gen:api`      | Regenerate the typed API client from the backend's OpenAPI schema. |

---

## Regenerating the API types

The typed API surface in [`src/lib/api/schema.ts`](../src/lib/api/schema.ts) is
generated from the backend's OpenAPI schema. **Regenerate it whenever the backend
API changes:**

```bash
# with the backend running on http://localhost:8000
pnpm gen:api
```

The generated file is checked in (so the app type-checks without the backend
running) but is treated as a build artifact: don't hand-edit it, and it's
excluded from Prettier/oxlint.

---

## Environment variables

| Variable            | Required | Purpose                                          |
| ------------------- | -------- | ------------------------------------------------ |
| `VITE_API_BASE_URL` | yes      | Base URL of the backend API (no trailing slash). |

Set per environment:

- **Local:** `.env.local` (gitignored). Copy from `.env.example`.
- **Staging / production:** configured in Vercel (see [../PLAN.md](../PLAN.md) §8).

Vite only exposes variables prefixed with `VITE_` to the client. `src/lib/env.ts`
reads and validates them at startup and throws a clear error if missing.

---

## Adding a shadcn/ui component

Components are copied into [`src/components/ui`](../src/components/ui) (we own the
code). Add more as needed:

```bash
pnpm dlx shadcn@latest add <component>   # e.g. dialog, table, select, badge
```

Config lives in `components.json`. `src/components/ui` is excluded from Prettier
to avoid churn against upstream.

---

## Conventions

- **Imports:** use the `@/` alias for everything under `src/` (e.g.
  `import { api } from '@/lib/api/client'`).
- **Formatting/linting:** Prettier for formatting, oxlint for linting. Run both
  before committing (or rely on the editor).
- **Commits:** small and focused; the build (`pnpm build`) should stay green.

See [architecture.md](architecture.md) for where things live and how the pieces
fit together.
