# Trendsplant Pattern Maker

Herramienta web para crear **tablas de medidas**, **patrones de prendas** y **fichas técnicas**
con preview en vivo. Cambias una medida y el patrón se vuelve a dibujar al instante.

No es un editor de dibujo: es un **motor de patronaje paramétrico**. Tú defines las medidas de la
prenda acabada (medidas en plano, como en una ficha de producción) y la herramienta calcula las
piezas, las curvas, los márgenes de costura y el marcador.

## Qué hace

**Tabla de medidas**
- 7 tallas (XS → 3XL) con escalado automático por incrementos editables.
- Cada celda es editable; las editadas a mano quedan marcadas y el regrade no las pisa.
- Unidades en cm, mm o pulgadas.
- Export a CSV listo para pasar al taller o al proveedor.

**Patrón**
- Piezas reales con curvas Bézier: escote, sisa, copa de manga, tiro, capucha.
- La **copa de manga se ajusta por bisección** al largo de sisa real + el embebido indicado.
- La **línea de cuello de la capucha se cuadra** con el escote de la prenda.
- Márgenes de costura por tramo (dobladillo de bajo distinto del resto, canto sobre doblez sin margen).
- Línea de hilo, línea de doblez, guías internas, cotas acotadas y etiquetas de pieza.
- Marcador con el ancho de tela que elijas (90 / 110 / 150 / 180 cm).
- Avisos cuando las medidas no son construibles (cuello más ancho que el hombro, copa imposible,
  muslo que no cabe en la cadera, etc.).

**Edición directa sobre el patrón**
- Activa "Editar vértices" y arrastra los puntos verdes del dibujo.
- Cada vértice está atado a una o dos medidas: arrastrar la punta del hombro escribe
  `ancho de hombros` y `caída de hombro`; el fondo de sisa escribe `ancho de pecho` y
  `profundidad de sisa`; el tiro escribe `ancho de muslo`.
- No es edición libre de nodos: el vértice **reescribe la medida**, y desde ahí se vuelve a
  calcular todo el patrón. Así la tabla sigue siendo la única fuente de verdad, la copa de manga
  se reajusta sola y el escalado de tallas se mantiene.
- Arrastrando en la talla base se mueve toda la gama por el salto; arrastrando en otra talla se
  edita sólo esa, y la celda queda marcada.

**Ficha técnica**
- Croquis plano de la prenda dibujado desde las mismas medidas, con cotas.

**Exportar**
- **SVG** a escala 1:1 con cuadro de control.
- **PDF 1:1** en A4 / A3 / A0, teselado en hojas con solapa de 15 mm, marcas de unión y
  numeración `fila / col`, para imprimir en casa o mandar al plotter.
- **CSV** de la tabla de medidas.
- **JSON** del proyecto completo, para guardar y volver a abrir.

Las descargas usan un enlace `<a download>` normal. Si la app corre dentro de un
visor que lo bloquea (como el de artifacts de claude.ai), pasa automaticamente
por la API de descargas del anfitrion.

## Prendas incluidas

| Prenda | Piezas |
|---|---|
| Camiseta | delantero, espalda, manga, rib de cuello |
| Hoodie | delantero, espalda, manga, capucha (×2), bolsillo canguro, rib de bajo, puños, cinta de cuello |
| Pantalón / Jogger | pierna delantera, pierna trasera, cinturilla, bolsas de bolsillo |

## Empezar

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173.

```bash
npm run build
```

```bash
npm test
```

### Un solo archivo

```bash
npm run build:single
```

Genera `dist-single/index.html`: la app entera (JS y CSS incrustados) en un
archivo que se abre con doble clic, sin servidor, y que puedes subir a cualquier
hosting estatico o pasar por correo.

## Cómo se toman las medidas

Todas las medidas son **de la prenda acabada, medida en plano** (la prenda sobre la mesa, sin
estirar), no medidas de cuerpo. Los anchos son **medio contorno**: "ancho de pecho 56 cm" significa
112 cm de contorno. Pasa el ratón por el nombre de cada medida en la tabla para ver dónde se toma.

## Cómo funciona por dentro

```
src/engine/
  types.ts         piezas, contornos, cotas, guías
  units.ts         mm / cm / pulgadas
  geometry.ts      Bézier, longitud de arco, aplanado, offset de polígono
  measurements.ts  definición de medidas por prenda
  grading.ts       tabla de tallas, escalado, celdas bloqueadas
  drafts/          trazado de cada prenda (common / tee / hoodie / pants)
  flats/           croquis de ficha técnica
  layout.ts        márgenes de costura y colocación en el marcador
  annotate.ts      geometría de cotas y línea de hilo
src/export/        SVG, PDF, CSV, proyecto JSON
src/components/    tabla, canvas, croquis, resumen, barra de herramientas
src/state/         estado del proyecto (reducer)
```

El motor trabaja **siempre en milímetros**; las unidades sólo afectan a la presentación.

Las piezas se trazan con nodos y tangentes explícitas, de modo que las curvas salen
perpendiculares al doblez en el escote y perpendiculares al hombro en la sisa, igual que en
patronaje plano. Los márgenes de costura se calculan aplanando el contorno y desplazando cada
arista por su normal, con recorte de las esquinas.

## Limitaciones conocidas

- Las piezas se colocan en filas simples: sirve como marcador de referencia, no optimiza el consumo
  de tela.
- Un único bloque por prenda (sin variantes raglán, manga japonesa ni cortes de canesú).
- El escalado es lineal por talla salvo en las celdas que edites a mano.
- Las medidas no contemplan el encogimiento del tejido: añádelo tú a los valores.
- Comprueba siempre el cuadro de control al imprimir antes de cortar.
