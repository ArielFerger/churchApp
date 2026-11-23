import type { MediaItem } from '../types/media'

/**
 * Helpers para navegar items de media organizados en subcarpetas.
 * `path` usa "/" como separador y '' representa la raíz.
 */

/** Items que viven exactamente en `path` (no en subcarpetas más profundas). */
export function itemsInFolder(items: MediaItem[], path: string): MediaItem[] {
  return items.filter((m) => (m.folder ?? '') === path)
}

/** Nombres de las subcarpetas inmediatas de `path`, ordenadas alfabéticamente. */
export function childFolders(items: MediaItem[], path: string): string[] {
  return childFolderCounts(items, path).map(([name]) => name)
}

const byName = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/** Subcarpetas inmediatas con sus totales recursivos, en una pasada. */
export function childFolderCounts(items: MediaItem[], path: string): [string, number][] {
  const prefix = path ? `${path}/` : ''
  const counts = new Map<string, number>()
  for (const item of items) {
    const folder = item.folder ?? ''
    if (!folder.startsWith(prefix)) continue
    const first = folder.slice(prefix.length).split('/', 1)[0]
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1)
  }
  return [...counts].sort(([a], [b]) => byName.compare(a, b))
}

/** Cantidad de items (recursiva) dentro de `path`. */
export function countInFolder(items: MediaItem[], path: string): number {
  const prefix = path ? `${path}/` : ''
  return items.filter((m) => {
    const folder = m.folder ?? ''
    return folder === path || (prefix ? folder.startsWith(prefix) : folder !== '')
  }).length
}

/** Segmentos del breadcrumb: [{ name, path }] desde la raíz hasta `path`. */
export function breadcrumbSegments(path: string): { name: string; path: string }[] {
  if (!path) return []
  const parts = path.split('/')
  return parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') }))
}

/** Carpeta padre de `path` ('' si ya es raíz o hija directa de la raíz). */
export function parentFolder(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/**
 * Minúsculas y sin acentos, para que "Adoracion" encuentre "Adoración".
 * NFD separa la letra de su tilde y \p{M} borra las tildes ya sueltas.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/**
 * Busca en TODA la librería (no solo en la carpeta abierta): cada término de
 * la consulta tiene que aparecer en el nombre del archivo o en su ruta de
 * carpetas. Consulta vacía = sin resultados (el llamador muestra la carpeta).
 */
export function searchMedia(items: MediaItem[], query: string): MediaItem[] {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return items.filter((m) => {
    const haystack = normalizeText(`${m.folder ?? ''}/${m.fileName}`)
    return terms.every((term) => haystack.includes(term))
  })
}
