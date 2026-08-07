import { describe, expect, it } from 'vitest'

import { chartColor, foldToOther } from './palette'

describe('chartColor', () => {
  it('maps 0-based slots to the 1-based CSS vars', () => {
    expect(chartColor(0)).toBe('var(--chart-1)')
    expect(chartColor(7)).toBe('var(--chart-8)')
  })
  it('wraps around after eight slots', () => {
    expect(chartColor(8)).toBe('var(--chart-1)')
  })
})

describe('foldToOther', () => {
  it('drops zero-value slices and keeps small sets', () => {
    expect(
      foldToOther(
        [
          { name: 'a', value: 3 },
          { name: 'b', value: 0 },
        ],
        'Other',
      ),
    ).toEqual([{ name: 'a', value: 3 }])
  })

  it('folds everything past the cap into a single Other slice', () => {
    const slices = Array.from({ length: 10 }, (_, i) => ({
      name: `hk${i}`,
      value: 10 - i, // 10, 9, … 1
    }))
    const out = foldToOther(slices, 'Other', 8)
    expect(out).toHaveLength(8)
    // Smallest three (3 + 2 + 1) roll into Other.
    expect(out[7]).toEqual({ name: 'Other', value: 6 })
  })
})
