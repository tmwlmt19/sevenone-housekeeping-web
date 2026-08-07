import type { Polygon, Vertex } from '@/lib/api/types'

/**
 * Pure polygon geometry for the floor mapper — the web mirror of the backend's
 * `app/services/floor_geometry.py`. All geometry is absolute vertices in float
 * feet (a rectangle is four right-angle vertices); rotation is baked into the
 * points, so this module is the single place shapes are measured, rotated,
 * stretched, hit-tested, and merged. Keep it pure so it stays trivially testable.
 *
 * Coordinate convention: screen space (x right, y down). Everything here is sign-
 * consistent within that space; where winding matters (merge), polygons are
 * normalized to a canonical orientation first.
 */

const COORD_DP = 2 // decimal places → 0.01 ft, matching the backend
const EPS = 1e-6

export function roundVertex([x, y]: Vertex): Vertex {
  const f = 10 ** COORD_DP
  return [Math.round(x * f) / f, Math.round(y * f) / f]
}

export function roundPolygon(v: Polygon): Polygon {
  return v.map(roundVertex)
}

/** A rectangle as four vertices, clockwise in screen space (the placement default). */
export function rectVertices(x: number, y: number, w: number, h: number): Polygon {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

export function boundingBox(v: Polygon): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  w: number
  h: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of v) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/** Signed area (shoelace). Sign encodes winding in the current coordinate space. */
