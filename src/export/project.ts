import type { GarmentKind, Size } from '../engine/measurements'
import type { BaseValues, Grades, LockedCells, SizeChart } from '../engine/grading'
import type { Unit } from '../engine/units'

export const PROJECT_FORMAT = 'trendsplant-pattern-maker/v1'

export type ProjectFile = {
  format: typeof PROJECT_FORMAT
  savedAt: string
  name: string
  garment: GarmentKind
  unit: Unit
  activeSize: Size
  base: BaseValues
  grades: Grades
  chart: SizeChart
  locked: LockedCells
}

export function serialize(p: Omit<ProjectFile, 'format' | 'savedAt'>): string {
  const file: ProjectFile = { format: PROJECT_FORMAT, savedAt: new Date().toISOString(), ...p }
  return JSON.stringify(file, null, 2)
}

export function parse(text: string): ProjectFile {
  const data = JSON.parse(text) as Partial<ProjectFile>
  if (data.format !== PROJECT_FORMAT) {
    throw new Error('El archivo no es un proyecto de Trendsplant Pattern Maker.')
  }
  if (!data.garment || !data.chart || !data.base || !data.grades) {
    throw new Error('El proyecto esta incompleto.')
  }
  return data as ProjectFile
}

export { saveFile } from './save'

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'patron'
}
