import { describe, expect, it } from 'vitest'

import { evenSplit, parseDirtyRoomsCsv } from './dirty-rooms'

function csvFile(text: string): File {
  return new File([text], 'rooms.csv', { type: 'text/csv' })
}

describe('parseDirtyRoomsCsv', () => {
  it('parses a headered file', async () => {
    const rooms = await parseDirtyRoomsCsv(
      csvFile('room_number\n101\n102\n203\n'),
    )
    expect(rooms).toEqual(['101', '102', '203'])
  })

  it('accepts header aliases and ignores extra columns', async () => {
    const rooms = await parseDirtyRoomsCsv(
      csvFile('Room,Floor\n101,1\n102,2\n'),
    )
    expect(rooms).toEqual(['101', '102'])
  })

  it('treats a header-less file as a bare list', async () => {
    const rooms = await parseDirtyRoomsCsv(csvFile('101\n102\n103\n'))
    expect(rooms).toEqual(['101', '102', '103'])
  })

  it('trims, drops blanks, and de-duplicates preserving order', async () => {
    const rooms = await parseDirtyRoomsCsv(
      csvFile('room_number\n 101 \n\n102\n101\n'),
    )
    expect(rooms).toEqual(['101', '102'])
  })

  it('returns an empty list for an empty file', async () => {
    const rooms = await parseDirtyRoomsCsv(csvFile(''))
    expect(rooms).toEqual([])
  })
})

describe('evenSplit', () => {
  it('splits evenly with a remainder, largest first', () => {
    expect(evenSplit(5, 2)).toEqual([3, 2])
    expect(evenSplit(7, 3)).toEqual([3, 2, 2])
  })

  it('splits exactly when divisible', () => {
    expect(evenSplit(4, 2)).toEqual([2, 2])
  })

  it('handles zero items', () => {
    expect(evenSplit(0, 3)).toEqual([0, 0, 0])
  })

  it('returns empty when there are no buckets', () => {
    expect(evenSplit(5, 0)).toEqual([])
  })

  it('never differs by more than one', () => {
    const sizes = evenSplit(10, 3)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(10)
  })
})
