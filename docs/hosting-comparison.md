# Hosting Comparison — Operations App

A decision aid for where to deploy the SevenOne Housekeeping **operations app**.
Written to be read standalone.

> **TL;DR recommendation:** **Vercel** — for the per-PR preview deploys (you can
> demo a work-in-progress to a hotel manager from a unique URL) and the lowest-
> friction setup. **Cloudflare Pages** is the strong alternative if you want the
> fastest/cheapest edge. Consider **Railway** only if "one platform for
> everything" matters more than preview-deploy quality.

---

## What we're actually hosting

The operations app is a **Vite SPA** — `pnpm build` produces a folder of static
files (HTML/CSS/JS). The FastAPI backend is a **separate service already on
Railway**. So the frontend host only has three jobs:

1. **Serve static assets** on a CDN.
2. **SPA fallback** — serve `index.html` for any unknown path so client-side
   routing works (e.g. a deep link to `/tasks/123`).
3. **Inject build-time env** — bake `VITE_API_BASE_URL` per environment
   (local / staging / prod).

Every option below does all three. There is **no SSR / server runtime** to host —
this is a pure static deploy. That keeps cost near zero and makes the choice
mostly about developer experience.

---

## Decision criteria that matter here

| Criterion                  | Why it matters for us                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Per-PR preview deploys** | A unique URL for each pull request → demo to a manager without touching prod. **Highest-value feature for us.**           |
| **CORS coordination**      | Whatever origin we deploy to must be added to the backend's `CORS_ORIGINS`. Co-locating behind one domain can avoid this. |
| **Env per environment**    | Separate staging vs prod builds pointing at different API URLs.                                                           |
| **Custom domain + TLS**    | We'll want `app.sevenone…` eventually, with automatic HTTPS.                                                              |
| **CI integration**         | Auto build+deploy on push/PR from GitHub.                                                                                 |
| **Cost**                   | All have free tiers that cover an MVP; differences are at scale.                                                          |
| **One-platform ops**       | The backend is on Railway; co-locating reduces moving parts/bills.                                                        |

---

## The options

### 1. Vercel ⭐ recommended

Purpose-built static/frontend host with first-class GitHub integration.

- **Pros:** Best-in-class DX. **Automatic preview deploy for every PR.** Trivial
  env var management per environment, custom domains + auto TLS, instant
  rollbacks. Detects Vite with zero config.
- **Cons:** Marketing nudges you toward Next.js (irrelevant — Vite SPA works
  perfectly). Generous but metered free tier; pricing steps up at real scale.
- **Best when:** You want the smoothest path and value preview deploys. **Us.**

### 2. Cloudflare Pages

Static hosting on Cloudflare's edge network.

- **Pros:** **Fastest global edge** and the **most generous free tier** (very high
  request/bandwidth allowances). Preview deploys per PR, custom domains + TLS,
  tight integration with the rest of Cloudflare (WAF, analytics) if we ever want
  it.
- **Cons:** DX is slightly more minimal than Vercel; some advanced features lean
  on Cloudflare Workers, which we don't need for a static SPA.
- **Best when:** You want maximum performance/value and are comfortable with a
  touch less hand-holding.

### 3. Railway (co-locate with the backend)

The backend already runs here, so we could deploy the frontend alongside it.

- **Pros:** **One platform, one bill, one mental model.** Option to serve frontend
  and API under a **single domain** (e.g. `app.example.com` + `app.example.com/api`
  via a proxy), which **eliminates CORS** config. Good if you'd rather not juggle
  vendors.
- **Cons:** Railway is **container/service-oriented**, not a static-CDN product:
  you'd serve the static build from a small static server/container, preview
  deploys are weaker/more manual, and you don't get a global CDN by default.
  More setup for less frontend-specific polish.
- **Best when:** Operational simplicity (single vendor) outranks preview-deploy
  quality and edge performance.

### 4. Netlify

Vercel's closest analog for this use case.

- **Pros:** Per-PR **deploy previews**, SPA redirects (`_redirects` /
  `netlify.toml`), custom domains + TLS, good free tier, mature.
- **Cons:** Broadly comparable to Vercel; pick on preference/familiarity. DX for
  pure Vite SPAs is very slightly less seamless than Vercel's.
- **Best when:** You already like Netlify, or want a Vercel alternative with the
  same feature shape.

---

## Side-by-side

|                           | Vercel       | Cloudflare Pages | Railway (co-locate) | Netlify |
| ------------------------- | ------------ | ---------------- | ------------------- | ------- |
| Per-PR preview deploys    | ✅ excellent | ✅ good          | ⚠️ weak/manual      | ✅ good |
| Static CDN / edge         | ✅           | ✅ fastest       | ❌ not by default   | ✅      |
| Avoids CORS (same-origin) | ❌           | ❌               | ✅ possible         | ❌      |
| Env per environment       | ✅ easy      | ✅ easy          | ✅                  | ✅ easy |
| Custom domain + auto TLS  | ✅           | ✅               | ✅                  | ✅      |
| One platform with backend | ❌           | ❌               | ✅                  | ❌      |
| Free-tier generosity      | Good         | Most generous    | N/A (usage-based)   | Good    |
| Setup effort (static SPA) | Lowest       | Low              | Highest             | Low     |

