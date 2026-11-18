import { jsPDF } from 'jspdf'
import { dimGeometry, grainline } from '../engine/annotate'
import { flattenWithEdges } from '../engine/geometry'
import { seamOutline, type LayoutResult, type PlacedPiece } from '../engine/layout'
import { formatMm, type Unit } from '../engine/units'
import type { Point } from '../engine/types'

export type PageSize = 'A4' | 'A3' | 'A0'

const PAGES: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A0: { w: 841, h: 1189 },
}

export type PdfOptions = {
  page: PageSize
  landscape: boolean
  unit: Unit
  showSeamAllowance: boolean
  showDimensions: boolean
  /** Solapa entre hojas para pegar, en mm. */
  overlap: number
  title: string
  subtitle: string
}

type Poly = { points: Point[]; closed: boolean; dash?: number[]; width: number; color: [number, number, number] }

function piecePolys(p: PlacedPiece, opts: PdfOptions): Poly[] {
  const out: Poly[] = []
  const shift = (pts: Point[]) => pts.map((q) => ({ x: q.x + p.offset.x, y: q.y + p.offset.y }))

  if (opts.showSeamAllowance && p.piece.seamAllowance > 0) {
    out.push({ points: shift(seamOutline(p.piece)), closed: true, dash: [3, 2], width: 0.25, color: [150, 160, 175] })
  }
  out.push({ points: shift(flattenWithEdges(p.piece.outline, 0.3).points), closed: true, width: 0.5, color: [17, 17, 17] })

  if (p.foldAxis !== undefined) {
    out.push({
      points: shift([
        { x: p.foldAxis, y: p.net.min.y },
        { x: p.foldAxis, y: p.net.max.y },
      ]),
      closed: false,
      dash: [8, 3],
      width: 0.4,
      color: [192, 38, 211],
    })
  }
  for (const guide of p.piece.guides ?? []) {
    out.push({
      points: shift(guide.points),
      closed: false,
      dash: guide.style === 'dotted' ? [1, 2] : guide.style === 'dashed' ? [5, 3] : undefined,
      width: 0.3,
      color: [37, 99, 235],
    })
  }
  const gl = grainline(p.net, p.piece.grain)
  out.push({ points: shift([gl.a, gl.b]), closed: false, width: 0.4, color: [17, 17, 17] })

  if (opts.showDimensions) {
    for (const dim of p.piece.dimensions ?? []) {
      const gm = dimGeometry(dim.from, dim.to, dim.offset ?? 0)
      out.push({ points: shift([gm.a, gm.b]), closed: false, width: 0.25, color: [220, 38, 38] })
      out.push({ points: shift(gm.leaderA), closed: false, width: 0.15, color: [220, 38, 38] })
      out.push({ points: shift(gm.leaderB), closed: false, width: 0.15, color: [220, 38, 38] })
    }
  }
  return out
}

type Label = { x: number; y: number; text: string; size: number; bold?: boolean; color?: [number, number, number] }

function pieceLabels(p: PlacedPiece, opts: PdfOptions): Label[] {
  const cx = (p.net.min.x + p.net.max.x) / 2 + p.offset.x
  const cy = (p.net.min.y + p.net.max.y) / 2 + p.offset.y
  const labels: Label[] = [
    { x: cx, y: cy - 4, text: p.piece.name, size: 11, bold: true },
    {
      x: cx,
      y: cy + 2,
      text: `x${p.piece.cutCount}${p.piece.onFold ? ' sobre doblez' : ''} · MC ${formatMm(p.piece.seamAllowance, opts.unit)}`,
      size: 7,
    },
  ]
  if (opts.showDimensions) {
    for (const dim of p.piece.dimensions ?? []) {
      const gm = dimGeometry(dim.from, dim.to, dim.offset ?? 0)
      labels.push({
        x: gm.text.x + p.offset.x,
        y: gm.text.y + p.offset.y,
        text: `${dim.label} ${formatMm(gm.length, opts.unit)}`,
        size: 6.5,
        color: [220, 38, 38],
      })
    }
  }
  return labels
}

/**
 * PDF a escala 1:1. El patron se reparte en hojas con solapa y marcas de
 * union; cada hoja lleva su coordenada (fila/columna) para pegarlas.
 */
