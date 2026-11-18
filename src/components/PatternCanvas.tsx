import { useCallback, useEffect, useRef, useState } from 'react'
import { dimGeometry, grainline } from '../engine/annotate'
import type { LayoutResult } from '../engine/layout'
import type { Handle, Piece } from '../engine/types'
import { formatMm, type Unit } from '../engine/units'
import type { ViewOptions } from '../state/store'

export type HandleEdit = { key: string; value: number }

type Props = {
  layout: LayoutResult
  unit: Unit
  view: ViewOptions
  selected: string | null
  onSelect: (id: string | null) => void
  /** Medidas que resultan de arrastrar un vertice. */
  onHandleDrag?: (edits: HandleEdit[]) => void
}

type DragState = {
  handle: Handle
  piece: string
  /** Puntero que inicio el arrastre; se ignoran los demas. */
  pointerId: number
  /** Posicion del puntero al empezar, en px de pantalla. */
  originX: number
  originY: number
  /** Coordenadas del vertice al empezar, en mm. */
  startX: number
  startY: number
  scale: number
}

/** Aplica el eje de un vertice: medida = scale * coordenada + offset. */
function axisValue(axis: Handle['x'], coord: number): number {
  if (!axis) return NaN
  return axis.scale * coord + (axis.offset ?? 0)
}

const PAD = 60
const MIN_ZOOM = 0.05
const MAX_ZOOM = 8

type Camera = { z: number; x: number; y: number }

type Gesture =
  | { kind: 'pan'; id: number; startX: number; startY: number; cam: Camera }
  | { kind: 'pinch'; startDist: number; startZoom: number; u: number; v: number }

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** true en pantallas tactiles, donde los blancos tienen que ser mas grandes. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return coarse
}

