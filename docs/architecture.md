# Architecture

How the operations app is structured and how the pieces fit together. Pair this
with [site-map.md](site-map.md) (routes + per-page API calls) and
[../PLAN.md](../PLAN.md) (requirements and decisions).

---

## Stack

| Concern       | Choice                                       |
| ------------- | -------------------------------------------- |
| Build / dev   | Vite 8 + React 19 + TypeScript               |
| Styling / UI  | Tailwind v4 + shadcn/ui (new-york, neutral)  |
| Routing       | React Router (`createBrowserRouter`)         |
| Server state  | TanStack Query                               |
| Forms         | React Hook Form + Zod                        |
| API client    | openapi-fetch + types generated from OpenAPI |
| Auth/session  | JWT in localStorage + React context          |
| Lint / format | oxlint + Prettier                            |

---

## Source tree

```
src/
├── main.tsx                  # Entry: mounts providers + router (see "Provider tree")
├── index.css                 # Tailwind v4 entry + shadcn theme tokens
├── auth/
│   ├── types.ts              # Role, AuthUser
│   ├── jwt.ts                # decode JWT, expiry check
│   └── auth-context.tsx      # AuthProvider + useAuth()
├── routes/
│   ├── router.tsx            # Route tree (createBrowserRouter)
│   └── guards.tsx            # RequireAuth, RequireRole, RootRedirect, homePathFor
├── components/
│   ├── layout/
│   │   ├── auth-layout.tsx   # Centered card for /login
│   │   ├── app-shell.tsx     # Desktop sidebar shell (manager/admin)
│   │   └── mobile-shell.tsx  # Mobile shell (housekeeper)
│   ├── page-placeholder.tsx  # Temporary page content (removed as features land)
│   └── ui/                   # shadcn components (owned; excluded from format/lint)
├── pages/                    # One file per route (login, dashboard, rooms, …)
└── lib/
    ├── env.ts                # Reads + validates VITE_* env at startup
    ├── utils.ts              # cn() class-merge helper
    ├── query-client.ts       # Configured TanStack QueryClient
    └── api/
        ├── schema.ts         # GENERATED from OpenAPI (pnpm gen:api) — do not edit
        ├── token-store.ts    # localStorage JWT + 401 callback
        └── client.ts         # openapi-fetch client w/ auth + 401 middleware
```

---

## Provider tree

`src/main.tsx` wires the app top-down:

```
QueryClientProvider        # TanStack Query cache
└── AuthProvider           # session state from the JWT
    ├── RouterProvider     # all routes/pages render here
    └── Toaster            # sonner toasts
```

AuthProvider wraps the router so route guards and pages can call `useAuth()`.

---

## Auth & session

The session is derived entirely from the backend's JWT (claims: `sub`,
`hotel_id`, `role`; 24h, no refresh token).

- **[`lib/api/token-store.ts`](../src/lib/api/token-store.ts)** is the single
  source of truth for the raw token in `localStorage`. Both the auth context and
  the API client read/write through it, and it holds the "on unauthorized"
  callback.
- **[`auth/auth-context.tsx`](../src/auth/auth-context.tsx)** decodes the token
  into an `AuthUser` (`id`, `hotelId`, `role`), exposes `login`/`logout`, drops
  expired tokens on load, and registers the 401 callback so a `401` from the API
  logs the user out.
- **`login(token)`** stores the token and updates context; **`logout()`** clears
  both.

> Storing the JWT in localStorage is the simplest option and is XSS-exposed. The
> hardening path (in-memory token + httpOnly refresh cookie) is in
> [../PLAN.md](../PLAN.md) §3 and needs backend support.

---

## Routing & guards

Defined in [`routes/router.tsx`](../src/routes/router.tsx); guards in
[`routes/guards.tsx`](../src/routes/guards.tsx).

- **`RequireAuth`** — redirects unauthenticated users to `/login` (remembering
  the origin so they return after signing in).
- **`RequireRole`** — allows only the given roles; otherwise bounces the user to
  their own home via `homePathFor(role)`.
- **`RootRedirect`** — sends `/` to each role's home (housekeeper → `/my-tasks`,
  manager/admin → `/dashboard`).

Layouts nest by audience: `AppShell` (manager/admin desktop), `MobileShell`
(housekeeper), `AuthLayout` (login). The full route ↔ role ↔ layout mapping is in
[site-map.md](site-map.md). Guards mirror the backend's role rules
([../PLAN.md](../PLAN.md) §2a) — the UI hides what a role can't do, and the API
remains the source of truth.

---

## API layer

- **[`lib/api/schema.ts`](../src/lib/api/schema.ts)** — types generated from the
  backend's `/openapi.json` (`pnpm gen:api`). Build artifact; never hand-edited.
- **[`lib/api/client.ts`](../src/lib/api/client.ts)** — an `openapi-fetch` client
  typed by `schema.ts`. Middleware injects `Authorization: Bearer <token>` on
  every request and, on a `401`, clears the token and fires the unauthorized
  callback (→ logout/redirect).

Data fetching uses **TanStack Query** on top of this client. Query keys follow the
tenant-scoped shape documented in [site-map.md](site-map.md#shared-query-keys-tanstack-query)
(e.g. `['rooms', hotelId]`); mutations invalidate the relevant list keys.

> The login request in [`pages/login.tsx`](../src/pages/login.tsx) uses a plain
> `fetch` (it runs before there's a token/typed-client need); everything else
> goes through the typed client.

---

## Conventions

- **Path alias:** `@/` → `src/` (configured in `tsconfig*.json` and `vite.config.ts`).
- **Theme tokens:** colors/radii are CSS variables in `index.css`; use the
  semantic Tailwind classes (`bg-background`, `text-muted-foreground`, …) rather
  than hard-coded colors so dark mode and rebranding stay cheap.
- **One page per route** under `pages/`; shared pieces under `components/`.
- **Owned UI:** `components/ui` is shadcn output we own; restyle freely, but it's
  excluded from Prettier/oxlint to avoid churn.

---

## How a feature gets built (pattern)

For each resource (rooms, staff, tasks):

1. **Query hooks** over the typed client (list/get/create/update/delete) with
   TanStack Query keys + invalidation.
2. **List page** — table (TanStack Table) with role-gated actions.
3. **Create/edit** — route-aware modal (`/…/new`, `/…/:id` render a dialog over
   the list) using React Hook Form + Zod; surface backend `409`s as field errors.
4. **Wire** into the route tree and navigation.

See [../PLAN.md](../PLAN.md) §9 for the phase order.
