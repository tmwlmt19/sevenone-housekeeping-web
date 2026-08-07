import { describe, expect, it } from 'vitest'

import type { Decoration, FloorMap, MapRoom } from '@/lib/api/types'

import {
  autoAssignOptimized,
  crossDoorBand,
  doorsApart,
  estimateMinutes,
  walkableComponents,
  type DurationTable,
  type HousekeeperShift,
} from './auto-assign'
import { rectVertices } from './geometry'

const TABLE: DurationTable = { byType: { STD: 20, DLX: 30, STE: 40 }, default: 25 }

/** A placed dirty room with an 8×8 footprint centered at (cx, cy). */
function room(
  id: string,
  number: string,
  cx: number,
  cy: number,
  opts: { type?: string | null; status?: MapRoom['status']; hasTask?: boolean; placed?: boolean; door?: boolean } = {},
): MapRoom {
  const placed = opts.placed ?? true
  return {
    id,
    room_number: number,
    room_type: opts.type ?? null,
    status: opts.status ?? 'dirty',
    has_open_task: opts.hasTask ?? false,
    placement: placed
      ? { vertices: rectVertices(cx - 4, cy - 4, 8, 8), door: opts.door ? { edge: 0, t: 0.5 } : null }
      : null,
  }
}

function hall(x: number, y: number, w: number, h: number): Decoration {
  return { id: `hall-${x}-${y}`, kind: 'hall', vertices: rectVertices(x, y, w, h), label: null }
}
function elevator(cx: number, cy: number): Decoration {
  return { id: `el-${cx}-${cy}`, kind: 'elevator', vertices: rectVertices(cx - 3, cy - 3, 6, 6), label: null }
}

function floor(n: number, rooms: MapRoom[], decorations: Decoration[] = []): FloorMap {
  return { floor: n, name: null, width_ft: null, height_ft: null, grid_ft: 1, outline: null, decorations, rooms }
}

function shifts(...specs: [string, number][]): HousekeeperShift[] {
  return specs.map(([id, shiftMinutes]) => ({ id, shiftMinutes }))
}

const XAXIS: [number, number] = [1, 0]

describe('estimateMinutes', () => {
  it('uses the type entry, falling back to the default', () => {
    expect(estimateMinutes(room('r', '1', 0, 0, { type: 'STD' }), TABLE)).toBe(20)
    expect(estimateMinutes(room('r', '1', 0, 0, { type: 'STE' }), TABLE)).toBe(40)
    expect(estimateMinutes(room('r', '1', 0, 0, { type: 'KING' }), TABLE)).toBe(25) // unknown
    expect(estimateMinutes(room('r', '1', 0, 0, { type: null }), TABLE)).toBe(25) // null
  })
})

describe('crossDoorBand', () => {
  it('buckets the perpendicular crossing at 10 ft and 20 ft', () => {
    expect(crossDoorBand(9)).toBe(0)
    expect(crossDoorBand(10)).toBe(1)
    expect(crossDoorBand(15)).toBe(1)
    expect(crossDoorBand(20)).toBe(2)
    expect(crossDoorBand(21)).toBe(2)
  })
})

describe('doorsApart', () => {
  it('counts doors down the hall by spacing', () => {
    expect(doorsApart([0, 0], [15, 0], XAXIS, 15)).toBe(1)
    expect(doorsApart([0, 0], [30, 0], XAXIS, 15)).toBe(2)
    expect(doorsApart([0, 0], [45, 0], XAXIS, 15)).toBe(3)
  })
  it('adds the perpendicular crossing band', () => {
    expect(doorsApart([0, 0], [0, 9], XAXIS, 15)).toBe(0) // directly across a narrow hall
    expect(doorsApart([0, 0], [0, 20], XAXIS, 15)).toBe(2) // wide hall, no along offset → still links
    expect(doorsApart([0, 0], [15, 25], XAXIS, 15)).toBe(3) // wide + one door along → breaks
  })
})

