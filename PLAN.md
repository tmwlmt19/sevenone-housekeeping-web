# SevenOne Housekeeping — Web App Plan

Frontend (React) for the hotel housekeeping SaaS. The backend API lives in the
separate `sevenone-housekeeping-service` repo (FastAPI + PostgreSQL/Neon).

> **Status: open questions only.** This document is a discussion agenda, not a
> set of decisions. Each section frames a question and sketches options; nothing
> here is committed. "Leaning" notes are starting points for discussion, not
> conclusions.

---

## How to use this doc

We'll work through these questions together, promote the answers into a real
implementation plan (mirroring the backend's phased `PLAN.md`), and only then
start building. Add comments/answers inline as we go.

---

## 1. Repo & integration

- **Separate repo vs monorepo?** Current direction: separate repo (this one).
  *Leaning: keep separate* — distinct toolchains, independent deploys, clean REST
  boundary. Worth a final confirmation. Revisit if we want atomic cross-repo
  changes or shared code.
- **How do we share the API contract?** The backend exposes OpenAPI at
  `/openapi.json`. Options: (a) generate a typed TS client from it
  (e.g. `openapi-typescript` / `orval`), (b) hand-write a thin API client,
  (c) use a generated SDK. *Leaning: generate types from OpenAPI* to stay in sync.
- **How is the API base URL configured per environment?** (local / staging / prod)

## 2. Framework & tooling

- **React framework?** Vite SPA vs Next.js vs React Router (framework mode) /
  Remix. Do we need SSR/SEO (probably not — it's an authed internal tool), or is
  a client-only SPA fine? *Leaning: Vite SPA* for a pure authed dashboard.
- **TypeScript?** Assumed yes — confirm.
- **Package manager?** npm / pnpm / yarn.
- **Linting/formatting?** ESLint + Prettier config and conventions.

## 3. Auth & session handling

- **Where do we store the JWT?** `localStorage` (simple, XSS-exposed) vs
  in-memory + httpOnly refresh cookie (more secure, more moving parts). This has
  **backend implications** (cookies, CSRF, refresh endpoint).
- **Token refresh / expiry.** Backend currently issues a single access token
  (24h, no refresh token). Do we add refresh tokens, or just re-login on expiry
  for the MVP?
- **Route protection.** Redirect unauthenticated users to login; handle 401s
  globally (interceptor) by clearing session and redirecting.
- **Role-based UI.** Admin / manager / housekeeper see different
  navigation and actions. How granular for the MVP?

## 4. Data fetching & state

- **Server state / data fetching lib?** TanStack Query (React Query) vs SWR vs
  RTK Query. *Leaning: TanStack Query* for caching + invalidation on CRUD.
- **Client/global state?** Likely minimal (auth/session, maybe UI prefs).
  Context vs Zustand vs Redux. *Leaning: Context or Zustand* — keep it light.
- **Cache invalidation strategy** after create/update/delete.

## 5. UI / design system

- **Component library?** shadcn/ui, MUI, Chakra, Mantine, Ant Design, or Tailwind
  from scratch. Tradeoff: speed/consistency vs bundle size/customizability.
- **Styling approach?** Tailwind vs CSS modules vs CSS-in-JS.
- **Branding / visual design.** Do we have a brand direction, colors, logo?
- **Responsive / device targets.** Housekeepers may use phones on the floor;
  managers use desktop. How much do we invest in mobile for the MVP?
- **Accessibility** expectations.

## 6. Core screens & MVP scope

Mirror the backend MVP so we can demo a full flow to a hotel manager.

- **Login** page.
- **Dashboard** — rooms grid with live status (clean/dirty/in-progress/OOS),
  plus today's tasks.
- **Rooms** — list + create/edit/delete (admin/manager).
- **Users / staff** — list + create/edit/delete (admin/manager).
- **Tasks** — create & assign (manager), board/list view, status updates.
- **Housekeeper view** — "my tasks" + one-tap status updates.
- **Open question:** what is the minimum set of screens to demo convincingly?
- **Open question:** manager desktop experience vs housekeeper mobile experience —
  one responsive app or tailored views?

## 7. Multi-tenancy in the UI

- Each user belongs to one hotel (from the JWT's `hotel_id`). The hotel context
  is implicit. Do we ever need a hotel switcher (multi-hotel users)? *Not for MVP.*
- How do we surface the current hotel (header/branding)?

## 8. Forms & validation

- **Form library?** React Hook Form (+ Zod) vs Formik vs uncontrolled.
- **Validation parity** with backend rules (email, password length, room codes).
  Can we derive validation from the OpenAPI schema?

## 9. Onboarding / sign-up portal

(From earlier discussion — likely post-MVP, but flag the dependency.)

- **Public sign-up page** to onboard a new hotel + first admin. This **requires a
  new backend endpoint** (create hotel + admin in one unauthenticated call). Is
  sign-up in the web MVP, or do we keep seeding admins manually for now?
- Batch import (CSV/Excel) UI — definitely later.

## 10. Real-time updates

- Housekeeping status is collaborative. Do we need live updates (websockets/SSE)
  or is **polling / refetch-on-focus** good enough for the MVP? *Leaning: polling
  for MVP*, revisit websockets later (backend implication).

## 11. Testing

- **Component/unit:** Vitest + React Testing Library?
- **E2E:** Playwright vs Cypress?
- How much test coverage do we want for the MVP vs after validation?

## 12. CI / DevEx / deployment

- **Hosting target?** Vercel / Netlify / Cloudflare Pages / Railway static.
- **CI** (GitHub Actions): lint + test + build on PR.
- **Environment variables** and secrets management for the frontend.

---

## Backend changes this may require

Tracking coordination items so they don't get lost (these live in the backend repo):

- **Registration endpoint** for public sign-up (create hotel + first admin).
- **Token refresh** strategy / endpoint, if we don't just re-login on expiry.
- **Cookie-based auth + CSRF**, if we go that route instead of `localStorage`.
- **CORS origins** — add the deployed frontend origin(s).
- **Pagination** on list endpoints (currently return all rows).
- Any **aggregate/dashboard endpoints** the UI needs (e.g. room status counts).