export function signedArea(v: Polygon): number {
  let s = 0
  for (let i = 0; i < v.length; i++) {
    const [x1, y1] = v[i]
    const [x2, y2] = v[(i + 1) % v.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

export function polygonArea(v: Polygon): number {
  return Math.abs(signedArea(v))
}

/** Area-weighted centroid — the correct center for rotation pivot, label anchor,
 *  and proximity clustering, including concave shapes. Falls back to the vertex
 *  average for a degenerate (zero-area) polygon. */
export function centroid(v: Polygon): Vertex {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < v.length; i++) {
    const [x1, y1] = v[i]
    const [x2, y2] = v[(i + 1) % v.length]
    const cross = x1 * y2 - x2 * y1
    a += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(a) < EPS) {
    const n = v.length
    return [
      v.reduce((s, p) => s + p[0], 0) / n,
      v.reduce((s, p) => s + p[1], 0) / n,
    ]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

export function translate(v: Polygon, dx: number, dy: number): Polygon {
  return v.map(([x, y]) => [x + dx, y + dy])
}

/** Rotate a single point by `deg` about a pivot. */
export function rotatePoint([x, y]: Vertex, deg: number, [px, py]: Vertex): Vertex {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - px
  const dy = y - py
  return [px + dx * cos - dy * sin, py + dx * sin + dy * cos]
}

/** Rotate a polygon by `deg` about a pivot (defaults to its centroid). */
export function rotatePolygon(v: Polygon, deg: number, about?: Vertex): Polygon {
  const pivot = about ?? centroid(v)
  return v.map((p) => rotatePoint(p, deg, pivot))
}

/** Orientation of the baseline edge (v0→v1) in degrees, normalized to [0, 360).
 *  This is the shape's "rotation" readout — 0 for an unrotated rectangle. */
export function edgeOrientationDeg(v: Polygon): number {
  if (v.length < 2) return 0
  const [x1, y1] = v[0]
  const [x2, y2] = v[1]
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

export function edgeLengths(v: Polygon): number[] {
  return v.map(([x1, y1], i) => {
    const [x2, y2] = v[(i + 1) % v.length]
    return Math.hypot(x2 - x1, y2 - y1)
  })
}

/** Interior angle (degrees) at each vertex, correct for concave (reflex) corners. */
export function internalAngles(v: Polygon): number[] {
  const n = v.length
  const s = Math.sign(signedArea(v)) || 1
  return v.map(([x, y], i) => {
    const [px, py] = v[(i - 1 + n) % n]
    const [nx, ny] = v[(i + 1) % n]
    const ux = px - x
    const uy = py - y
    const wx = nx - x
    const wy = ny - y
    const lenU = Math.hypot(ux, uy)
    const lenW = Math.hypot(wx, wy)
    if (lenU < EPS || lenW < EPS) return 0
    const dot = (ux * wx + uy * wy) / (lenU * lenW)
    const base = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI
    const crossZ = ux * wy - uy * wx
    // Reflex when the corner turns "into" the winding direction.
    return s * crossZ > 0 ? 360 - base : base
  })
}

/** Ray-cast point-in-polygon test (for selection / hit-testing). */
export function pointInPolygon([x, y]: Vertex, v: Polygon): boolean {
  let inside = false
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [xi, yi] = v[i]
    const [xj, yj] = v[j]
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export function snapAngle(deg: number, step: number): number {
  return Math.round(deg / step) * step
}

/** Intersection point of the two infinite lines through a→b and c→d, or null if
 *  they're parallel. Used to close the gap when an edge is deleted (the two
 *  neighbouring edges extend until they meet). */
export function lineIntersection(
  a: Vertex,
  b: Vertex,
  c: Vertex,
  d: Vertex,
): Vertex | null {
  const rx = b[0] - a[0]
  const ry = b[1] - a[1]
  const sx = d[0] - c[0]
  const sy = d[1] - c[1]
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < EPS) return null
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / denom
  return [a[0] + t * rx, a[1] + t * ry]
}

/** The polygon edge nearest to `pt`: its index, the closest point on it, and that
 *  point's parametric position `t` (0..1) along the edge. */
export function nearestEdge(
  pt: Vertex,
  v: Polygon,
): { index: number; point: Vertex; t: number } {
  let index = 0
  let point: Vertex = v[0]
  let t = 0
  let bestD = Infinity
  for (let i = 0; i < v.length; i++) {
    const a = v[i]
    const b = v[(i + 1) % v.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    let tt = len2 < EPS ? 0 : ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2
    tt = Math.max(0, Math.min(1, tt))
    const q: Vertex = [a[0] + tt * dx, a[1] + tt * dy]
    const d = Math.hypot(q[0] - pt[0], q[1] - pt[1])
    if (d < bestD) {
      bestD = d
      index = i
      point = q
      t = tt
    }
  }
  return { index, point, t }
}

/** The two endpoints of a `length`-ft door segment centered at edge-relative
 *  position `door` on a room's wall — so it stays glued to that wall through
 *  moves/rotations/resizes. Returns null if the edge no longer exists. */
export function doorSegment(
  v: Polygon,
  door: { edge: number; t: number },
  length = 2,
): [Vertex, Vertex] | null {
  if (door.edge < 0 || door.edge >= v.length) return null
  const a = v[door.edge]
  const b = v[(door.edge + 1) % v.length]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const half = Math.min(length, len) / 2
  // Center along the edge, clamped so the segment stays on the wall.
  const d = Math.max(half, Math.min(len - half, door.t * len))
  const cx = a[0] + ux * d
  const cy = a[1] + uy * d
  return [
    [cx - ux * half, cy - uy * half],
    [cx + ux * half, cy + uy * half],
  ]
}

/** Closest point on a polygon's boundary to `pt`. */
export function projectToPolygon(pt: Vertex, v: Polygon): Vertex {
  return nearestEdge(pt, v).point
}

/** Snap a dragged point to the nearest candidate point within `tol` (else return
 *  it unchanged). Snapping corners together is what makes shapes line up so they
 *  can be merged — the "edge-to-edge" Shift assist. */
export function snapVertexToNeighbors(
  pt: Vertex,
  candidates: Iterable<Vertex>,
  tol: number,
): Vertex {
  let best: Vertex | null = null
  let bestD = tol
  for (const c of candidates) {
    const d = Math.hypot(c[0] - pt[0], c[1] - pt[1])
    if (d <= bestD) {
      bestD = d
      best = c
    }
  }
  return best ?? pt
}

// --- Overlap --------------------------------------------------------------

/** Signed perpendicular distance of `p` from the infinite line a→b (in feet).
 *  ~0 means p is on the line; the sign tells which side. */
function sideOfLine(a: Vertex, b: Vertex, p: Vertex): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len
}

/** Do segments a1→a2 and b1→b2 cross through each other's interior? Collinear or
 *  merely-touching-at-an-endpoint segments do NOT count (within `tol` feet), so
 *  two shapes that share a boundary aren't read as crossing. */
export function segmentsCross(
  a1: Vertex,
  a2: Vertex,
  b1: Vertex,
  b2: Vertex,
  tol = 0.02,
): boolean {
  const d1 = sideOfLine(b1, b2, a1)
  const d2 = sideOfLine(b1, b2, a2)
  const d3 = sideOfLine(a1, a2, b1)
  const d4 = sideOfLine(a1, a2, b2)
  const opposite = (u: number, w: number) =>
    (u > tol && w < -tol) || (u < -tol && w > tol)
  return opposite(d1, d2) && opposite(d3, d4)
}

/** A handful of points strictly inside `v` — the centroid (when it lies within,
 *  which it may not for a concave shape) plus a point stepped just off each edge
 *  midpoint. Enough to detect containment / aligned partial overlap that produces
 *  no edge crossing (e.g. two grid-aligned rooms overlapping halfway). */
function interiorProbes(v: Polygon): Vertex[] {
  const probes: Vertex[] = []
  const c = centroid(v)
  if (pointInPolygon(c, v)) probes.push(c)
  const bb = boundingBox(v)
  const step = Math.min(0.5, 0.4 * Math.max(EPS, Math.min(bb.w, bb.h)))
  for (let i = 0; i < v.length; i++) {
    const a = v[i]
    const b = v[(i + 1) % v.length]
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const len = Math.hypot(ex, ey) || 1
    const nx = -ey / len
    const ny = ex / len
    const p1: Vertex = [mx + nx * step, my + ny * step]
    if (pointInPolygon(p1, v)) probes.push(p1)
    else {
      const p2: Vertex = [mx - nx * step, my - ny * step]
      if (pointInPolygon(p2, v)) probes.push(p2)
    }
  }
  return probes
}

/** True when the interiors of two simple polygons overlap. Shapes that only share
 *  a boundary — flush neighbours, a corner touch, an edge-to-edge join — do NOT
 *  overlap, so circulation nodes can butt against a hall and rooms can sit wall to
 *  wall. Robust to rotated and concave (merged / L-shaped) polygons: it combines
 *  proper edge crossings (catches skew/sliver overlaps) with interior sampling
 *  (catches containment and grid-aligned partial overlap that never crosses). */
export function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  if (a.length < 3 || b.length < 3) return false
  // Fast reject: separated bounding boxes (touching boxes still get the full test).
  const ba = boundingBox(a)
  const bb = boundingBox(b)
  if (
    ba.maxX < bb.minX - EPS ||
    bb.maxX < ba.minX - EPS ||
    ba.maxY < bb.minY - EPS ||
    bb.maxY < ba.minY - EPS
  ) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]
    const a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true
    }
  }
  for (const p of interiorProbes(a)) if (pointInPolygon(p, b)) return true
  for (const p of interiorProbes(b)) if (pointInPolygon(p, a)) return true
  return false
}

// --- Merge ----------------------------------------------------------------

function close(a: Vertex, b: Vertex, tol: number): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol
}

