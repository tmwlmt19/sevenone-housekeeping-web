# UI Stack Comparison

A decision aid for choosing the component/styling approach for the SevenOne
Housekeeping frontends. Written to be read standalone — no prior context needed.

> **TL;DR recommendation:** **shadcn/ui + Tailwind CSS**. It fits a project that
> has both a data-dense manager dashboard *and* a touch-friendly mobile
> housekeeper view, gives us full control of branding, and keeps the bundle
> small. The main cost is that we assemble a few complex components ourselves
> instead of importing them.

---

## What we're optimizing for

This product has three distinct UI surfaces, and the component library has to
serve all three well:

1. **Manager / front-desk dashboard (desktop)** — data-dense: room-status grids,
   task boards, sortable tables, lots of forms (rooms, staff, tasks).
2. **Housekeeper view (phone / tablet)** — touch-first: big tap targets, simple
   lists, one-tap status changes, glanceable status colors.
3. **Owner/platform console (desktop)** — admin tables for hotels/clients.

So the decision criteria that actually matter here:

| Criterion | Why it matters for us |
|---|---|
| **Tables / data grid** | Manager + owner views are table-heavy. |
| **Touch / responsive** | Housekeepers use phones on the floor. |
| **Custom branding** | This is a SaaS product; we'll want our own look, not a stock theme. |
| **Bundle size** | Mobile users on hotel Wi‑Fi; smaller = faster. |
| **Build speed** | We want a demoable MVP quickly. |
| **Ownership / lock-in** | How hard is it to customize or migrate later? |

---

## The options

### 1. shadcn/ui + Tailwind CSS  ⭐ recommended

Not a dependency you install — a CLI copies component *source* (built on Radix UI
primitives + Tailwind classes) **into your repo**. You own and edit the code.

- **Pros:** Full control and customization (it's your code). Excellent
  accessibility (Radix under the hood). Small bundle — you ship only the
  components you use. Tailwind makes responsive/touch design fast and consistent
  across desktop and mobile. Huge momentum in the React ecosystem; easy to hire
  for and to get AI assistance with.
- **Cons:** No prebuilt heavy data-grid — for advanced tables we pair it with
  **TanStack Table** (headless, free) and style the markup ourselves. You
  assemble some complex components rather than importing them. Tailwind's
  utility-class style is divisive if you dislike classes in markup.
- **Best when:** You want a custom-branded product and are comfortable owning
  component code. **This is us.**

### 2. MUI (Material UI)

The most "batteries-included" option. Comprehensive component set implementing
Google's Material Design.

- **Pros:** Everything is prebuilt, including a strong (paid, for advanced
  features) **MUI X Data Grid** — great for the table-heavy manager/owner views.
  Fastest path to "a working screen" without assembling primitives. Mature,
  enormous community.
- **Cons:** Largest bundle of these options. Strong Material look is recognizable
  and **takes real effort to de-Material** into custom branding. The advanced
  data grid and date pickers are a **paid license**. Theming/customization is
  powerful but has its own learning curve.
- **Best when:** Internal tools where speed beats bespoke branding, or
  table-heavy admin apps where the data grid alone justifies it.

### 3. Mantine

A modern, comprehensive component + hooks library — think "MUI's completeness
with a lighter, less opinionated look."

- **Pros:** Very rich out of the box (100+ components, 50+ hooks), including
  tables, forms, date pickers, notifications — **all free**. Great DX and docs.
  Easier to make "not look like Mantine" than MUI is to de-Material. Good
  TypeScript support.
- **Cons:** Smaller community than MUI/shadcn (still healthy). Its own styling
  system to learn. Heavier than shadcn if you only use a handful of components.
- **Best when:** You want lots of prebuilt components for free without committing
  to Material design — a strong middle ground.

### 4. Also-rans (brief)

- **Chakra UI** — pleasant DX, good accessibility, runtime CSS-in-JS adds
  overhead; momentum has cooled relative to shadcn.
- **Ant Design** — superb for dense enterprise admin tables, but a very strong
  opinionated look and large bundle; awkward for a touch-first mobile view.
- **Tailwind from scratch (no component layer)** — maximum control, but we'd
  rebuild accessible dialogs/menus/etc. by hand. shadcn exists precisely to avoid
  this.

---

## Side-by-side

| | shadcn/ui + Tailwind | MUI | Mantine |
|---|---|---|---|
| Prebuilt components | Core set (you assemble complex ones) | Extensive | Extensive |
| Advanced data grid | TanStack Table (free, headless) | MUI X (paid) | Built-in (free) |
| Custom branding | Easiest (you own the code) | Hardest (de-Material) | Moderate |
| Bundle size | Smallest | Largest | Medium |
| Accessibility | Excellent (Radix) | Good | Good |
| Touch / responsive | Excellent (Tailwind) | Good | Good |
| Speed to first screen | Fast | Fastest | Fast |
| Lock-in | None (code is yours) | Higher | Medium |
| License cost | Free | Free core, paid X | Free |

---

## Recommendation for SevenOne

**shadcn/ui + Tailwind**, paired with **TanStack Table** for the manager/owner
data grids. Rationale:

- We want a **branded SaaS product**, not a stock-themed internal tool — shadcn's
  "own the code" model makes that cheapest.
- The same Tailwind setup serves the **dense desktop dashboard and the touch
  mobile view** without fighting a component library's defaults.
- **Smallest bundle** helps housekeepers on phones.
- It pairs naturally with the rest of the leaning stack (Vite, TanStack Query,
  React Hook Form + Zod).

**Pick MUI instead if** you'd rather not assemble any components and are happy to
accept a heavier, more Material-looking app to move fastest — the MUI X Data Grid
is genuinely excellent for the admin/owner tables.

**Pick Mantine if** you want lots of free prebuilt components (including tables)
without the Material look — a reasonable middle path.

If we go shadcn, the choice is reversible-ish: components live in our repo, so we
can restyle freely without a migration.
