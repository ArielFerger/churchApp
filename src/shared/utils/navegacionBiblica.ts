import { bookById } from './bibleBooks'
import type { EstadisticasBiblia } from './escuchaBiblica'

/**
 * Moverse versículo por versículo desde lo que está en pantalla.
 *
 * El predicador casi nunca lee un versículo suelto: anuncia "Juan 3:16" y
 * sigue leyendo el 17, el 18… Sin esto, el operador tenía que volver a la
 * sección Biblia y tipear cada uno mientras la congregación esperaba.
 */

export interface Pasaje {
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

/**
 * El pasaje que sigue (o el anterior) a `p`, de a un versículo.
 *
 * - Desde un rango, "siguiente" arranca después de su último versículo y
 *   "anterior" antes del primero.
 * - Cruza de capítulo: después de Juan 3:36 viene Juan 4:1, y antes de Juan
 *   4:1, Juan 3:36.
 * - No cruza de libro: después de Juan 21:25 no hay "siguiente" (`null`). Pasar
 *   a Hechos sin que el predicador lo diga sería inventar.
 *
 * Sin estadísticas (la Biblia todavía no cargó) no se sabe dónde termina un
 * capítulo, así que sólo se avanza dentro del mismo y se confía en que el
 * lookup falle si el versículo no existe.
 */
export function pasajeVecino(
  p: Pasaje,
  direccion: 1 | -1,
  estadisticas?: EstadisticasBiblia | null
): Pasaje | null {
  const caps = estadisticas?.[p.bookId]
  const libro = bookById(p.bookId)
  const totalCaps = caps?.length ?? libro?.chapters ?? p.chapter

  if (direccion === 1) {
    const siguiente = (p.endVerse ?? p.verse) + 1
    const tope = caps?.[p.chapter - 1]
    if (tope === undefined || siguiente <= tope) {
      return { bookId: p.bookId, chapter: p.chapter, verse: siguiente }
    }
    if (p.chapter < totalCaps) return { bookId: p.bookId, chapter: p.chapter + 1, verse: 1 }
    return null
  }

  const anterior = p.verse - 1
  if (anterior >= 1) return { bookId: p.bookId, chapter: p.chapter, verse: anterior }
  if (p.chapter > 1) {
    const ultimo = caps?.[p.chapter - 2]
    if (ultimo === undefined) return null
    return { bookId: p.bookId, chapter: p.chapter - 1, verse: ultimo }
  }
  return null
}

/** "Juan 3:16", "Juan 3:16-18", "Salmos 23" (capítulo entero). */
export function textoReferencia(
  bookId: string,
  chapter: number,
  verse: number | null,
  endVerse?: number
): string {
  const nombre = bookById(bookId)?.name ?? bookId
  if (verse === null) return `${nombre} ${chapter}`
  return `${nombre} ${chapter}:${verse}${endVerse && endVerse > verse ? `-${endVerse}` : ''}`
}
