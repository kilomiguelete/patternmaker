export type GarmentKind = 'tee' | 'hoodie' | 'pants'

export type MeasurementGroup = 'cuerpo' | 'cuello' | 'manga' | 'pierna' | 'detalles'

export type MeasurementSpec = {
  key: string
  label: string
  code: string
  group: MeasurementGroup
  /** Valor para la talla base, en mm. */
  base: number
  /** Incremento por talla, en mm. */
  grade: number
  min: number
  max: number
  /** Como se toma la medida sobre la prenda en plano. */
  how: string
}

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const
export type Size = (typeof SIZES)[number]
export const BASE_SIZE: Size = 'M'

export type GarmentDef = {
  kind: GarmentKind
  name: string
  blurb: string
  specs: MeasurementSpec[]
}

const TEE_SPECS: MeasurementSpec[] = [
  { key: 'bodyLength', label: 'Largo total (HPS a bajo)', code: 'A', group: 'cuerpo', base: 700, grade: 20, min: 450, max: 950, how: 'Desde el punto mas alto del hombro recto hasta el bajo.' },
  { key: 'chestWidth', label: 'Ancho de pecho (1/2 contorno)', code: 'B', group: 'cuerpo', base: 560, grade: 25, min: 350, max: 850, how: 'En plano, 2,5 cm por debajo de la sisa, de canto a canto.' },
  { key: 'hemWidth', label: 'Ancho de bajo (1/2 contorno)', code: 'C', group: 'cuerpo', base: 560, grade: 25, min: 350, max: 900, how: 'En plano, en el borde del bajo, de canto a canto.' },
  { key: 'shoulderWidth', label: 'Ancho de hombros (punta a punta)', code: 'D', group: 'cuerpo', base: 520, grade: 15, min: 330, max: 760, how: 'De punta de hombro a punta de hombro por la espalda.' },
  { key: 'shoulderSlope', label: 'Caida de hombro', code: 'E', group: 'cuerpo', base: 40, grade: 2, min: 0, max: 110, how: 'Diferencia de altura entre el HPS y la punta de hombro.' },
  { key: 'armholeDepth', label: 'Profundidad de sisa (desde HPS)', code: 'F', group: 'cuerpo', base: 275, grade: 10, min: 170, max: 420, how: 'Del HPS recto hacia abajo hasta el fondo de la sisa.' },
  { key: 'neckWidth', label: 'Ancho de cuello (costura a costura)', code: 'G', group: 'cuello', base: 190, grade: 5, min: 120, max: 280, how: 'Entre las dos costuras de hombro, por dentro del cuello.' },
  { key: 'frontNeckDrop', label: 'Caida de escote delantero', code: 'H', group: 'cuello', base: 80, grade: 2.5, min: 30, max: 300, how: 'Del HPS hasta el punto mas bajo del escote delantero.' },
  { key: 'backNeckDrop', label: 'Caida de escote espalda', code: 'I', group: 'cuello', base: 22, grade: 1, min: 5, max: 120, how: 'Del HPS hasta el punto mas bajo del escote de espalda.' },
  { key: 'collarHeight', label: 'Alto de rib de cuello', code: 'J', group: 'cuello', base: 20, grade: 0, min: 0, max: 60, how: 'Alto acabado de la cinta o rib del cuello.' },
  { key: 'sleeveLength', label: 'Largo de manga (desde punta hombro)', code: 'K', group: 'manga', base: 220, grade: 10, min: 60, max: 700, how: 'De la punta del hombro al borde de la manga.' },
  { key: 'bicep', label: 'Ancho de biceps (1/2 contorno)', code: 'L', group: 'manga', base: 210, grade: 10, min: 130, max: 340, how: 'En plano, justo bajo la sisa, de canto a canto.' },
  { key: 'sleeveOpening', label: 'Ancho de boca de manga (1/2)', code: 'M', group: 'manga', base: 180, grade: 7.5, min: 90, max: 300, how: 'En plano, en el borde de la manga, de canto a canto.' },
  { key: 'sleeveEase', label: 'Embebido de manga (%)', code: 'N', group: 'manga', base: 2, grade: 0, min: 0, max: 8, how: 'Porcentaje de holgura de la copa respecto al largo de sisa.' },
  { key: 'hemAllowance', label: 'Dobladillo de bajo', code: 'O', group: 'detalles', base: 20, grade: 0, min: 0, max: 60, how: 'Ancho del dobladillo del bajo del cuerpo.' },
  { key: 'sleeveHemAllowance', label: 'Dobladillo de manga', code: 'P', group: 'detalles', base: 20, grade: 0, min: 0, max: 60, how: 'Ancho del dobladillo de la boca de manga.' },
  { key: 'seamAllowance', label: 'Margen de costura general', code: 'Q', group: 'detalles', base: 10, grade: 0, min: 0, max: 30, how: 'Margen anadido al contorno neto de cada pieza.' },
]

