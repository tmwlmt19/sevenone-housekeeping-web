export function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Map a pointer position to SVG user space (feet) via the element's CTM, which
 *  accounts for the viewBox scale and any letterboxing from preserveAspectRatio. */
export function pointerToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: point.x, y: point.y }
}
