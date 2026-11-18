export type Unit = 'mm' | 'cm' | 'in'

export const MM_PER_UNIT: Record<Unit, number> = { mm: 1, cm: 10, in: 25.4 }

export function toMm(value: number, unit: Unit): number {
  return value * MM_PER_UNIT[unit]
}

export function fromMm(mm: number, unit: Unit): number {
  return mm / MM_PER_UNIT[unit]
}

const DECIMALS: Record<Unit, number> = { mm: 0, cm: 1, in: 2 }

export function formatMm(mm: number, unit: Unit, withUnit = true): string {
  const v = fromMm(mm, unit)
  const s = v.toFixed(DECIMALS[unit])
  return withUnit ? `${s} ${unit}` : s
}

export function roundToUnit(mm: number, unit: Unit): number {
  const step = unit === 'in' ? 25.4 / 8 : MM_PER_UNIT[unit] / 10
  return Math.round(mm / step) * step
}
