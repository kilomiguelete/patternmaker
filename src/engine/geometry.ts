import type { Contour, Node, Point } from './types'

export const pt = (x: number, y: number): Point => ({ x, y })
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
export const len = (a: Point): number => Math.hypot(a.x, a.y)
export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

export function norm(a: Point): Point {
  const l = len(a)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

/** Rota 90 grados en sentido antihorario (en pantalla, con y hacia abajo). */
export const perp = (a: Point): Point => ({ x: a.y, y: -a.x })

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// ---------------------------------------------------------------- bezier

export type Segment = { a: Point; c1: Point; c2: Point; b: Point; straight: boolean }

/** Construye los segmentos cubicos de un contorno a partir de sus nodos. */
export function segments(contour: Contour): Segment[] {
  const { nodes, closed } = contour
  const out: Segment[] = []
  const last = closed ? nodes.length : nodes.length - 1
  for (let i = 0; i < last; i++) {
    const n0 = nodes[i]
    const n1 = nodes[(i + 1) % nodes.length]
    const h0 = n0.out
    const h1 = n1.in
    const straight = !h0 && !h1
    out.push({
      a: n0.p,
      c1: h0 ? add(n0.p, h0) : lerp(n0.p, n1.p, 1 / 3),
      c2: h1 ? add(n1.p, h1) : lerp(n0.p, n1.p, 2 / 3),
      b: n1.p,
      straight,
    })
  }
  return out
}

export function cubicAt(s: Segment, t: number): Point {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * s.a.x + w1 * s.c1.x + w2 * s.c2.x + w3 * s.b.x,
    y: w0 * s.a.y + w1 * s.c1.y + w2 * s.c2.y + w3 * s.b.y,
  }
}

export function cubicTangent(s: Segment, t: number): Point {
  const u = 1 - t
  const d = {
    x: 3 * u * u * (s.c1.x - s.a.x) + 6 * u * t * (s.c2.x - s.c1.x) + 3 * t * t * (s.b.x - s.c2.x),
    y: 3 * u * u * (s.c1.y - s.a.y) + 6 * u * t * (s.c2.y - s.c1.y) + 3 * t * t * (s.b.y - s.c2.y),
  }
  return len(d) < 1e-9 ? norm(sub(s.b, s.a)) : norm(d)
}

export function segmentLength(s: Segment, steps = 48): number {
  if (s.straight) return dist(s.a, s.b)
  let total = 0
  let prev = s.a
  for (let i = 1; i <= steps; i++) {
    const p = cubicAt(s, i / steps)
    total += dist(prev, p)
    prev = p
  }
  return total
}

/** Longitud de un tramo concreto del contorno (del nodo i al i+1). */
export function edgeLength(contour: Contour, i: number): number {
  const segs = segments(contour)
  return segs[i] ? segmentLength(segs[i]) : 0
}

export function contourLength(contour: Contour): number {
  return segments(contour).reduce((acc, s) => acc + segmentLength(s), 0)
}

/** Longitud de un recorrido parcial: del nodo `from` al nodo `to` (inclusive). */
export function pathLengthBetween(contour: Contour, from: number, to: number): number {
  const segs = segments(contour)
  let total = 0
  for (let i = from; i < to; i++) total += segmentLength(segs[i])
  return total
}

// ---------------------------------------------------------------- poligonos

export function flattenContour(contour: Contour, tolerance = 0.4): Point[] {
  const segs = segments(contour)
  const points: Point[] = []
  for (const s of segs) {
    const steps = s.straight ? 1 : Math.max(6, Math.ceil(segmentLength(s) / Math.max(tolerance, 0.05)))
    for (let i = 0; i < steps; i++) points.push(cubicAt(s, i / steps))
  }
  if (!contour.closed) points.push(segs.length ? segs[segs.length - 1].b : contour.nodes[0].p)
  return points
}