export function patternToPdf(layout: LayoutResult, opts: PdfOptions): jsPDF {
  const page = PAGES[opts.page]
  const pw = opts.landscape ? page.h : page.w
  const ph = opts.landscape ? page.w : page.h
  const margin = 10
  const usableW = pw - margin * 2
  const usableH = ph - margin * 2
  const step = { x: usableW - opts.overlap, y: usableH - opts.overlap }

  const polys = layout.placed.flatMap((p) => piecePolys(p, opts))
  const labels = layout.placed.flatMap((p) => pieceLabels(p, opts))

  const cols = Math.max(1, Math.ceil(layout.width / step.x))
  const rows = Math.max(1, Math.ceil(layout.height / step.y))

  const doc = new jsPDF({ orientation: opts.landscape ? 'landscape' : 'portrait', unit: 'mm', format: opts.page })
  doc.setLineJoin('round')

  let first = true
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!first) doc.addPage(opts.page, opts.landscape ? 'landscape' : 'portrait')
      first = false

      const originX = c * step.x
      const originY = r * step.y
      const tx = margin - originX
      const ty = margin - originY

      // Encabezado y marcas de union
      doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(60)
      doc.text(`${opts.title} — fila ${r + 1} / col ${c + 1} de ${rows}x${cols}`, margin, margin - 4)
      doc.setFont('helvetica', 'normal').setFontSize(6)
      doc.text(`${opts.subtitle} · escala 1:1 · solapa ${opts.overlap} mm`, margin, ph - margin + 5)

      doc.setDrawColor(200).setLineWidth(0.2)
      doc.rect(margin, margin, usableW, usableH)
      doc.setLineDashPattern([2, 2], 0)
      doc.line(margin + opts.overlap, margin, margin + opts.overlap, ph - margin)
      doc.line(margin, margin + opts.overlap, pw - margin, margin + opts.overlap)
      doc.setLineDashPattern([], 0)

      // Cuadro de control de 50 mm en la primera hoja
      if (r === 0 && c === 0) {
        doc.setDrawColor(17).setLineWidth(0.3)
        doc.rect(pw - margin - 50, ph - margin - 50, 50, 50)
        doc.setFontSize(6).setTextColor(90)
        doc.text('Control 50 x 50 mm', pw - margin - 50, ph - margin - 52)
      }

      doc.setLineWidth(0.5)
      for (const poly of polys) {
        if (poly.points.length < 2) continue
        const box = polyBox(poly.points)
        if (box.maxX + tx < margin - 2 || box.minX + tx > pw - margin + 2) continue
        if (box.maxY + ty < margin - 2 || box.minY + ty > ph - margin + 2) continue

        doc.setDrawColor(poly.color[0], poly.color[1], poly.color[2])
        doc.setLineWidth(poly.width)
        doc.setLineDashPattern(poly.dash ?? [], 0)
        const pts = poly.points.map((q) => [q.x + tx, q.y + ty] as [number, number])
        drawPolyline(doc, pts, poly.closed)
      }
      doc.setLineDashPattern([], 0)

      doc.setFont('helvetica', 'normal')
      for (const label of labels) {
        const x = label.x + tx
        const y = label.y + ty
        if (x < margin || x > pw - margin || y < margin || y > ph - margin) continue
        const col = label.color ?? [17, 17, 17]
        doc.setTextColor(col[0], col[1], col[2])
        doc.setFontSize(label.size)
        doc.setFont('helvetica', label.bold ? 'bold' : 'normal')
        doc.text(label.text, x, y, { align: 'center' })
      }
    }
  }
  return doc
}

function polyBox(points: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function drawPolyline(doc: jsPDF, pts: [number, number][], closed: boolean) {
  const all = closed ? [...pts, pts[0]] : pts
  // jsPDF dibuja mejor en tramos cortos que con un unico array enorme.
  const CHUNK = 400
  for (let i = 0; i < all.length - 1; i += CHUNK) {
    const slice = all.slice(i, Math.min(all.length, i + CHUNK + 1))
    if (slice.length < 2) continue
    const deltas = slice.slice(1).map((p, k) => [p[0] - slice[k][0], p[1] - slice[k][1]] as [number, number])
    doc.lines(deltas, slice[0][0], slice[0][1], [1, 1], 'S', false)
  }
}
