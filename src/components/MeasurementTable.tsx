import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { GARMENTS, GROUP_LABELS, SIZES, type MeasurementGroup, type Size } from '../engine/measurements'
import { rowGrade, type SizeChart, type LockedCells } from '../engine/grading'
import { fromMm, toMm, type Unit } from '../engine/units'
import type { Action } from '../state/store'
import type { GarmentKind } from '../engine/measurements'

type Props = {
  garment: GarmentKind
  chart: SizeChart
  locked: LockedCells
  grades: Record<string, number>
  unit: Unit
  activeSize: Size
  dispatch: (a: Action) => void
}

const dec = (u: Unit) => (u === 'mm' ? 0 : u === 'cm' ? 1 : 2)

function NumCell({
  mm,
  unit,
  edited,
  active,
  onCommit,
}: {
  mm: number
  unit: Unit
  edited: boolean
  active: boolean
  onCommit: (mm: number) => void
}) {
  const shown = fromMm(mm, unit).toFixed(dec(unit))
  const [draftValue, setDraftValue] = useState<string | null>(null)

  return (
    <input
      className={`cell${active ? ' cell-active' : ''}${edited ? ' cell-edited' : ''}`}
      inputMode="decimal"
      value={draftValue ?? shown}
      onChange={(e) => setDraftValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        if (draftValue !== null) {
          const parsed = Number(draftValue.replace(',', '.'))
          if (Number.isFinite(parsed)) onCommit(toMm(parsed, unit))
          setDraftValue(null)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraftValue(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

export function MeasurementTable({ garment, chart, locked, grades, unit, activeSize, dispatch }: Props) {
  const specs = GARMENTS[garment].specs
  // En tactil no hay hover, asi que el "como se mide" se despliega al tocar.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const activeTh = useRef<HTMLTableCellElement>(null)

  // Con 7 tallas la columna activa puede quedar fuera de la vista.
  useEffect(() => {
    activeTh.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeSize, garment])
  const groups = useMemo(() => {
    const map = new Map<MeasurementGroup, typeof specs>()
    for (const s of specs) {
      const list = map.get(s.group) ?? []
      list.push(s)
      map.set(s.group, list)
    }
    return [...map.entries()]
  }, [specs])

  return (
    <div className="table-wrap">
      <table className="chart">
        <thead>
          <tr>
            <th className="th-name">Medida</th>
            {SIZES.map((s) => (
              <th
                key={s}
                ref={s === activeSize ? activeTh : undefined}
                className={s === activeSize ? 'th-size th-active' : 'th-size'}
                onClick={() => dispatch({ type: 'size', size: s })}
                title="Ver el patron de esta talla"
              >
                {s}
              </th>
            ))}
            <th className="th-grade" title="Incremento entre tallas consecutivas">
              Salto
            </th>
            <th className="th-reset"></th>
          </tr>
        </thead>
        {groups.map(([group, rows]) => (
          <tbody key={group}>
            <tr className="group-row">
              <td colSpan={SIZES.length + 3}>
                <span className="sticky-left">{GROUP_LABELS[group]}</span>
              </td>
            </tr>
            {rows.map((spec) => {
              const computedGrade = rowGrade(chart, spec.key)
              const isPercent = spec.key === 'sleeveEase'
              const row = (
                <tr key={spec.key}>
                  <th className="th-name" scope="row">
                    <button
                      type="button"
                      className="name-button"
                      title={spec.how}
                      aria-expanded={openKey === spec.key}
                      onClick={() => setOpenKey((k) => (k === spec.key ? null : spec.key))}
                    >
                      <span className="code">{spec.code}</span>
                      <span className="name-text">{spec.label}</span>
                    </button>
                  </th>
                  {SIZES.map((size) => (
                    <td key={size}>
                      {isPercent ? (
                        <input
                          className={`cell${size === activeSize ? ' cell-active' : ''}`}
                          inputMode="decimal"
                          value={chart[spec.key][size].toFixed(1)}
                          onChange={(e) => {
                            const parsed = Number(e.target.value.replace(',', '.'))
                            if (Number.isFinite(parsed)) dispatch({ type: 'cell', key: spec.key, size, value: parsed })
                          }}
                        />
                      ) : (
                        <NumCell
                          mm={chart[spec.key][size]}
                          unit={unit}
                          active={size === activeSize}
                          edited={Boolean(locked[spec.key]?.[size])}
                          onCommit={(mm) => dispatch({ type: 'cell', key: spec.key, size, value: mm })}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <input
                      className="cell cell-grade"
                      inputMode="decimal"
                      title={Number.isNaN(computedGrade) ? 'Saltos irregulares: escribe un valor para uniformar la fila' : undefined}
                      value={
                        Number.isNaN(computedGrade)
                          ? '~'
                          : isPercent
                            ? computedGrade.toFixed(1)
                            : fromMm(grades[spec.key] ?? 0, unit).toFixed(dec(unit))
                      }
                      onChange={(e) => {
                        const parsed = Number(e.target.value.replace(',', '.'))
                        if (Number.isFinite(parsed)) {
                          dispatch({ type: 'grade', key: spec.key, value: isPercent ? parsed : toMm(parsed, unit) })
                        }
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className="row-reset"
                      title="Restaurar esta medida"
                      onClick={() => dispatch({ type: 'resetRow', key: spec.key })}
                    >
                      ⟲
                    </button>
                  </td>
                </tr>
              )
              const info =
                openKey === spec.key ? (
                  <tr key={`${spec.key}-info`} className="info-row">
                    <td colSpan={SIZES.length + 3}>
                      <div className="sticky-left info-body">
                        <strong>{spec.label}</strong>
                        <span>{spec.how}</span>
                      </div>
                    </td>
                  </tr>
                ) : null
              return info ? (
                <Fragment key={spec.key}>
                  {row}
                  {info}
                </Fragment>
              ) : (
                row
              )
            })}
          </tbody>
        ))}
      </table>
      <p className="table-note">
        Valores en <strong>{unit}</strong> sobre la prenda acabada, medida en plano. Las celdas en ambar se han
        editado a mano y el regrade automatico no las toca. Pulsa una talla en la cabecera para dibujar su patron.
      </p>
    </div>
  )
}
