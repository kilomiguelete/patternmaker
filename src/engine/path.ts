import { segments } from './geometry'
import type { Contour, Point } from './types'

const f = (n: number) => (Math.abs(n) < 1e-4 ? '0' : n.toFixed(3).replace(/\.?0+$/, ''))

export function contourToPath(contour: Contour): string {
  const segs = segments(contour)
  if (!contour.nodes.length) return ''
  const start = contour.nodes[0].p
  let d = `M ${f(start.x)} ${f(start.y)}`
  for (const s of segs) {
    if (s.straight) d += ` L ${f(s.b.x)} ${f(s.b.y)}`
    else d += ` C ${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.b.x)} ${f(s.b.y)}`
  }
  if (contour.closed) d += ' Z'
  return d
}

export function polylineToPath(points: Point[], closed = true): string {
  if (!points.length) return ''
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`
  for (let i = 1; i < points.length; i++) d += ` L ${f(points[i].x)} ${f(points[i].y)}`
  if (closed) d += ' Z'
  return d
}