---

## Cost estimates

> **Prices as of early 2026 — verify before committing; vendor pricing changes.**
> These cover **frontend hosting only**. The per-client cost that actually scales
> lives in the **backend** (Railway API + Neon database), which is a separate
> service and out of scope here.

**Why frontend hosting is nearly flat:** we serve a static SPA. The browser
downloads the JS bundle once and caches it, then talks directly to the API (on
Railway). So the only thing that grows with clients is CDN egress for the cached
bundle — which is tiny. The cost driver is **"commercial use needs a paid seat"**
(~$20/mo on Vercel/Netlify), **not** traffic.

**Traffic model used below**

| Assumption                                                | Value                           |
| --------------------------------------------------------- | ------------------------------- |
| App users per client (hotel) — front desk + housekeepers  | ~20                             |
| 0 clients                                                 | pre-launch / dev + preview only |
| 10 clients                                                | ~200 users                      |
| 100 clients                                               | ~2,000 users                    |
| Frontend egress per user/month (SPA, aggressively cached) | ~30 MB                          |
| → Frontend egress at 10 clients                           | ~6 GB/month                     |
| → Frontend egress at 100 clients                          | ~60 GB/month                    |

Even at 100 clients, ~60 GB/month is well inside every free/Pro CDN bandwidth
allowance — so bandwidth overage essentially never triggers at this scale.

### Estimated monthly cost

| Option                  | Pricing model                                                        | 0 clients                                      | 10 clients | 100 clients                                   |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------- | ---------- | --------------------------------------------- |
| **Vercel**              | Flat seat + included usage (1 TB); overage usage-based               | $0 on Hobby for dev¹ → **$20** once commercial | **$20**    | **$20**                                       |
| **Cloudflare Pages**    | Static serving free (unlimited bandwidth); pay only for extra builds | **$0**                                         | **$0**     | **$0** (opt. $20 for more builds/concurrency) |
| **Netlify**             | Free tier (100 GB/mo) → flat seat                                    | **$0**                                         | **$0**     | **$0–19**²                                    |
| **Railway (co-locate)** | Usage-based: static container + egress (~$0.10/GB) + seat            | ~$5³                                           | ~$5–10     | ~$10–15³                                      |

¹ Vercel's **Hobby** tier is non-commercial only — fine for pre-launch dev, but a
live commercial product needs **Pro (~$20/mo/seat)**. That $20 is effectively
flat: 60 GB is far under the 1 TB included, so 10 and 100 clients cost the same.

² Netlify free includes 100 GB bandwidth, so even 100 clients (~60 GB) can stay
**$0** on bandwidth alone; you'd move to **Pro ($19/seat)** for team/commercial
features or more build minutes, not for traffic. (Note: Netlify's _overage_ rate
is steep — ~$55 per extra 100 GB — but we never approach it here.)

³ Railway is the only **usage-based** option and the only one that isn't flat.
You'd run a small static container (~$5/mo idle) plus egress (~$0.10/GB → ~$6 at
60 GB) plus a seat (Hobby $5 / Pro $20). The upside: the **backend is already on
Railway**, so this is incremental, and serving under one domain can remove CORS.
The downside: weakest preview deploys and you pay for traffic you'd get free on a
CDN.

**Bottom line:** frontend hosting is roughly **$0–$20/month flat** across the
entire 0→100 client range on any of these. Cost should **not** drive this choice —
DX (preview deploys) and ops preference should. Cloudflare Pages is the cheapest
($0), Vercel/Netlify are ~$20 flat once commercial, Railway is modest but the only
one that grows with usage.

---

## Recommendation for SevenOne

**Vercel.** The per-PR preview deploys are the deciding factor for an early-stage
product you'll be demoing to hotel managers, and the setup is the lowest-friction
of the bunch. We add the Vercel preview + prod origins to the backend's
`CORS_ORIGINS` and we're done.

- **Choose Cloudflare Pages instead** if you want the fastest edge and the most
  headroom on the free tier, and don't mind marginally rougher DX.
- **Choose Railway** only if consolidating to one vendor (and optionally serving
  under a single domain to skip CORS) is worth giving up strong preview deploys.

This is a low-lock-in decision: the build output is plain static files, so moving
hosts later is a config change, not a rewrite.

---

## Whatever we pick — the setup checklist

- [ ] SPA fallback to `index.html` configured.
- [ ] `VITE_API_BASE_URL` set for **staging** and **prod** builds.
- [ ] Deployed origin(s) — including preview URLs if feasible — added to the
      backend `CORS_ORIGINS`.
- [ ] Custom domain + automatic HTTPS.
- [ ] GitHub CI wired so build/deploy runs on PR and on merge to `main`.
