import { pt } from '../geometry'
import { polylineToPath } from '../path'
import type { GarmentKind } from '../measurements'
import type { Handle, Point } from '../types'

export type FlatPart = {
  id: string
  d: string
  kind: 'body' | 'detail' | 'stitch' | 'rib'
}

export type FlatDim = {
  id: string
  from: Point
  to: Point
  label: string
  offset?: number
}

export type FlatDrawing = {
  parts: FlatPart[]
  dims: FlatDim[]
  /** Vertices arrastrables sobre el dibujo de la prenda. */
  handles: Handle[]
  box: { x: number; y: number; w: number; h: number }
}

type M = Record<string, number>
const g = (m: M, k: string, d = 0) => (Number.isFinite(m[k]) ? m[k] : d)

function path(points: Point[], closed = true): string {
  return polylineToPath(points, closed)
}

/** Medio escote como cuarto de elipse, del centro al HPS. */
function halfNeck(width: number, drop: number, steps = 14): Point[] {
  const out: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2)
    out.push(pt(width * Math.sin(t), drop * Math.cos(t)))
  }
  return out
}

/** Sisa del croquis: curva suave del hombro al fondo de sisa. */
function halfArmhole(sp: Point, underarm: Point, steps = 10): Point[] {
  const out: Point[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    out.push(
      pt(
        sp.x + (underarm.x - sp.x) * Math.sin((t * Math.PI) / 2),
        sp.y + (underarm.y - sp.y) * (1 - Math.cos((t * Math.PI) / 2)),
      ),
    )
  }
  return out
}

/** Contorno de medio cuerpo, de centro escote a centro bajo. */
function halfBody(m: M, neckDrop: number, length: number): Point[] {
  const nw = g(m, 'neckWidth') / 2
  const sw = g(m, 'shoulderWidth') / 2
  const cw = g(m, 'chestWidth') / 2
  const hw = g(m, 'hemWidth') / 2
  const sp = pt(sw, g(m, 'shoulderSlope'))
  const underarm = pt(cw, g(m, 'armholeDepth'))
  return [
    ...halfNeck(nw, neckDrop),
    sp,
    ...halfArmhole(sp, underarm),
    pt(hw, length),
    pt(0, length),
  ]
}

function mirrorX(points: Point[]): Point[] {
  return points.map((p) => pt(-p.x, p.y))
}

/**
 * Manga del croquis: del hombro hacia fuera y abajo, con el ancho en plano
 * (medio contorno) medido perpendicular al eje de la manga.
 */
const SLEEVE_ANGLE = 38

function sleeveQuad(m: M, length: number, openingFlat: number, angle = SLEEVE_ANGLE): Point[] {
  const sw = g(m, 'shoulderWidth') / 2
  const cw = g(m, 'chestWidth') / 2
  const sp = pt(sw, g(m, 'shoulderSlope'))
  const underarm = pt(cw, g(m, 'armholeDepth'))
  const rad = (angle * Math.PI) / 180
  const dir = pt(Math.cos(rad), Math.sin(rad))
  const normal = pt(-dir.y, dir.x)
  const endTop = pt(sp.x + dir.x * length, sp.y + dir.y * length)
  const endBottom = pt(endTop.x + normal.x * openingFlat, endTop.y + normal.y * openingFlat)
  return [sp, endTop, endBottom, underarm]
}

/** Puno o bocamanga: banda de alto `h` al final de la manga. */
function cuffQuad(quad: Point[], h: number, angle = SLEEVE_ANGLE): Point[] {
  const rad = (angle * Math.PI) / 180
  const dir = pt(Math.cos(rad) * h, Math.sin(rad) * h)
  const [, endTop, endBottom] = quad
  return [
    endTop,
    pt(endTop.x + dir.x, endTop.y + dir.y),
    pt(endBottom.x + dir.x, endBottom.y + dir.y),
    endBottom,
  ]
}

