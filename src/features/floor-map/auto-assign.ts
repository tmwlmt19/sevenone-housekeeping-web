import type { Decoration, FloorMap, MapRoom, Polygon, Vertex } from '@/lib/api/types'

import type { ZoneMap } from './assign'
import {
  boundingBox,
  centroid,
  doorSegment,
  pointInPolygon,
  polygonsOverlap,
  sharedEdge,
} from './geometry'

/**
 * Optimized auto-assign (floor-map use case #2, the "route-ordered" split that
 * `hotel-map-plan.md` §8/§12 deferred). Given the whole-hotel map, a roster of
 * housekeepers with shift lengths, and a room-type → minutes table, it:
 *
 *   1. estimates each dirty room's cleaning time (§ estimateMinutes),
 *   2. groups dirty rooms into walkable clusters ("up to 2 doors apart", where a
 *      perpendicular hall crossing counts as 0/1/2 doors by its width),
 *   3. measures walking distance between rooms — including elevator rides across
 *      floors (30 ft + 5 ft/floor); stairs are ignored (carts can't use them),
 *   4. fills routes to a *fair share* of the work — each housekeeper's slice is
 *      proportional to their shift (so a light day spreads across everyone
 *      instead of loading the first few and sending the rest home). Each route
 *      grows from a cluster edge through its nearest rooms up to that share;
 *      when a cluster is bigger than the share it is filled partway from the
 *      edge, and lumpy leftovers are then handed to whoever is furthest below
 *      their share, keeping equal-shift loads within one room of each other.
 *
 * Output is a `ZoneMap` (roomId → housekeeperId), identical in shape to manual
 * painting and the even-band splitter, so it funnels through the exact same
 * `zonesToAssignments` → POST /tasks/import seam. Pure and deterministic — no
 * React, no I/O — so it stays trivially testable. See `auto-assign-plan.md`.
 */

// --- Tunables (feet / doors) ------------------------------------------------

const ELEVATOR_BASE_FT = 30 // fixed cost of an elevator ride, for proximity
const ELEVATOR_PER_FLOOR_FT = 5 // added per floor traversed
const CROSS_NARROW_FT = 10 // < this across the hall → 0 doors to cross
const CROSS_WIDE_FT = 20 // >= this → 2 doors; in between → 1
const MAX_DOORS_APART = 2 // rooms link into one cluster at or below this
const FALLBACK_DOOR_SPACING_FT = 15 // when a component's spacing can't be measured

// --- Public types -----------------------------------------------------------

/** Room-type (UPPERCASE) → minutes, plus a fallback for unknown/null types. */
export interface DurationTable {
  byType: Record<string, number>
  default: number
}

/** One rostered housekeeper and the length of their shift, in minutes. */
export interface HousekeeperShift {
  id: string
  shiftMinutes: number
}

export interface AutoAssignResult {
  /** roomId → housekeeperId, merge-able into the running plan. */
  zones: ZoneMap
  /** Placed dirty rooms that fit no remaining shift (add staff / assign by hand). */
  overflow: MapRoom[]
  /** housekeeperId → minutes of work assigned. */
  load: Record<string, number>
  /** Estimated minutes to clean every placed candidate (assigned or not). */
  totalWorkMinutes: number
  /** Sum of all rostered shift minutes. */
  totalShiftMinutes: number
}

// --- Time estimate ----------------------------------------------------------

/** Minutes to clean a room: its type's entry, else the table default. */
export function estimateMinutes(room: MapRoom, table: DurationTable): number {
  const type = room.room_type
  if (type && Object.prototype.hasOwnProperty.call(table.byType, type)) {
    return table.byType[type]
  }
  return table.default
}

/** How many "doors" it costs to cross the walkable space, by its width in feet. */
export function crossDoorBand(acrossFt: number): number {
  if (acrossFt < CROSS_NARROW_FT) return 0
  if (acrossFt < CROSS_WIDE_FT) return 1
  return 2
}

// --- Geometry helpers -------------------------------------------------------

/** A room's anchor for proximity: its door midpoint if it has one, else the
 *  footprint centroid (the plan's door-less fallback). */
function roomAnchor(room: MapRoom): Vertex {
  const p = room.placement!
  if (p.door) {
    const seg = doorSegment(p.vertices, p.door)
    if (seg) return [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2]
  }
  return centroid(p.vertices)
}

function dist(a: Vertex, b: Vertex): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y)
  const n = s.length
  if (n === 0) return NaN
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

