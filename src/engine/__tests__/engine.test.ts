import { describe, expect, it } from 'vitest'
import { draft } from '../drafts'
import { buildChart, chartColumn, defaultBaseValues, defaultGrades } from '../grading'
import { GARMENT_LIST, SIZES, type GarmentKind } from '../measurements'
import { contourLength, flattenWithEdges, polygonArea } from '../geometry'
import { layoutPieces, measurePiece } from '../layout'

function measurementsFor(kind: GarmentKind, size: (typeof SIZES)[number] = 'M') {
  const base = defaultBaseValues(kind)
  const grades = defaultGrades(kind)
  return chartColumn(buildChart(kind, base, grades), size)
}

describe('tabla de medidas', () => {
  it('escala cada talla con su incremento', () => {
    const chart = buildChart('tee', defaultBaseValues('tee'), defaultGrades('tee'))
    expect(chart.chestWidth.M).toBe(560)
    expect(chart.chestWidth.L - chart.chestWidth.M).toBeCloseTo(25, 5)
    expect(chart.chestWidth.S - chart.chestWidth.XS).toBeCloseTo(25, 5)
  })

  it('respeta las celdas bloqueadas al regradar', () => {
    const base = defaultBaseValues('tee')
    const grades = defaultGrades('tee')
    const first = buildChart('tee', base, grades)
    const edited = { ...first, chestWidth: { ...first.chestWidth, XL: 640 } }
    const again = buildChart('tee', base, grades, edited, { chestWidth: { XL: true } })
    expect(again.chestWidth.XL).toBe(640)
    expect(again.chestWidth.L).toBe(first.chestWidth.L)
  })

  it('mantiene los valores dentro de los limites del spec', () => {
    const chart = buildChart('tee', { ...defaultBaseValues('tee'), bodyLength: 99999 }, defaultGrades('tee'))
    expect(chart.bodyLength.M).toBeLessThanOrEqual(950)
  })
})

describe.each(GARMENT_LIST)('patron de $name', (garment) => {
  const m = measurementsFor(garment.kind)
  const result = draft(garment.kind, m)

  it('genera piezas con contorno cerrado y area positiva', () => {
    expect(result.pieces.length).toBeGreaterThan(1)
    for (const piece of result.pieces) {
      const { points } = flattenWithEdges(piece.outline)
      expect(points.length).toBeGreaterThan(3)
      expect(Math.abs(polygonArea(points))).toBeGreaterThan(100)
      expect(contourLength(piece.outline)).toBeGreaterThan(10)
    }
  })

  it('el margen de costura agranda la pieza', () => {
    for (const piece of result.pieces) {
      if (piece.seamAllowance <= 0) continue
      const { net, gross } = measurePiece(piece)
      expect(gross.w).toBeGreaterThanOrEqual(net.w - 0.01)
      expect(gross.h).toBeGreaterThanOrEqual(net.h - 0.01)
    }
  })

  it('no emite errores con las medidas por defecto', () => {
    expect(result.warnings.filter((w) => w.level === 'error')).toEqual([])
  })

  it('coloca todas las piezas dentro del ancho de tela', () => {
    const layout = layoutPieces(result.pieces, { sheetWidth: 1500, gap: 30, showSeamAllowance: true, unfold: false })
    expect(layout.placed).toHaveLength(result.pieces.length)
    expect(layout.width).toBeLessThanOrEqual(1500)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('funciona en todas las tallas', () => {
    for (const size of SIZES) {
      const r = draft(garment.kind, measurementsFor(garment.kind, size))
      expect(r.pieces.length).toBeGreaterThan(1)
      expect(r.warnings.filter((w) => w.level === 'error')).toEqual([])
    }
  })
})

describe('manga montada', () => {
  it('ajusta la copa al largo de sisa mas el embebido', () => {
    for (const kind of ['tee', 'hoodie'] as const) {
      const r = draft(kind, measurementsFor(kind))
      const { armholeTotal, sleeveCapLength } = r.computed
      const ease = measurementsFor(kind).sleeveEase
      const target = armholeTotal * (1 + ease / 100)
      expect(Math.abs(sleeveCapLength - target)).toBeLessThan(1)
    }
  })

  it('una sisa mas profunda da una copa mas larga', () => {
    const m = measurementsFor('tee')
    const a = draft('tee', m).computed.sleeveCapLength
    const b = draft('tee', { ...m, armholeDepth: m.armholeDepth + 40 }).computed.sleeveCapLength
    expect(b).toBeGreaterThan(a)
  })
})

describe('capucha', () => {
  it('iguala su linea de cuello a la mitad del escote', () => {
    const r = draft('hoodie', measurementsFor('hoodie'))
    expect(Math.abs(r.computed.hoodNeckLength - r.computed.neckOpening / 2)).toBeLessThan(1)
  })
})

describe('pantalon', () => {
  it('el tiro trasero es mas largo que el delantero', () => {
    const r = draft('pants', measurementsFor('pants'))
    expect(r.computed.riseBack).toBeGreaterThan(r.computed.riseFront)
  })

  it('avisa cuando el muslo no cabe en la cadera', () => {
    const m = measurementsFor('pants')
    const r = draft('pants', { ...m, thighWidth: m.hipWidth / 2 })
    expect(r.warnings.some((w) => w.level === 'warn')).toBe(true)
  })
})

describe('validaciones', () => {
  it('detecta un cuello mas ancho que los hombros', () => {
    const m = measurementsFor('tee')
    const r = draft('tee', { ...m, neckWidth: m.shoulderWidth + 10 })
    expect(r.warnings.some((w) => w.level === 'error')).toBe(true)
  })
})
