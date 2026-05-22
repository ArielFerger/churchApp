export type Transition = 'fade' | 'cut'

export interface SlideContent {
  lines: string[]
  songTitle?: string
  sectionLabel?: string
}

export type ProjectionCommand =
  | { type: 'showSlide'; content: SlideContent; transition?: Transition }
  | { type: 'showBibleVerse'; reference: string; text: string; version: string }
  | { type: 'showMedia'; mediaId: string; mode: 'image' | 'video' | 'gif' }
  | { type: 'preloadMedia'; mediaId: string }
  | { type: 'setBackground'; mediaId: string | null }
  | { type: 'blackout' }
  | { type: 'showLogo' }
  | { type: 'clear' }

export interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

export interface AppSettings {
  projectionDisplayId: number | null
  mediaFolder: string | null
  audioFolder: string | null
  songsFolder: string | null
}
