import { useRef } from 'react'
import { dimGeometry } from '../engine/annotate'
import { buildFlat } from '../engine/flats'
import type { GarmentKind } from '../engine/measurements'
import { formatMm, type Unit } from '../engine/units'
import { useHandleDrag, type HandleEdit } from '../hooks/useHandleDrag'

type Props = {
  garment: GarmentKind
  measurements: Record<string, number>
  unit: Unit
  showDimensions: boolean
  /** Medidas que resultan de arrastrar un vertice del dibujo. */
  onHandleDrag?: (edits: HandleEdit[]) => void
}

export function FlatSketch({ garment, measurements, unit, showDimensions, onHandleDrag }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const flat = buildFlat(garment, measurements)

  // El SVG se escala para encajar en su hueco, asi que la escala real se
  // lee de la propia matriz de pantalla.
  const pxPerMm = () => svgRef.current?.getScreenCTM()?.a ?? 0

  const { start, hint, activeId } = useHandleDrag({ unit, onEdit: onHandleDrag, pxPerMm })

  // El croquis se autoescala al hueco, asi que los puntos se dimensionan
  // contra el dibujo para verse igual de grandes en todas las prendas.
  const span = Math.max(flat.box.w, flat.box.h)
  const dotR = span / 90
  const hitR = span / 26

  return (
    <div className="flat-wrap">
      <svg
        ref={svgRef}
        viewBox={`${flat.box.x} ${flat.box.y} ${flat.box.w} ${flat.box.h}`}
        className="flat-svg"
      >
        {flat.parts.map((part) => (
          <path key={part.id} d={part.d} className={`flat-${part.kind}`} />
        ))}

        {showDimensions &&
          flat.dims.map((dim) => {
            const gm = dimGeometry(dim.from, dim.to, dim.offset ?? 0)
            return (
              <g key={dim.id}>
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

        {onHandleDrag &&
          flat.handles.map((h) => (
            <g
              key={h.id}
              className={`handle flat-handle${activeId === h.id ? ' handle-active' : ''}`}
              onPointerDown={(e) => start(e, h.id, h)}
            >
              <circle cx={h.p.x} cy={h.p.y} r={hitR} className="handle-hit" />
              <circle cx={h.p.x} cy={h.p.y} r={dotR} className="handle-dot" />
              <title>
                {h.label} — arrastra para cambiar {[h.x?.key, h.y?.key].filter(Boolean).join(' y ')}
              </title>
            </g>
          ))}
      </svg>

      {hint && <div className="handle-readout">{hint}</div>}
      {onHandleDrag && (
        <p className="flat-hint">Arrastra los puntos para dar forma a la prenda · la tabla y el patron se recalculan</p>
      )}
    </div>
  )
}
