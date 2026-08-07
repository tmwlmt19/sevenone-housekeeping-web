import { describe, expect, it } from 'vitest'

import type { Polygon } from '@/lib/api/types'

import {
  boundingBox,
  centroid,
  cleanCollinear,
  doorSegment,
  edgeOrientationDeg,
  internalAngles,
  lineIntersection,
  mergeEligible,
  nearestEdge,
  pointInPolygon,
  polygonArea,
  rectVertices,
  rotatePoint,
  rotatePolygon,
  polygonsOverlap,
  snapAngle,
  snapVertexToNeighbors,
  unionPolygons,
} from './geometry'

const square: Polygon = rectVertices(0, 0, 10, 10)
// An L-shape (concave, simple): bottom bar 20×10 + left column up to y=20.
const lShape: Polygon = [
  [0, 0],
  [20, 0],
  [20, 10],
  [10, 10],
  [10, 20],
  [0, 20],
]

describe('measurement', () => {
  it('rectVertices + boundingBox', () => {
    expect(square).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ])
    expect(boundingBox(square)).toMatchObject({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
  })

  it('polygonArea', () => {
    expect(polygonArea(square)).toBe(100)
    expect(polygonArea(lShape)).toBe(300)
    expect(polygonArea([[0, 0], [10, 0], [0, 10]])).toBe(50)
  })

  it('centroid of a rectangle is its center', () => {
    expect(centroid(square)).toEqual([5, 5])
  })

  it('centroid of an L-shape is area-weighted (inside the shape)', () => {
    const [cx, cy] = centroid(lShape)
    expect(cx).toBeCloseTo(8.333, 2)
    expect(cy).toBeCloseTo(8.333, 2)
  })
})

describe('angles', () => {
  it('a rectangle has four right angles', () => {
    expect(internalAngles(square)).toEqual([90, 90, 90, 90])
  })

  it('an L-shape has one reflex (270°) interior angle summing to 720°', () => {
    const angles = internalAngles(lShape)
    expect(angles.filter((a) => Math.round(a) === 270)).toHaveLength(1)
    expect(Math.round(angles.reduce((s, a) => s + a, 0))).toBe(720)
  })

  it('edgeOrientationDeg is 0 for an axis-aligned rect and tracks rotation', () => {
    expect(edgeOrientationDeg(square)).toBeCloseTo(0, 5)
    expect(edgeOrientationDeg(rotatePolygon(square, 30))).toBeCloseTo(30, 3)
  })
})

describe('rotation', () => {
  it('rotatePoint moves a point about a pivot (and round-trips)', () => {
    const p = rotatePoint([10, 0], 90, [0, 0])
    expect(p[0]).toBeCloseTo(0, 6)
    expect(p[1]).toBeCloseTo(10, 6)
    // Un-rotating by the negative angle returns the original point.
    const back = rotatePoint(p, -90, [0, 0])
    expect(back[0]).toBeCloseTo(10, 6)
    expect(back[1]).toBeCloseTo(0, 6)
  })

  it('rotating 90° about the center preserves the bounding box and area', () => {
    const r = rotatePolygon(square, 90, [5, 5])
    const bb = boundingBox(r)
    expect(bb.minX).toBeCloseTo(0, 6)
    expect(bb.minY).toBeCloseTo(0, 6)
    expect(bb.maxX).toBeCloseTo(10, 6)
    expect(bb.maxY).toBeCloseTo(10, 6)
    expect(polygonArea(r)).toBeCloseTo(100, 6)
  })
})

describe('hit-testing', () => {
  it('pointInPolygon inside/outside a square', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true)
    expect(pointInPolygon([15, 5], square)).toBe(false)
  })

  it('respects concavity of an L-shape (notch is outside)', () => {
    expect(pointInPolygon([5, 5], lShape)).toBe(true)
    expect(pointInPolygon([15, 15], lShape)).toBe(false) // the cut-out corner
  })
})

describe('snap assists', () => {
  it('snapAngle to 15°', () => {
    expect(snapAngle(37, 15)).toBe(30)
    expect(snapAngle(38, 15)).toBe(45)
  })

  it('snapVertexToNeighbors pulls to a nearby corner, ignores far ones', () => {
    expect(snapVertexToNeighbors([10.2, 0.1], [[10, 0]], 0.5)).toEqual([10, 0])
    expect(snapVertexToNeighbors([12, 5], [[10, 0]], 0.5)).toEqual([12, 5])
  })
})

