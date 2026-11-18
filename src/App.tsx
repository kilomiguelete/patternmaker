import { useState } from 'react'
import { FlatSketch } from './components/FlatSketch'
import { MeasurementTable } from './components/MeasurementTable'
import { PatternCanvas } from './components/PatternCanvas'
import { Summary } from './components/Summary'
import { Toolbar } from './components/Toolbar'
import { GARMENTS } from './engine/measurements'
import { chartToCsv } from './export/csv'
import type { PageSize } from './export/pdf'
import { parse, saveFile, serialize, slug } from './export/project'
import { patternToSvg } from './export/svgDoc'
import { useProject } from './state/store'

type Tab = 'pattern' | 'flat' | 'chart'

/** En movil solo cabe un panel a la vez; se eligen desde la barra inferior. */
type MobilePanel = 'chart' | 'preview' | 'summary'

const MOBILE_PANELS: { id: MobilePanel; label: string; icon: string }[] = [
  { id: 'chart', label: 'Medidas', icon: '▦' },
  { id: 'preview', label: 'Patron', icon: '✎' },
  { id: 'summary', label: 'Piezas', icon: '☰' },
]

export default function App() {
  const { state, dispatch, measurements, result, layout } = useProject()
  const [tab, setTab] = useState<Tab>('pattern')
  const [page, setPage] = useState<PageSize>('A4')
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<MobilePanel>('preview')

  const garment = GARMENTS[state.garment]
  const fileBase = `${slug(state.name)}-${garment.kind}-${state.activeSize}`
  const subtitle = `${garment.name} · talla ${state.activeSize} · ${state.name}`

  async function handleExport(kind: 'svg' | 'pdf' | 'csv' | 'json') {
    try {
      if (kind === 'svg') {
        const svg = patternToSvg(layout, {
          unit: state.unit,
          showSeamAllowance: state.view.showSeamAllowance,
          showDimensions: state.view.showDimensions,
          showLabels: state.view.showLabels,
          unfold: state.view.unfold,
          title: state.name,
          subtitle,
        })
        await saveFile(`${fileBase}.svg`, svg, 'image/svg+xml;charset=utf-8')
      } else if (kind === 'pdf') {
        // jsPDF pesa bastante: se carga solo al exportar.
        const { patternToPdf } = await import('./export/pdf')
        const doc = patternToPdf(layout, {
          page,
          landscape: false,
          unit: state.unit,
          showSeamAllowance: state.view.showSeamAllowance,
          showDimensions: state.view.showDimensions,
          overlap: 15,
          title: state.name,
          subtitle,
        })
        await saveFile(`${fileBase}-${page}.pdf`, doc.output('blob'), 'application/pdf')
      } else if (kind === 'csv') {
        await saveFile(
          `${slug(state.name)}-tabla-medidas.csv`,
          chartToCsv(state.garment, state.chart, state.unit),
          'text/csv;charset=utf-8',
        )
      } else {
        await saveFile(
          `${slug(state.name)}.json`,
          serialize({
            name: state.name,
            garment: state.garment,
            unit: state.unit,
            activeSize: state.activeSize,
            base: state.base,
            grades: state.grades,
            chart: state.chart,
            locked: state.locked,
          }),
          'application/json',
        )
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar.')
    }
  }

  function handleImport(text: string) {
    try {
      dispatch({ type: 'load', file: parse(text) })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archivo no valido.')
    }
  }

  return (
    <div className="app">
      <Toolbar state={state} dispatch={dispatch} onExport={handleExport} onImport={handleImport} />

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
          <button onClick={() => setError(null)}>cerrar</button>
        </div>
      )}

      <main className={`layout mobile-${panel}`}>
        <section className="panel panel-chart">
          <div className="panel-head">
            <h2>Tabla de medidas · {garment.name}</h2>
            <p>{garment.blurb}</p>
          </div>
          <MeasurementTable
            garment={state.garment}
            chart={state.chart}
            locked={state.locked}
            grades={state.grades}
            unit={state.unit}
            activeSize={state.activeSize}
            dispatch={dispatch}
          />
        </section>

        <section className="panel panel-preview">
          <div className="panel-head panel-head-row">
            <div className="tabs">
              <button className={tab === 'pattern' ? 'on' : ''} onClick={() => setTab('pattern')}>
                Patron
              </button>
              <button className={tab === 'flat' ? 'on' : ''} onClick={() => setTab('flat')}>
                Ficha tecnica
              </button>
              <button className={tab === 'chart' ? 'on' : ''} onClick={() => setTab('chart')}>
                Marcador
              </button>
            </div>
            <div className="preview-opts">
              <label>
                <span>Hoja PDF</span>
                <select value={page} onChange={(e) => setPage(e.target.value as PageSize)}>
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="A0">A0 (plotter)</option>
                </select>
              </label>
              <label>
                <span>Ancho de tela</span>
                <select
                  value={state.view.sheetWidth}
                  onChange={(e) => dispatch({ type: 'view', patch: { sheetWidth: Number(e.target.value) } })}
                >
                  <option value={900}>90 cm</option>
                  <option value={1100}>110 cm</option>
                  <option value={1500}>150 cm</option>
                  <option value={1800}>180 cm</option>
                  <option value={4000}>Sin limite</option>
                </select>
              </label>
            </div>
          </div>

          {tab === 'flat' ? (
            <FlatSketch
              garment={state.garment}
              measurements={measurements}
              unit={state.unit}
              showDimensions={state.view.showDimensions}
            />
          ) : (
            <PatternCanvas
              layout={layout}
              unit={state.unit}
              view={
                tab === 'chart'
                  ? { ...state.view, showDimensions: false, editHandles: false }
                  : state.view
              }
              selected={state.selectedPiece}
              onSelect={(id) => dispatch({ type: 'selectPiece', id })}
              onHandleDrag={(edits) => dispatch({ type: 'cells', size: state.activeSize, edits })}
            />
          )}
        </section>

        <Summary
          result={result}
          layout={layout}
          unit={state.unit}
          selected={state.selectedPiece}
          onSelect={(id) => dispatch({ type: 'selectPiece', id })}
        />
      </main>

      <nav className="bottom-nav" aria-label="Secciones">
        {MOBILE_PANELS.map((item) => (
          <button
            key={item.id}
            className={panel === item.id ? 'on' : ''}
            aria-current={panel === item.id}
            onClick={() => setPanel(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
