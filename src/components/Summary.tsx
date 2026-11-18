import type { DraftResult } from '../engine/types'
import { formatMm, type Unit } from '../engine/units'
import type { LayoutResult } from '../engine/layout'

const LABELS: Record<string, string> = {
  armholeFront: 'Sisa delantero',
  armholeBack: 'Sisa espalda',
  armholeTotal: 'Sisa total',
  sleeveCapLength: 'Largo de copa',
  sleeveCapHeight: 'Alto de copa',
  neckOpening: 'Contorno de escote',
  hoodNeckLength: 'Cuello de capucha (por panel)',
  ribLength: 'Largo del rib de cuello',
  chestCircumference: 'Contorno de pecho',
  hemCircumference: 'Contorno de bajo',
  panelLength: 'Largo del panel sin rib',
  inseamFront: 'Entrepierna delantera',
  inseamBack: 'Entrepierna trasera',
  riseFront: 'Curva de tiro delantera',
  riseBack: 'Curva de tiro trasera',
  sideSeam: 'Costura de costado',
  thighFront: 'Muslo delantero',
  thighBack: 'Muslo trasero',
  waistCircumference: 'Contorno de cintura',
  hipCircumference: 'Contorno de cadera',
  totalLength: 'Largo total',
}

type Props = {
  result: DraftResult
  layout: LayoutResult
  unit: Unit
  selected: string | null
  onSelect: (id: string | null) => void
}

export function Summary({ result, layout, unit, selected, onSelect }: Props) {
  const piece = result.pieces.find((p) => p.id === selected)

  return (
    <aside className="summary">
      {result.warnings.length > 0 && (
        <section>
          <h3>Avisos del patron</h3>
          <ul className="warnings">
            {result.warnings.map((w, i) => (
              <li key={i} className={`warn warn-${w.level}`}>
                {w.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Valores calculados</h3>
        <dl className="computed">
          {Object.entries(result.computed).map(([key, value]) => (
            <div key={key}>
              <dt>{LABELS[key] ?? key}</dt>
              <dd>{formatMm(value, unit)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3>Piezas ({result.pieces.length})</h3>
        <ul className="piece-list">
          {result.pieces.map((p) => {
            const placed = layout.placed.find((x) => x.piece.id === p.id)
            return (
              <li key={p.id}>
                <button className={selected === p.id ? 'on' : ''} onClick={() => onSelect(selected === p.id ? null : p.id)}>
                  <strong>{p.name}</strong>
                  <span>
                    x{p.cutCount}
                    {p.onFold ? ' · sobre doblez' : ''}
                    {placed ? ` · ${formatMm(placed.net.w, unit)} × ${formatMm(placed.net.h, unit)}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {piece && (
        <section className="piece-detail">
          <h3>{piece.name}</h3>
          <p>
            Hilo {piece.grain === 'vertical' ? 'vertical' : piece.grain === 'horizontal' ? 'horizontal' : 'al bies'} ·
            margen {formatMm(piece.seamAllowance, unit)}
          </p>
          {piece.notes && (
            <ul className="notes">
              {piece.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h3>Marcador</h3>
        <p className="marker-info">
          {formatMm(layout.width, unit)} de ancho × {formatMm(layout.height, unit)} de largo de tela, con las piezas
          colocadas en filas dentro del ancho util configurado.
        </p>
      </section>
    </aside>
  )
}
