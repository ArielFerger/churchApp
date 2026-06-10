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
  const prefix = path ? `${path}/` : ''
  const names = new Set<string>()
  for (const m of items) {
    const folder = m.folder ?? ''
    if (!folder || folder === path) continue
    if (prefix && !folder.startsWith(prefix)) continue
    const rest = prefix ? folder.slice(prefix.length) : folder
    const first = rest.split('/')[0]
    if (first) names.add(first)
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }))
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
