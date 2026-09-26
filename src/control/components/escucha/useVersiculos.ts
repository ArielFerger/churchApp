import { useEffect, useRef, useState } from 'react'

/**
 * Trae el texto de los versículos sugeridos, para mostrarlo en cada tarjeta.
 *
 * Es lo que deja al operador confirmar ANTES de proyectar: "Juan 3:16" puede
 * haberse oído mal, pero si debajo dice "Porque de tal manera amó Dios al
 * mundo…" y eso es lo que el pastor está leyendo, no hay duda. Se cachea por
 * versión y referencia: la lista se re-renderiza con cada fragmento transcrito
 * y no tiene sentido volver a pedir lo mismo.
 */

export interface PedidoVersiculo {
  clave: string
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

export type EstadoVersiculo =
  | { estado: 'cargando' }
  | { estado: 'ok'; texto: string; referencia: string }
  | { estado: 'no-existe' }

export function useVersiculos(
  version: string | null,
  pedidos: PedidoVersiculo[]
): Record<string, EstadoVersiculo> {
  const [cache, setCache] = useState<Record<string, EstadoVersiculo>>({})
  const pedidosEnVuelo = useRef(new Set<string>())
  // La lista de pedidos cambia de identidad en cada render: se compara por
  // contenido para no disparar el efecto de más.
  const firma = pedidos.map((p) => p.clave).join('|')

  useEffect(() => {
    const api = window.electronAPI
    if (!api || !version) return
    for (const p of pedidos) {
      const k = `${version}|${p.clave}`
      if (pedidosEnVuelo.current.has(k)) continue
      pedidosEnVuelo.current.add(k)
      setCache((c) => ({ ...c, [k]: { estado: 'cargando' } }))
      void api
        .lookupVerse({
          version,
          bookId: p.bookId,
          chapter: p.chapter,
          verse: p.verse,
          endVerse: p.endVerse
        })
        .then((r) => {
          const rango = r?.endVerse ? `${r.verse}-${r.endVerse}` : `${r?.verse}`
          setCache((c) => ({
            ...c,
            [k]: r
              ? { estado: 'ok', texto: r.text, referencia: `${r.bookName} ${r.chapter}:${rango}` }
              : { estado: 'no-existe' }
          }))
        })
        .catch(() => setCache((c) => ({ ...c, [k]: { estado: 'no-existe' } })))
    }
    // `pedidos` se representa con `firma`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, firma])

  const salida: Record<string, EstadoVersiculo> = {}
  if (version) {
    for (const p of pedidos) {
      const e = cache[`${version}|${p.clave}`]
      if (e) salida[p.clave] = e
    }
  }
  return salida
}
