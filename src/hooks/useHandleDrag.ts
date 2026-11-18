import { useCallback, useEffect, useState } from 'react'
import type { Handle, HandleAxis, Point } from '../engine/types'
import { formatMm, type Unit } from '../engine/units'

export type HandleEdit = { key: string; value: number }

type DragState = {
  id: string
  handle: Handle
  pointerId: number
  originX: number
  originY: number
  /** Pixeles de pantalla por milimetro en el momento de empezar. */
  pxPerMm: number
}

const AXIS_X: Point = { x: 1, y: 0 }
const AXIS_Y: Point = { x: 0, y: 1 }

const dirOf = (axis: HandleAxis, fallback: Point): Point => axis.dir ?? fallback

/** Coordenada del punto sobre la direccion del eje. */
const project = (p: Point, d: Point): number => p.x * d.x + p.y * d.y

/** Valor de la medida para una coordenada: medida = scale * coord + offset. */
export function axisValue(axis: HandleAxis, coord: number): number {
  return axis.scale * coord + (axis.offset ?? 0)
}

/**
 * Arrastre de vertices compartido por el patron y el croquis. Convierte el
 * desplazamiento del puntero a milimetros, lo proyecta sobre la direccion de
 * cada eje y devuelve las medidas resultantes.
 */
export function useHandleDrag(opts: {
  unit: Unit
  onEdit?: (edits: HandleEdit[]) => void
  /** Escala actual del dibujo, en px de pantalla por mm. */
  pxPerMm: () => number
}) {
  const { unit, onEdit, pxPerMm } = opts
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const start = useCallback(
    (e: React.PointerEvent, id: string, handle: Handle) => {
      if (!onEdit) return
      e.stopPropagation()
      e.preventDefault()
      const scale = pxPerMm()
      if (!Number.isFinite(scale) || scale <= 0) return
      setDrag({ id, handle, pointerId: e.pointerId, originX: e.clientX, originY: e.clientY, pxPerMm: scale })
    },
    [onEdit, pxPerMm],
  )

  useEffect(() => {
    if (!drag || !onEdit) return

    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const dx = (e.clientX - drag.originX) / drag.pxPerMm
      const dy = (e.clientY - drag.originY) / drag.pxPerMm
      const { handle } = drag
      const edits: HandleEdit[] = []
      const labels: string[] = []

      for (const [axis, fallback] of [
        [handle.x, AXIS_X],
        [handle.y, AXIS_Y],
      ] as const) {
        if (!axis) continue
        const d = dirOf(axis, fallback)
        const coord = project(handle.p, d) + dx * d.x + dy * d.y
        const value = axisValue(axis, coord)
        edits.push({ key: axis.key, value })
        labels.push(formatMm(Math.abs(value), unit))
      }

      if (edits.length) {
        onEdit(edits)
        setHint(`${handle.label}: ${labels.join(' × ')}`)
      }
    }

    const end = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      setDrag(null)
      setHint(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [drag, onEdit, unit])

  return { start, hint, activeId: drag?.id ?? null, dragging: drag !== null }
}
