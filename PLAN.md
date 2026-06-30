# SevenOne Housekeeping — Web App Plan

Frontend for the hotel housekeeping SaaS. The backend API lives in the separate
`sevenone-housekeeping-service` repo (FastAPI + PostgreSQL/Neon).

> **Status: requirements agreed; ready to scaffold.** Decisions below are
> committed unless marked _(open)_. See also
> [docs/ui-stack-comparison.md](docs/ui-stack-comparison.md) (component library)
> and [docs/site-map.md](docs/site-map.md) (routes, navigation, and the API calls
> behind each page).

---

## 0. Product shape & audiences

Three audiences, **two separate frontend apps**:

| App                | Audience                                                                | Tenancy                 | Repo                   | Status             |
| ------------------ | ----------------------------------------------------------------------- | ----------------------- | ---------------------- | ------------------ |
| **Operations app** | Hotel manager / front desk (desktop) **+** housekeeper (mobile/tablet)  | Single hotel (from JWT) | **this repo**          | building now       |
| **Owner console**  | Software owner — manage hotel clients, onboard new hotels, batch import | Cross-tenant            | separate repo (future) | blocked on backend |

Manager and housekeeper are the **same data, different role + device**, so they
are **one responsive, role-gated app** — not two. The owner console is a
genuinely separate app and is **deferred until the backend gains cross-tenant
endpoints** (see §10). This plan covers the **operations app** only.

---

## 1. Decisions

| Area            | Decision                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Repo strategy   | **Two separate repos**, not a monorepo. This repo = operations app.                                                                       |
| Sequencing      | **Operations app first**; owner console after backend support lands.                                                                      |
| Framework       | **Vite SPA + TypeScript** (authed internal tool, no SSR/SEO need).                                                                        |
| Package manager | pnpm                                                                                                                                      |
| API contract    | **Generate TS types from `/openapi.json`** (openapi-typescript) + a thin fetch client.                                                    |
| Server state    | **TanStack Query** (caching + invalidation on CRUD).                                                                                      |
| Client state    | Light — Context (or Zustand) for auth/session only.                                                                                       |
| Forms           | **React Hook Form + Zod**.                                                                                                                |
| Create/edit UX  | **Route-aware modals** — `/…/new` and `/…/:id` keep working as URLs but render as a dialog over the list (deep-linkable + keeps context). |
| UI library      | **shadcn/ui + Tailwind** (+ TanStack Table for data grids).                                                                               |
| Auth storage    | **JWT in `localStorage`, re-login on expiry** (simplest). Hardening path documented in §3.                                                |
| Realtime        | **Polling / refetch-on-focus** for MVP; websockets later (backend implication).                                                           |
| Lint / format   | **oxlint** (Vite template default — faster than ESLint) + **Prettier** for formatting.                                                    |
| Testing         | Vitest + React Testing Library; Playwright for E2E happy paths.                                                                           |
| Hosting         | **Vercel** (per-PR preview deploys; ~$20/mo flat once commercial). See [docs/hosting-comparison.md](docs/hosting-comparison.md).          |

---

## 2. API contract (from the live backend)

Base: `/api/v1`. All resources are nested under the tenant:
`/api/v1/hotels/{hotel_id}/{rooms|users|tasks}`. `hotel_id` comes from the JWT —
the hotel context is implicit; there is no hotel switcher.

- **Auth:** `POST /auth/login` → `{ access_token, token_type:"bearer" }`. Single
  JWT, **24h, no refresh token**. Claims: `sub` (user id), `hotel_id`, `role`.
  `GET /auth/me` → current user.
- **Rooms:** CRUD under `/hotels/{id}/rooms`. `room_number` unique per hotel
  (409 on dup). Status enum: `clean | dirty | in_progress | out_of_service`.
- **Users (staff):** CRUD under `/hotels/{id}/users`. Email unique (409).
  Role enum: `admin | manager | housekeeper`.
- **Tasks:** CRUD under `/hotels/{id}/tasks`; list filters `?status=` and
  `?assigned_to=`. `PATCH /tasks/{id}/status` for status-only updates. Status
  enum: `pending | assigned | in_progress | completed`; priority
  `low | normal | urgent`.
- **Hotel:** `GET/PUT /hotels/{id}` (PUT admin-only).

**Domain rules to mirror in the UI:** completing a task auto-sets its room to
`clean`; creating a task with an assignee auto-moves `pending → assigned`.

**Known gaps (accepted for MVP, tracked in §10):** no pagination (lists return
everything), no dashboard/aggregate endpoints, no refresh token, no public
registration / cross-tenant endpoints.

## 2a. Role → capability matrix (enforced by the backend; mirror in UI)

