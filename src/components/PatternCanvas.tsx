import { useEffect, useRef, useState } from 'react'
import { dimGeometry, grainline } from '../engine/annotate'
import type { LayoutResult } from '../engine/layout'
import { formatMm, type Unit } from '../engine/units'
import type { ViewOptions } from '../state/store'

type Props = {
  layout: LayoutResult
  unit: Unit
  view: ViewOptions
  selected: string | null
  onSelect: (id: string | null) => void
}

const PAD = 60

export function PatternCanvas({ layout, unit, view, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number; px: number; py: number } | null>(null)

  const contentW = layout.width + PAD * 2
  const contentH = layout.height + PAD * 2

  // Encaje inicial y al cambiar de prenda/talla.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = Math.min(el.clientWidth / contentW, el.clientHeight / contentH)
    setZoom(Number.isFinite(fit) && fit > 0 ? fit * 0.96 : 1)
    setPan({ x: 0, y: 0 })
  }, [contentW, contentH])

  const scale = zoom

  return (
    <div className="canvas-shell">
      <div className="canvas-tools">
        <button onClick={() => setZoom((z) => Math.min(6, z * 1.25))} title="Acercar">+</button>
        <button onClick={() => setZoom((z) => Math.max(0.05, z / 1.25))} title="Alejar">−</button>
        <button
          onClick={() => {
            const el = wrapRef.current
            if (!el) return
            setZoom(Math.min(el.clientWidth / contentW, el.clientHeight / contentH) * 0.96)
            setPan({ x: 0, y: 0 })
          }}
          title="Encajar en pantalla"
        >
          ⤢
        </button>
        <span className="zoom-label">{Math.round(scale * 100)} %</span>
      </div>

      <div
        className="canvas-wrap"
        ref={wrapRef}
        onMouseDown={(e) => setDrag({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y })}
        onMouseMove={(e) => {
          if (!drag) return
          setPan({ x: drag.px + (e.clientX - drag.x), y: drag.py + (e.clientY - drag.y) })
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          setZoom((z) => Math.min(6, Math.max(0.05, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))
        }}
        style={{ cursor: drag ? 'grabbing' : 'grab' }}
      >
        <svg
          width={contentW * scale}
          height={contentH * scale}
          viewBox={`${-PAD} ${-PAD} ${contentW} ${contentH}`}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelect(null)
          }}
        >
          <defs>
            <marker id="tp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="grain-arrow" />
            </marker>
            <pattern id="tp-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" className="grid-line" strokeWidth="0.5" />
              <path d="M 10 0 V 100 M 20 0 V 100 M 30 0 V 100 M 40 0 V 100 M 50 0 V 100 M 60 0 V 100 M 70 0 V 100 M 80 0 V 100 M 90 0 V 100 M 0 10 H 100 M 0 20 H 100 M 0 30 H 100 M 0 40 H 100 M 0 50 H 100 M 0 60 H 100 M 0 70 H 100 M 0 80 H 100 M 0 90 H 100"
                fill="none" className="grid-line-fine" strokeWidth="0.2" />
            </pattern>
          </defs>

          <rect x={-PAD} y={-PAD} width={contentW} height={contentH} className="canvas-bg" />
          <rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#tp-grid)" />
          <rect x={0} y={0} width={layout.width} height={layout.height} className="sheet-outline" />
          <text x={0} y={-16} className="sheet-label">
            Marcador {formatMm(layout.width, unit)} × {formatMm(layout.height, unit)} · retícula 10 / 100 mm
          </text>

          {layout.placed.map((p) => {
            const isSel = selected === p.piece.id
            return (
              <g
                key={p.piece.id}
                transform={`translate(${p.offset.x} ${p.offset.y})`}
                className={`piece${isSel ? ' piece-selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(isSel ? null : p.piece.id)
                }}
              >
                {view.showSeamAllowance && p.piece.seamAllowance > 0 && (
                  <path d={p.seamPath} className="seam-allowance" />
                )}
                <path d={p.outlinePath} className="piece-outline" />
                {view.unfold && p.mirrorPath && <path d={p.mirrorPath} className="piece-mirror" />}
                {p.foldAxis !== undefined && (
                  <line x1={p.foldAxis} y1={p.net.min.y} x2={p.foldAxis} y2={p.net.max.y} className="fold-line" />
                )}

                {(p.piece.guides ?? []).map((guide) => (
                  <polyline
                    key={guide.id}
                    points={guide.points.map((q) => `${q.x},${q.y}`).join(' ')}
                    className={`guide guide-${guide.style ?? 'solid'}`}
                  />
                ))}

                {(() => {
                  const gl = grainline(p.net, p.piece.grain)
                  return (
                    <line
                      x1={gl.a.x}
                      y1={gl.a.y}
                      x2={gl.b.x}
                      y2={gl.b.y}
                      className="grainline"
                      markerStart="url(#tp-arrow)"
                      markerEnd="url(#tp-arrow)"
                    />
                  )
                })()}

                {view.showDimensions &&
                  (p.piece.dimensions ?? []).map((dim) => {
                    const gm = dimGeometry(dim.from, dim.to, dim.offset ?? 0)
                    return (
                      <g key={dim.id} className="dim">
                        <line x1={gm.a.x} y1={gm.a.y} x2={gm.b.x} y2={gm.b.y} className="dim-line" />
                        <line x1={gm.leaderA[0].x} y1={gm.leaderA[0].y} x2={gm.leaderA[1].x} y2={gm.leaderA[1].y} className="dim-leader" />
                        <line x1={gm.leaderB[0].x} y1={gm.leaderB[0].y} x2={gm.leaderB[1].x} y2={gm.leaderB[1].y} className="dim-leader" />
                        <text
                          x={gm.text.x}
                          y={gm.text.y}
                          className="dim-text"
                          textAnchor="middle"
                          transform={`rotate(${gm.angle} ${gm.text.x} ${gm.text.y})`}
                        >
                          {dim.label} {formatMm(gm.length, unit)}
                        </text>
                      </g>
                    )
                  })}

                {view.showLabels && (
                  <g className="piece-label">
                    <text
                      x={(p.net.min.x + p.net.max.x) / 2}
                      y={(p.net.min.y + p.net.max.y) / 2 - 14}
                      textAnchor="middle"
                      className="piece-name"
                    >
                      {p.piece.name}
                    </text>
                    <text
                      x={(p.net.min.x + p.net.max.x) / 2}
                      y={(p.net.min.y + p.net.max.y) / 2 + 2}
                      textAnchor="middle"
                      className="piece-meta"
                    >
                      x{p.piece.cutCount}
                      {p.piece.onFold ? ' sobre doblez' : ''} · MC {formatMm(p.piece.seamAllowance, unit)}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <p className="canvas-hint">Arrastra para mover · Ctrl/⌘ + rueda para hacer zoom · clic en una pieza para ver su ficha</p>
    </div>
  )
}