/** Reverse to a canonical winding (positive signed area) so two adjacent shapes
 *  traverse their shared edge in opposite directions — the invariant merge needs. */
function toCanonical(v: Polygon): Polygon {
  return signedArea(v) < 0 ? [...v].reverse() : v
}

/** Remove consecutive (and wrap-around) near-duplicate vertices. */
function dedupeClose(v: Polygon, tol: number): Polygon {
  const out: Polygon = []
  for (const p of v) {
    if (out.length === 0 || !close(out[out.length - 1], p, tol)) out.push(p)
  }
  while (out.length > 1 && close(out[0], out[out.length - 1], tol)) out.pop()
  return out
}

/** Drop vertices that are collinear with their neighbors (so square+triangle
 *  yields a clean pentagon, and two rects a clean L, with no redundant points). */
export function cleanCollinear(v: Polygon, tol = 0.02): Polygon {
  if (v.length <= 3) return v
  const out: Polygon = []
  const n = v.length
  for (let i = 0; i < n; i++) {
    const [px, py] = v[(i - 1 + n) % n]
    const [x, y] = v[i]
    const [nx, ny] = v[(i + 1) % n]
    // Twice the triangle area (prev, cur, next); ~0 means cur sits on the edge.
    const cross = Math.abs((x - px) * (ny - py) - (y - py) * (nx - px))
    if (cross > tol) out.push(v[i])
  }
  return out.length >= 3 ? out : v
}

/** If two polygons share a full edge (coincident endpoints, opposite direction),
 *  return the matching edge indices; else null. This is the "corners must line up"
 *  gate on merging. */
export function sharedEdge(
  a: Polygon,
  b: Polygon,
  tol = 0.25,
): { i: number; j: number } | null {
  const ca = toCanonical(a)
  const cb = toCanonical(b)
  const n = ca.length
  const m = cb.length
  for (let i = 0; i < n; i++) {
    const a0 = ca[i]
    const a1 = ca[(i + 1) % n]
    for (let j = 0; j < m; j++) {
      const b0 = cb[j]
      const b1 = cb[(j + 1) % m]
      // Adjacent same-winding polygons traverse the shared edge in reverse.
      if (close(a0, b1, tol) && close(a1, b0, tol)) return { i, j }
    }
  }
  return null
}

export function mergeEligible(a: Polygon, b: Polygon, tol = 0.25): boolean {
  return sharedEdge(a, b, tol) !== null
}

/** Boolean union of two polygons that share a full edge, stitched along that edge
 *  into one clean polygon (square + triangle → pentagon; two rects → L-shape).
 *  Returns null when they don't line up. */
export function unionPolygons(a: Polygon, b: Polygon, tol = 0.25): Polygon | null {
  const ca = toCanonical(a)
  const cb = toCanonical(b)
  const match = sharedEdge(ca, cb, tol)
  if (!match) return null
  const { i, j } = match
  const n = ca.length
  const m = cb.length
  const out: Polygon = []
  // A's boundary from just after the shared edge, all the way around to A[i].
  for (let k = 0; k < n; k++) out.push(ca[(i + 1 + k) % n])
  // Then B's outer path, skipping the two shared-edge endpoints (already present).
  for (let k = 1; k < m - 1; k++) out.push(cb[(j + 1 + k) % m])
  return cleanCollinear(dedupeClose(out, tol / 2))
}
