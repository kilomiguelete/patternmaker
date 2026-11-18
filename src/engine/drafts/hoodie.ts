import { pathLengthBetween, pt } from '../geometry'
import type { Contour, DraftResult, DraftWarning, Piece } from '../types'
import { buildBodyPanel, buildSleeve, hDim, rectPiece, v, vDim, type M } from './common'

/**
 * Panel de capucha de 2 piezas: canto delantero inclinado, linea de cuello
 * curva y corona que forma la costura central con el otro panel.
 */
function hoodPanel(width: number, height: number, frontInset: number, dip: number): Contour {
  return {
    nodes: [
      { p: pt(0, 0), in: pt(width * 0.58, 0), label: 'Canto alto' },
      { p: pt(frontInset, height), out: pt((width - frontInset) * 0.34, dip), label: 'Cuello del.' },
      {
        p: pt(width, height),
        in: pt(-(width - frontInset) * 0.34, dip * 0.72),
        out: pt(0, -height * 0.52),
        label: 'Cuello esp.',
      },
    ],
    closed: true,
    kind: 'cut',
  }
}

const hoodNeck = (c: Contour) => pathLengthBetween(c, 1, 2)

/**
 * Cuadra la capucha con el escote de la prenda. Primero inclina el canto
 * delantero hacia atras y, si aun hace falta mas longitud, profundiza la
 * curva de cuello.
 */
function fitHoodPanel(width: number, height: number, target: number) {
  const baseDip = height * 0.04

  // 1) Inclinacion del canto delantero.
  let lo = 0
  let hi = width * 0.85
  let inset = 0
  let outline = hoodPanel(width, height, 0, baseDip)
  if (hoodNeck(outline) > target) {
    for (let k = 0; k < 40; k++) {
      inset = (lo + hi) / 2
      outline = hoodPanel(width, height, inset, baseDip)
      const neck = hoodNeck(outline)
      if (Math.abs(neck - target) < 0.05) break
      if (neck > target) lo = inset
      else hi = inset
    }
    return { outline, inset, dip: baseDip, neckLength: hoodNeck(outline) }
  }

  // 2) Profundidad de la curva de cuello.
  let dLo = baseDip
  let dHi = height * 0.9
  let dip = baseDip
  for (let k = 0; k < 40; k++) {
    dip = (dLo + dHi) / 2
    outline = hoodPanel(width, height, 0, dip)
    const neck = hoodNeck(outline)
    if (Math.abs(neck - target) < 0.05) break
    if (neck < target) dLo = dip
    else dHi = dip
  }
  return { outline, inset: 0, dip, neckLength: hoodNeck(outline) }
}

function pocketOutline(w: number, h: number): Contour {
  const od = h * 0.46
  return {
    nodes: [
      { p: pt(0, od), label: 'Abertura izq.' },
      { p: pt(w * 0.3, 0) },
      { p: pt(w * 0.7, 0) },
      { p: pt(w, od), label: 'Abertura der.' },
      { p: pt(w, h) },
      { p: pt(0, h) },
    ],
    closed: true,
    kind: 'cut',
  }
}

