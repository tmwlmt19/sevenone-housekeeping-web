# Site Map & Page Connections — Operations App

Information architecture for the hotel operations app: routes, per-role
navigation, and the API calls behind each page. Drives the scaffold (router tree,
layout shells, role gating, query keys). Visual design is out of scope here.

All API paths are under `/api/v1` and tenant-scoped as
`/hotels/{hotelId}/…`, where `hotelId` comes from the JWT.

---

## Route tree

```
/login                         public
/                              → redirect by role (see below)
/dashboard                     manager, admin            (front-desk home)
/rooms                         manager, admin
/rooms/new                     manager, admin            (route-aware modal)
/rooms/:roomId                 manager, admin            (edit)
/staff                         manager, admin
/staff/new                     manager, admin
/staff/:userId                 manager, admin
/tasks                         manager, admin            (board/list)
/tasks/new                     manager, admin
/tasks/:taskId                 manager, admin            (edit/assign)
/my-tasks                      housekeeper               (mobile-first)
/settings/hotel                admin
*                              → 404 / not-authorized
```

**Root redirect by role** (read from JWT after login):
- `housekeeper` → `/my-tasks`
- `manager` / `admin` → `/dashboard`

**Route protection:** an `AuthGuard` redirects unauthenticated users to `/login`;
a `RoleGuard` blocks routes a role can't use (housekeeper hitting `/rooms` →
redirect to `/my-tasks`). Mirrors the backend matrix in PLAN.md §2a — the UI hides
what it can, and still handles 401/403 defensively.

---

## Layout shells

- **AppShell (manager/admin):** desktop sidebar nav + top bar (hotel name, user
  menu/logout). Wraps dashboard, rooms, staff, tasks, settings.
- **MobileShell (housekeeper):** minimal top bar + bottom-safe touch layout.
  Wraps my-tasks. No sidebar.
- **AuthLayout:** centered card for `/login`.

Hotel name for the top bar comes from `GET /hotels/{hotelId}` (cached).

---

## User journeys by role

How each role actually moves through the app. Three roles share one app but land
in very different places; the route guards (PLAN.md §2a) enforce the boundaries.

### Housekeeper — phone on the floor, single screen

Only ever sees their own tasks and flips statuses. No rooms, staff, or dashboard —
the backend won't allow it, so the UI gives them one focused screen.

1. **Login** (`/login`) → role read from JWT is `housekeeper` → redirect to
   `/my-tasks`. They never see the sidebar (MobileShell, not AppShell).
2. **My Tasks** (`/my-tasks`) — mobile-first vertical list of cards
   (`GET /tasks?assigned_to=me`): room number, priority, notes, a big status
   control.
3. **Do the work** — tap **In progress** when starting, **Completed** when done
   (`PATCH /tasks/{id}/status`, optimistic). Completing auto-flips the room to
   *clean* on the backend — they never touch room status directly.
4. New assignments appear as the list refetches (focus/poll). Only other action
   is logout.

*Looks like:* a checklist app — big touch targets, glanceable status colors, one
screen.

### Manager / front desk — desktop, runs the floor

The operational hub: set up rooms, manage staff, create/assign tasks, monitor
progress. Everything except hotel-level settings.

1. **Login** → role `manager` → `/dashboard`, in the desktop AppShell (sidebar +
   top bar with hotel name).
2. **Dashboard** (`/dashboard`) — morning glance: room-status grid + today's tasks
   (incl. unassigned/urgent), aggregated client-side from the rooms/tasks lists.
3. **Rooms** (`/rooms`) — sortable table; add/edit/delete via route-aware modals
   (`/rooms/new`, `/rooms/:id`). One-time setup plus ongoing upkeep.
4. **Staff** (`/staff`) — onboard housekeepers/managers (name, email, password,
   role). This is the "self-service onboarding within a hotel" — adding people to
   an existing hotel, which works today.
5. **Tasks** (`/tasks`) — the heart of it: a board grouped by status (with a list
   toggle), filterable by status/assignee. Create a task (`/tasks/new`): pick
   room + housekeeper, set priority/notes/due date (assigning auto-moves it to
   *assigned*). Watch cards move across the board through the day; reassign as
   needed.

*Looks like:* information-dense desktop — sidebar, tables, a kanban-style task
board.

### Admin — manager + the keys to the hotel

A manager with one extra power: editing the hotel's own record. In this
single-hotel MVP the admin is **not** a cross-tenant super-user (that's the future
owner console, a separate app), so day-to-day they work exactly like a manager.

1. **Login** → role `admin` → `/dashboard`. Same AppShell, plus one extra sidebar
   item: **Settings**.
2. **Everything a manager does** — dashboard, rooms, staff (typically the one
   creating the first managers), tasks. Identical screens and permissions.
3. **Hotel settings** (`/settings/hotel`) — admin-only: edit hotel name/address
   (`PUT /hotels/{id}`). Changing the name updates the top bar everyone sees.

*Looks like:* indistinguishable from the manager view except the extra Settings
entry and page.

### End-to-end: one task across all three roles

