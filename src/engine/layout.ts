import { bbox, flattenWithEdges, offsetPolygon } from './geometry'
import { contourToPath, polylineToPath } from './path'
import type { Piece, Point } from './types'

export type Box = { min: Point; max: Point; w: number; h: number }

export type PlacedPiece = {
  piece: Piece
  /** Traslacion aplicada en el marcador. */
  offset: Point
  /** Caja del contorno neto en coordenadas locales de la pieza. */
  net: Box
  /** Caja incluyendo margen de costura. */
  gross: Box
  outlinePath: string
  seamPath: string
  /** Mitad espejada, para previsualizar piezas cortadas sobre doblez. */
  mirrorPath?: string
  foldAxis?: number
}

export function foldAxisOf(piece: Piece): number | undefined {
  if (!piece.onFold) return undefined
  const idx = piece.foldEdges?.[0]
  const nodes = piece.outline.nodes
  if (idx === undefined) return 0
  const a = nodes[idx]
  const b = nodes[(idx + 1) % nodes.length]
  if (!a || !b) return 0
  return Math.abs(a.p.x - b.p.x) < 0.5 ? a.p.x : undefined
}

export function seamOutline(piece: Piece): Point[] {
  const { points, edge } = flattenWithEdges(piece.outline)
  const offsets = edge.map((e) => {
    const override = piece.seamAllowanceOverrides?.[e]
    return override === undefined ? piece.seamAllowance : override
  })
  return offsetPolygon(points, offsets)
}

export function measurePiece(piece: Piece): { net: Box; gross: Box; seam: Point[] } {
  const { points } = flattenWithEdges(piece.outline)
  const seam = seamOutline(piece)
  return { net: bbox(points), gross: bbox(seam.length ? seam : points), seam }
}

export type LayoutOptions = {
  /** Ancho util del marcador, en mm (ancho de tela). */
  sheetWidth: number
  gap: number
  showSeamAllowance: boolean
  /** Desplegar piezas cortadas sobre doblez. */
  unfold: boolean
}

export type LayoutResult = {
  placed: PlacedPiece[]
  width: number
  height: number
}

/**
 * Coloca las piezas en filas de izquierda a derecha, de mayor a menor alto,
 * dentro del ancho de tela indicado. Suficiente como marcador de muestra.
 */
export function layoutPieces(pieces: Piece[], opts: LayoutOptions): LayoutResult {
  const prepared = pieces.map((piece) => {
    const { net, gross, seam } = measurePiece(piece)
    const axis = foldAxisOf(piece)
    const unfolded = opts.unfold && axis !== undefined
    const box = opts.showSeamAllowance ? gross : net

    const effective: Box = unfolded
      ? {
          min: { x: axis - (box.max.x - axis), y: box.min.y },
          max: { x: box.max.x, y: box.max.y },
          w: (box.max.x - axis) * 2,
          h: box.h,
        }
      : box

    return {
      piece,
      net,
      gross,
      seam,
      box: effective,
      axis,
      unfolded,
    }
  })

  const order = [...prepared].sort((a, b) => b.box.h - a.box.h)

  const placed: PlacedPiece[] = []
  let cursorX = 0
  let rowY = 0
  let rowHeight = 0
  let maxX = 0

  for (const item of order) {
    if (cursorX > 0 && cursorX + item.box.w > opts.sheetWidth) {
      rowY += rowHeight + opts.gap
      cursorX = 0
      rowHeight = 0
    }
    const offset: Point = {
      x: cursorX - item.box.min.x,
      y: rowY - item.box.min.y,
    }
    placed.push({
      piece: item.piece,
      offset,
      net: item.net,
      gross: item.gross,
      outlinePath: contourToPath(item.piece.outline),
      seamPath: polylineToPath(item.seam, true),
      mirrorPath:
        item.axis !== undefined
          ? contourToPath({
              ...item.piece.outline,
              nodes: item.piece.outline.nodes.map((nd) => ({
                ...nd,
                p: { x: 2 * item.axis! - nd.p.x, y: nd.p.y },
                in: nd.in ? { x: -nd.in.x, y: nd.in.y } : undefined,
                out: nd.out ? { x: -nd.out.x, y: nd.out.y } : undefined,
              })),
            })
          : undefined,
      foldAxis: item.axis,
    })
    cursorX += item.box.w + opts.gap
    rowHeight = Math.max(rowHeight, item.box.h)
    maxX = Math.max(maxX, cursorX - opts.gap)
  }

  return {
    placed,
    width: Math.max(maxX, 1),
    height: Math.max(rowY + rowHeight, 1),
  }
}
