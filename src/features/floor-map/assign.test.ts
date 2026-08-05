import { describe, expect, it } from 'vitest'

import type { MapRoom } from '@/lib/api/types'

import { autoClusterRooms, zonesToAssignments } from './assign'

/** Minimal placed room; x/y position it, w/h default to a small footprint. */
function room(
  id: string,
  number: string,
  x: number,
  y: number,
  placed = true,
): MapRoom {
  return {
    id,
    room_number: number,
    room_type: null,
    status: 'dirty',
    has_open_task: false,
    placement: placed ? { x, y, w: 10, h: 10, rotation: 0 } : null,
  }
}

describe('zonesToAssignments', () => {
  const rooms = [room('r1', '101', 0, 0), room('r2', '102', 20, 0), room('r3', '103', 40, 0)]

  it('emits only assigned rooms, mapping id → room_number', () => {
    const out = zonesToAssignments({ r1: 'ann', r3: 'bob' }, rooms)
    expect(out).toEqual([
      { room_number: '101', housekeeper_id: 'ann' },
      { room_number: '103', housekeeper_id: 'bob' },
    ])
  })

  it('follows room order, not zone-insertion order', () => {
    const out = zonesToAssignments({ r3: 'bob', r1: 'ann', r2: 'ann' }, rooms)
    expect(out.map((a) => a.room_number)).toEqual(['101', '102', '103'])
  })

  it('ignores assignments for rooms not in the list', () => {
    expect(zonesToAssignments({ ghost: 'ann' }, rooms)).toEqual([])
  })

  it('returns empty for an empty zone map', () => {
    expect(zonesToAssignments({}, rooms)).toEqual([])
  })
})

describe('autoClusterRooms', () => {
  it('returns empty with no housekeepers or no placed rooms', () => {
    expect(autoClusterRooms([room('r1', '101', 0, 0)], [])).toEqual({})
    expect(autoClusterRooms([], ['ann'])).toEqual({})
    expect(autoClusterRooms([room('r1', '101', 0, 0, false)], ['ann'])).toEqual({})
  })

  it('gives every room to a single housekeeper', () => {
    const rooms = [room('r1', '101', 0, 0), room('r2', '102', 50, 0)]
    expect(autoClusterRooms(rooms, ['ann'])).toEqual({ r1: 'ann', r2: 'ann' })
  })

  it('splits a horizontal corridor into left/right bands by x', () => {
    // Four rooms in a row; sweep is along x (wider spread), even 2/2 split.
    const rooms = [
      room('r1', '101', 0, 0),
      room('r2', '102', 10, 0),
      room('r3', '103', 60, 0),
      room('r4', '104', 70, 0),
    ]
    const zones = autoClusterRooms(rooms, ['ann', 'bob'])
    expect(zones).toEqual({ r1: 'ann', r2: 'ann', r3: 'bob', r4: 'bob' })
  })

  it('sweeps along the wider axis (vertical spread → top/bottom bands)', () => {
    const rooms = [
      room('r1', '101', 0, 0),
      room('r2', '102', 0, 10),
      room('r3', '103', 0, 60),
      room('r4', '104', 0, 70),
    ]
    const zones = autoClusterRooms(rooms, ['ann', 'bob'])
    expect(zones).toEqual({ r1: 'ann', r2: 'ann', r3: 'bob', r4: 'bob' })
  })

  it('balances counts, earlier housekeepers taking the remainder', () => {
    const rooms = [
      room('r1', '101', 0, 0),
      room('r2', '102', 10, 0),
      room('r3', '103', 20, 0),
      room('r4', '104', 30, 0),
      room('r5', '105', 40, 0),
    ]
    const zones = autoClusterRooms(rooms, ['ann', 'bob'])
    const counts = ['ann', 'bob'].map(
      (hk) => Object.values(zones).filter((v) => v === hk).length,
    )
    expect(counts).toEqual([3, 2])
    // Every room assigned exactly once.
    expect(Object.keys(zones).length).toBe(5)
  })

  it('ignores unplaced rooms in the split', () => {
    const rooms = [
      room('r1', '101', 0, 0),
      room('r2', '102', 60, 0),
      room('ru', '999', 0, 0, false),
    ]
    const zones = autoClusterRooms(rooms, ['ann', 'bob'])
    expect(zones.ru).toBeUndefined()
    expect(Object.keys(zones).sort()).toEqual(['r1', 'r2'])
  })
})
