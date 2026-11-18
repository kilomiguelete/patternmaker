import type { GarmentKind } from '../measurements'
import type { DraftResult } from '../types'
import { draftHoodie } from './hoodie'
import { draftPants } from './pants'
import { draftTee } from './tee'
import type { M } from './common'

export function draft(kind: GarmentKind, m: M): DraftResult {
  switch (kind) {
    case 'tee':
      return draftTee(m)
    case 'hoodie':
      return draftHoodie(m)
    case 'pants':
      return draftPants(m)
  }
}

export type { M } from './common'
