export type MediaType = 'image' | 'video' | 'gif'

export interface MediaItem {
  id: string
  filePath: string
  fileName: string
  type: MediaType
  /**
   * Carpeta relativa a la raíz escaneada, con separador "/" ('' = raíz).
   * Ej: "Alabanza/Fondos" para <raíz>/Alabanza/Fondos/video.mp4
   */
  folder: string
  thumbnailPath?: string
  width?: number
  height?: number
  addedAt: string
}

/**
 * Categorías con las que el operador etiqueta el material (sobre todo videos):
 * a qué momento del servicio pertenece cada archivo.
 */
export type MediaCategory = 'alabanza' | 'adoracion' | 'proyeccion'

export interface MediaCategoryInfo {
  value: MediaCategory
  label: string
  /** Clases Tailwind del badge (fondo + texto). */
  badgeClass: string
  /** Clase Tailwind del borde cuando el filtro está activo. */
  activeClass: string
}

/** Única fuente de verdad de las categorías: agregar una es agregar una fila. */
export const MEDIA_CATEGORIES: MediaCategoryInfo[] = [
  {
    value: 'alabanza',
    label: 'Alabanza',
    badgeClass: 'bg-sky-500/15 text-sky-300',
    activeClass: 'bg-sky-600 text-white'
  },
  {
    value: 'adoracion',
    label: 'Adoración',
    badgeClass: 'bg-violet-500/15 text-violet-300',
    activeClass: 'bg-violet-600 text-white'
  },
  {
    value: 'proyeccion',
    label: 'Proyección',
    badgeClass: 'bg-teal-500/15 text-teal-300',
    activeClass: 'bg-teal-600 text-white'
  }
]

export function isMediaCategory(value: unknown): value is MediaCategory {
  return MEDIA_CATEGORIES.some((c) => c.value === value)
}

export function categoryInfo(value: MediaCategory): MediaCategoryInfo | undefined {
  return MEDIA_CATEGORIES.find((c) => c.value === value)
}

/**
 * Metadatos que el operador le pone a la media y que NO viven en el disco:
 * la categoría de cada archivo y la selección efímera "para hoy".
 */
export interface MediaMeta {
  /** mediaId → categoría. Un id ausente = sin categoría. */
  categories: Record<string, MediaCategory>
  /**
   * Archivos elegidos para el servicio de hoy. `date` es la fecha local
   * (YYYY-MM-DD) en la que se armó: si al abrir la app ya es otro día, la
   * lista se vacía sola — es una selección momentánea, no una carpeta.
   */
  today: { date: string; ids: string[] }
}
