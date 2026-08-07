import type { MapRoom, RoomAssignment } from '@/lib/api/types'

import { centroid } from './geometry'

/**
 * Shared core for map-driven task assignment. Both entry points — manually
 * lassoing rooms into zones and the one-click auto proximity-split — produce the
 * same `ZoneMap`, which flattens to the API's explicit `assignments` payload. So
 * the two modes differ only in how the zone map is built; everything downstream
 * (payload shape, POST /tasks/import) is identical. Keep this module pure and
 * geometry-only so it stays trivially testable.
 */

/** roomId → housekeeperId. A room belongs to at most one housekeeper. */
export type ZoneMap = Record<string, string>

/**
 * Flatten a zone map to the explicit-assignment payload. Emits only rooms that
 * are both assigned and present in `rooms`; order follows `rooms` (already
 * natural, since the map query returns rooms ordered by number).
 */
export function zonesToAssignments(
  zones: ZoneMap,
  rooms: MapRoom[],
): RoomAssignment[] {
  const out: RoomAssignment[] = []
  for (const room of rooms) {
    const housekeeperId = zones[room.id]
    if (housekeeperId) {
      out.push({ room_number: room.room_number, housekeeper_id: housekeeperId })
    }
  }
  return out
}

/** Even chunk sizes summing to `count`; earlier chunks take the remainder.
 *  Mirrors the backend/CSV even-split so auto and manual balance the same way. */
function chunkSizes(count: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(count / n)
  const remainder = count % n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}

function center(room: MapRoom): { cx: number; cy: number } {
  const [cx, cy] = centroid(room.placement!.vertices)
  return { cx, cy }
}

/**
 * Auto proximity-split: partition placed rooms into one walkable band per
 * housekeeper. Sweep along whichever axis the rooms spread across most (so each
 * cut runs across the long dimension, leaving compact bands), then chop the
 * sorted rooms into even-count chunks, one per housekeeper in order. On a typical
 * corridor floor this hands each person a contiguous stretch of hallway.
 *
 * Deterministic. Rooms without a placement are ignored — a spatial split needs
 * geometry — so the caller assigns/handles unplaced rooms itself.
 */
export function autoClusterRooms(
  rooms: MapRoom[],
  housekeeperIds: string[],
): ZoneMap {
  const zones: ZoneMap = {}
  const k = housekeeperIds.length
  const placed = rooms.filter((r) => r.placement)
  if (k === 0 || placed.length === 0) return zones
  if (k === 1) {
    for (const room of placed) zones[room.id] = housekeeperIds[0]
    return zones
  }

  const centers = placed.map(center)
  const xs = centers.map((c) => c.cx)
  const ys = centers.map((c) => c.cy)
  const sweepX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys)

  // Sort along the wider axis; tiebreak on the other so a band stays compact.
  const ordered = placed
    .map((room, i) => ({ room, c: centers[i] }))
    .sort((a, b) =>
      sweepX
        ? a.c.cx - b.c.cx || a.c.cy - b.c.cy
        : a.c.cy - b.c.cy || a.c.cx - b.c.cx,
    )
    .map((e) => e.room)

  const sizes = chunkSizes(ordered.length, k)
  let idx = 0
  for (let group = 0; group < k; group++) {
    for (let n = 0; n < sizes[group]; n++) {
      zones[ordered[idx].id] = housekeeperIds[group]
      idx++
    }
  }
  return zones
}