export function draftHoodie(m: M): DraftResult {
  const warnings: DraftWarning[] = []
  const sa = v(m, 'seamAllowance', 10)
  const ribH = v(m, 'ribHeight', 60)
  const cuffH = v(m, 'cuffHeight', 70)

  const panelLength = v(m, 'bodyLength') - ribH
  if (panelLength < 200) {
    warnings.push({ level: 'error', message: 'El rib del bajo consume casi todo el largo del cuerpo.' })
  }

  const common = {
    bodyLength: Math.max(120, panelLength),
    chestWidth: v(m, 'chestWidth'),
    hemWidth: v(m, 'hemWidth'),
    shoulderWidth: v(m, 'shoulderWidth'),
    shoulderSlope: v(m, 'shoulderSlope'),
    armholeDepth: v(m, 'armholeDepth'),
    neckWidth: v(m, 'neckWidth'),
  }

  const front = buildBodyPanel({ ...common, side: 'front', neckDrop: v(m, 'frontNeckDrop') })
  const back = buildBodyPanel({ ...common, side: 'back', neckDrop: v(m, 'backNeckDrop') })

  const sleeveLen = v(m, 'sleeveLength') - cuffH
  const sleeve = buildSleeve({
    frontArmhole: front.armholeLength,
    backArmhole: back.armholeLength,
    sleeveLength: Math.max(80, sleeveLen),
    bicep: v(m, 'bicep'),
    opening: v(m, 'sleeveOpening') + 25, // la manga se frunce dentro del puno
    ease: v(m, 'sleeveEase', 2),
  })

  const neckOpening = (front.necklineLength + back.necklineLength) * 2
  const hood = fitHoodPanel(v(m, 'hoodWidth'), v(m, 'hoodHeight'), neckOpening / 2)

  if (Math.abs(hood.neckLength - neckOpening / 2) > 1) {
    warnings.push({
      level: 'warn',
      message: `La capucha no cuadra con el escote (${(hood.neckLength / 10).toFixed(1)} cm frente a ${(neckOpening / 20).toFixed(1)} cm). Ajusta el ancho de capucha o el escote.`,
    })
  }
  if (v(m, 'hoodHeight') < v(m, 'hoodWidth') * 1.05) {
    warnings.push({ level: 'info', message: 'Capucha baja y ancha: queda caida sobre los hombros.' })
  }
  if (common.neckWidth >= common.shoulderWidth) {
    warnings.push({ level: 'error', message: 'El ancho de cuello supera el ancho de hombros.' })
  }
  if (sleeve.capHeight > common.armholeDepth * 1.05) {
    warnings.push({ level: 'warn', message: 'Alto de copa excesivo para esta sisa: amplia el biceps.' })
  }

  const pocketW = v(m, 'pocketWidth')
  const pocketH = v(m, 'pocketHeight')

  const pieces: Piece[] = [
    {
      id: 'front',
      name: 'Delantero',
      outline: front.outline,
      cutCount: 1,
      onFold: true,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 5: 0 },
      foldEdges: [5],
      guides: pocketW > 0 && pocketH > 0
        ? [
            {
              id: 'pocket-pos',
              label: 'Posicion bolsillo',
              points: [
                pt(0, common.bodyLength - 20 - pocketH),
                pt(pocketW / 2, common.bodyLength - 20 - pocketH),
                pt(pocketW / 2, common.bodyLength - 20),
                pt(0, common.bodyLength - 20),
              ],
              style: 'dashed',
            },
          ]
        : undefined,
      dimensions: [
        vDim('f-len', 0, 0, common.bodyLength, 'Largo panel', -26),
        hDim('f-chest', common.armholeDepth + 25, 0, common.chestWidth / 2, '1/2 pecho', 18),
        hDim('f-hem', common.bodyLength, 0, common.hemWidth / 2, '1/2 bajo', 26),
        vDim('f-neck', 0, 0, v(m, 'frontNeckDrop'), 'Escote del.', 22),
      ],
      notes: [
        `Sisa: ${(front.armholeLength / 10).toFixed(1)} cm`,
        `Largo total con rib: ${(v(m, 'bodyLength') / 10).toFixed(1)} cm`,
      ],
    },
    {
      id: 'back',
      name: 'Espalda',
      outline: back.outline,
      cutCount: 1,
      onFold: true,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 5: 0 },
      foldEdges: [5],
      dimensions: [
        vDim('b-len', 0, 0, common.bodyLength, 'Largo panel', -26),
        hDim('b-chest', common.armholeDepth + 25, 0, common.chestWidth / 2, '1/2 pecho', 18),
      ],
      notes: [`Sisa: ${(back.armholeLength / 10).toFixed(1)} cm`],
    },
    {
      id: 'sleeve',
      name: 'Manga',
      outline: sleeve.outline,
      cutCount: 2,
      onFold: false,
      grain: 'vertical',
      seamAllowance: sa,
      guides: [
        { id: 'sleeve-center', label: 'Centro de manga', points: [pt(0, 0), pt(0, Math.max(80, sleeveLen))], style: 'dashed' },
        {
          id: 'sleeve-bicep',
          label: 'Linea de biceps',
          points: [pt(-v(m, 'bicep'), sleeve.capHeight), pt(v(m, 'bicep'), sleeve.capHeight)],
          style: 'dotted',
        },
      ],
      dimensions: [
        hDim('s-bicep', sleeve.capHeight, -v(m, 'bicep'), v(m, 'bicep'), 'Biceps', 20),
        vDim('s-cap', 0, 0, sleeve.capHeight, 'Alto copa', -24),
      ],
      notes: [
        `Copa: ${(sleeve.capLength / 10).toFixed(1)} cm`,
        `Largo sin puno: ${(Math.max(80, sleeveLen) / 10).toFixed(1)} cm`,
        'La boca de manga lleva 2,5 cm extra para fruncir en el puno.',
      ],
    },
    {
      id: 'hood',
      name: 'Capucha',
      outline: hood.outline,
      cutCount: 2,
      onFold: false,
      grain: 'vertical',
      seamAllowance: sa,
      guides: v(m, 'hoodOpening') > 0
        ? [
            {
              id: 'hood-facing',
              label: 'Vista',
              points: [
                pt(v(m, 'hoodOpening'), 0),
                pt(hood.inset + v(m, 'hoodOpening'), v(m, 'hoodHeight')),
              ],
              style: 'dashed',
            },
          ]
        : undefined,
      dimensions: [
        vDim('h-height', 0, 0, v(m, 'hoodHeight'), 'Alto capucha', -24),
        hDim('h-width', 0, 0, v(m, 'hoodWidth'), 'Ancho capucha', -22),
      ],
      notes: [
        `Linea de cuello: ${(hood.neckLength / 10).toFixed(1)} cm por panel`,
        'Canto delantero con vista doblada; corona unida por costura central.',
      ],
    },
  ]

  if (pocketW > 0 && pocketH > 0) {
    pieces.push({
      id: 'pocket',
      name: 'Bolsillo canguro',
      outline: pocketOutline(pocketW, pocketH),
      cutCount: 1,
      onFold: false,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 0: 20, 2: 20 },
      dimensions: [
        hDim('p-w', pocketH, 0, pocketW, 'Ancho', 24),
        vDim('p-h', pocketW, 0, pocketH, 'Alto', -22),
      ],
      notes: ['Aberturas laterales con dobladillo de 2 cm.'],
    })
  }

  if (ribH > 0) {
    pieces.push(
      rectPiece({
        id: 'hem-rib',
        name: 'Rib de bajo',
        w: v(m, 'hemWidth') * 2 * 0.9,
        h: ribH * 2 + sa * 2,
        cutCount: 1,
        seamAllowance: 0,
        notes: ['Largo = 90 % del contorno de bajo.', 'Doblado por la mitad, hilo en el ancho.'],
      }),
    )
  }

  if (cuffH > 0) {
    pieces.push(
      rectPiece({
        id: 'cuff',
        name: 'Puno',
        w: v(m, 'sleeveOpening') * 2 * 0.9,
        h: cuffH * 2 + sa * 2,
        cutCount: 2,
        seamAllowance: 0,
        notes: ['Largo = 90 % del contorno del puno.', 'Doblado por la mitad, hilo en el ancho.'],
      }),
    )
  }

  pieces.push(
    rectPiece({
      id: 'neck-tape',
      name: 'Cinta de cuello',
      w: neckOpening * 0.92,
      h: 25 + sa * 2,
      cutCount: 1,
      seamAllowance: 0,
      notes: ['Remata la union capucha-escote por el interior.'],
    }),
  )

  return {
    pieces,
    warnings,
    computed: {
      armholeFront: front.armholeLength,
      armholeBack: back.armholeLength,
      armholeTotal: front.armholeLength + back.armholeLength,
      sleeveCapLength: sleeve.capLength,
      sleeveCapHeight: sleeve.capHeight,
      neckOpening,
      hoodNeckLength: hood.neckLength,
      chestCircumference: v(m, 'chestWidth') * 2,
      panelLength: common.bodyLength,
    },
  }
}
