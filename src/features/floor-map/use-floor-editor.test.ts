import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { FloorMap } from '@/lib/api/types'

import { boundingBox, polygonArea, rectVertices } from './geometry'
import { useFloorEditor } from './use-floor-editor'

function makeFloor(): FloorMap {
  return {
    floor: 1,
    name: null,
    width_ft: 100,
    height_ft: 60,
    grid_ft: 1,
    outline: null,
    decorations: [],
    rooms: [
      {
        id: 'r1',
        room_number: '101',
        room_type: null,
        status: 'dirty',
        has_open_task: false,
        placement: { vertices: rectVertices(10, 10, 12, 16), door: null },
      },
      {
        id: 'r2',
        room_number: '102',
        room_type: null,
        status: 'dirty',
        has_open_task: false,
        placement: null,
      },
    ],
  }
}

describe('useFloorEditor', () => {
  it('places an unplaced room as a default rectangle', () => {
    const { result } = renderHook(() => useFloorEditor(makeFloor()))
    act(() => {
      result.current.beginChange()
      result.current.placeAt('r2', 60, 30)
    })
    const payload = result.current.buildPayload()
    const placed = (payload.placements ?? []).find((p) => p.room_id === 'r2')
    expect(placed).toBeDefined()
    expect(placed!.vertices).toHaveLength(4) // a rectangle
    const bb = boundingBox(placed!.vertices)
    expect(bb.w).toBe(12)
    expect(bb.h).toBe(16)
  })

  it('rotates a room, preserving its area', () => {
    const { result } = renderHook(() => useFloorEditor(makeFloor()))
    act(() => {
      result.current.beginChange()
      result.current.rotateItem('room', 'r1', 37)
    })
    const verts = result.current.itemVertices('room', 'r1')!
    expect(polygonArea(verts)).toBeCloseTo(192, 3) // 12 × 16, unchanged
    // No longer axis-aligned: its bounding box has grown.
    expect(boundingBox(verts).w).toBeGreaterThan(12)
  })

  it('stretches a single vertex (corner-stretch changes the shape)', () => {
    const { result } = renderHook(() => useFloorEditor(makeFloor()))
    act(() => {
      result.current.beginChange()
      result.current.stretchVertex('room', 'r1', 0, [0, 0])
    })
    expect(result.current.itemVertices('room', 'r1')![0]).toEqual([0, 0])
  })

  it('adds an editable floor outline and reports it in the payload', () => {
    const { result } = renderHook(() => useFloorEditor(makeFloor()))
    act(() => {
      result.current.beginChange()
      result.current.initOutline()
    })
    expect(result.current.buildPayload().outline).toHaveLength(4)
  })

  it("records a room's edge-relative door in the payload", () => {
    const { result } = renderHook(() => useFloorEditor(makeFloor()))
    act(() => {
      result.current.beginChange()
      result.current.setDoor('r1', { edge: 2, t: 0.5 })
    })
    const placed = (result.current.buildPayload().placements ?? []).find(
      (p) => p.room_id === 'r1',
    )
    expect(placed!.door).toEqual({ edge: 2, t: 0.5 })
  })

  it('undo reverts the last gesture', () => {
    const { result } = renderHook(() => useFloorEditor(makeFloor()))
    act(() => {
      result.current.beginChange()
      result.current.placeAt('r2', 60, 30)
    })
    expect(result.current.buildPayload().placements ?? []).toHaveLength(2)
    act(() => result.current.undo())
    expect(result.current.buildPayload().placements ?? []).toHaveLength(1)
  })

  it('merges two edge-sharing decorations into one unlabeled shape', () => {
    // Seed a floor whose two decorations share a full edge and carry labels.
    const floor = makeFloor()
    floor.decorations = [
      { id: 'd1', kind: 'lobby', vertices: rectVertices(0, 0, 10, 10), label: 'Main Lobby' },
      { id: 'd2', kind: 'hall', vertices: rectVertices(0, 10, 10, 10), label: 'Hall B' },
    ]
    const { result } = renderHook(() => useFloorEditor(floor))
    act(() => {
      result.current.beginChange()
      result.current.mergeDecorations(['d1', 'd2'])
    })
    expect(result.current.decorations).toHaveLength(1)
    // Two stacked 10×10 squares → a 10×20 rectangle (collinear points cleaned).
    expect(polygonArea(result.current.decorations[0].vertices)).toBeCloseTo(200, 3)
    // The inherited labels are dropped so the user can name the merged space.
    expect(result.current.decorations[0].label).toBeNull()
  })

  it('blocks a drag that would overlap another room, keeping the last valid spot', () => {
    const floor = makeFloor()
    const { result } = renderHook(() => useFloorEditor(floor))
    act(() => {
      result.current.beginChange()
      result.current.placeAt('r2', 60, 30) // clear of r1
    })
    const before = result.current.itemVertices('room', 'r1')!
    const onTopOfR2 = result.current.itemVertices('room', 'r2')!.map((p) => [...p] as [number, number])
    act(() => {
      result.current.beginChange()
      result.current.moveItems([{ type: 'room', id: 'r1', vertices: onTopOfR2 }])
    })
    // Rejected — r1 didn't move onto r2.
    expect(result.current.itemVertices('room', 'r1')).toEqual(before)
  })

  it('allows moving a room flush against another — touching is not overlap', () => {
    const floor = makeFloor()
    const { result } = renderHook(() => useFloorEditor(floor))
    act(() => {
      result.current.beginChange()
      result.current.placeAt('r2', 60, 30)
    })
    // r1 spans x[10,22]; butt r2 up against its right wall at x=22 (shared edge).
    act(() => {
      result.current.beginChange()
      result.current.moveItems([{ type: 'room', id: 'r2', vertices: rectVertices(22, 10, 12, 16) }])
    })
    expect(boundingBox(result.current.itemVertices('room', 'r2')!)).toMatchObject({
      minX: 22,
      minY: 10,
    })
  })

  it('will not place a room on top of another (canPlaceAt / placeAt agree)', () => {
    const floor = makeFloor()
    const { result } = renderHook(() => useFloorEditor(floor))
    // r1 is centered at (16, 18); dropping r2 there would land right on it.
    expect(result.current.canPlaceAt('r2', 16, 18)).toBe(false)
    let placed: boolean | undefined
    act(() => {
      result.current.beginChange()
      placed = result.current.placeAt('r2', 16, 18)
    })
    expect(placed).toBe(false)
    expect(result.current.itemVertices('room', 'r2')).toBeNull()
    // An open spot is fine.
    expect(result.current.canPlaceAt('r2', 60, 30)).toBe(true)
  })

  it('keeps stairs/elevators independent — will not merge them into a hall', () => {
    // A stairwell butts flush against a hall (shares a full edge), but circulation
    // nodes must stay their own shape so route-mapping can locate them.
    const floor = makeFloor()
    floor.decorations = [
      { id: 'h1', kind: 'hall', vertices: rectVertices(0, 0, 40, 6), label: null },
      { id: 's1', kind: 'stairs', vertices: rectVertices(0, 6, 8, 10), label: null },
    ]
    const { result } = renderHook(() => useFloorEditor(floor))
    let survivor: string | null = 'unset'
    act(() => {
      result.current.beginChange()
      survivor = result.current.mergeDecorations(['h1', 's1'])
    })
    expect(survivor).toBeNull()
    // Both shapes survive, untouched.
    expect(result.current.decorations).toHaveLength(2)
    expect(result.current.decorations.map((d) => d.kind).sort()).toEqual([
      'hall',
      'stairs',
    ])
  })

  it('deletes an edge, dropping one side and rejoining the neighbours', () => {
    const floor = makeFloor()
    const { result } = renderHook(() => useFloorEditor(floor))
    // r1 starts as a 12×16 rectangle (4 sides). Delete one edge → a triangle.
    act(() => {
      result.current.beginChange()
      result.current.deleteEdge('room', 'r1', 0)
    })
    expect(result.current.itemVertices('room', 'r1')).toHaveLength(3)
  })

  it('will not delete an edge below a triangle', () => {
    const floor = makeFloor()
    floor.decorations = [
      { id: 'd1', kind: 'lobby', vertices: [[0, 0], [10, 0], [5, 8]], label: null },
    ]
    const { result } = renderHook(() => useFloorEditor(floor))
    act(() => {
      result.current.beginChange()
      result.current.deleteEdge('deco', 'd1', 0)
    })
    expect(result.current.decorations[0].vertices).toHaveLength(3)
  })
})
