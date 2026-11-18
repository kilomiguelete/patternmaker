import { useRef, useState } from 'react'
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { GARMENT_LIST, SIZES } from '../engine/measurements'
import type { Unit } from '../engine/units'
import type { Action, State } from '../state/store'

type Props = {
  state: State
  dispatch: (a: Action) => void
  onExport: (kind: 'svg' | 'pdf' | 'csv' | 'json') => void
  onImport: (text: string) => void
}

const UNITS: Unit[] = ['cm', 'mm', 'in']

export function Toolbar({ state, dispatch, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  // En movil las opciones secundarias van plegadas; en escritorio el CSS
  // las muestra siempre.
  const [optionsOpen, setOptionsOpen] = useState(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)

  // En movil el nombre del proyecto y la unidad se consultan poco, asi que
  // bajan al panel de opciones y dejan sitio al dibujo.
  const projectField = (
    <label className="field">
      <span>Proyecto</span>
      <input value={state.name} onChange={(e) => dispatch({ type: 'name', name: e.target.value })} />
    </label>
  )

  const unitField = (
    <label className="field field-narrow">
      <span>Unidad</span>
      <select value={state.unit} onChange={(e) => dispatch({ type: 'unit', unit: e.target.value as Unit })}>
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">TP</span>
        <div>
          <h1>Trendsplant Pattern Maker</h1>
          <p>Tablas de medidas, patrones y fichas tecnicas con preview</p>
        </div>
      </div>

      <div className="toolbar-group">
        {!isMobile && projectField}

        <div className="field">
          <span>Prenda</span>
          <div className="segmented">
            {GARMENT_LIST.map((g) => (
              <button
                key={g.kind}
                className={state.garment === g.kind ? 'on' : ''}
                onClick={() => dispatch({ type: 'garment', kind: g.kind })}
                title={g.blurb}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Talla del patron</span>
          <div className="segmented">
            {SIZES.map((s) => (
              <button key={s} className={state.activeSize === s ? 'on' : ''} onClick={() => dispatch({ type: 'size', size: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {!isMobile && unitField}
      </div>

      <button
        className="toolbar-toggle"
        aria-expanded={optionsOpen}
        onClick={() => setOptionsOpen((v) => !v)}
      >
        {optionsOpen ? 'Cerrar opciones' : 'Opciones y exportar'}
      </button>

      <div className={`toolbar-group toolbar-right${optionsOpen ? ' open' : ''}`}>
        {isMobile && (
          <div className="sheet-fields">
            {projectField}
            {unitField}
          </div>
        )}

        <div className="toggles">
          <label>
            <input
              type="checkbox"
              checked={state.view.showSeamAllowance}
              onChange={(e) => dispatch({ type: 'view', patch: { showSeamAllowance: e.target.checked } })}
            />
            Margen de costura
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.view.showDimensions}
              onChange={(e) => dispatch({ type: 'view', patch: { showDimensions: e.target.checked } })}
            />
            Cotas
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.view.showLabels}
              onChange={(e) => dispatch({ type: 'view', patch: { showLabels: e.target.checked } })}
            />
            Etiquetas
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.view.unfold}
              onChange={(e) => dispatch({ type: 'view', patch: { unfold: e.target.checked } })}
            />
            Desplegar doblez
          </label>
          <label title="Muestra los vertices del patron; al arrastrarlos se reescribe la medida que controlan">
            <input
              type="checkbox"
              checked={state.view.editHandles}
              onChange={(e) => dispatch({ type: 'view', patch: { editHandles: e.target.checked } })}
            />
            Editar vertices
          </label>
        </div>

        <div className="actions">
          <button onClick={() => onExport('svg')}>SVG</button>
          <button onClick={() => onExport('pdf')}>PDF 1:1</button>
          <button onClick={() => onExport('csv')}>Tabla CSV</button>
          <button onClick={() => onExport('json')}>Guardar</button>
          <button onClick={() => fileRef.current?.click()}>Abrir</button>
          <button className="danger" onClick={() => dispatch({ type: 'resetAll' })}>
            Reiniciar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              onImport(await file.text())
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}
