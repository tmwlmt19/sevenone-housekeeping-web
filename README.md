# sevenone-housekeeping-web

Frontend (React) for the SevenOne hotel housekeeping SaaS platform.

The backend API lives in a separate repo: `sevenone-housekeeping-service`
(FastAPI + PostgreSQL/Neon).

This repo is the **hotel operations app** (manager desktop + housekeeper
mobile/tablet, one responsive role-gated app). The owner/platform console is a
separate, later app — see PLAN.md §0.

## Status

Requirements agreed; ready to scaffold. See:

- [PLAN.md](PLAN.md) — requirements, API contract, role matrix, and build phases.
- [docs/site-map.md](docs/site-map.md) — routes, per-role navigation, and the
  API calls behind each page.
- [docs/ui-stack-comparison.md](docs/ui-stack-comparison.md) — component-library
  options and recommendation.
- [docs/hosting-comparison.md](docs/hosting-comparison.md) — hosting options and
  recommendation.
