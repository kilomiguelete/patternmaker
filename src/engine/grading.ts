import { BASE_SIZE, GARMENTS, SIZES, type GarmentKind, type Size } from './measurements'

/** Tabla de medidas: clave de medida -> talla -> valor en mm. */
export type SizeChart = Record<string, Record<Size, number>>

/** Celdas editadas a mano, que el regrade automatico no sobreescribe. */
export type LockedCells = Record<string, Partial<Record<Size, true>>>

export type Grades = Record<string, number>
export type BaseValues = Record<string, number>

const baseIndex = SIZES.indexOf(BASE_SIZE)

export function defaultBaseValues(kind: GarmentKind): BaseValues {
  const out: BaseValues = {}
  for (const s of GARMENTS[kind].specs) out[s.key] = s.base
  return out
}

export function defaultGrades(kind: GarmentKind): Grades {
  const out: Grades = {}
  for (const s of GARMENTS[kind].specs) out[s.key] = s.grade
  return out
}

/** Genera la tabla completa a partir de valores base + incrementos. */
export function buildChart(
  kind: GarmentKind,
  base: BaseValues,
  grades: Grades,
  previous?: SizeChart,
  locked?: LockedCells,
): SizeChart {
  const chart: SizeChart = {}
  for (const spec of GARMENTS[kind].specs) {
    const row = {} as Record<Size, number>
    SIZES.forEach((size, i) => {
      const keptValue = locked?.[spec.key]?.[size] ? previous?.[spec.key]?.[size] : undefined
      const graded = (base[spec.key] ?? spec.base) + (grades[spec.key] ?? spec.grade) * (i - baseIndex)
      const value = keptValue ?? graded
      row[size] = clampSpec(kind, spec.key, value)
    })
    chart[spec.key] = row
  }
  return chart
}

export function clampSpec(kind: GarmentKind, key: string, value: number): number {
  const spec = GARMENTS[kind].specs.find((s) => s.key === key)
  if (!spec) return value
  return Math.min(spec.max, Math.max(spec.min, Math.round(value * 100) / 100))
}

export function chartColumn(chart: SizeChart, size: Size): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of Object.keys(chart)) out[key] = chart[key][size]
  return out
}

/** Diferencia entre tallas consecutivas, para la columna de incrementos. */
export function rowGrade(chart: SizeChart, key: string): number {
  const row = chart[key]
  if (!row) return 0
  const diffs: number[] = []
  for (let i = 1; i < SIZES.length; i++) diffs.push(row[SIZES[i]] - row[SIZES[i - 1]])
  if (!diffs.length) return 0
  const uniform = diffs.every((d) => Math.abs(d - diffs[0]) < 0.01)
  return uniform ? diffs[0] : NaN
}