function topFlat(m: M, kind: 'tee' | 'hoodie'): FlatDrawing {
  const isHoodie = kind === 'hoodie'
  const ribH = isHoodie ? g(m, 'ribHeight', 60) : 0
  const cuffH = isHoodie ? g(m, 'cuffHeight', 70) : 0
  const length = g(m, 'bodyLength')
  const panelLength = length - ribH

  const half = halfBody(m, g(m, 'frontNeckDrop'), panelLength)
  const body = [...mirrorX([...half].reverse()), ...half]

  const sleeveLen = Math.max(40, g(m, 'sleeveLength') - cuffH)
  const opening = g(m, 'sleeveOpening')
  const rightSleeve = sleeveQuad(m, sleeveLen, opening)
  const leftSleeve = mirrorX(rightSleeve)

  const parts: FlatPart[] = [
    { id: 'body', d: path(body), kind: 'body' },
    { id: 'sleeve-r', d: path(rightSleeve), kind: 'body' },
    { id: 'sleeve-l', d: path(leftSleeve), kind: 'body' },
  ]

  // Escote / cuello
  const nw = g(m, 'neckWidth') / 2
  const drop = g(m, 'frontNeckDrop')
  const halfN = halfNeck(nw, drop)
  const neckLine = [...mirrorX([...halfN].reverse()), ...halfN]
  if (isHoodie) {
    const hh = g(m, 'hoodHeight')
    const hw = g(m, 'hoodWidth')
    parts.push({
      id: 'hood',
      d: path(
        [
          pt(-nw, 0),
          pt(-nw - hw * 0.1, -hh * 0.45),
          pt(-nw * 0.35, -hh * 0.78),
          pt(nw * 0.35, -hh * 0.78),
          pt(nw + hw * 0.1, -hh * 0.45),
          pt(nw, 0),
        ],
        false,
      ),
      kind: 'body',
    })
    parts.push({ id: 'neck', d: path(neckLine, false), kind: 'detail' })
    const pw = g(m, 'pocketWidth') / 2
    const ph = g(m, 'pocketHeight')
    if (pw > 0 && ph > 0) {
      const py = panelLength - 20
      parts.push({
        id: 'pocket',
        d: path([pt(-pw, py - ph * 0.54), pt(-pw * 0.7, py - ph), pt(pw * 0.7, py - ph), pt(pw, py - ph * 0.54), pt(pw, py), pt(-pw, py)]),
        kind: 'detail',
      })
    }
  } else {
    const ch = g(m, 'collarHeight', 20)
    parts.push({ id: 'neck', d: path(neckLine, false), kind: 'detail' })
    if (ch > 0) {
      const outer = [...mirrorX([...halfNeck(nw + ch, drop + ch)].reverse()), ...halfNeck(nw + ch, drop + ch)]
      parts.push({ id: 'collar', d: path([...neckLine, ...[...outer].reverse()]), kind: 'rib' })
    }
  }

  // Ribs / dobladillos
  const hw = g(m, 'hemWidth') / 2
  if (ribH > 0) {
    parts.push({ id: 'hem-rib', d: path([pt(-hw, panelLength), pt(hw, panelLength), pt(hw, length), pt(-hw, length)]), kind: 'rib' })
  } else {
    const ha = g(m, 'hemAllowance', 20)
    parts.push({ id: 'hem-stitch', d: path([pt(-hw, panelLength - ha), pt(hw, panelLength - ha)], false), kind: 'stitch' })
  }

  if (cuffH > 0) {
    parts.push({ id: 'cuff-r', d: path(cuffQuad(rightSleeve, cuffH)), kind: 'rib' })
    parts.push({ id: 'cuff-l', d: path(mirrorX(cuffQuad(rightSleeve, cuffH))), kind: 'rib' })
  } else {
    const sa = g(m, 'sleeveHemAllowance', 20)
    if (sa > 0) {
      const inner = cuffQuad(rightSleeve, -sa)
      parts.push({ id: 'sleeve-hem-r', d: path([inner[1], inner[2]], false), kind: 'stitch' })
      const innerL = mirrorX(inner)
      parts.push({ id: 'sleeve-hem-l', d: path([innerL[1], innerL[2]], false), kind: 'stitch' })
    }
  }

  const dims: FlatDim[] = [
    { id: 'd-len', from: pt(0, 0), to: pt(0, length), label: 'Largo total', offset: -(hw + 70) },
    { id: 'd-chest', from: pt(-g(m, 'chestWidth') / 2, g(m, 'armholeDepth') + 25), to: pt(g(m, 'chestWidth') / 2, g(m, 'armholeDepth') + 25), label: '1/2 pecho x2', offset: 0 },
    { id: 'd-hem', from: pt(-hw, length), to: pt(hw, length), label: 'Bajo', offset: 55 },
    { id: 'd-shoulder', from: pt(-g(m, 'shoulderWidth') / 2, g(m, 'shoulderSlope')), to: pt(g(m, 'shoulderWidth') / 2, g(m, 'shoulderSlope')), label: 'Hombros', offset: -45 },
  ]

  // El eje de la manga va inclinado, asi que su vertice mide sobre esa
  // direccion y su perpendicular en vez de sobre X e Y.
  const rad = (SLEEVE_ANGLE * Math.PI) / 180
  const axis = pt(Math.cos(rad), Math.sin(rad))
  const normal = pt(-axis.y, axis.x)
  const sp = pt(g(m, 'shoulderWidth') / 2, g(m, 'shoulderSlope'))
  const cuffCorner = rightSleeve[2]

  const handles: Handle[] = [
    { id: 'f-neck', label: 'Escote delantero', p: pt(0, drop), y: { key: 'frontNeckDrop', scale: 1 } },
    { id: 'f-hps', label: 'Ancho de cuello', p: pt(nw, 0), x: { key: 'neckWidth', scale: 2 } },
    {
      id: 'f-shoulder',
      label: 'Hombro',
      p: sp,
      x: { key: 'shoulderWidth', scale: 2 },
      y: { key: 'shoulderSlope', scale: 1 },
    },
    {
      id: 'f-underarm',
      label: 'Fondo de sisa',
      p: pt(g(m, 'chestWidth') / 2, g(m, 'armholeDepth')),
      x: { key: 'chestWidth', scale: 2 },
      y: { key: 'armholeDepth', scale: 1 },
    },
    {
      id: 'f-hem',
      label: 'Bajo',
      p: pt(hw, length),
      x: { key: 'hemWidth', scale: 2 },
      y: { key: 'bodyLength', scale: 1 },
    },
    {
      // La esquina de la bocamanga lleva largo (sobre el eje de la manga) y
      // ancho (sobre su perpendicular) en un solo gesto.
      id: 'f-sleeve',
      label: 'Manga',
      p: cuffCorner,
      x: {
        key: 'sleeveLength',
        scale: 1,
        offset: -(sp.x * axis.x + sp.y * axis.y) + cuffH,
        dir: axis,
      },
      y: {
        key: 'sleeveOpening',
        scale: 1,
        offset: -(sp.x * normal.x + sp.y * normal.y),
        dir: normal,
      },
    },
  ]

  if (isHoodie) {
    const hh = g(m, 'hoodHeight')
    handles.push({
      id: 'f-hood',
      label: 'Alto de capucha',
      p: pt(0, -hh * 0.78),
      y: { key: 'hoodHeight', scale: -1 / 0.78 },
    })
    const pw = g(m, 'pocketWidth') / 2
    const ph = g(m, 'pocketHeight')
    if (pw > 0 && ph > 0) {
      const py = panelLength - 20
      handles.push({
        id: 'f-pocket',
        label: 'Bolsillo canguro',
        p: pt(pw * 0.7, py - ph),
        x: { key: 'pocketWidth', scale: 1 / 0.35 },
        y: { key: 'pocketHeight', scale: -1, offset: py },
      })
    }
  }

  const reach = g(m, 'shoulderWidth') / 2 + sleeveLen + cuffH
  return {
    parts,
    dims,
    handles,
    box: {
      x: -reach - 110,
      y: (isHoodie ? -g(m, 'hoodHeight') : 0) - 70,
      w: (reach + 110) * 2,
      h: length + (isHoodie ? g(m, 'hoodHeight') : 0) + 160,
    },
  }
}

