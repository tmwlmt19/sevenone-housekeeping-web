# Environments & Deployment (test + prod)

Config reference for the two environments — **staging** and **prod** — of the
four-app system. For the click-by-click setup, see
[deploy-guide.md](deploy-guide.md). Cross-repo; lives in the web repo as the hub
(see [status.md](status.md)).

> **Key finding:** the code is already fully env-parametrized (backend via
> `pydantic-settings`, frontends via `VITE_*`). **No code changes required** —
> infra + configuration only.

---

## Brand & domains

SevenOne is an **umbrella brand** for lightweight SaaS products; Housekeeping is
the first. Products live on **subdomains** of one domain with a **shared login**
(`login.`), so one sign-in authenticates across all SevenOne products (the cookie
is scoped to the umbrella domain).

**One registered domain** (`seven1solutions.com`), with staging on a `staging.`
subdomain namespace:

| Env         | Apps live at                                        | Cookie domain                 | Cookie name                |
| ----------- | --------------------------------------------------- | ----------------------------- | -------------------------- |
| **prod**    | `login/hk/hk-admin/api.seven1solutions.com`         | `seven1solutions.com`         | `sevenone_session`         |
| **staging** | `login/hk/hk-admin/api.staging.seven1solutions.com` | `staging.seven1solutions.com` | `sevenone_session_staging` |

**Why a distinct staging cookie name:** prod's cookie (`Domain=seven1solutions.com`)
is also transmitted to `*.staging.` hosts. Giving staging a different
`SESSION_COOKIE_NAME` means each env only ever reads its own cookie, and different
`JWT_SECRET`s mean a stray cookie could never be honored anyway. (The residual: a
prod token is _transmitted_ to staging hosts but ignored — acceptable since you
own both. A fully separate domain would avoid even that; deferrable later, see
[status.md](status.md).)

### Subdomain scheme

| Subdomain   | App                          | Repo        | Host    |
| ----------- | ---------------------------- | ----------- | ------- |
| `login.`    | Shared SSO login             | `…-login`   | Vercel  |
| `hk.`       | Housekeeping — hotel app     | `…-web`     | Vercel  |
| `hk-admin.` | Housekeeping — owner console | `…-admin`   | Vercel  |
| `api.`      | Housekeeping — backend API   | `…-service` | Railway |

Labels are config (apps read URLs from env vars), so they're easy to change.
Future products slot in as new subdomains (`crm.`, `billing.`, …).

---

## Per-environment configuration

### Backend (Railway) — one service/environment per env

**Bold = must differ / be unique.**

| Var                           | staging                                                                                                                         | prod                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | **Neon `staging` branch, direct host**                                                                                          | **Neon `prod` branch, direct host**                                                                     |
| `JWT_SECRET`                  | **unique random**                                                                                                               | **unique random (different)**                                                                           |
| `SESSION_COOKIE_NAME`         | `sevenone_session_staging`                                                                                                      | `sevenone_session`                                                                                      |
| `COOKIE_DOMAIN`               | `staging.seven1solutions.com`                                                                                                   | `seven1solutions.com`                                                                                   |
| `COOKIE_SECURE`               | `true`                                                                                                                          | `true`                                                                                                  |
| `COOKIE_SAMESITE`             | `lax`                                                                                                                           | `lax`                                                                                                   |
| `CORS_ORIGINS`                | `https://login.staging.seven1solutions.com,https://hk.staging.seven1solutions.com,https://hk-admin.staging.seven1solutions.com` | `https://login.seven1solutions.com,https://hk.seven1solutions.com,https://hk-admin.seven1solutions.com` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440`                                                                                                                          | `1440`                                                                                                  |

Neon connection strings (use the **direct**, non-`pooler` host — the app's async
driver needs it):

- prod (`br-noisy-block-atzuoefv`):
  `postgresql://neondb_owner:npg_TCmyKe4VZfw6@ep-small-mouse-atwqkrwc.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require`
- staging (`br-wandering-scene-atwxlgg0`):
  `postgresql://neondb_owner:npg_TCmyKe4VZfw6@ep-young-bird-atgtf5td.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require`

Paste as-is; `config.py` normalizes to `postgresql+asyncpg://…`. Migrations run
automatically on deploy (`alembic upgrade head` in `railway.toml`).

### Frontends (Vercel) — one project per app, Production + Staging environments

`VITE_*` are baked in at build time, so each environment builds with its own.

**Login app** (`…-login`):

| Var                  | staging                                        | prod                                   |
| -------------------- | ---------------------------------------------- | -------------------------------------- |
| `VITE_API_BASE_URL`  | `https://api.staging.seven1solutions.com`      | `https://api.seven1solutions.com`      |
| `VITE_HOTEL_APP_URL` | `https://hk.staging.seven1solutions.com`       | `https://hk.seven1solutions.com`       |
| `VITE_ADMIN_APP_URL` | `https://hk-admin.staging.seven1solutions.com` | `https://hk-admin.seven1solutions.com` |

**Hotel app** (`…-web`) and **Admin app** (`…-admin`):

| Var                 | staging                                     | prod                                |
| ------------------- | ------------------------------------------- | ----------------------------------- |
| `VITE_API_BASE_URL` | `https://api.staging.seven1solutions.com`   | `https://api.seven1solutions.com`   |
| `VITE_LOGIN_URL`    | `https://login.staging.seven1solutions.com` | `https://login.seven1solutions.com` |

---

## DNS records (Cloudflare)

Eight `CNAME` records, all **DNS-only (grey cloud)** so Vercel/Railway manage TLS
and see real requests. Point each at the target the host gives you when you attach
the custom domain:

| Name               | Type  | Target                                     |
| ------------------ | ----- | ------------------------------------------ |
| `login`            | CNAME | Vercel target (login project)              |
| `hk`               | CNAME | Vercel target (web project)                |
| `hk-admin`         | CNAME | Vercel target (admin project)              |
| `api`              | CNAME | Railway target (api-prod)                  |
| `login.staging`    | CNAME | Vercel target (login project, staging env) |
| `hk.staging`       | CNAME | Vercel target (web project, staging env)   |
| `hk-admin.staging` | CNAME | Vercel target (admin project, staging env) |
| `api.staging`      | CNAME | Railway target (api-staging)               |

---

## Git flow

`staging` branch exists on all four repos. `main` → prod, `staging` → test;
promote via `staging` → `main`.

## Secrets & hardening

- **Unique `JWT_SECRET` per env** (`python -c "import secrets; print(secrets.token_urlsafe(48))"`); store only in Railway/Vercel.
- Reseed the **prod** Neon branch with a real admin + clear demo data before
  go-live (branches carry demo rows today).
- `.env` is gitignored (local only); prod reads injected env vars.
