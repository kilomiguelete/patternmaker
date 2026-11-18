import { dimGeometry } from '../engine/annotate'
import { buildFlat } from '../engine/flats'
import type { GarmentKind } from '../engine/measurements'
import { formatMm, type Unit } from '../engine/units'

type Props = {
  garment: GarmentKind
  measurements: Record<string, number>
  unit: Unit
  showDimensions: boolean
}

export function FlatSketch({ garment, measurements, unit, showDimensions }: Props) {
  const flat = buildFlat(garment, measurements)

  return (
    <div className="flat-wrap">
      <svg viewBox={`${flat.box.x} ${flat.box.y} ${flat.box.w} ${flat.box.h}`} className="flat-svg">
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
      </svg>
    </div>
  )
}
