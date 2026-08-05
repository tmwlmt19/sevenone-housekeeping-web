// Per-housekeeper colors for the assignment map: a swatch for the palette chip
// and matching SVG fill/stroke for that housekeeper's rooms. Distinct hues,
// theme-aware (light + dark), and kept off the status palette's greens/ambers so
// zones don't read as a room status. Assigned by housekeeper order; wraps past 8.
export interface ZoneColor {
  swatch: string
  fill: string
  stroke: string
}

export const ZONE_COLORS: ZoneColor[] = [
  { swatch: 'bg-rose-500', fill: 'fill-rose-300 dark:fill-rose-500/50', stroke: 'stroke-rose-500' },
  { swatch: 'bg-sky-500', fill: 'fill-sky-300 dark:fill-sky-500/50', stroke: 'stroke-sky-500' },
  { swatch: 'bg-violet-500', fill: 'fill-violet-300 dark:fill-violet-500/50', stroke: 'stroke-violet-500' },
  { swatch: 'bg-orange-500', fill: 'fill-orange-300 dark:fill-orange-500/50', stroke: 'stroke-orange-500' },
  { swatch: 'bg-teal-500', fill: 'fill-teal-300 dark:fill-teal-500/50', stroke: 'stroke-teal-500' },
  { swatch: 'bg-fuchsia-500', fill: 'fill-fuchsia-300 dark:fill-fuchsia-500/50', stroke: 'stroke-fuchsia-500' },
  { swatch: 'bg-indigo-500', fill: 'fill-indigo-300 dark:fill-indigo-500/50', stroke: 'stroke-indigo-500' },
  { swatch: 'bg-cyan-500', fill: 'fill-cyan-300 dark:fill-cyan-500/50', stroke: 'stroke-cyan-500' },
]

export function zoneColor(index: number): ZoneColor {
  return ZONE_COLORS[((index % ZONE_COLORS.length) + ZONE_COLORS.length) % ZONE_COLORS.length]
}