> **Admin** creates the hotel's managers in Staff. → **Manager** sets up rooms,
> then creates "clean room 204" and assigns it to housekeeper Maria (task →
> *assigned*). → **Maria (housekeeper)** opens My Tasks on her phone, taps *In
> progress*, cleans, taps *Completed* — room 204 auto-flips to *clean*. → On the
> **manager's** dashboard and task board, the card lands in *Completed* and the
> room grid shows 204 green on the next refetch.

**Boundaries worth keeping straight:** housekeepers can only change status on
tasks assigned to them (no reassign/edit/create); room status is never edited by
housekeepers — it changes as a side effect of completing tasks (a manager *can*
set room status directly, e.g. out-of-service); and admin ≠ platform owner in
this app.

---

## Pages & their connections

Notation: **reads** = queries on load; **writes** = mutations; **invalidates** =
query keys refetched after a write.

### `/login`
- **writes:** `POST /auth/login` → store JWT in localStorage.
- then: `GET /auth/me` (or decode JWT) → seed auth context → root redirect.

### `/dashboard` (manager/admin)
- **reads:** `GET /hotels/{id}/rooms`, `GET /hotels/{id}/tasks`.
- Derived client-side (no aggregate endpoint yet): room-status counts
  (clean/dirty/in_progress/out_of_service), today's tasks, unassigned/urgent
  counts. Cards link to `/rooms` and `/tasks`.
- **refetch:** on window focus / poll, for collaborative freshness.

### `/rooms` (manager/admin)
- **reads:** `GET /hotels/{id}/rooms` (TanStack Table: sort by number/floor/status).
- Row actions → `/rooms/:roomId` (edit), delete.

### `/rooms/new`, `/rooms/:roomId`
- **reads (edit):** `GET /hotels/{id}/rooms/{roomId}`.
- **writes:** `POST` / `PUT /hotels/{id}/rooms[/{roomId}]`;
  `DELETE` on the edit/list view.
- **invalidates:** rooms list (+ dashboard).
- Surface **409** (duplicate room_number) as a field error. Fields: room_number
  (req, unique, 1–50), floor (int, opt), room_type (≤20, uppercased), status.

### `/staff` (manager/admin)
- **reads:** `GET /hotels/{id}/users`.
- Row actions → `/staff/:userId`, delete.

### `/staff/new`, `/staff/:userId`
- **reads (edit):** `GET /hotels/{id}/users/{userId}`.
- **writes:** `POST` / `PUT /hotels/{id}/users[/{userId}]`; `DELETE`.
- **invalidates:** staff list; also the **assignee picker** used by tasks.
- Surface **409** (duplicate email). Fields: email (req, unique), password
  (8–128; required on create, optional on edit), name (req), role.

### `/tasks` (manager/admin)
- **reads:** `GET /hotels/{id}/tasks?status=&assigned_to=` (filter controls);
  plus rooms + users lists to render room numbers / assignee names.
- View toggle: board (grouped by status) ↔ list.
- Row/card → `/tasks/:taskId`.

### `/tasks/new`, `/tasks/:taskId`
- **reads:** rooms list (room picker), users list (assignee picker), and for
  edit `GET /hotels/{id}/tasks/{taskId}`.
- **writes:** `POST` / `PUT /hotels/{id}/tasks[/{taskId}]`; `DELETE`.
- **invalidates:** tasks list, dashboard; rooms (completion flips room → clean).
- Fields: room_id (req), assigned_to (opt), status, priority, notes, due_date.
- Mirror domain rules in UI copy: assigning a pending task → shows as assigned;
  marking completed → room becomes clean.

### `/my-tasks` (housekeeper, mobile-first)
- **reads:** `GET /hotels/{id}/tasks?assigned_to={me}` (id from JWT).
- **writes:** `PATCH /hotels/{id}/tasks/{taskId}/status` (one-tap:
  in_progress → completed). Only the assignee may call this.
- **invalidates:** my-tasks list. Optimistic update for snappy taps; poll/focus
  refetch for new assignments.

### `/settings/hotel` (admin)
- **reads:** `GET /hotels/{id}`.
- **writes:** `PUT /hotels/{id}`.
- **invalidates:** hotel query (top-bar name).

---

## Shared query keys (TanStack Query)

```
['me']
['hotel', hotelId]
['rooms', hotelId]                      ['room', hotelId, roomId]
['staff', hotelId]                      ['user', hotelId, userId]
['tasks', hotelId, { status, assignedTo }]   ['task', hotelId, taskId]
```

Mutations invalidate the relevant list key(s); task completion also invalidates
`['rooms', hotelId]` and any dashboard-derived reads.

---

## Cross-cutting pieces the scaffold needs

- **API client:** typed fetch wrapper (types generated from `/openapi.json`) that
  injects the bearer token and centralizes 401 → logout+redirect.
- **Auth context:** `{ token, userId, hotelId, role }` derived from the JWT;
  exposes `login`, `logout`, `isAuthenticated`.
- **Guards:** `AuthGuard`, `RoleGuard` (allowed-roles prop).
- **Route-aware modals:** the `/…/new` and `/…/:id` routes render as a shadcn
  Dialog over the underlying list route rather than as standalone pages — the URL
  stays deep-linkable while the list keeps its place behind the overlay.
- **Reusable UI:** status badges (room + task enums), assignee picker, room
  picker, confirm-delete dialog, form field + error wiring for 409s.
```
