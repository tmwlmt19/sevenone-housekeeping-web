import { describe, expect, it } from 'vitest'

import { presetRange } from './date-range'

// 2026-08-07 in local time (month index 7 = August).
const TODAY = new Date(2026, 7, 7)

describe('presetRange', () => {
  it('today is a single day', () => {
    expect(presetRange('today', TODAY)).toEqual({
      from: '2026-08-07',
      to: '2026-08-07',
    })
  })
  it('7d is an inclusive 7-day window', () => {
    expect(presetRange('7d', TODAY)).toEqual({
      from: '2026-08-01',
      to: '2026-08-07',
    })
  })
  it('30d is an inclusive 30-day window across a month boundary', () => {
    expect(presetRange('30d', TODAY)).toEqual({
      from: '2026-07-09',
      to: '2026-08-07',
    })
  })
  it('custom yields an empty range for the caller to fill', () => {
    expect(presetRange('custom', TODAY)).toEqual({})
  })
})