| Action                            | Housekeeper           | Manager | Admin  |
| --------------------------------- | --------------------- | ------- | ------ |
| List/view rooms & tasks           | ✅                    | ✅      | ✅     |
| Update task status                | ✅ **own tasks only** | ✅ any  | ✅ any |
| Create/edit/delete rooms          | ❌                    | ✅      | ✅     |
| Create/edit/delete & assign tasks | ❌                    | ✅      | ✅     |
| List/create/edit/delete staff     | ❌                    | ✅      | ✅     |
| Edit hotel details                | ❌                    | ❌      | ✅     |

UI must hide actions a role can't perform and still handle 401/403 defensively.

---

## 3. Auth & session

- On login, store the JWT in `localStorage`; decode it (or call `/auth/me`) to
  get `hotel_id`, `role`, user id for routing and role-gating.
- A fetch wrapper attaches `Authorization: Bearer <token>`; a global handler
  clears the session and redirects to login on **401**.
- Protected routes redirect unauthenticated users to `/login`. No refresh token:
  on expiry the user re-logs in.

> **Security hardening backlog** (documented now, deferred for MVP):
> `localStorage` is XSS-exposed. The more secure path is an in-memory access
> token + an **httpOnly refresh cookie**, which requires backend work: a refresh
> endpoint, cookie issuance, and CSRF protection. Revisit before handling real
> customer data in production. Also: tighten CSP, audit dependencies.

---

## 4. Screens (operations app MVP)

1. **Login.**
2. **Dashboard (manager/front-desk):** room-status grid (clean/dirty/in‑progress/
   OOS counts + grid) and today's tasks. Built from client-side aggregation of
   the rooms/tasks lists until backend aggregate endpoints exist.
3. **Rooms:** list + create/edit/delete (manager/admin).
4. **Staff:** list + create/edit/delete (manager/admin).
5. **Tasks:** board/list with status & assignee filters; create & assign (manager/admin).
6. **My Tasks (housekeeper, mobile-first):** assigned tasks + one-tap status
   updates (`in_progress → completed`).
7. **Hotel settings (admin):** edit hotel name/address.
8. **Self-service onboarding within a hotel:** front-desk adds rooms/staff —
   covered by screens 3–4 (no new backend needed).

Responsive: desktop-dense layouts for manager/admin; touch-first list views for
housekeeper, gated by role from the JWT.

---

## 5. Data fetching & state

- TanStack Query keyed by `[hotel_id, resource, filters]`; invalidate on mutation.
- Polling/refetch-on-focus for collaborative status freshness.
- Auth/session in Context (or Zustand). No heavier global store expected.

---

## 6. Forms & validation

- React Hook Form + Zod. Mirror backend constraints: email format, password
  8–128 chars, room_number 1–50 chars (unique), room_type ≤20 chars (uppercased),
  required name. Where practical, derive/cross-check against the OpenAPI schema.
- Surface backend 409s (duplicate room number / email) as field errors.

---

## 7. Testing

- Vitest + RTL for components and the auth/role gating logic.
- Playwright for the core flow: login → create room → create staff → create &
  assign task → housekeeper completes task → room shows clean.

---

## 8. CI / deployment

- **Vercel** for hosting: auto build + deploy on push, per-PR preview deploys,
  prod on merge to `main`. (GitHub Actions still runs lint + typecheck + test on PR.)
- Configure API base URL per environment via build-time env
  (`VITE_API_BASE_URL` for local / staging / prod).
- Coordinate **CORS origins** with the backend for each deployed origin —
  including Vercel preview URLs if we want previews to hit a live API.

---

## 9. Build phases

1. **Scaffold:** Vite + TS + pnpm, lint/format, UI library, routing, env config.
2. **API layer:** generate types from `/openapi.json`, fetch client, auth interceptor.
3. **Auth:** login, session storage, protected routes, role context.
4. **Rooms + Staff CRUD** (manager/admin).
5. **Tasks:** board, create/assign, filters.
6. **Dashboard:** room-status grid + today's tasks (client-side aggregation).
7. **Housekeeper My Tasks** (mobile-first) + one-tap status.
8. **Hotel settings** (admin).
9. **Tests + CI + deploy.**

---

## 10. Backend coordination items

Tracked here so they aren't lost; they live in the `sevenone-housekeeping-service`
repo.

**Needed for the owner console (separate, deferred app):**

- **Cross-tenant access** for the software owner (a platform super-admin scope;
  today `require_same_hotel` scopes even admins to one hotel).
- **Hotel onboarding endpoint:** create hotel + first admin in one call.
- **Batch onboarding** capability (script/endpoint) layered on the above.

**Nice-to-have for the operations app (accepted gaps for MVP):**

- **Pagination** on list endpoints (currently return all rows).
- **Dashboard/aggregate endpoints** (room-status counts, task throughput) to
  replace client-side aggregation.
- **Token refresh** + cookie/CSRF, if/when we do the auth hardening in §3.
- **CORS origins** updated for each deployed frontend origin.
- **Websockets/SSE** if we move off polling for realtime.
