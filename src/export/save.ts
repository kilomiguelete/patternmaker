/**
 * Guardado de archivos.
 *
 * En un navegador normal se usa un enlace `<a download>`. Cuando la app
 * corre dentro del visor de artifacts de claude.ai ese enlace no hace nada,
 * asi que se pasa por su API de descargas, que pide confirmacion al usuario.
 * Si no hay ninguna de las dos, se avisa en vez de fallar en silencio.
 */

type DownloadsApi = {
  save(request: { filename: string; data: Blob }): Promise<{ status: string }>
}

type ClaudeHost = { use?: (name: string) => Promise<unknown> }

declare global {
  interface Window {
    claude?: ClaudeHost
  }
}

let cached: Promise<DownloadsApi | null> | null = null

function hostDownloads(): Promise<DownloadsApi | null> {
  if (cached) return cached
  const host = typeof window === 'undefined' ? undefined : window.claude
  cached = host?.use
    ? Promise.resolve(host.use('downloads'))
        .then((api) => (api as DownloadsApi | null) ?? null)
        .catch(() => null)
    : Promise.resolve(null)
  return cached
}

const MESSAGES: Record<string, string> = {
  declined: '',
  rate_limited: 'Hay otra descarga esperando confirmacion. Intentalo de nuevo en un momento.',
  too_large: 'El archivo es demasiado grande para guardarlo aqui. Prueba con menos tallas o con hoja A0.',
  rejected_extension: 'Este visor no permite guardar archivos con esa extension.',
}

export class SaveError extends Error {}

/** Guarda `content` como `filename`. No lanza si el usuario cancela. */
export async function saveFile(
  filename: string,
  content: string | Blob,
  type = 'text/plain;charset=utf-8',
): Promise<void> {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content

  const api = await hostDownloads()
  if (api) {
    try {
      await api.save({ filename, data: blob })
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'unavailable'
      if (code === 'declined') return
      const message = MESSAGES[code]
      throw new SaveError(message || `No se pudo guardar el archivo (${code}).`)
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
