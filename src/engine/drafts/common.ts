import {
  add,
  mul,
  norm,
  pathLengthBetween,
  pt,
  smooth,
  sub,
} from '../geometry'
import type { Contour, Dimension, Guide, Node, Piece, Point } from '../types'

export type M = Record<string, number>

export const v = (m: M, key: string, fallback = 0): number =>
  Number.isFinite(m[key]) ? m[key] : fallback

// ------------------------------------------------------------ cuerpo

export type BodyPanelInput = {
  side: 'front' | 'back'
  bodyLength: number
  chestWidth: number
  hemWidth: number
  shoulderWidth: number
  shoulderSlope: number
  armholeDepth: number
  neckWidth: number
  neckDrop: number
  /** Curvatura del bajo: cuanto baja el centro respecto al costado. */
  hemCurve?: number
}

export type BodyPanel = {
  outline: Contour
  /** Indice del nodo donde empieza la sisa. */
  armholeStart: number
  armholeEnd: number
  armholeLength: number
  necklineLength: number
  points: {
    cfNeck: Point
    hps: Point
    sp: Point
    underarm: Point
    sideHem: Point
    cfHem: Point
  }
}

/**
 * Media pieza de cuerpo (delantero o espalda) con el centro sobre doblez
 * en x = 0. Las curvas de escote y sisa se construyen con tangentes
 * perpendiculares al doblez y al hombro, como en patronaje plano.
 */
export function buildBodyPanel(i: BodyPanelInput): BodyPanel {
  const halfNeck = i.neckWidth / 2
  const halfShoulder = i.shoulderWidth / 2
  const halfChest = i.chestWidth / 2
  const halfHem = i.hemWidth / 2
  const hemCurve = i.hemCurve ?? 0

  const cfNeck = pt(0, i.neckDrop)
  const hps = pt(halfNeck, 0)
  const sp = pt(halfShoulder, i.shoulderSlope)
  const underarm = pt(halfChest, i.armholeDepth)
  const sideHem = pt(halfHem, i.bodyLength - hemCurve)
  const cfHem = pt(0, i.bodyLength)

  // Escote: horizontal en el centro, entrada inclinada en el HPS.
  const neckChord = Math.hypot(halfNeck, i.neckDrop)
  const neckOut = pt(neckChord * 0.62, 0)
  const neckIn = mul(norm(pt(-halfNeck, i.neckDrop * 1.9)), neckChord * 0.46)

  // Sisa: sale perpendicular al hombro y llega vertical al fondo de sisa.
  const shoulderDir = norm(sub(sp, hps))
  const ahChord = Math.hypot(underarm.x - sp.x, underarm.y - sp.y)
  const scoop = i.side === 'front' ? 0.52 : 0.44
  const ahOut = mul(norm(pt(-shoulderDir.y, shoulderDir.x)), ahChord * scoop)
  const ahIn = pt(0, -ahChord * (i.side === 'front' ? 0.42 : 0.46))

  const nodes: Node[] = [
    { p: cfNeck, out: neckOut, label: i.side === 'front' ? 'CD escote' : 'CE escote' },
    { p: hps, in: neckIn, label: 'HPS' },
    { p: sp, out: ahOut, label: 'Punta hombro' },
    { p: underarm, in: ahIn, label: 'Fondo sisa' },
    { p: sideHem, label: 'Costado bajo' },
    { p: cfHem, ...(hemCurve > 0 ? { in: pt(halfHem * 0.4, 0) } : {}), label: 'Centro bajo' },
  ]

  const outline: Contour = { nodes, closed: true, kind: 'cut' }

  return {
    outline,
    armholeStart: 2,
    armholeEnd: 3,
    armholeLength: pathLengthBetween(outline, 2, 3),
    necklineLength: pathLengthBetween(outline, 0, 1),
    points: { cfNeck, hps, sp, underarm, sideHem, cfHem },
  }
}

// ------------------------------------------------------------ manga

export type SleeveInput = {
  /** Largo de sisa del delantero (media pieza). */
  frontArmhole: number
  /** Largo de sisa de la espalda (media pieza). */
  backArmhole: number
  /** Largo de manga desde la punta del hombro. */
  sleeveLength: number
  /** Medio ancho de biceps. */
  bicep: number
  /** Medio ancho de boca de manga. */
  opening: number
  /** Embebido en %. */
  ease: number
}

export type SleeveResult = {
  outline: Contour
  capHeight: number
  capLength: number
  targetLength: number
  underarmSeam: number
}

/** Un lado de la copa de manga: del alto de copa al fondo de sisa. */
function capSide(w: number, h: number, bulge: number, hollow: number): Node[] {
  const top = pt(0, 0)
  const under = pt(w, h)
  const diag = sub(under, top)
  const diagLen = Math.hypot(diag.x, diag.y) || 1
  const outward = mul(pt(diag.y, -diag.x), 1 / diagLen)

  const along = (t: number, off: number): Point =>
    add(add(top, mul(diag, t)), mul(outward, off * diagLen))

  const p1 = along(0.3, bulge)
  const p2 = along(0.58, bulge * 0.45)
  const p3 = along(0.84, -hollow)

  const seq = [top, p1, p2, p3, under]
  const nodes: Node[] = []
  for (let k = 0; k < seq.length; k++) {
    if (k === 0) {
      nodes.push({ p: top, out: pt(w * 0.4, 0), label: 'Alto de copa' })
    } else if (k === seq.length - 1) {
      nodes.push({ p: under, in: mul(norm(sub(p3, under)), diagLen * 0.18), label: 'Fondo sisa' })
    } else {
      nodes.push(smooth(seq[k], seq[k - 1], seq[k + 1], 0.42))
    }
  }
  return nodes
}

