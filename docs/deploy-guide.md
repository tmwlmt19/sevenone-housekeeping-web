# Deployment Guide (step by step)

A click-by-click for standing up **staging** and **prod** on Railway (backend) +
Vercel (frontends) + Cloudflare (DNS). Values (env vars, domains, DB strings) are
in [environments.md](environments.md) — this doc is the _procedure_.

> UI labels on Railway/Vercel/Cloudflare shift over time; match the intent if a
> label differs slightly.

---

## Order of operations

1. **Railway** (backend) → gives you `api` CNAME targets.
2. **Vercel** (3 frontends) → gives you `login/hk/hk-admin` CNAME targets.
3. **Cloudflare** → add the DNS records pointing at those targets.
4. **Seed prod + verify.**

Accounts to create (sign in with your GitHub `tmwlmt19`): **Railway**, **Vercel**.
Cloudflare (with `seven1solutions.com`) already exists.

---

## DNS in 60 seconds (for the method decision)

A **DNS record** maps a hostname to where it lives. You'll add **CNAME** records —
a CNAME says "this subdomain is an alias for that other hostname." When you attach
`hk.seven1solutions.com` to a Vercel project, Vercel says "make a CNAME to
`cname.vercel-dns.com`," and you add exactly that in Cloudflare. Railway does the
same for `api.` with its own target.

- **Proxy status:** set these records to **DNS only (grey cloud)**, _not_ proxied
  (orange). Vercel/Railway need to terminate TLS and see the real hostname.
- **How many:** 8 total (4 prod + 4 staging). All CNAMEs.

**Recommended method: do it in the Cloudflare dashboard yourself.** It's a
one-time ~15-minute copy-paste of 8 records, you keep full control, and there's no
API token to hand off. (Automating via API only pays off for frequent/bulk
changes.) I'll give you the exact records once the targets exist. If you'd still
rather I automate it, create a **scoped API token** (Zone → DNS → Edit, this zone
only) and share it + the Zone ID.

---

## Part A — Railway (backend, 2 environments)

Repo: `sevenone-housekeeping-service`. It has `railway.toml`, so Railway runs
`alembic upgrade head && uvicorn …` and health-checks `/health` automatically.

1. **New Project → Deploy from GitHub repo** → pick `sevenone-housekeeping-service`.
   This creates the default (production) environment deploying the `main` branch.
2. **Variables** (production/prod): add every backend var from
   [environments.md](environments.md) **prod** column — `DATABASE_URL` (prod
   branch, direct host), a fresh `JWT_SECRET`, `SESSION_COOKIE_NAME=sevenone_session`,
   `COOKIE_DOMAIN=seven1solutions.com`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`,
   `CORS_ORIGINS=<the 3 prod origins>`, and `PORT=8080` (the app runs
   `uvicorn --port $PORT`, so this is the port to route the custom domain to).
3. **Generate a JWT secret:** `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
4. **Staging environment:** in the project, **create a second environment** named
   `staging`, set its **deploy branch to `staging`**, and add the **staging**
   column vars (staging DB string, a _different_ `JWT_SECRET`,
   `SESSION_COOKIE_NAME=sevenone_session_staging`,
   `COOKIE_DOMAIN=staging.seven1solutions.com`, the 3 staging origins).
5. **Custom domains:** in each environment's service → Settings → Networking →
   **Custom Domain**: add `api.seven1solutions.com` (prod) and
   `api.staging.seven1solutions.com` (staging). If it asks for a **target port**,
   enter **8080** (matches the `PORT` var from step 2). Railway shows a **CNAME
   target** for each — note them for Part C.
6. Deploys should go green (health check `/health`). If a deploy fails, check the
   logs — usually a missing/invalid `DATABASE_URL`.

## Part B — Vercel (3 frontend apps)

Do this three times — once per repo: `…-login`, `…-web`, `…-admin`.

1. **Add New → Project → Import** the repo. Framework preset: **Vite**. Deploy.
   (First build may warn about missing `VITE_*` — that's fine until you set them.)
2. **Settings → Environments:** ensure **Production** is the `main` branch, and
   **create a `Staging` environment bound to the `staging` branch**.
3. **Settings → Environment Variables:** add the app's vars from
   [environments.md](environments.md) — the **prod** values scoped to Production,
   the **staging** values scoped to Staging. (Login app has 3 vars; hotel/admin
   have 2 each.)
4. **Settings → Domains:** add the app's **prod** subdomain to Production and its
   **staging** subdomain to Staging — e.g. for `…-web`: `hk.seven1solutions.com`
   (prod) and `hk.staging.seven1solutions.com` (staging). Vercel shows the
   **CNAME target** (usually `cname.vercel-dns.com`) — note it for Part C.
5. **Redeploy** each environment so the build picks up the env vars.

Result: 3 projects, each serving a prod domain (from `main`) and a staging domain
(from `staging`).

## Part C — Cloudflare DNS

In the `seven1solutions.com` zone → **DNS → Records**, add the 8 CNAMEs from
[environments.md](environments.md), each **DNS only (grey cloud)**:

- `login`, `hk`, `hk-admin` → the Vercel targets from Part B (prod).
- `api` → the Railway target from Part A (prod).
- `login.staging`, `hk.staging`, `hk-admin.staging` → Vercel staging targets.
- `api.staging` → Railway staging target.

(For a CNAME named `hk.staging`, Cloudflare stores it as
`hk.staging.seven1solutions.com` — just type `hk.staging` in the Name field.)

TLS certs issue automatically once DNS resolves (a few minutes). If Vercel/Railway
show "Invalid Configuration," give DNS a few minutes and re-check.

## Part D — Seed prod & verify

1. **Prod admin:** the prod DB branch still has demo data. Before real use, clear
   it and seed a real admin. Easiest: run the seed against the prod DB —
   `DATABASE_URL=<prod string> python -m app.seed --email you@… --password '…'`
   (or ask me to do the reset via the Neon tools). Staging can keep the demo
   admin (`admin@demo.com` / `DemoAdmin123!`).
2. **Verify each env:** go to `login.<env>`, sign in, confirm you land in
   `hk.`/`hk-admin.` per role, that reloading keeps you signed in (cookie works),
   and logout clears it. Check the cookie in DevTools is scoped to the right
   domain (`seven1solutions.com` vs `staging.seven1solutions.com`).

---

## Troubleshooting

- **401 loop / not staying logged in:** cookie domain/secure mismatch. Confirm
  `COOKIE_DOMAIN` matches the env and `COOKIE_SECURE=true` (https).
- **CORS errors in the browser console:** the app's origin isn't in that env's
  `CORS_ORIGINS`. Add it and redeploy the backend.
- **Frontend calls the wrong API:** `VITE_API_BASE_URL` was wrong at build time —
  fix it and **redeploy** (these bake in at build).
- **Railway deploy fails at start:** almost always `DATABASE_URL` (wrong host —
  use the **direct**, non-`pooler` host).
