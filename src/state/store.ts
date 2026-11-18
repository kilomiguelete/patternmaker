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
  /** Mostrar y permitir arrastrar los vertices del patron. */
  editHandles: boolean
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
  | { type: 'cells'; size: Size; edits: { key: string; value: number }[] }
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
      editHandles: false,
      sheetWidth: 1500,
      gap: 30,
    },
    selectedPiece: null,
  }
}

export function initialState(): State {
  return freshState('tee', 'Camiseta base')
}

/**
 * Escribe medidas en una talla.
 *
 * En la talla base se escribe `base`, que es de donde sale el escalado, y se
 * LIBERA el bloqueo de esa celda: dejarla bloqueada haria que el regrade la
 * restaurase al valor anterior y la edicion no tendria efecto. En el resto de
 * tallas se escribe la celda y se bloquea para que el regrade la respete.
 */
function applyEdits(s: State, size: Size, edits: { key: string; value: number }[]): State {
  const locked: LockedCells = { ...s.locked }
  let base = s.base
  let chart = s.chart

  for (const edit of edits) {
    const value = clampSpec(s.garment, edit.key, edit.value)
    if (size === BASE_SIZE) {
      base = { ...base, [edit.key]: value }
      locked[edit.key] = { ...locked[edit.key] }
      delete locked[edit.key][size]
    } else {
      locked[edit.key] = { ...locked[edit.key], [size]: true }
      chart = { ...chart, [edit.key]: { ...chart[edit.key], [size]: value } }
    }
  }

  return size === BASE_SIZE
    ? { ...s, base, locked, chart: buildChart(s.garment, base, s.grades, chart, locked) }
    : { ...s, chart, locked }
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
    case 'cell':
      return applyEdits(s, a.size, [{ key: a.key, value: a.value }])
    case 'cells':
      // Varias medidas a la vez: lo que produce arrastrar un vertice, que
      // suele mover dos (ancho y alto) en el mismo gesto.
      return applyEdits(s, a.size, a.edits)
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
