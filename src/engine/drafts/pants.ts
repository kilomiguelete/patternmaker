import { pathLengthBetween, pt } from '../geometry'
import type { Contour, DraftResult, DraftWarning, Handle, Piece, Point } from '../types'
import { hDim, rectPiece, v, vDim, type M } from './common'

type LegInput = {
  side: 'front' | 'back'
  waistHalf: number
  hipHalf: number
  hipLevel: number
  rise: number
  /** Nivel y del tiro, comun a delantero y espalda. */
  crotchLevel: number
  inseam: number
  crotchExt: number
  kneeWidth: number
  hemWidth: number
}

type Leg = {
  outline: Contour
  legCenter: number
  inseamLength: number
  sideLength: number
  riseLength: number
  thighWidth: number
  /** Distancia vertical del borde de cintura al tiro, en esta pieza. */
  riseSpan: number
  levels: { knee: number; hem: number }
  points: {
    waistSide: Point
    hipSide: Point
    crotch: Point
    kneeIn: Point
    hemIn: Point
  }
}

/**
 * Pierna (delantera o trasera) con la linea de tiro en x = 0 y el costado
 * a la izquierda. La pierna afina simetricamente respecto a su linea de hilo.
 */
function buildLeg(i: LegInput): Leg {
  const kneeLevel = i.crotchLevel + i.inseam / 2
  const hemLevel = i.crotchLevel + i.inseam
  const legCenter = (-i.hipHalf + i.crotchExt) / 2
  const waistY = i.crotchLevel - i.rise

  const kneeIn = legCenter + i.kneeWidth / 2
  const kneeOut = legCenter - i.kneeWidth / 2
  const hemIn = legCenter + i.hemWidth / 2
  const hemOut = legCenter - i.hemWidth / 2

  const riseSpan = i.crotchLevel - i.hipLevel

  const outline: Contour = {
    nodes: [
      { p: pt(-i.waistHalf, 0), label: 'Cintura costado' },
      { p: pt(0, waistY), label: i.side === 'front' ? 'Cintura CD' : 'Cintura CE' },
      { p: pt(0, i.hipLevel), out: pt(0, riseSpan * 0.52), label: 'Cadera' },
      {
        p: pt(i.crotchExt, i.crotchLevel),
        in: pt(-i.crotchExt * 0.8, 0),
        out: pt((kneeIn - i.crotchExt) * 0.35, i.inseam * 0.16),
        label: 'Tiro',
      },
      { p: pt(kneeIn, kneeLevel), label: 'Rodilla interior' },
      { p: pt(hemIn, hemLevel), label: 'Bajo interior' },
      { p: pt(hemOut, hemLevel), label: 'Bajo costado' },
      { p: pt(kneeOut, kneeLevel), label: 'Rodilla costado' },
      { p: pt(-i.hipHalf, i.hipLevel), label: 'Cadera costado' },
    ],
    closed: true,
    kind: 'cut',
  }

  return {
    outline,
    legCenter,
    // Nodos: 0 cintura costado, 1 cintura centro, 2 cadera, 3 tiro,
    // 4 rodilla int., 5 bajo int., 6 bajo costado, 7 rodilla costado, 8 cadera costado.
    inseamLength: pathLengthBetween(outline, 3, 5),
    sideLength: pathLengthBetween(outline, 6, 9),
    riseLength: pathLengthBetween(outline, 1, 3),
    thighWidth: i.crotchExt + i.hipHalf,
    riseSpan: i.rise,
    levels: { knee: kneeLevel, hem: hemLevel },
    points: {
      waistSide: pt(-i.waistHalf, 0),
      hipSide: pt(-i.hipHalf, i.hipLevel),
      crotch: pt(i.crotchExt, i.crotchLevel),
      kneeIn: pt(kneeIn, kneeLevel),
      hemIn: pt(hemIn, hemLevel),
    },
  }
}

/**
 * Vertices arrastrables de una pierna. El nivel del tiro es comun a las dos
 * piezas, asi que el alto de cintura de cada una lleva su propio tiro.
 */
