/** Todas las coordenadas y longitudes del motor estan en milimetros. */

export type Point = { x: number; y: number }

/** Nodo de un contorno. `handleOut`/`handleIn` son vectores relativos al nodo. */
export type Node = {
  p: Point
  /** Tangente de salida (hacia el nodo siguiente). */
  out?: Point
  /** Tangente de entrada (desde el nodo anterior). */
  in?: Point
  /** Etiqueta del punto de patronaje (HPS, SP, AH...). */
  label?: string
}

export type SeamKind =
  | 'cut'      // linea de corte
  | 'fold'     // doblez / canto de tela
  | 'seam'     // costura
  | 'internal' // linea interna (bolsillo, pinza, referencia)

export type Contour = {
  nodes: Node[]
  closed: boolean
  kind?: SeamKind
}

/** Linea interna de referencia dibujada dentro de la pieza. */
export type Guide = {
  id: string
  label?: string
  points: Point[]
  style?: 'dashed' | 'solid' | 'dotted'
}

/** Cota: medida anotada entre dos puntos. */
export type Dimension = {
  id: string
  from: Point
  to: Point
  label: string
  /** Desplazamiento perpendicular de la linea de cota, en mm. */
  offset?: number
}

export type GrainDirection = 'vertical' | 'horizontal' | 'bias'

export type Piece = {
  id: string
  name: string
  /** Contorno exterior (linea de corte neta, sin margen). */
  outline: Contour
  /** Aristas que van sobre doblez de tela (indices de nodo inicial del tramo). */
  foldEdges?: number[]
  guides?: Guide[]
  dimensions?: Dimension[]
  /** Cuantas veces se corta la pieza. */
  cutCount: number
  /** Si se corta sobre doblez (la pieza dibujada es media pieza). */
  onFold: boolean
  grain: GrainDirection
  /** Margen de costura por defecto de la pieza, en mm. */
  seamAllowance: number
  /** Margen especifico por tramo: clave = indice de nodo inicial del tramo. */
  seamAllowanceOverrides?: Record<number, number>
  notes?: string[]
}

export type DraftWarning = { level: 'info' | 'warn' | 'error'; message: string }

export type DraftResult = {
  pieces: Piece[]
  warnings: DraftWarning[]
  /** Valores calculados que conviene mostrar (largo de sisa, etc). */
  computed: Record<string, number>
}