describe('walkableComponents', () => {
  it('joins abutting halls and separates disconnected ones', () => {
    const joined = walkableComponents([hall(0, 0, 20, 5), hall(20, 0, 20, 5)]) // share the x=20 edge
    expect(joined).toHaveLength(1)
    const split = walkableComponents([hall(0, 0, 20, 5), hall(200, 0, 20, 5)])
    expect(split).toHaveLength(2)
  })
})

/** Which housekeeper (if any) each room id landed with. */
function zonesOf(res: { zones: Record<string, string> }, ids: string[]): (string | undefined)[] {
  return ids.map((id) => res.zones[id])
}

describe('autoAssignOptimized', () => {
  it('returns empty (all overflow) with no housekeepers, and empty with no candidates', () => {
    const rooms = [room('a', '101', 0, 0), room('b', '102', 15, 0)]
    const noHk = autoAssignOptimized([floor(1, rooms)], [], TABLE)
    expect(noHk.zones).toEqual({})
    expect(noHk.overflow.map((r) => r.id).sort()).toEqual(['a', 'b'])

    const clean = [room('a', '101', 0, 0, { status: 'clean' })]
    const noCand = autoAssignOptimized([floor(1, clean)], shifts(['ann', 480]), TABLE)
    expect(noCand.zones).toEqual({})
    expect(noCand.overflow).toEqual([])
  })

  it('excludes non-candidates (clean, out-of-service, already-tasked, unplaced skipped for geometry)', () => {
    const rooms = [
      room('dirty', '101', 0, 0),
      room('clean', '102', 15, 0, { status: 'clean' }),
      room('oos', '103', 30, 0, { status: 'out_of_service' }),
      room('tasked', '104', 45, 0, { hasTask: true }),
    ]
    const res = autoAssignOptimized([floor(1, rooms, [hall(-10, -10, 80, 20)])], shifts(['ann', 480]), TABLE)
    expect(Object.keys(res.zones)).toEqual(['dirty'])
  })

  it('gives every room to one housekeeper when the shift is ample', () => {
    const rooms = [room('a', '101', 0, 0), room('b', '102', 15, 0), room('c', '103', 30, 0)]
    const res = autoAssignOptimized([floor(1, rooms, [hall(-10, -10, 60, 20)])], shifts(['ann', 480]), TABLE)
    expect(zonesOf(res, ['a', 'b', 'c'])).toEqual(['ann', 'ann', 'ann'])
    expect(res.load.ann).toBe(75) // 3 × default 25
    expect(res.overflow).toEqual([])
    expect(res.totalWorkMinutes).toBe(75)
    expect(res.totalShiftMinutes).toBe(480)
  })

  it('overflows rooms that fit no remaining shift', () => {
    const rooms = [
      room('a', '101', 0, 0),
      room('b', '102', 15, 0),
      room('c', '103', 30, 0),
      room('d', '104', 45, 0),
    ]
    // 50 min shift fits exactly two 25-min rooms.
    const res = autoAssignOptimized([floor(1, rooms, [hall(-10, -10, 60, 20)])], shifts(['ann', 50]), TABLE)
    expect(Object.keys(res.zones)).toHaveLength(2)
    expect(res.overflow).toHaveLength(2)
    expect(res.load.ann).toBe(50)
  })

  it('splits two far-apart clusters across two housekeepers', () => {
    const rooms = [
      room('a', '101', 0, 0),
      room('b', '102', 15, 0),
      room('x', '301', 300, 0),
      room('y', '302', 315, 0),
    ]
    // Each shift fits two rooms (60 ≥ 2×25, < 3×25).
    const res = autoAssignOptimized(
      [floor(1, rooms, [hall(-10, -10, 340, 20)])],
      shifts(['ann', 60], ['bob', 60]),
      TABLE,
    )
    const [a, b, x, y] = zonesOf(res, ['a', 'b', 'x', 'y'])
    expect(a).toBe(b) // the near cluster stays together
    expect(x).toBe(y) // the far cluster stays together
    expect(a).not.toBe(x) // and they go to different housekeepers
    expect(res.overflow).toEqual([])
  })

  it('grows to the nearest cluster first, overflowing the farthest', () => {
    const rooms = [
      room('n1', '101', 0, 0),
      room('n2', '102', 15, 0), // near cluster
      room('m1', '201', 100, 0),
      room('m2', '202', 115, 0), // mid cluster
      room('f1', '301', 1000, 0),
      room('f2', '302', 1015, 0), // far cluster
    ]
    // 100 min → exactly four 25-min rooms: the near + mid clusters, not the far.
    const res = autoAssignOptimized(
      [floor(1, rooms, [hall(-10, -10, 1040, 20)])],
      shifts(['ann', 100]),
      TABLE,
    )
    expect(zonesOf(res, ['n1', 'n2', 'm1', 'm2'])).toEqual(['ann', 'ann', 'ann', 'ann'])
    expect(res.overflow.map((r) => r.id).sort()).toEqual(['f1', 'f2'])
  })

  it('reaches another floor across an elevator, and cannot without one', () => {
    const withEl = [
      floor(1, [room('a', '101', 0, 0)], [hall(-10, -10, 80, 20), elevator(50, 0)]),
      floor(2, [room('b', '201', 0, 0)], [hall(-10, -10, 80, 20), elevator(50, 0)]),
    ]
    const reached = autoAssignOptimized(withEl, shifts(['ann', 100]), TABLE)
    expect(zonesOf(reached, ['a', 'b'])).toEqual(['ann', 'ann'])
    expect(reached.overflow).toEqual([])

    const noEl = [
      floor(1, [room('a', '101', 0, 0)], [hall(-10, -10, 80, 20)]),
      floor(2, [room('b', '201', 0, 0)], [hall(-10, -10, 80, 20)]),
    ]
    const stuck = autoAssignOptimized(noEl, shifts(['ann', 100]), TABLE)
    expect(stuck.overflow.map((r) => r.id)).toEqual(['b']) // floor 2 unreachable
  })

  it('works with no walkable decorations (implicit whole-floor component) and with doors', () => {
    const rooms = [
      room('a', '101', 0, 0, { door: true }),
      room('b', '102', 15, 0, { door: true }),
    ]
    const res = autoAssignOptimized([floor(1, rooms)], shifts(['ann', 480]), TABLE)
    expect(zonesOf(res, ['a', 'b'])).toEqual(['ann', 'ann'])
  })

  it('respects per-type minutes in the shift budget', () => {
    const rooms = [
      room('a', '101', 0, 0, { type: 'STE' }), // 40
      room('b', '102', 15, 0, { type: 'STE' }), // 40
    ]
    const res = autoAssignOptimized([floor(1, rooms, [hall(-10, -10, 60, 20)])], shifts(['ann', 50]), TABLE)
    expect(Object.keys(res.zones)).toHaveLength(1) // only one 40-min suite fits in 50
    expect(res.load.ann).toBe(40)
    expect(res.overflow).toHaveLength(1)
  })

  it('spreads a light day across everyone instead of loading the first housekeepers', () => {
    // One contiguous cluster of six rooms, three ample shifts. The old
    // fill-to-shift greedy handed all six to the first housekeeper; fair shares
    // give each of the three an equal, non-empty slice.
    const rooms = [
      room('a', '101', 0, 0),
      room('b', '102', 15, 0),
      room('c', '103', 30, 0),
      room('d', '104', 45, 0),
      room('e', '105', 60, 0),
      room('f', '106', 75, 0),
    ]
    const res = autoAssignOptimized(
      [floor(1, rooms, [hall(-10, -10, 100, 20)])],
      shifts(['ann', 480], ['bob', 480], ['cy', 480]),
      TABLE,
    )
    expect(res.load).toEqual({ ann: 50, bob: 50, cy: 50 }) // 2 rooms each, nobody idle
    expect(res.overflow).toEqual([])
  })

  it('splits work in proportion to each shift length', () => {
    const rooms = [
      room('a', '101', 0, 0),
      room('b', '102', 15, 0),
      room('c', '103', 30, 0),
      room('d', '104', 45, 0),
      room('e', '105', 60, 0),
      room('f', '106', 75, 0),
    ]
    // 150 min of work over an 8h + 4h roster → a fair share of 100 vs 50.
    const res = autoAssignOptimized(
      [floor(1, rooms, [hall(-10, -10, 100, 20)])],
      shifts(['ann', 480], ['bob', 240]),
      TABLE,
    )
    expect(res.load.ann).toBe(100) // 4 rooms
    expect(res.load.bob).toBe(50) // 2 rooms
    expect(res.overflow).toEqual([])
  })

  it('keeps loads within one room of each other with lumpy room sizes', () => {
    // Five 30-min rooms across two equal shifts: 150 min won't halve evenly, so
    // the split is 90 / 60 — apart by exactly one room, the largest type here.
    const rooms = [
      room('a', '101', 0, 0, { type: 'DLX' }),
      room('b', '102', 15, 0, { type: 'DLX' }),
      room('c', '103', 30, 0, { type: 'DLX' }),
      room('d', '104', 45, 0, { type: 'DLX' }),
      room('e', '105', 60, 0, { type: 'DLX' }),
    ]
    const res = autoAssignOptimized(
      [floor(1, rooms, [hall(-10, -10, 85, 20)])],
      shifts(['ann', 480], ['bob', 480]),
      TABLE,
    )
    expect(res.overflow).toEqual([]) // every room placed — capacity was ample
    expect([res.load.ann, res.load.bob].sort((x, y) => x - y)).toEqual([60, 90])
    expect(Math.abs(res.load.ann - res.load.bob)).toBe(30) // ≤ the largest room type
  })

  it('edge-fills a cluster bigger than the fair share, up to the share not the shift', () => {
    // One eight-room cluster (200 min) over two 8h shifts. No cluster fits a fair
    // share (100), so each housekeeper starts at an edge and loads up to 100 —
    // a contiguous half — rather than one grabbing the whole cluster.
    const rooms = [
      room('a', '101', 0, 0),
      room('b', '102', 15, 0),
      room('c', '103', 30, 0),
      room('d', '104', 45, 0),
      room('e', '105', 60, 0),
      room('f', '106', 75, 0),
      room('g', '107', 90, 0),
      room('h', '108', 105, 0),
    ]
    const res = autoAssignOptimized(
      [floor(1, rooms, [hall(-10, -10, 130, 20)])],
      shifts(['ann', 480], ['bob', 480]),
      TABLE,
    )
    expect(res.load).toEqual({ ann: 100, bob: 100 }) // fair share, well under the 480 shift
    // Contiguous halves: the first four rooms to one, the last four to the other.
    const [a, b, c, d, e, f, g, h] = zonesOf(res, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    expect(new Set([a, b, c, d]).size).toBe(1)
    expect(new Set([e, f, g, h]).size).toBe(1)
    expect(a).not.toBe(e)
    expect(res.overflow).toEqual([])
  })

  it('is deterministic', () => {
    const build = () =>
      autoAssignOptimized(
        [
          floor(
            1,
            [
              room('a', '101', 0, 0),
              room('b', '102', 15, 0),
              room('x', '301', 300, 0),
              room('y', '302', 315, 0),
            ],
            [hall(-10, -10, 340, 20)],
          ),
        ],
        shifts(['ann', 60], ['bob', 60]),
        TABLE,
      )
    expect(build().zones).toEqual(build().zones)
  })
})
