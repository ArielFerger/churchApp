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
