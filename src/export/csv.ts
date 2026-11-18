import { GARMENTS, SIZES, type GarmentKind } from '../engine/measurements'
import type { SizeChart } from '../engine/grading'
import { fromMm, type Unit } from '../engine/units'

const dec = (u: Unit) => (u === 'mm' ? 0 : u === 'cm' ? 1 : 2)

export function chartToCsv(kind: GarmentKind, chart: SizeChart, unit: Unit, delimiter = ';'): string {
  const rows: string[][] = []
  rows.push(['Codigo', 'Medida', `Unidad (${unit})`, ...SIZES, 'Incremento'])
  for (const spec of GARMENTS[kind].specs) {
    const row = chart[spec.key]
    if (!row) continue
    const values = SIZES.map((s) => fromMm(row[s], unit).toFixed(dec(unit)))
    const grade = (fromMm(row[SIZES[1]] - row[SIZES[0]], unit)).toFixed(dec(unit))
    rows.push([spec.code, spec.label, unit, ...values, grade])
  }
  return rows
    .map((r) => r.map((cell) => (/[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(delimiter))
    .join('\n')
}
