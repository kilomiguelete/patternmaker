import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Empaqueta la app en un unico index.html con el JS y el CSS incrustados,
 * para poder abrirla con doble clic o subirla a cualquier sitio estatico.
 */
function inlineSingleFile(): Plugin {
  return {
    name: 'inline-single-file',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (f) => f.type === 'asset' && f.fileName.endsWith('.html'),
      )
      if (!html || html.type !== 'asset') return

      let source = String(html.source)

      // La precarga de modulos sobra en un archivo unico y, en file://,
      // provoca una peticion bloqueada por CORS.
      source = source.replace(/<link[^>]*rel="modulepreload"[^>]*>\s*/gi, '')

      for (const [name, file] of Object.entries(bundle)) {
        if (name === html.fileName) continue
        const id = escapeRe(file.fileName)

        if (file.type === 'chunk' && file.fileName.endsWith('.js')) {
          // Evita que un "</script>" dentro del codigo cierre la etiqueta.
          const code = file.code.replace(/<\/script/gi, '<\\/script')
          source = source.replace(new RegExp(`<script[^>]*src="[^"]*${id}"[^>]*>\\s*</script>`), '')
          // Al final del body: un script clasico se ejecuta al momento, y en
          // el head correria antes de que exista el nodo raiz.
          // Replacer como funcion: en una cadena, los "$" del codigo
          // (como ${...}) se interpretarian como patrones de sustitucion.
          source = source.replace(/<\/body>/i, () => `<script>${code}</script>\n</body>`)
          delete bundle[name]
        } else if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          const css = String(file.source)
          source = source.replace(
            new RegExp(`<link[^>]*href="[^"]*${id}"[^>]*>`),
            () => `<style>${css}</style>`,
          )
          delete bundle[name]
        }
      }

      if (/<(script|link)[^>]*(src|href)="[^"]*assets\//.test(source)) {
        this.error('Quedan recursos externos sin incrustar en el HTML unico.')
      }

      html.source = source
    },
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default defineConfig({
  plugins: [react(), inlineSingleFile()],
  base: './',
  build: {
    outDir: 'dist-single',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    // IIFE en vez de modulo ES: asi el archivo tambien abre con doble
    // clic (file://), donde los modulos ES quedan bloqueados por CORS.
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
})
