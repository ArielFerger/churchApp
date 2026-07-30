import {
  isMediaCategory,
  type MediaCategory,
  type MediaItem,
  type MediaMeta
} from '../types/media'

/**
 * Lógica pura de los metadatos de media (categorías + selección "para hoy").
 * Vive en shared para que el servicio de main y el renderer compartan las
 * mismas reglas — y para poder testearla sin Electron.
 */

/** Fecha local en formato YYYY-MM-DD (no UTC: el servicio es local). */
export function todayKey(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function emptyMeta(date: string = todayKey()): MediaMeta {
  return { categories: {}, today: { date, ids: [] } }
}

/**
 * Sanea lo leído del disco y aplica el vencimiento diario: si la selección
 * "para hoy" quedó de otro día, se descarta. Tolera JSON viejo o corrupto.
 */
export function normalizeMeta(raw: unknown, date: string = todayKey()): MediaMeta {
  const meta = emptyMeta(date)
  if (!raw || typeof raw !== 'object') return meta

  const source = raw as Partial<MediaMeta>

  if (source.categories && typeof source.categories === 'object') {
    for (const [id, category] of Object.entries(source.categories)) {
      if (id && isMediaCategory(category)) meta.categories[id] = category
    }
  }

  const today = source.today
  if (today && typeof today === 'object' && today.date === date && Array.isArray(today.ids)) {
    meta.today.ids = dedupe(today.ids.filter((id): id is string => typeof id === 'string' && !!id))
  }

  return meta
}

/** Asigna (o quita, con `null`) la categoría de un item. */
export function withCategory(
  meta: MediaMeta,
  mediaId: string,
  category: MediaCategory | null
): MediaMeta {
  const categories = { ...meta.categories }
  if (category === null) delete categories[mediaId]
  else categories[mediaId] = category
  return { ...meta, categories }
}

/**
 * Marca o desmarca un item para hoy. Los nuevos se agregan al final para que
 * la fila de arriba respete el orden en que el operador los fue eligiendo.
 */
export function withToday(
  meta: MediaMeta,
  mediaId: string,
  selected: boolean,
  date: string = todayKey()
): MediaMeta {
  const base = meta.today.date === date ? meta.today.ids : []
  const ids = selected
    ? base.includes(mediaId)
      ? base
      : [...base, mediaId]
    : base.filter((id) => id !== mediaId)
  return { ...meta, today: { date, ids } }
}

export function clearToday(meta: MediaMeta, date: string = todayKey()): MediaMeta {
  return { ...meta, today: { date, ids: [] } }
}

/**
 * Resuelve los ids de "hoy" a items reales, en el orden en que se eligieron.
 * Los ids que ya no existen (archivo borrado o movido) se ignoran.
 */
export function todayItems(items: MediaItem[], meta: MediaMeta): MediaItem[] {
  const byId = new Map(items.map((m) => [m.id, m]))
  return meta.today.ids
    .map((id) => byId.get(id))
    .filter((m): m is MediaItem => Boolean(m))
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)]
}