export function polygonArea(points: Point[]): number {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[(i + 1) % points.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

export function bbox(points: Point[]): { min: Point; max: Point; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (!points.length) return { min: pt(0, 0), max: pt(0, 0), w: 0, h: 0 }
  return { min: pt(minX, minY), max: pt(maxX, maxY), w: maxX - minX, h: maxY - minY }
}

/**
 * Offset de un poligono cerrado hacia fuera. Desplaza cada arista por su
 * normal y recorta las intersecciones; suficiente para margenes de costura
 * de 5-30 mm sobre contornos de prendas.
 */
export function offsetPolygon(points: Point[], offsets: number[]): Point[] {
  const n = points.length
  if (n < 3) return points
  // Con y hacia abajo, un contorno de area positiva (sentido horario en
  // pantalla) ya tiene su normal perp() apuntando hacia fuera.
  const outward = polygonArea(points) > 0 ? 1 : -1

  type Line = { p: Point; d: Point }
  const lines: Line[] = []
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const d = norm(sub(b, a))
    if (len(d) < 1e-9) {
      lines.push({ p: a, d: pt(1, 0) })
      continue
    }
    const nrm = mul(perp(d), outward)
    const off = offsets[i] ?? offsets[0] ?? 0
    lines.push({ p: add(a, mul(nrm, off)), d })
  }

  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const l0 = lines[(i - 1 + n) % n]
    const l1 = lines[i]
    const cross = l0.d.x * l1.d.y - l0.d.y * l1.d.x
    if (Math.abs(cross) < 1e-6) {
      out.push(l1.p)
      continue
    }
    const diff = sub(l1.p, l0.p)
    const t = (diff.x * l1.d.y - diff.y * l1.d.x) / cross
    const hit = add(l0.p, mul(l0.d, t))
    // Limita picos en esquinas muy agudas.
    const maxOff = Math.max(offsets[i] ?? 0, offsets[(i - 1 + n) % n] ?? 0)
    if (dist(hit, points[i]) > maxOff * 4 + 1) {
      out.push(l0.p, l1.p)
    } else {
      out.push(hit)
    }
  }
  return out
}

// ---------------------------------------------------------------- helpers de patronaje

/** Nodo con tangentes simetricas calculadas desde dos puntos vecinos. */
export function smooth(p: Point, prev: Point, next: Point, tension = 0.35): Node {
  const d = mul(sub(next, prev), tension / 2)
  return { p, in: mul(d, -1), out: d }
}

/**
 * Curva de sisa/escote: nodo con tangente en una direccion dada y una
 * longitud proporcional a la cuerda.
 */
export function handle(dir: Point, chord: number, factor: number): Point {
  return mul(norm(dir), chord * factor)
}

/** Traslada todos los puntos de un contorno. */
export function translateContour(c: Contour, dx: number, dy: number): Contour {
  return {
    ...c,
    nodes: c.nodes.map((nd) => ({ ...nd, p: pt(nd.p.x + dx, nd.p.y + dy) })),
  }
}

/** Espeja un contorno respecto a x = axis, invirtiendo el orden de nodos. */
export function mirrorContour(c: Contour, axis = 0): Contour {
  const nodes: Node[] = c.nodes
    .map((nd) => ({
      p: pt(2 * axis - nd.p.x, nd.p.y),
      in: nd.in ? pt(-nd.in.x, nd.in.y) : undefined,
      out: nd.out ? pt(-nd.out.x, nd.out.y) : undefined,
      label: nd.label,
    }))
    .reverse()
    .map((nd) => ({ ...nd, in: nd.out, out: nd.in }))
  return { ...c, nodes }
}

/**
 * Aplana un contorno guardando, para cada punto, el indice del tramo
 * original del que proviene. Necesario para aplicar margenes de costura
 * distintos por tramo (dobladillos, cantos sobre doblez).
 */
export function flattenWithEdges(
  contour: Contour,
  tolerance = 0.5,
): { points: Point[]; edge: number[] } {
  const segs = segments(contour)
  const points: Point[] = []
  const edge: number[] = []
  segs.forEach((s, idx) => {
    const steps = s.straight
      ? 1
      : Math.max(8, Math.ceil(segmentLength(s) / Math.max(tolerance, 0.05)))
    for (let i = 0; i < steps; i++) {
      points.push(cubicAt(s, i / steps))
      edge.push(idx)
    }
  })
  return { points, edge }
}
