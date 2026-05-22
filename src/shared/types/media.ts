export type MediaType = 'image' | 'video' | 'gif'

export interface MediaItem {
  id: string
  filePath: string
  fileName: string
  type: MediaType
  thumbnailPath?: string
  width?: number
  height?: number
  addedAt: string
}