describe('merge', () => {
  // A triangular roof whose base is the square's top edge.
  const roof: Polygon = [
    [0, 10],
    [10, 10],
    [5, 15],
  ]

  it('square + aligned triangle merges into a 5-vertex pentagon', () => {
    expect(mergeEligible(square, roof)).toBe(true)
    const merged = unionPolygons(square, roof)
    expect(merged).not.toBeNull()
    expect(merged).toHaveLength(5)
    // The apex survives; the shared-edge midpoints do not become extra vertices.
    expect(merged!.some(([x, y]) => x === 5 && y === 15)).toBe(true)
  })

  it('two squares sharing a full edge merge (collinear points cleaned away)', () => {
    const top = rectVertices(0, 10, 10, 10)
    const merged = unionPolygons(square, top)
    expect(merged).not.toBeNull()
    // A 10×20 rectangle — the shared edge and its collinear points are removed.
    expect(merged).toHaveLength(4)
    expect(polygonArea(merged!)).toBeCloseTo(200, 6)
  })

  it('disjoint shapes are not merge-eligible', () => {
    const far = rectVertices(100, 100, 10, 10)
    expect(mergeEligible(square, far)).toBe(false)
    expect(unionPolygons(square, far)).toBeNull()
  })

  it('a partial (mismatched-length) shared edge is not eligible in v1', () => {
    const bar = rectVertices(0, 0, 20, 10) // its bottom edge is longer
    const small = rectVertices(0, 10, 10, 10)
    expect(mergeEligible(bar, small)).toBe(false)
  })
})

describe('door geometry', () => {
  it('nearestEdge finds the closest edge, point, and t', () => {
    // Point just below the bottom edge (edge index 2: (10,10)->(0,10)).
    const hit = nearestEdge([5, 11], square)
    expect(hit.index).toBe(2)
    expect(hit.point[1]).toBeCloseTo(10, 6)
    expect(hit.t).toBeCloseTo(0.5, 6)
  })

  it('doorSegment is a 2 ft line centered on the wall', () => {
    const seg = doorSegment(square, { edge: 2, t: 0.5 })
    expect(seg).not.toBeNull()
    const [a, b] = seg!
    // Length ~2 ft, lying on the bottom edge (y = 10).
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(2, 6)
    expect(a[1]).toBeCloseTo(10, 6)
    expect(b[1]).toBeCloseTo(10, 6)
  })

  it('doorSegment returns null for a missing edge', () => {
    expect(doorSegment(square, { edge: 9, t: 0.5 })).toBeNull()
  })
})

describe('lineIntersection', () => {
  it('finds where two non-parallel lines cross', () => {
    const p = lineIntersection([0, 0], [10, 0], [5, -5], [5, 5])
    expect(p).not.toBeNull()
    expect(p![0]).toBeCloseTo(5, 6)
    expect(p![1]).toBeCloseTo(0, 6)
  })

  it('returns null for parallel lines', () => {
    expect(lineIntersection([0, 0], [10, 0], [0, 5], [10, 5])).toBeNull()
  })
})

describe('cleanCollinear', () => {
  it('drops a redundant midpoint on a straight edge', () => {
    const withMid: Polygon = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    expect(cleanCollinear(withMid)).toHaveLength(4)
  })
})

describe('polygonsOverlap', () => {
  it('is false for disjoint shapes', () => {
    expect(polygonsOverlap(square, rectVertices(20, 20, 10, 10))).toBe(false)
  })

  it('is false for flush (edge-sharing) neighbours — touching is allowed', () => {
    // A room wall-to-wall with the square, and a stairwell butted onto its edge.
    expect(polygonsOverlap(square, rectVertices(10, 0, 10, 10))).toBe(false)
    expect(polygonsOverlap(square, rectVertices(0, 10, 8, 8))).toBe(false)
  })

  it('is false for a corner-only touch', () => {
    expect(polygonsOverlap(square, rectVertices(10, 10, 10, 10))).toBe(false)
  })

  it('is true for a grid-aligned half overlap (no edge crossing)', () => {
    // The classic drag-halfway-on case: every crossing is collinear/endpoint.
    expect(polygonsOverlap(square, rectVertices(5, 0, 10, 10))).toBe(true)
  })

  it('is true when one shape contains the other', () => {
    expect(polygonsOverlap(square, rectVertices(2, 2, 4, 4))).toBe(true)
  })

  it('is true for a skew (rotated) overlap that crosses edges', () => {
    const diamond: Polygon = rotatePolygon(rectVertices(3, 3, 6, 6), 45)
    expect(polygonsOverlap(square, diamond)).toBe(true)
  })

  it('lets a room sit in the notch of a concave L-shaped hall', () => {
    // The L leaves an empty 10×10 pocket at the top-right; a room there must not
    // read as overlapping the hall.
    const room = rectVertices(11, 11, 8, 8)
    expect(polygonsOverlap(lShape, room)).toBe(false)
    // …but a room poking into the L's filled arm does overlap.
    expect(polygonsOverlap(lShape, rectVertices(5, 5, 8, 8))).toBe(true)
  })
})
