import { dist, mul, norm, perp, pt, sub } from './geometry'
import type { Point } from './types'

export type DimGeometry = {
  /** Linea de cota desplazada. */
  a: Point
  b: Point
  /** Lineas de referencia desde el punto medido hasta la cota. */
  leaderA: [Point, Point]
  leaderB: [Point, Point]
  /** Posicion y giro del texto. */
  text: Point
  angle: number
  length: number
}

export function dimGeometry(from: Point, to: Point, offset = 0): DimGeometry {
  const d = norm(sub(to, from))
  const n = mul(perp(d), offset)
  const a = { x: from.x + n.x, y: from.y + n.y }
  const b = { x: to.x + n.x, y: to.y + n.y }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  if (angle > 90) angle -= 180
  if (angle < -90) angle += 180
  const lift = mul(perp(d), offset >= 0 ? 7 : -7)
  return {
    a,
    b,
    leaderA: [from, a],
    leaderB: [to, b],
    text: { x: mid.x + lift.x, y: mid.y + lift.y },
    angle,
    length: dist(from, to),
  }
}

/** Marca de hilo: flecha doble centrada en la caja de la pieza. */
export function grainline(
  box: { min: Point; max: Point; w: number; h: number },
  direction: 'vertical' | 'horizontal' | 'bias',
): { a: Point; b: Point } {
  const cx = (box.min.x + box.max.x) / 2
  const cy = (box.min.y + box.max.y) / 2
  if (direction === 'horizontal') {
    const l = Math.min(box.w * 0.45, 110)
    return { a: pt(cx - l, cy), b: pt(cx + l, cy) }
  }
  if (direction === 'bias') {
    const l = Math.min(box.w, box.h) * 0.3
    return { a: pt(cx - l, cy - l), b: pt(cx + l, cy + l) }
  }
  const l = Math.min(box.h * 0.35, 130)
  return { a: pt(cx, cy - l), b: pt(cx, cy + l) }
}
