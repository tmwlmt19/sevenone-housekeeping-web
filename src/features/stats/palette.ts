// Categorical chart colors. The eight validated slots live in index.css as
// --chart-1..8 (light + dark). Slots are assigned in fixed order and never
// cycled past eight — a 9th category folds into "Other" (see foldToOther).

export const CHART_SLOTS = 8

/** The CSS-var color for a categorical slot (0-based). Resolves per theme. */
export function chartColor(index: number): string {
  return `var(--chart-${(index % CHART_SLOTS) + 1})`
}

export interface Slice {
  name: string
  value: number
}

/** Cap a set of pie slices at `max`, summing the smallest remainder into a
 * single "Other" slice, so the pie never needs a 9th categorical hue. */
export function foldToOther(
  slices: Slice[],
  otherLabel: string,
  max = CHART_SLOTS,
): Slice[] {
  const nonZero = slices.filter((s) => s.value > 0)
  if (nonZero.length <= max) return nonZero
  const sorted = [...nonZero].sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, max - 1)
  const otherValue = sorted
    .slice(max - 1)
    .reduce((sum, s) => sum + s.value, 0)
  return otherValue > 0 ? [...head, { name: otherLabel, value: otherValue }] : head
}