const HOODIE_SPECS: MeasurementSpec[] = [
  { key: 'bodyLength', label: 'Largo total (HPS a bajo)', code: 'A', group: 'cuerpo', base: 690, grade: 20, min: 450, max: 950, how: 'Desde el punto mas alto del hombro recto hasta el bajo.' },
  { key: 'chestWidth', label: 'Ancho de pecho (1/2 contorno)', code: 'B', group: 'cuerpo', base: 610, grade: 25, min: 400, max: 900, how: 'En plano, 2,5 cm por debajo de la sisa, de canto a canto.' },
  { key: 'hemWidth', label: 'Ancho de bajo con rib (1/2)', code: 'C', group: 'cuerpo', base: 540, grade: 25, min: 350, max: 900, how: 'Ancho del rib del bajo relajado, de canto a canto.' },
  { key: 'shoulderWidth', label: 'Ancho de hombros (punta a punta)', code: 'D', group: 'cuerpo', base: 560, grade: 15, min: 350, max: 800, how: 'De punta de hombro a punta de hombro por la espalda.' },
  { key: 'shoulderSlope', label: 'Caida de hombro', code: 'E', group: 'cuerpo', base: 35, grade: 2, min: 0, max: 110, how: 'Diferencia de altura entre el HPS y la punta de hombro.' },
  { key: 'armholeDepth', label: 'Profundidad de sisa (desde HPS)', code: 'F', group: 'cuerpo', base: 300, grade: 10, min: 180, max: 450, how: 'Del HPS recto hacia abajo hasta el fondo de la sisa.' },
  { key: 'neckWidth', label: 'Ancho de cuello (costura a costura)', code: 'G', group: 'cuello', base: 210, grade: 5, min: 140, max: 300, how: 'Entre las dos costuras de hombro, por dentro del cuello.' },
  { key: 'frontNeckDrop', label: 'Caida de escote delantero', code: 'H', group: 'cuello', base: 110, grade: 3, min: 40, max: 300, how: 'Del HPS hasta el punto mas bajo del escote delantero.' },
  { key: 'backNeckDrop', label: 'Caida de escote espalda', code: 'I', group: 'cuello', base: 25, grade: 1, min: 5, max: 120, how: 'Del HPS hasta el punto mas bajo del escote de espalda.' },
  { key: 'hoodHeight', label: 'Alto de capucha', code: 'R', group: 'cuello', base: 380, grade: 8, min: 250, max: 520, how: 'Del borde del cuello a la coronilla de la capucha.' },
  { key: 'hoodWidth', label: 'Ancho de capucha', code: 'S', group: 'cuello', base: 290, grade: 6, min: 200, max: 420, how: 'Del canto delantero de la capucha a la costura trasera.' },
  { key: 'hoodOpening', label: 'Vista de capucha', code: 'T', group: 'cuello', base: 45, grade: 0, min: 0, max: 90, how: 'Ancho de la vista doblada del canto delantero de la capucha.' },
  { key: 'sleeveLength', label: 'Largo de manga (desde punta hombro)', code: 'K', group: 'manga', base: 560, grade: 15, min: 300, max: 750, how: 'De la punta del hombro al borde del puno.' },
  { key: 'bicep', label: 'Ancho de biceps (1/2 contorno)', code: 'L', group: 'manga', base: 240, grade: 10, min: 150, max: 360, how: 'En plano, justo bajo la sisa, de canto a canto.' },
  { key: 'sleeveOpening', label: 'Ancho de puno (1/2 contorno)', code: 'M', group: 'manga', base: 105, grade: 5, min: 70, max: 180, how: 'Ancho del puno relajado, de canto a canto.' },
  { key: 'sleeveEase', label: 'Embebido de manga (%)', code: 'N', group: 'manga', base: 2, grade: 0, min: 0, max: 8, how: 'Porcentaje de holgura de la copa respecto al largo de sisa.' },
  { key: 'ribHeight', label: 'Alto de rib de bajo', code: 'U', group: 'detalles', base: 60, grade: 0, min: 0, max: 140, how: 'Alto acabado del rib del bajo del cuerpo.' },
  { key: 'cuffHeight', label: 'Alto de puno', code: 'V', group: 'detalles', base: 70, grade: 0, min: 0, max: 140, how: 'Alto acabado del puno de la manga.' },
  { key: 'pocketWidth', label: 'Ancho de bolsillo canguro', code: 'W', group: 'detalles', base: 420, grade: 15, min: 0, max: 620, how: 'Ancho total del bolsillo canguro.' },
  { key: 'pocketHeight', label: 'Alto de bolsillo canguro', code: 'X', group: 'detalles', base: 190, grade: 5, min: 0, max: 320, how: 'Alto del bolsillo canguro en su punto mas alto.' },
  { key: 'seamAllowance', label: 'Margen de costura general', code: 'Q', group: 'detalles', base: 10, grade: 0, min: 0, max: 30, how: 'Margen anadido al contorno neto de cada pieza.' },
]

