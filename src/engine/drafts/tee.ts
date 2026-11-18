import { pt } from '../geometry'
import type { DraftResult, DraftWarning, Piece } from '../types'
import { buildBodyPanel, buildSleeve, hDim, rectPiece, v, vDim, type M } from './common'

export function draftTee(m: M): DraftResult {
  const warnings: DraftWarning[] = []
  const sa = v(m, 'seamAllowance', 10)
  const hemAllow = v(m, 'hemAllowance', 20)
  const sleeveHemAllow = v(m, 'sleeveHemAllowance', 20)

  const common = {
    bodyLength: v(m, 'bodyLength'),
    chestWidth: v(m, 'chestWidth'),
    hemWidth: v(m, 'hemWidth'),
    shoulderWidth: v(m, 'shoulderWidth'),
    shoulderSlope: v(m, 'shoulderSlope'),
    armholeDepth: v(m, 'armholeDepth'),
    neckWidth: v(m, 'neckWidth'),
  }

  const front = buildBodyPanel({ ...common, side: 'front', neckDrop: v(m, 'frontNeckDrop') })
  const back = buildBodyPanel({ ...common, side: 'back', neckDrop: v(m, 'backNeckDrop') })

  const sleeve = buildSleeve({
    frontArmhole: front.armholeLength,
    backArmhole: back.armholeLength,
    sleeveLength: v(m, 'sleeveLength'),
    bicep: v(m, 'bicep'),
    opening: v(m, 'sleeveOpening'),
    ease: v(m, 'sleeveEase', 2),
  })

  // -------------------------------------------------------- validaciones
  if (common.shoulderWidth / 2 >= common.chestWidth / 2) {
    warnings.push({
      level: 'warn',
      message: 'El hombro es igual o mas ancho que el pecho: la sisa queda sin curva. Reduce el ancho de hombros o amplia el pecho.',
    })
  }
  if (common.neckWidth >= common.shoulderWidth) {
    warnings.push({ level: 'error', message: 'El ancho de cuello supera el ancho de hombros.' })
  }
  if (common.armholeDepth <= common.shoulderSlope + 50) {
    warnings.push({ level: 'warn', message: 'La sisa es muy corta respecto a la caida de hombro.' })
  }
  if (sleeve.capHeight > common.armholeDepth * 1.05) {
    warnings.push({
      level: 'warn',
      message: `Alto de copa (${(sleeve.capHeight / 10).toFixed(1)} cm) muy alto para esta sisa: amplia el biceps o reduce el embebido.`,
    })
  }
  if (sleeve.capHeight < v(m, 'bicep') * 0.35) {
    warnings.push({
      level: 'info',
      message: 'Copa muy baja: manga comoda tipo dropped/relaxed, con menos movilidad del brazo.',
    })
  }
  if (v(m, 'sleeveOpening') > v(m, 'bicep')) {
    warnings.push({ level: 'warn', message: 'La boca de manga es mas ancha que el biceps.' })
  }
  if (v(m, 'sleeveLength') <= sleeve.capHeight + 20) {
    warnings.push({ level: 'error', message: 'El largo de manga no llega a cubrir el alto de copa.' })
  }

  // -------------------------------------------------------- piezas
  const neckOpening = (front.necklineLength + back.necklineLength) * 2
  const ribLength = neckOpening * 0.86
  const collarH = v(m, 'collarHeight', 20)

  const pieces: Piece[] = [
    {
      id: 'front',
      name: 'Delantero',
      outline: front.outline,
      cutCount: 1,
      onFold: true,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 4: hemAllow, 5: 0 },
      foldEdges: [5],
      dimensions: [
        vDim('f-len', 0, 0, common.bodyLength, 'Largo total', -26),
        hDim('f-chest', common.armholeDepth + 25, 0, common.chestWidth / 2, '1/2 pecho', 18),
        hDim('f-hem', common.bodyLength, 0, common.hemWidth / 2, '1/2 bajo', 26),
        hDim('f-sh', common.shoulderSlope, common.neckWidth / 2, common.shoulderWidth / 2, 'Hombro', -20),
        vDim('f-neck', 0, 0, v(m, 'frontNeckDrop'), 'Escote del.', 22),
      ],
      notes: [`Sisa: ${(front.armholeLength / 10).toFixed(1)} cm`, `Dobladillo bajo: ${(hemAllow / 10).toFixed(1)} cm`],
    },
    {
      id: 'back',
      name: 'Espalda',
      outline: back.outline,
      cutCount: 1,
      onFold: true,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 4: hemAllow, 5: 0 },
      foldEdges: [5],
      dimensions: [
        vDim('b-len', 0, 0, common.bodyLength, 'Largo total', -26),
        hDim('b-chest', common.armholeDepth + 25, 0, common.chestWidth / 2, '1/2 pecho', 18),
        vDim('b-neck', 0, 0, v(m, 'backNeckDrop'), 'Escote esp.', 22),
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
      seamAllowanceOverrides: { 5: sleeveHemAllow },
      guides: [
        {
          id: 'sleeve-center',
          label: 'Centro de manga',
          points: [pt(0, 0), pt(0, v(m, 'sleeveLength'))],
          style: 'dashed',
        },
        {
          id: 'sleeve-bicep',
          label: 'Linea de biceps',
          points: [pt(-v(m, 'bicep'), sleeve.capHeight), pt(v(m, 'bicep'), sleeve.capHeight)],
          style: 'dotted',
        },
      ],
      dimensions: [
        hDim('s-bicep', sleeve.capHeight, -v(m, 'bicep'), v(m, 'bicep'), 'Biceps', 20),
        hDim('s-open', v(m, 'sleeveLength'), -v(m, 'sleeveOpening'), v(m, 'sleeveOpening'), 'Boca manga', 24),
        vDim('s-cap', 0, 0, sleeve.capHeight, 'Alto copa', -24),
      ],
      notes: [
        `Copa: ${(sleeve.capLength / 10).toFixed(1)} cm vs sisa ${((front.armholeLength + back.armholeLength) / 10).toFixed(1)} cm`,
        `Embebido: ${v(m, 'sleeveEase', 2).toFixed(1)} %`,
      ],
    },
  ]

  if (collarH > 0) {
    pieces.push(
      rectPiece({
        id: 'collar',
        name: 'Rib de cuello',
        w: ribLength,
        h: collarH * 2 + sa * 2,
        cutCount: 1,
        seamAllowance: 0,
        grain: 'horizontal',
        notes: [
          `Largo = 86 % del escote (${(neckOpening / 10).toFixed(1)} cm)`,
          'Cortar en rib 1x1 con el hilo en el ancho, doblado por la mitad.',
        ],
      }),
    )
  }

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
      ribLength,
      chestCircumference: common.chestWidth * 2,
      hemCircumference: common.hemWidth * 2,
    },
  }
}
