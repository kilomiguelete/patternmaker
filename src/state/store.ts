import { useMemo, useReducer } from 'react'
import { draft } from '../engine/drafts'
import { layoutPieces, type LayoutResult } from '../engine/layout'
import {
  buildChart,
  chartColumn,
  clampSpec,
  defaultBaseValues,
  defaultGrades,
  type BaseValues,
  type Grades,
  type LockedCells,
  type SizeChart,
} from '../engine/grading'
import { BASE_SIZE, type GarmentKind, type Size } from '../engine/measurements'
import type { Unit } from '../engine/units'
import type { ProjectFile } from '../export/project'

export type ViewOptions = {
  showSeamAllowance: boolean
  showDimensions: boolean
  showLabels: boolean
  unfold: boolean
  /** Ancho de tela del marcador, en mm. */
  sheetWidth: number
  gap: number
}

export type State = {
  name: string
  garment: GarmentKind
  unit: Unit
  activeSize: Size
  base: BaseValues
  grades: Grades
  chart: SizeChart
  locked: LockedCells
  view: ViewOptions
  selectedPiece: string | null
}

export type Action =
  | { type: 'garment'; kind: GarmentKind }
  | { type: 'unit'; unit: Unit }
  | { type: 'size'; size: Size }
  | { type: 'name'; name: string }
  | { type: 'cell'; key: string; size: Size; value: number }
  | { type: 'grade'; key: string; value: number }
  | { type: 'resetRow'; key: string }
  | { type: 'resetAll' }
  | { type: 'view'; patch: Partial<ViewOptions> }
  | { type: 'selectPiece'; id: string | null }
  | { type: 'load'; file: ProjectFile }

function freshState(kind: GarmentKind, name?: string): State {
  const base = defaultBaseValues(kind)
  const grades = defaultGrades(kind)
  return {
    name: name ?? 'Proyecto sin nombre',
    garment: kind,
    unit: 'cm',
    activeSize: BASE_SIZE,
    base,
    grades,
    chart: buildChart(kind, base, grades),
    locked: {},
    view: {
      showSeamAllowance: true,
      showDimensions: true,
      showLabels: true,
      unfold: false,
      sheetWidth: 1500,
      gap: 30,
    },
    selectedPiece: null,
  }
}

export function initialState(): State {
  return freshState('tee', 'Camiseta base')
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'garment': {
      if (a.kind === s.garment) return s
      return { ...freshState(a.kind), unit: s.unit, view: s.view, name: s.name }
    }
    case 'unit':
      return { ...s, unit: a.unit }
    case 'size':
      return { ...s, activeSize: a.size }
    case 'name':
      return { ...s, name: a.name }
    case 'cell': {
      const value = clampSpec(s.garment, a.key, a.value)
      const locked: LockedCells = { ...s.locked, [a.key]: { ...s.locked[a.key], [a.size]: true } }
      if (a.size === BASE_SIZE) {
        const base = { ...s.base, [a.key]: value }
        const next = { ...s, base, locked }
        return { ...next, chart: buildChart(s.garment, base, s.grades, s.chart, locked) }
      }
      const chart: SizeChart = { ...s.chart, [a.key]: { ...s.chart[a.key], [a.size]: value } }
      return { ...s, chart, locked }
    }
    case 'grade': {
      const grades = { ...s.grades, [a.key]: a.value }
      // Al cambiar el incremento se recalcula la fila completa.
      const locked: LockedCells = { ...s.locked, [a.key]: {} }
      const next = { ...s, grades, locked }
      return { ...next, chart: buildChart(s.garment, s.base, grades, s.chart, locked) }
    }
    case 'resetRow': {
      const base = { ...s.base, [a.key]: defaultBaseValues(s.garment)[a.key] }
      const grades = { ...s.grades, [a.key]: defaultGrades(s.garment)[a.key] }
      const locked: LockedCells = { ...s.locked, [a.key]: {} }
      const next = { ...s, base, grades, locked }
      return { ...next, chart: buildChart(s.garment, base, grades, s.chart, locked) }
    }
    case 'resetAll':
      return { ...freshState(s.garment, s.name), unit: s.unit, view: s.view }
    case 'view':
      return { ...s, view: { ...s.view, ...a.patch } }
    case 'selectPiece':
      return { ...s, selectedPiece: a.id }
    case 'load': {
      const f = a.file
      return {
        ...freshState(f.garment, f.name),
        unit: f.unit,
        activeSize: f.activeSize,
        base: f.base,
        grades: f.grades,
        chart: f.chart,
        locked: f.locked ?? {},
        view: s.view,
      }
    }
    default:
      return s
  }
}

export function useProject() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const measurements = useMemo(() => chartColumn(state.chart, state.activeSize), [state.chart, state.activeSize])

  const result = useMemo(() => draft(state.garment, measurements), [state.garment, measurements])

  const layout: LayoutResult = useMemo(
    () =>
      layoutPieces(result.pieces, {
        sheetWidth: state.view.sheetWidth,
        gap: state.view.gap,
        showSeamAllowance: state.view.showSeamAllowance,
        unfold: state.view.unfold,
      }),
    [result.pieces, state.view.sheetWidth, state.view.gap, state.view.showSeamAllowance, state.view.unfold],
  )

  return { state, dispatch, measurements, result, layout }
}