function buildSleeveOutline(
  i: SleeveInput,
  capHeight: number,
): { outline: Contour; capLength: number } {
  const front = capSide(i.bicep, capHeight, 0.062, 0.055)
  const back = capSide(i.bicep, capHeight, 0.05, 0.072)

  // Lado delantero (x > 0) y lado espalda espejado (x < 0).
  const frontNodes = front.slice(1) // sin el nodo superior, se anade una vez
  const backNodes: Node[] = back
    .slice(1)
    .map((nd) => ({
      p: pt(-nd.p.x, nd.p.y),
      in: nd.out ? pt(-nd.out.x, nd.out.y) : undefined,
      out: nd.in ? pt(-nd.in.x, nd.in.y) : undefined,
      label: nd.label,
    }))
    .reverse()

  const top: Node = { p: pt(0, 0), in: pt(-i.bicep * 0.4, 0), out: pt(i.bicep * 0.4, 0), label: 'Alto de copa' }

  const nodes: Node[] = [
    top,
    ...frontNodes,
    { p: pt(i.opening, i.sleeveLength), label: 'Boca manga del.' },
    { p: pt(-i.opening, i.sleeveLength), label: 'Boca manga esp.' },
    ...backNodes,
  ]

  const outline: Contour = { nodes, closed: true, kind: 'cut' }
  // Tramos: [0..F) copa delantera, [F..F+2) costura bajo manga + boca,
  // [F+3..n) copa de espalda.
  const F = frontNodes.length
  const frontCapLen = pathLengthBetween(outline, 0, F)
  const backCapLen = pathLengthBetween(outline, F + 3, nodes.length)
  return { outline, capLength: frontCapLen + backCapLen }
}

/**
 * Manga montada cuya copa se ajusta por biseccion al largo de sisa mas el
 * embebido indicado. Devuelve el alto de copa resultante.
 */
export function buildSleeve(i: SleeveInput): SleeveResult {
  const armhole = i.frontArmhole + i.backArmhole
  const target = armhole * (1 + i.ease / 100)

  let lo = Math.max(20, i.bicep * 0.25)
  let hi = Math.max(lo + 10, i.bicep * 2.2)
  let best = buildSleeveOutline(i, (lo + hi) / 2)
  let height = (lo + hi) / 2

  for (let k = 0; k < 40; k++) {
    height = (lo + hi) / 2
    best = buildSleeveOutline(i, height)
    if (Math.abs(best.capLength - target) < 0.1) break
    if (best.capLength < target) lo = height
    else hi = height
  }

  const underarmSeam = Math.hypot(i.bicep - i.opening, i.sleeveLength - height)

  return {
    outline: best.outline,
    capHeight: height,
    capLength: best.capLength,
    targetLength: target,
    underarmSeam,
  }
}

// ------------------------------------------------------------ piezas simples

export function rectOutline(w: number, h: number, x = 0, y = 0): Contour {
  return {
    nodes: [
      { p: pt(x, y) },
      { p: pt(x + w, y) },
      { p: pt(x + w, y + h) },
      { p: pt(x, y + h) },
    ],
    closed: true,
    kind: 'cut',
  }
}

export function rectPiece(opts: {
  id: string
  name: string
  w: number
  h: number
  cutCount: number
  seamAllowance: number
  grain?: 'vertical' | 'horizontal'
  onFold?: boolean
  notes?: string[]
  guides?: Guide[]
}): Piece {
  const dims: Dimension[] = [
    { id: `${opts.id}-w`, from: pt(0, 0), to: pt(opts.w, 0), label: 'ancho', offset: -14 },
    { id: `${opts.id}-h`, from: pt(opts.w, 0), to: pt(opts.w, opts.h), label: 'alto', offset: -14 },
  ]
  return {
    id: opts.id,
    name: opts.name,
    outline: rectOutline(opts.w, opts.h),
    cutCount: opts.cutCount,
    onFold: opts.onFold ?? false,
    grain: opts.grain ?? 'horizontal',
    seamAllowance: opts.seamAllowance,
    dimensions: dims,
    notes: opts.notes,
    guides: opts.guides,
  }
}

/** Cota vertical sobre el centro de una pieza. */
export function vDim(id: string, x: number, y0: number, y1: number, label: string, offset = -16): Dimension {
  return { id, from: pt(x, y0), to: pt(x, y1), label, offset }
}

export function hDim(id: string, y: number, x0: number, x1: number, label: string, offset = -16): Dimension {
  return { id, from: pt(x0, y), to: pt(x1, y), label, offset }
}
