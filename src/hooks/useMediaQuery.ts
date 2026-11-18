import { useEffect, useState } from 'react'

/** Observa una media query y devuelve si se cumple ahora mismo. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])

  return matches
}

/** Ancho a partir del cual la interfaz pasa a un panel por pantalla. */
export const MOBILE_QUERY = '(max-width: 860px)'