export function PatternCanvas({ layout, unit, view, selected, onSelect, onHandleDrag }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Camera>({ z: 1, x: 0, y: 0 })
  const [handleDrag, setHandleDrag] = useState<DragState | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const coarse = useCoarsePointer()

  /** Punteros activos sobre el lienzo, para distinguir arrastre de pellizco. */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)

  const contentW = layout.width + PAD * 2
  const contentH = layout.height + PAD * 2
  const scale = cam.z

  const fit = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const f = Math.min(el.clientWidth / contentW, el.clientHeight / contentH)
    setCam({ z: Number.isFinite(f) && f > 0 ? clampZoom(f * 0.94) : 1, x: 0, y: 0 })
  }, [contentW, contentH])

  // Encaje inicial y al cambiar de prenda, de talla o de tamano de ventana.
  useEffect(fit, [fit])
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  /** Esquina superior izquierda del SVG en pantalla, para una camara dada. */
  const svgOrigin = useCallback(
    (c: Camera) => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return { x: 0, y: 0, cx: 0, cy: 0 }
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      return { x: cx - (contentW * c.z) / 2 + c.x, y: cy - (contentH * c.z) / 2 + c.y, cx, cy }
    },
    [contentW, contentH],
  )

  /** Zoom manteniendo fijo el punto del patron que hay bajo (px, py). */
  const zoomAt = useCallback(
    (next: number, px: number, py: number) => {
      setCam((prev) => {
        const z = clampZoom(next)
        const o = svgOrigin(prev)
        const u = (px - o.x) / prev.z
        const v = (py - o.y) / prev.z
        return {
          z,
          x: px - u * z - o.cx + (contentW * z) / 2,
          y: py - v * z - o.cy + (contentH * z) / 2,
        }
      })
    },
    [svgOrigin, contentW, contentH],
  )

  const zoomCenter = useCallback(
    (factor: number) => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      zoomAt(cam.z * factor, r.left + r.width / 2, r.top + r.height / 2)
    },
    [cam.z, zoomAt],
  )

  // ---------------------------------------------------------- gestos

  const onPointerDown = (e: React.PointerEvent) => {
    if (handleDrag) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture?.(e.pointerId)

    const list = [...pointers.current.values()]
    if (list.length === 1) {
      gesture.current = { kind: 'pan', id: e.pointerId, startX: e.clientX, startY: e.clientY, cam }
      setPanning(true)
    } else if (list.length === 2) {
      const [a, b] = list
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const o = svgOrigin(cam)
      gesture.current = {
        kind: 'pinch',
        startDist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        startZoom: cam.z,
        u: (mx - o.x) / cam.z,
        v: (my - o.y) / cam.z,
      }
      setPanning(false)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    if (g.kind === 'pan' && g.id === e.pointerId) {
      setCam({ z: g.cam.z, x: g.cam.x + (e.clientX - g.startX), y: g.cam.y + (e.clientY - g.startY) })
      return
    }

    if (g.kind === 'pinch') {
      const list = [...pointers.current.values()]
      if (list.length < 2) return
      const [a, b] = list
      const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const z = clampZoom(g.startZoom * (dist / g.startDist))
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      setCam({
        z,
        x: mx - g.u * z - (r.left + r.width / 2) + (contentW * z) / 2,
        y: my - g.v * z - (r.top + r.height / 2) + (contentH * z) / 2,
      })
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      gesture.current = null
      setPanning(false)
    } else if (pointers.current.size === 1) {
      // Al soltar un dedo del pellizco, el que queda sigue desplazando.
      const [id, p0] = [...pointers.current.entries()][0]
      gesture.current = { kind: 'pan', id, startX: p0.x, startY: p0.y, cam }
    }
  }

  // ---------------------------------------------------------- vertices

  const startHandleDrag = useCallback(
    (e: React.PointerEvent, piece: Piece, handle: Handle) => {
      if (!onHandleDrag) return
      e.stopPropagation()
      e.preventDefault()
      setHandleDrag({
        handle,
        piece: piece.id,
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        startX: handle.p.x,
        startY: handle.p.y,
        scale,
      })
    },
    [onHandleDrag, scale],
  )

  useEffect(() => {
    if (!handleDrag || !onHandleDrag) return

    const move = (e: PointerEvent) => {
      if (e.pointerId !== handleDrag.pointerId) return
      const { handle, originX, originY, startX, startY, scale: s } = handleDrag
      const edits: HandleEdit[] = []
      const labels: string[] = []

      if (handle.x) {
        const value = axisValue(handle.x, startX + (e.clientX - originX) / s)
        edits.push({ key: handle.x.key, value })
        labels.push(formatMm(Math.abs(value), unit))
      }
      if (handle.y) {
        const value = axisValue(handle.y, startY + (e.clientY - originY) / s)
        edits.push({ key: handle.y.key, value })
        labels.push(formatMm(Math.abs(value), unit))
      }
      if (edits.length) {
        onHandleDrag(edits)
        setHint(`${handle.label}: ${labels.join(' × ')}`)
      }
    }

    const up = (e: PointerEvent) => {
      if (e.pointerId !== handleDrag.pointerId) return
      setHandleDrag(null)
      setHint(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [handleDrag, onHandleDrag, unit])

  return (
    <div className="canvas-shell">
      <div className="canvas-tools">
        <button onClick={() => zoomCenter(1.3)} title="Acercar" aria-label="Acercar">+</button>
        <button onClick={() => zoomCenter(1 / 1.3)} title="Alejar" aria-label="Alejar">−</button>
        <button onClick={fit} title="Encajar en pantalla" aria-label="Encajar en pantalla">⤢</button>
        <span className="zoom-label">{Math.round(scale * 100)} %</span>
      </div>

      <div
        className="canvas-wrap"
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          zoomAt(cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY)
        }}
        style={{ cursor: handleDrag ? 'crosshair' : panning ? 'grabbing' : 'grab' }}
      >
        <svg
          width={contentW * scale}
          height={contentH * scale}
          viewBox={`${-PAD} ${-PAD} ${contentW} ${contentH}`}
          style={{ transform: `translate(${cam.x}px, ${cam.y}px)` }}
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

                {view.editHandles &&
                  onHandleDrag &&
                  (p.piece.handles ?? []).map((h) => (
                    <g
                      key={h.id}
                      className={`handle${handleDrag?.handle.id === h.id && handleDrag.piece === p.piece.id ? ' handle-active' : ''}`}
                      onPointerDown={(e) => startHandleDrag(e, p.piece, h)}
                    >
                      <circle cx={h.p.x} cy={h.p.y} r={(coarse ? 26 : 14) / scale} className="handle-hit" />
                      <circle cx={h.p.x} cy={h.p.y} r={(coarse ? 8 : 5) / scale} className="handle-dot" />
                      <title>
                        {h.label} — arrastra para cambiar {[h.x?.key, h.y?.key].filter(Boolean).join(' y ')}
                      </title>
                    </g>
                  ))}

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
      {hint && <div className="handle-readout">{hint}</div>}
      <p className="canvas-hint">
        {view.editHandles && onHandleDrag
          ? 'Arrastra un punto verde para cambiar la medida que controla · el resto del patron se recalcula solo'
          : coarse
            ? 'Desliza para mover · pellizca para el zoom · toca una pieza'
            : 'Arrastra para mover · Ctrl/⌘ + rueda para hacer zoom · clic en una pieza para ver su ficha'}
      </p>
    </div>
  )
}