function pantsFlat(m: M): FlatDrawing {
  const ww = g(m, 'waistWidth')
  const hw = g(m, 'hipWidth')
  const rise = g(m, 'frontRise')
  const inseam = g(m, 'inseam')
  const hipLevel = Math.min(180, rise * 0.58)
  const kneeLevel = rise + inseam / 2
  const hemLevel = rise + inseam
  const kneeHalf = g(m, 'kneeWidth') / 2
  const hemHalf = g(m, 'hemWidth') / 2
  const legCenter = hw / 2

  const rightLeg: Point[] = [
    pt(0, 0),
    pt(ww, 0),
    pt(hw, hipLevel),
    pt(legCenter + kneeHalf, kneeLevel),
    pt(legCenter + hemHalf, hemLevel),
    pt(legCenter - hemHalf, hemLevel),
    pt(legCenter - kneeHalf, kneeLevel),
    pt(0, rise),
  ]
  const leftLeg = mirrorX(rightLeg)

  const parts: FlatPart[] = [
    { id: 'leg-r', d: path(rightLeg), kind: 'body' },
    { id: 'leg-l', d: path(leftLeg), kind: 'body' },
  ]

  const wbH = g(m, 'waistbandHeight', 40)
  if (wbH > 0) {
    parts.push({
      id: 'waistband',
      d: path([pt(-ww, 0), pt(ww, 0), pt(ww * 0.985, wbH), pt(-ww * 0.985, wbH)]),
      kind: 'rib',
    })
    parts.push({ id: 'drawcord', d: path([pt(-60, wbH * 0.6), pt(60, wbH * 0.6)], false), kind: 'stitch' })
  }
  const ha = g(m, 'hemAllowance', 25)
  if (ha > 0) {
    parts.push({ id: 'hem-r', d: path([pt(legCenter - hemHalf, hemLevel - ha), pt(legCenter + hemHalf, hemLevel - ha)], false), kind: 'stitch' })
    parts.push({ id: 'hem-l', d: path([pt(-legCenter + hemHalf, hemLevel - ha), pt(-legCenter - hemHalf, hemLevel - ha)], false), kind: 'stitch' })
  }
  const po = g(m, 'pocketOpening')
  if (po > 0) {
    parts.push({ id: 'pkt-r', d: path([pt(ww, 12), pt(hw - 18, po)], false), kind: 'detail' })
    parts.push({ id: 'pkt-l', d: path([pt(-ww, 12), pt(-hw + 18, po)], false), kind: 'detail' })
  }

  const dims: FlatDim[] = [
    { id: 'd-waist', from: pt(-ww, 0), to: pt(ww, 0), label: 'Cintura', offset: -50 },
    { id: 'd-hip', from: pt(-hw, hipLevel), to: pt(hw, hipLevel), label: 'Cadera', offset: 0 },
    { id: 'd-rise', from: pt(0, 0), to: pt(0, rise), label: 'Tiro del.', offset: 0 },
    { id: 'd-inseam', from: pt(legCenter, rise), to: pt(legCenter, hemLevel), label: 'Entrepierna', offset: -30 },
    { id: 'd-hem', from: pt(legCenter - hemHalf, hemLevel), to: pt(legCenter + hemHalf, hemLevel), label: 'Bajo', offset: 45 },
  ]

  const handles: Handle[] = [
    { id: 'p-waist', label: 'Cintura', p: pt(ww, 0), x: { key: 'waistWidth', scale: 1 } },
    { id: 'p-hip', label: 'Cadera', p: pt(hw, hipLevel), x: { key: 'hipWidth', scale: 1 } },
    { id: 'p-rise', label: 'Tiro delantero', p: pt(0, rise), y: { key: 'frontRise', scale: 1 } },
    {
      id: 'p-knee',
      label: 'Rodilla',
      p: pt(legCenter + kneeHalf, kneeLevel),
      x: { key: 'kneeWidth', scale: 2, offset: -hw },
    },
    {
      id: 'p-hem',
      label: 'Bajo',
      p: pt(legCenter + hemHalf, hemLevel),
      x: { key: 'hemWidth', scale: 2, offset: -hw },
      y: { key: 'inseam', scale: 1, offset: -rise },
    },
  ]

  return {
    parts,
    dims,
    handles,
    box: { x: -hw - 120, y: -80, w: (hw + 120) * 2, h: hemLevel + 160 },
  }
}

export function buildFlat(kind: GarmentKind, m: M): FlatDrawing {
  if (kind === 'pants') return pantsFlat(m)
  return topFlat(m, kind)
}