function legHandles(
  side: 'front' | 'back',
  leg: Leg,
  o: { hipHalf: number; crotchLevel: number; waistbandHeight: number; extRatio: number },
): Handle[] {
  const { waistSide, hipSide, crotch, kneeIn, hemIn } = leg.points
  const riseKey = side === 'front' ? 'frontRise' : 'backRise'
  const centerOffset = -2 * leg.legCenter
  return [
    {
      id: `${side}-waist`,
      label: 'Cintura',
      p: waistSide,
      x: { key: 'waistWidth', scale: -2 },
    },
    {
      id: `${side}-rise`,
      label: side === 'front' ? 'Tiro delantero' : 'Tiro trasero',
      p: pt(0, o.crotchLevel - leg.riseSpan),
      y: { key: riseKey, scale: -1, offset: o.crotchLevel + o.waistbandHeight },
    },
    { id: `${side}-hip`, label: 'Cadera', p: hipSide, x: { key: 'hipWidth', scale: -2 } },
    {
      id: `${side}-crotch`,
      label: 'Muslo',
      p: crotch,
      x: { key: 'thighWidth', scale: 1 / o.extRatio, offset: o.hipHalf },
    },
    {
      id: `${side}-knee`,
      label: 'Rodilla',
      p: kneeIn,
      x: { key: 'kneeWidth', scale: 2, offset: centerOffset },
    },
    {
      id: `${side}-hem`,
      label: 'Bajo',
      p: hemIn,
      x: { key: 'hemWidth', scale: 2, offset: centerOffset },
      y: { key: 'inseam', scale: 1, offset: -o.crotchLevel },
    },
  ]
}