// --- Walkable components ----------------------------------------------------

/** Group a floor's hall+lobby decorations into connected walkable regions. Two
 *  join when their polygons overlap or share a full edge (flush-abutting halls).
 *  Union-find over a handful of shapes. */
export function walkableComponents(decorations: Decoration[]): Polygon[][] {
  const walk = decorations
    .filter((d) => d.kind === 'hall' || d.kind === 'lobby')
    .map((d) => d.vertices)
  const n = walk.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (polygonsOverlap(walk[i], walk[j]) || sharedEdge(walk[i], walk[j])) {
        parent[find(i)] = find(j)
      }
    }
  }
  const groups = new Map<number, Polygon[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = groups.get(r)
    if (g) g.push(walk[i])
    else groups.set(r, [walk[i]])
  }
  return [...groups.values()]
}

interface Comp {
  id: number
  floor: number
  polys: Polygon[]
  axis: Vertex // corridor direction (unit) — set once rooms are known
  spacing: number // "one door" of along-corridor distance
}

/** Which component (on the room's floor) an anchor belongs to: the region that
 *  contains it, else the nearest region; a floor with a single (possibly
 *  implicit, hall-less) component always maps there. */
function componentFor(anchor: Vertex, floorComps: Comp[]): number {
  if (floorComps.length === 1) return floorComps[0].id
  for (const c of floorComps) {
    for (const poly of c.polys) if (pointInPolygon(anchor, poly)) return c.id
  }
  let best = floorComps[0].id
  let bestD = Infinity
  for (const c of floorComps) {
    for (const poly of c.polys) {
      const d = dist(anchor, centroid(poly))
      if (d < bestD) {
        bestD = d
        best = c.id
      }
    }
  }
  return best
}

// --- Doors-apart clustering -------------------------------------------------

/** Integer "doors apart" for two rooms in the same walkable component: doors
 *  down the hall (along-corridor distance / door spacing) plus the perpendicular
 *  crossing band. `axis` is the unit corridor direction. */
export function doorsApart(a: Vertex, b: Vertex, axis: Vertex, spacing: number): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const along = Math.abs(dx * axis[0] + dy * axis[1])
  const across = Math.abs(dx * -axis[1] + dy * axis[0])
  return Math.round(along / spacing) + crossDoorBand(across)
}

// --- Internal candidate model -----------------------------------------------

interface Cand {
  room: MapRoom
  floor: number
  anchor: Vertex
  comp: number
  minutes: number
}

interface Elevator {
  floor: number
  anchor: Vertex
}

function isCandidate(room: MapRoom): boolean {
  // Mirrors isCandidate() in floor-assign-canvas: a dirty room with no live task.
  return room.status === 'dirty' && !room.has_open_task
}

// --- All-pairs walking distance (rooms + elevators) -------------------------

/** Floyd–Warshall over candidate rooms (0..C-1) and elevators (C..C+E-1). Rooms
 *  connect within a floor+component by straight-line feet; each room connects to
 *  same-floor elevators; elevators form one vertical network (ride cost between
 *  any two). Returns the C×C room-to-room distance block. */
function walkingDistances(cands: Cand[], elevators: Elevator[]): number[][] {
  const C = cands.length
  const N = C + elevators.length
  const d: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(Infinity))
  for (let i = 0; i < N; i++) d[i][i] = 0

  const link = (i: number, j: number, w: number) => {
    if (w < d[i][j]) {
      d[i][j] = w
      d[j][i] = w
    }
  }

  for (let i = 0; i < C; i++) {
    for (let j = i + 1; j < C; j++) {
      if (cands[i].floor === cands[j].floor && cands[i].comp === cands[j].comp) {
        link(i, j, dist(cands[i].anchor, cands[j].anchor))
      }
    }
    for (let e = 0; e < elevators.length; e++) {
      if (cands[i].floor === elevators[e].floor) {
        link(i, C + e, dist(cands[i].anchor, elevators[e].anchor))
      }
    }
  }
  for (let a = 0; a < elevators.length; a++) {
    for (let b = a + 1; b < elevators.length; b++) {
      const ride =
        ELEVATOR_BASE_FT + ELEVATOR_PER_FLOOR_FT * Math.abs(elevators[a].floor - elevators[b].floor)
      link(C + a, C + b, ride)
    }
  }

  for (let k = 0; k < N; k++) {
    const dk = d[k]
    for (let i = 0; i < N; i++) {
      const dik = d[i][k]
      if (dik === Infinity) continue
      const di = d[i]
      for (let j = 0; j < N; j++) {
        const alt = dik + dk[j]
        if (alt < di[j]) di[j] = alt
      }
    }
  }
  return d.slice(0, C).map((row) => row.slice(0, C))
}