const PANTS_SPECS: MeasurementSpec[] = [
  { key: 'waistWidth', label: 'Ancho de cintura (1/2 contorno)', code: 'A', group: 'pierna', base: 390, grade: 20, min: 250, max: 650, how: 'En plano, en el borde de cintura, de canto a canto.' },
  { key: 'hipWidth', label: 'Ancho de cadera (1/2 contorno)', code: 'B', group: 'pierna', base: 530, grade: 20, min: 350, max: 800, how: 'En plano, a 18 cm de la cintura, de canto a canto.' },
  { key: 'frontRise', label: 'Tiro delantero', code: 'C', group: 'pierna', base: 300, grade: 8, min: 180, max: 450, how: 'Del borde de cintura a la union de tiro, por delante.' },
  { key: 'backRise', label: 'Tiro trasero', code: 'D', group: 'pierna', base: 390, grade: 8, min: 220, max: 520, how: 'Del borde de cintura a la union de tiro, por detras.' },
  { key: 'inseam', label: 'Largo de entrepierna', code: 'E', group: 'pierna', base: 730, grade: 20, min: 150, max: 950, how: 'De la union de tiro al bajo, por la costura interna.' },
  { key: 'thighWidth', label: 'Ancho de muslo (1/2 contorno)', code: 'F', group: 'pierna', base: 330, grade: 12, min: 200, max: 480, how: 'En plano, 2,5 cm bajo la union de tiro, de canto a canto.' },
  { key: 'kneeWidth', label: 'Ancho de rodilla (1/2 contorno)', code: 'G', group: 'pierna', base: 250, grade: 8, min: 140, max: 420, how: 'En plano, a mitad de la entrepierna, de canto a canto.' },
  { key: 'hemWidth', label: 'Ancho de bajo (1/2 contorno)', code: 'H', group: 'pierna', base: 190, grade: 6, min: 100, max: 400, how: 'En plano, en el borde del bajo, de canto a canto.' },
  { key: 'waistbandHeight', label: 'Alto de cinturilla', code: 'I', group: 'detalles', base: 40, grade: 0, min: 0, max: 120, how: 'Alto acabado de la cinturilla.' },
  { key: 'hemAllowance', label: 'Dobladillo de bajo', code: 'J', group: 'detalles', base: 25, grade: 0, min: 0, max: 80, how: 'Ancho del dobladillo del bajo de la pierna.' },
  { key: 'pocketOpening', label: 'Abertura de bolsillo lateral', code: 'K', group: 'detalles', base: 160, grade: 5, min: 0, max: 260, how: 'Largo de la abertura del bolsillo de costado.' },
  { key: 'seamAllowance', label: 'Margen de costura general', code: 'Q', group: 'detalles', base: 12, grade: 0, min: 0, max: 30, how: 'Margen anadido al contorno neto de cada pieza.' },
]

export const GARMENTS: Record<GarmentKind, GarmentDef> = {
  tee: {
    kind: 'tee',
    name: 'Camiseta',
    blurb: 'Camiseta de manga corta con manga montada, corte boxy ajustable.',
    specs: TEE_SPECS,
  },
  hoodie: {
    kind: 'hoodie',
    name: 'Hoodie',
    blurb: 'Sudadera con capucha, bolsillo canguro, ribs en bajo y punos.',
    specs: HOODIE_SPECS,
  },
  pants: {
    kind: 'pants',
    name: 'Pantalon / Jogger',
    blurb: 'Pantalon de dos piezas por pierna con cinturilla y bolsillos de costado.',
    specs: PANTS_SPECS,
  },
}

export const GARMENT_LIST = Object.values(GARMENTS)

export function specMap(kind: GarmentKind): Record<string, MeasurementSpec> {
  const out: Record<string, MeasurementSpec> = {}
  for (const s of GARMENTS[kind].specs) out[s.key] = s
  return out
}

export const GROUP_LABELS: Record<MeasurementGroup, string> = {
  cuerpo: 'Cuerpo',
  cuello: 'Cuello y capucha',
  manga: 'Manga',
  pierna: 'Pierna',
  detalles: 'Detalles y acabados',
}