export function draftPants(m: M): DraftResult {
  const warnings: DraftWarning[] = []
  const sa = v(m, 'seamAllowance', 12)
  const hemAllow = v(m, 'hemAllowance', 25)
  const wbH = v(m, 'waistbandHeight', 40)

  const waistHalf = v(m, 'waistWidth') / 2
  const hipHalf = v(m, 'hipWidth') / 2
  const frontRise = v(m, 'frontRise') - wbH
  const backRise = v(m, 'backRise') - wbH
  const inseam = v(m, 'inseam')
  const hipLevel = Math.min(180, Math.max(60, frontRise * 0.58))

  const extFront = Math.max(20, v(m, 'thighWidth') - hipHalf)
  const extBack = extFront * 1.6

  if (v(m, 'thighWidth') - hipHalf < 20) {
    warnings.push({
      level: 'warn',
      message: 'El muslo es demasiado estrecho para esta cadera: el tiro queda sin extension. Amplia el muslo o reduce la cadera.',
    })
  }
  if (backRise <= frontRise) {
    warnings.push({ level: 'warn', message: 'El tiro trasero deberia ser mayor que el delantero (2-10 cm).' })
  }
  if (v(m, 'kneeWidth') > v(m, 'thighWidth')) {
    warnings.push({ level: 'warn', message: 'La rodilla es mas ancha que el muslo.' })
  }
  if (v(m, 'hemWidth') > v(m, 'kneeWidth')) {
    warnings.push({ level: 'info', message: 'Bajo mas ancho que la rodilla: silueta acampanada / flare.' })
  }
  if (wbH >= frontRise + wbH) {
    warnings.push({ level: 'error', message: 'La cinturilla consume todo el tiro delantero.' })
  }

  const base = {
    waistHalf,
    hipHalf,
    hipLevel,
    crotchLevel: frontRise,
    inseam,
    kneeWidth: v(m, 'kneeWidth'),
    hemWidth: v(m, 'hemWidth'),
  }

  const front = buildLeg({ ...base, side: 'front', rise: frontRise, crotchExt: extFront })
  const back = buildLeg({ ...base, side: 'back', rise: backRise, crotchExt: extBack })

  const inseamDelta = Math.abs(front.inseamLength - back.inseamLength)
  if (inseamDelta > 8) {
    warnings.push({
      level: 'info',
      message: `La entrepierna trasera es ${(inseamDelta / 10).toFixed(1)} cm mas larga que la delantera: se embebe al montar.`,
    })
  }

  const pocketOpening = v(m, 'pocketOpening')

  const pieces: Piece[] = [
    {
      id: 'leg-front',
      name: 'Pierna delantera',
      outline: front.outline,
      cutCount: 2,
      onFold: false,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 5: hemAllow },
      handles: legHandles('front', front, {
        hipHalf,
        crotchLevel: frontRise,
        waistbandHeight: wbH,
        extRatio: 1,
      }),
      guides: [
        {
          id: 'grain-front',
          label: 'Hilo',
          points: [pt(front.legCenter, front.levels.knee - inseam * 0.3), pt(front.legCenter, front.levels.hem - 20)],
          style: 'dashed',
        },
        ...(pocketOpening > 0
          ? [
              {
                id: 'pocket-front',
                label: 'Abertura bolsillo',
                points: [pt(-waistHalf, 10), pt(-hipHalf + 20, pocketOpening)],
                style: 'solid' as const,
              },
            ]
          : []),
      ],
      dimensions: [
        hDim('pf-waist', 0, -waistHalf, 0, '1/4 cintura', -20),
        hDim('pf-hip', hipLevel, -hipHalf, 0, '1/4 cadera', 20),
        vDim('pf-rise', 0, 0, frontRise, 'Tiro del.', 24),
        vDim('pf-inseam', front.legCenter, frontRise, front.levels.hem, 'Entrepierna', -26),
        hDim('pf-hem', front.levels.hem, front.legCenter - v(m, 'hemWidth') / 2, front.legCenter + v(m, 'hemWidth') / 2, 'Bajo', 26),
      ],
      notes: [
        `Entrepierna: ${(front.inseamLength / 10).toFixed(1)} cm`,
        `Muslo: ${(front.thighWidth / 10).toFixed(1)} cm`,
        `Dobladillo: ${(hemAllow / 10).toFixed(1)} cm`,
      ],
    },
    {
      id: 'leg-back',
      name: 'Pierna trasera',
      outline: back.outline,
      cutCount: 2,
      onFold: false,
      grain: 'vertical',
      seamAllowance: sa,
      seamAllowanceOverrides: { 5: hemAllow },
      handles: legHandles('back', back, {
        hipHalf,
        crotchLevel: frontRise,
        waistbandHeight: wbH,
        extRatio: 1.6,
      }),
      guides: [
        {
          id: 'grain-back',
          label: 'Hilo',
          points: [pt(back.legCenter, back.levels.knee - inseam * 0.3), pt(back.legCenter, back.levels.hem - 20)],
          style: 'dashed',
        },
      ],
      dimensions: [
        hDim('pb-waist', 0, -waistHalf, 0, '1/4 cintura', -20),
        hDim('pb-hip', hipLevel, -hipHalf, 0, '1/4 cadera', 20),
        hDim('pb-thigh', frontRise, -hipHalf, extBack, 'Muslo', 22),
      ],
      notes: [
        `Entrepierna: ${(back.inseamLength / 10).toFixed(1)} cm`,
        `Muslo: ${(back.thighWidth / 10).toFixed(1)} cm`,
        'Tiro trasero mas largo: la cintura sube hacia el centro espalda.',
      ],
    },
  ]

  if (wbH > 0) {
    pieces.push(
      rectPiece({
        id: 'waistband',
        name: 'Cinturilla',
        w: v(m, 'waistWidth') * 2 * 0.95,
        h: wbH * 2 + sa * 2,
        cutCount: 1,
        seamAllowance: 0,
        notes: ['Largo = 95 % del contorno de cintura.', 'Doblada por la mitad, con tunel para cordon.'],
      }),
    )
  }

  if (pocketOpening > 0) {
    pieces.push(
      rectPiece({
        id: 'pocket-bag',
        name: 'Bolsa de bolsillo',
        w: pocketOpening * 1.15,
        h: pocketOpening * 1.6,
        cutCount: 4,
        seamAllowance: sa,
        grain: 'vertical',
        notes: ['Dos bolsas por bolsillo, en forro o en el mismo tejido.'],
      }),
    )
  }

  return {
    pieces,
    warnings,
    computed: {
      inseamFront: front.inseamLength,
      inseamBack: back.inseamLength,
      riseFront: front.riseLength,
      riseBack: back.riseLength,
      sideSeam: front.sideLength,
      thighFront: front.thighWidth,
      thighBack: back.thighWidth,
      waistCircumference: v(m, 'waistWidth') * 2,
      hipCircumference: v(m, 'hipWidth') * 2,
      totalLength: frontRise + inseam + wbH,
    },
  }
}
