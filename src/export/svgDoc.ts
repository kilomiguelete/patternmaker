import { dimGeometry, grainline } from '../engine/annotate'
import type { LayoutResult } from '../engine/layout'
import { formatMm, type Unit } from '../engine/units'

export type SvgOptions = {
  unit: Unit
  showSeamAllowance: boolean
  showDimensions: boolean
  showLabels: boolean
  unfold: boolean
  title: string
  subtitle: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** SVG autonomo a escala 1:1 (1 unidad de usuario = 1 mm). */
export function patternToSvg(layout: LayoutResult, opts: SvgOptions): string {
  const pad = 40
  const headerH = 70
  const w = layout.width + pad * 2
  const h = layout.height + pad * 2 + headerH

  const body: string[] = []
  const header: string[] = []

  header.push(
    `<text x="${pad}" y="26" font-size="16" font-weight="700" fill="#111">${esc(opts.title)}</text>`,
    `<text x="${pad}" y="46" font-size="10" fill="#555">${esc(opts.subtitle)}</text>`,
    `<text x="${pad}" y="60" font-size="8" fill="#888">Escala 1:1 — 1 unidad SVG = 1 mm. Verifica el cuadro de control antes de cortar.</text>`,
    `<rect x="${w - pad - 100}" y="12" width="100" height="100" fill="none" stroke="#111" stroke-width="0.5"/>`,
    `<text x="${w - pad - 100}" y="122" font-size="7" fill="#555">Cuadro de control 100 x 100 mm</text>`,
  )

  for (const p of layout.placed) {
    const { piece, offset } = p
    const g: string[] = []
    if (opts.showSeamAllowance && piece.seamAllowance > 0) {
      g.push(`<path d="${p.seamPath}" fill="#f4f6f8" stroke="#9aa4b2" stroke-width="0.5" stroke-dasharray="4 3"/>`)
    }
    g.push(`<path d="${p.outlinePath}" fill="rgba(17,17,17,0.04)" stroke="#111" stroke-width="0.9"/>`)
    if (opts.unfold && p.mirrorPath) {
      g.push(`<path d="${p.mirrorPath}" fill="none" stroke="#111" stroke-width="0.6" stroke-dasharray="6 4"/>`)
    }
    if (p.foldAxis !== undefined) {
      g.push(
        `<line x1="${p.foldAxis}" y1="${p.net.min.y}" x2="${p.foldAxis}" y2="${p.net.max.y}" stroke="#c026d3" stroke-width="1" stroke-dasharray="12 4 3 4"/>`,
      )
    }
    for (const guide of piece.guides ?? []) {
      const d = guide.points.map((q, i) => `${i ? 'L' : 'M'} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ')
      const dash = guide.style === 'dotted' ? '1.5 3' : guide.style === 'dashed' ? '7 4' : ''
      g.push(`<path d="${d}" fill="none" stroke="#2563eb" stroke-width="0.6"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`)
    }
    if (opts.showDimensions) {
      for (const dim of piece.dimensions ?? []) {
        const gm = dimGeometry(dim.from, dim.to, dim.offset ?? 0)
        g.push(
          `<line x1="${gm.a.x.toFixed(2)}" y1="${gm.a.y.toFixed(2)}" x2="${gm.b.x.toFixed(2)}" y2="${gm.b.y.toFixed(2)}" stroke="#dc2626" stroke-width="0.5"/>`,
          `<line x1="${gm.leaderA[0].x.toFixed(2)}" y1="${gm.leaderA[0].y.toFixed(2)}" x2="${gm.leaderA[1].x.toFixed(2)}" y2="${gm.leaderA[1].y.toFixed(2)}" stroke="#dc2626" stroke-width="0.3"/>`,
          `<line x1="${gm.leaderB[0].x.toFixed(2)}" y1="${gm.leaderB[0].y.toFixed(2)}" x2="${gm.leaderB[1].x.toFixed(2)}" y2="${gm.leaderB[1].y.toFixed(2)}" stroke="#dc2626" stroke-width="0.3"/>`,
          `<text x="${gm.text.x.toFixed(2)}" y="${gm.text.y.toFixed(2)}" font-size="7" fill="#dc2626" text-anchor="middle" transform="rotate(${gm.angle.toFixed(1)} ${gm.text.x.toFixed(2)} ${gm.text.y.toFixed(2)})">${esc(dim.label)} ${esc(formatMm(gm.length, opts.unit))}</text>`,
        )
      }
    }
    const gl = grainline(p.net, piece.grain)
    g.push(
      `<line x1="${gl.a.x.toFixed(2)}" y1="${gl.a.y.toFixed(2)}" x2="${gl.b.x.toFixed(2)}" y2="${gl.b.y.toFixed(2)}" stroke="#111" stroke-width="0.6" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`,
    )
    if (opts.showLabels) {
      const cx = (p.net.min.x + p.net.max.x) / 2
      const cy = (p.net.min.y + p.net.max.y) / 2
      g.push(
        `<text x="${cx.toFixed(2)}" y="${(cy - 14).toFixed(2)}" font-size="11" font-weight="700" fill="#111" text-anchor="middle">${esc(piece.name)}</text>`,
        `<text x="${cx.toFixed(2)}" y="${(cy + 2).toFixed(2)}" font-size="7.5" fill="#444" text-anchor="middle">x${piece.cutCount}${piece.onFold ? ' sobre doblez' : ''} — MC ${formatMm(piece.seamAllowance, opts.unit)}</text>`,
      )
    }
    body.push(`<g transform="translate(${offset.x.toFixed(2)} ${offset.y.toFixed(2)})">${g.join('')}</g>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#111"/></marker></defs>
<rect width="${w}" height="${h}" fill="#fff"/>
<g transform="translate(${pad} ${pad + headerH})">${body.join('')}</g>
${header.join('')}
</svg>`
}