// --- Clustering -------------------------------------------------------------

/** Cluster id per candidate: connected components of the "≤ MAX_DOORS_APART"
 *  graph, computed independently within each walkable component. */
function clusterCandidates(cands: Cand[], comps: Map<number, Comp>): number[] {
  const C = cands.length
  const parent = Array.from({ length: C }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const byComp = new Map<number, number[]>()
  cands.forEach((c, i) => {
    const g = byComp.get(c.comp)
    if (g) g.push(i)
    else byComp.set(c.comp, [i])
  })
  for (const [compId, members] of byComp) {
    const comp = comps.get(compId)!
    for (let x = 0; x < members.length; x++) {
      for (let y = x + 1; y < members.length; y++) {
        const i = members[x]
        const j = members[y]
        if (doorsApart(cands[i].anchor, cands[j].anchor, comp.axis, comp.spacing) <= MAX_DOORS_APART) {
          parent[find(i)] = find(j)
        }
      }
    }
  }
  return cands.map((_, i) => find(i))
}

// --- Assembly ---------------------------------------------------------------

interface Prepared {
  cands: Cand[]
  comps: Map<number, Comp>
  clusterOf: number[]
  distMatrix: number[][]
}

/** Turn the raw hotel map into candidates, walkable components, clusters, and a
 *  room-to-room distance matrix. */
function prepare(floors: FloorMap[], table: DurationTable): Prepared {
  const comps = new Map<number, Comp>()
  const floorCompIds = new Map<number, Comp[]>()
  let nextCompId = 0

  for (const f of floors) {
    const regions = walkableComponents(f.decorations)
    const list: Comp[] = []
    if (regions.length === 0) {
      // Hall-less floor → one implicit whole-floor component.
      const c: Comp = { id: nextCompId++, floor: f.floor, polys: [], axis: [1, 0], spacing: FALLBACK_DOOR_SPACING_FT }
      comps.set(c.id, c)
      list.push(c)
    } else {
      for (const polys of regions) {
        const c: Comp = { id: nextCompId++, floor: f.floor, polys, axis: [1, 0], spacing: FALLBACK_DOOR_SPACING_FT }
        comps.set(c.id, c)
        list.push(c)
      }
    }
    floorCompIds.set(f.floor, list)
  }

  // Assign every PLACED room (dirty or not) to a component — non-dirty rooms
  // still count toward a corridor's door spacing.
  const placedByComp = new Map<number, Vertex[]>()
  const widths: number[] = []
  for (const f of floors) {
    const floorComps = floorCompIds.get(f.floor)!
    for (const room of f.rooms) {
      if (!room.placement) continue
      const anchor = roomAnchor(room)
      const compId = componentFor(anchor, floorComps)
      const g = placedByComp.get(compId)
      if (g) g.push(anchor)
      else placedByComp.set(compId, [anchor])
      widths.push(boundingBox(room.placement.vertices).w)
    }
  }
  const fallbackSpacing = widths.length ? median(widths) : FALLBACK_DOOR_SPACING_FT

  // Set each component's corridor frame from its rooms' spread.
  for (const [compId, anchors] of placedByComp) {
    const comp = comps.get(compId)!
    const bb = boundingBox(anchors)
    comp.axis = bb.w >= bb.h ? [1, 0] : [0, 1]
    const proj = anchors.map((a) => a[0] * comp.axis[0] + a[1] * comp.axis[1]).sort((x, y) => x - y)
    const gaps: number[] = []
    for (let i = 1; i < proj.length; i++) {
      const g = proj[i] - proj[i - 1]
      if (g > 0.01) gaps.push(g)
    }
    comp.spacing = gaps.length ? median(gaps) : Math.max(fallbackSpacing, 1)
  }

  // Candidates (dirty, no live task, placed).
  const cands: Cand[] = []
  for (const f of floors) {
    const floorComps = floorCompIds.get(f.floor)!
    for (const room of f.rooms) {
      if (!room.placement || !isCandidate(room)) continue
      const anchor = roomAnchor(room)
      cands.push({
        room,
        floor: f.floor,
        anchor,
        comp: componentFor(anchor, floorComps),
        minutes: estimateMinutes(room, table),
      })
    }
  }

  const elevators: Elevator[] = []
  for (const f of floors) {
    for (const d of f.decorations) {
      if (d.kind === 'elevator') elevators.push({ floor: f.floor, anchor: centroid(d.vertices) })
    }
  }

  return {
    cands,
    comps,
    clusterOf: clusterCandidates(cands, comps),
    distMatrix: walkingDistances(cands, elevators),
  }
}

// --- Allocation -------------------------------------------------------------

export function autoAssignOptimized(
  floors: FloorMap[],
  roster: HousekeeperShift[],
  table: DurationTable,
): AutoAssignResult {
  const { cands, comps, clusterOf, distMatrix } = prepare(floors, table)

  const totalWorkMinutes = cands.reduce((n, c) => n + c.minutes, 0)
  const totalShiftMinutes = roster.reduce((n, h) => n + h.shiftMinutes, 0)
  const load: Record<string, number> = {}
  for (const h of roster) load[h.id] = 0
  const empty: AutoAssignResult = { zones: {}, overflow: [], load, totalWorkMinutes, totalShiftMinutes }
  if (cands.length === 0 || roster.length === 0) {
    return { ...empty, overflow: cands.map((c) => c.room) }
  }

  const zones: ZoneMap = {}
  const assigned = new Map<string, number[]>() // hkId → candidate indices
  for (const h of roster) assigned.set(h.id, [])
  const shiftOf = new Map(roster.map((h) => [h.id, h.shiftMinutes]))
  const unassigned = new Set<number>(cands.map((_, i) => i))

  // Fair share: each housekeeper's slice of the total work, in proportion to
  // their shift. Utilization saturates at 1, so when there is more work than
  // capacity the share is a full shift (and the surplus overflows), and when
  // there is less, everyone gets a proportionally lighter — but non-empty —
  // route instead of the first few filling up.
  const util = totalShiftMinutes > 0 ? Math.min(1, totalWorkMinutes / totalShiftMinutes) : 0
  const fairShare = new Map(roster.map((h) => [h.id, util * h.shiftMinutes]))
  const remainingShift = (id: string): number => shiftOf.get(id)! - load[id]
  const headroom = (id: string): number => fairShare.get(id)! - load[id]

  const membersOf = (cluster: number): number[] =>
    [...unassigned].filter((i) => clusterOf[i] === cluster)

  // A stable "corner-first" order for a cluster: down its corridor axis.
  const alongOrder = (idxs: number[]): number[] => {
    if (idxs.length === 0) return idxs
    const axis = comps.get(cands[idxs[0]].comp)!.axis
    return [...idxs].sort((a, b) => {
      const pa = cands[a].anchor[0] * axis[0] + cands[a].anchor[1] * axis[1]
      const pb = cands[b].anchor[0] * axis[0] + cands[b].anchor[1] * axis[1]
      return pa - pb || cands[a].room.room_number.localeCompare(cands[b].room.room_number)
    })
  }

  // Nearest reachable distance from an unassigned room to a housekeeper's route.
  const distToSet = (u: number, set: number[]): number => {
    let d = Infinity
    for (const r of set) if (distMatrix[r][u] < d) d = distMatrix[r][u]
    return d
  }

  const give = (hkId: string, i: number): void => {
    zones[cands[i].room.id] = hkId
    assigned.get(hkId)!.push(i)
    load[hkId] += cands[i].minutes
    unassigned.delete(i)
  }

  // The largest still-open cluster's rooms, corner-first — the seed order for a
  // housekeeper with no route yet. Filling this bounded by a budget "starts at a
  // cluster edge and loads up rooms in its vicinity," partway through the cluster
  // when it is bigger than the budget (the fair-share edge-fill).
  const seedOrder = (budget: number): number[] => {
    const clusters = [...new Set(clusterOf)]
      .map((cluster) => {
        const members = membersOf(cluster)
        const total = members.reduce((n, i) => n + cands[i].minutes, 0)
        return { cluster, members, total }
      })
      .filter((c) => c.members.some((i) => cands[i].minutes <= budget))
    if (clusters.length === 0) return []
    clusters.sort((a, b) => b.total - a.total || a.cluster - b.cluster)
    return alongOrder(clusters[0].members)
  }

  // One seed-or-grow visit: extend hk's route by rooms in proximity order, up to
  // `budget` added minutes. Seeds from a cluster edge when the route is empty,
  // else grows from the nearest reachable room they hold into its cluster,
  // closest-first. Unreachable rooms (∞ away) are never pulled in. Returns rooms
  // added — 0 means this housekeeper cannot make progress within the budget.
  const serve = (hkId: string, budget: number): number => {
    const mine = assigned.get(hkId)!
    let order: number[]
    if (mine.length === 0) {
      order = seedOrder(budget)
      if (order.length === 0) return 0
    } else {
      let pick = -1
      let bestD = Infinity
      for (const u of unassigned) {
        if (cands[u].minutes > budget) continue
        const du = distToSet(u, mine)
        if (du < bestD || (du === bestD && pick >= 0 && cands[u].room.room_number < cands[pick].room.room_number)) {
          bestD = du
          pick = u
        }
      }
      if (pick < 0) return 0
      order = membersOf(clusterOf[pick]).sort(
        (a, b) =>
          distToSet(a, mine) - distToSet(b, mine) ||
          cands[a].room.room_number.localeCompare(cands[b].room.room_number),
      )
    }

    let added = 0
    let spent = 0
    for (const i of order) {
      if (!unassigned.has(i)) continue
      if (spent + cands[i].minutes <= budget) {
        give(hkId, i)
        spent += cands[i].minutes
        added++
      }
    }
    return added
  }

  // The nearest reachable unassigned room a housekeeper can still fit in their
  // *shift* (used to place leftovers), or a fresh cluster edge if they have no
  // route yet. `u < 0` means they can place nothing.
  const nearestPlaceable = (hkId: string): { u: number; d: number } => {
    const rem = remainingShift(hkId)
    const mine = assigned.get(hkId)!
    if (mine.length === 0) {
      for (const i of seedOrder(rem)) if (cands[i].minutes <= rem) return { u: i, d: 0 }
      return { u: -1, d: Infinity }
    }
    let u = -1
    let best = Infinity
    for (const cand of unassigned) {
      if (cands[cand].minutes > rem) continue
      const du = distToSet(cand, mine)
      if (du === Infinity) continue
      if (du < best || (du === best && u >= 0 && cands[cand].room.room_number < cands[u].room.room_number)) {
        best = du
        u = cand
      }
    }
    return { u, d: best }
  }

  const stuck = new Set<string>()
  while (unassigned.size > 0) {
    const smallest = Math.min(...[...unassigned].map((i) => cands[i].minutes))

    // Phase 1 — bring everyone up to their fair share. The housekeeper furthest
    // below their share seeds/grows a route bounded by that share (ties → longer
    // shift, then id), so nobody races to a full shift while a colleague idles.
    const belowFair = roster.filter((h) => !stuck.has(h.id) && headroom(h.id) >= smallest)
    if (belowFair.length > 0) {
      const H = belowFair.reduce((best, h) => {
        const hb = headroom(best.id)
        const hh = headroom(h.id)
        if (hh !== hb) return hh > hb ? h : best
        const sb = shiftOf.get(best.id)!
        const sh = shiftOf.get(h.id)!
        if (sh !== sb) return sh > sb ? h : best
        return h.id < best.id ? h : best
      })
      if (serve(H.id, headroom(H.id)) === 0) stuck.add(H.id) // unreachable within share
      continue
    }

    // Phase 2 — fair shares are met; hand each leftover room (lumpiness the even
    // split couldn't place) to whoever is still furthest below their share and
    // can reach + fit it in their actual shift, closest such room first. One
    // room at a time keeps equal-shift loads within a single room of each other.
    let best: { hkId: string; u: number; d: number; head: number } | null = null
    for (const h of roster) {
      if (remainingShift(h.id) < smallest) continue
      const { u, d } = nearestPlaceable(h.id)
      if (u < 0) continue
      const head = headroom(h.id)
      const better =
        best === null ||
        head > best.head ||
        (head === best.head &&
          (d < best.d ||
            (d === best.d &&
              (shiftOf.get(h.id)! > shiftOf.get(best.hkId)! ||
                (shiftOf.get(h.id)! === shiftOf.get(best.hkId)! && h.id < best.hkId)))))
      if (better) best = { hkId: h.id, u, d, head }
    }
    if (best === null) break
    give(best.hkId, best.u)
  }

  return {
    zones,
    overflow: [...unassigned].map((i) => cands[i].room),
    load,
    totalWorkMinutes,
    totalShiftMinutes,
  }
}
