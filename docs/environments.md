# Environments & Deployment (test + prod)

How to stand up two isolated environments — **test (staging)** and **prod** — for
the whole four-app system. This is cross-repo; it lives in the web repo as the
system hub (see [status.md](status.md)).

> **Key finding:** the code is already fully env-parametrized (backend via
> `pydantic-settings`, frontends via `VITE_*`). **No code changes are required** —
> this is infra + configuration only.

---

## Model

Two fully isolated stacks that share only source code. Each stack = the 4 apps
deployed with env-specific config, on **its own parent domain** (required by
cookie SSO — see below).

| Layer                 | test (staging)          | prod                  |
| --------------------- | ----------------------- | --------------------- |
| Backend API (Railway) | `api.<TEST_DOMAIN>`     | `api.<PROD_DOMAIN>`   |
| Login (Vercel)        | `login.<TEST_DOMAIN>`   | `login.<PROD_DOMAIN>` |
| Hotel app (Vercel)    | `app.<TEST_DOMAIN>`     | `app.<PROD_DOMAIN>`   |
| Admin app (Vercel)    | `admin.<TEST_DOMAIN>`   | `admin.<PROD_DOMAIN>` |
| Database              | Neon **staging** branch | Neon **prod** branch  |
| Git branch            | `staging`               | `main`                |

Substitute your two registered domains for `<TEST_DOMAIN>` / `<PROD_DOMAIN>`.

### Why two separate domains (the cookie-SSO constraint)

SSO works by setting the session cookie's `Domain` to the shared parent (e.g.
`.<PROD_DOMAIN>`) so `login.`, `app.`, `admin.`, and `api.` all send it. A cookie
scoped to `.<PROD_DOMAIN>` is valid on **every** subdomain of it — so if test
lived at `*.staging.<PROD_DOMAIN>`, prod cookies would leak into test. Using two
**separate registrable domains** keeps the cookie namespaces disjoint. Decided:
two domains.

---

## Per-environment configuration

### Backend (Railway) — one service per env

Two services (or two Railway environments), each with these vars. **Bold = must
differ per env / must be unique.**

| Var                           | test                                   | prod                                   |
| ----------------------------- | -------------------------------------- | -------------------------------------- |
| `DATABASE_URL`                | **Neon staging branch**                | **Neon prod branch**                   |
| `JWT_SECRET`                  | **unique random**                      | **unique random (different)**          |
| `COOKIE_DOMAIN`               | `.<TEST_DOMAIN>`                       | `.<PROD_DOMAIN>`                       |
| `COOKIE_SECURE`               | `true`                                 | `true`                                 |
| `COOKIE_SAMESITE`             | `lax`                                  | `lax`                                  |
| `CORS_ORIGINS`                | the 3 `https://…<TEST_DOMAIN>` origins | the 3 `https://…<PROD_DOMAIN>` origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440`                                 | `1440`                                 |

(`SESSION_COOKIE_NAME`, `JWT_ALGORITHM` can stay default.)
Custom domain on each Railway service → `api.<domain>` (TLS automatic).

### Frontends (Vercel) — one project per app, two Environments each

Use Vercel **Environments**: **Production** (bound to `main`) and a custom
**Staging** environment (bound to the `staging` branch). Set the app's domain and
`VITE_*` vars per environment.

**Login app** (`sevenone-housekeeping-login`):

| Var                  | test                          | prod                          |
| -------------------- | ----------------------------- | ----------------------------- |
| `VITE_API_BASE_URL`  | `https://api.<TEST_DOMAIN>`   | `https://api.<PROD_DOMAIN>`   |
| `VITE_HOTEL_APP_URL` | `https://app.<TEST_DOMAIN>`   | `https://app.<PROD_DOMAIN>`   |
| `VITE_ADMIN_APP_URL` | `https://admin.<TEST_DOMAIN>` | `https://admin.<PROD_DOMAIN>` |

**Hotel app** (`sevenone-housekeeping-web`) and **Admin app**
(`sevenone-housekeeping-admin`):

| Var                 | test                          | prod                          |
| ------------------- | ----------------------------- | ----------------------------- |
| `VITE_API_BASE_URL` | `https://api.<TEST_DOMAIN>`   | `https://api.<PROD_DOMAIN>`   |
| `VITE_LOGIN_URL`    | `https://login.<TEST_DOMAIN>` | `https://login.<PROD_DOMAIN>` |

> `VITE_*` vars are baked in **at build time**, so each environment must build
> with its own values (Vercel does this per-environment automatically).

---

## Setup checklist (one-time)

1. **Register two domains**; add both to Vercel (and Railway for the `api.`
   subdomains). Create DNS: `login/app/admin` → Vercel, `api` → Railway, per env.
2. **Neon:** create a `prod` branch and a `staging` branch (separate from the
   throwaway `test` branch the pytest suite uses). Grab each connection string.
3. **Backend (Railway):** create `api-prod` and `api-staging` services from the
   `sevenone-housekeeping-service` repo (deploy `main` and `staging` respectively).
   Set the env vars above. For each: run `alembic upgrade head`, then seed an
   initial admin (`python -m app.seed …`) with **env-specific credentials**
   (store securely, NOT in git for prod).
4. **Frontends (Vercel):** for each of the 3 apps, create a project, add the
   Production + Staging environments, bind them to `main` / `staging`, set the
   per-env `VITE_*` vars and custom domains.
5. **Git flow:** create a `staging` branch in each of the 4 repos. `main` → prod,
   `staging` → test. Promote with `staging` → `main` merges.
6. **Verify:** on each env, sign in at `login.<domain>`, confirm the cookie is set
   for `.<domain>`, and that `app.`/`admin.` authenticate via the cookie and can
   call `api.`. Confirm test and prod cookies don't cross.

## Ongoing: deploy & promote

- Push to `staging` (any repo) → Vercel/Railway deploy that repo to **test**.
- Merge `staging` → `main` → deploys to **prod**.
- Keep the four repos roughly in lockstep when a change spans several.

## Secrets & hardening (do during setup)

- **Unique `JWT_SECRET` per env**; unique DB creds per env; store only in
  Railway/Vercel settings.
- **Rotate the currently-committed dev secrets** (`.env` with live Neon creds, the
  demo admin password) and gitignore `.env` before prod handles real data.
- Consider a CSRF double-submit token (SSO currently leans on `SameSite` +
  same-site subdomains); tighten CSP; audit dependencies.

## Cost delta for the second env

~$5–10/mo extra Railway (second backend), possibly Neon's paid tier if two
persistent branches exceed the free limit, ~$12/yr for the test domain. Vercel is
unchanged (one seat covers all projects/environments).

## What is NOT needed

- No application code changes — config is already fully parametrized.
- No monorepo — each repo deploys independently.
- No refresh-token work to ship envs (deferred; 24h cookie + re-login stands).
