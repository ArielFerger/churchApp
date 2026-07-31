export type Transition = 'fade' | 'cut'

export interface SlideContent {
  lines: string[]
  songTitle?: string
}

export type ProjectionCommand =
  | { type: 'showSlide'; content: SlideContent; transition?: Transition }
  | { type: 'showBibleVerse'; reference: string; text: string; version: string }
  | {
      type: 'showMedia'
      mediaId: string
      mode: 'image' | 'video' | 'gif'
      loop?: boolean
      /** Fade video audio in (low→high) on entrance. */
      fadeIn?: boolean
      /** Fade video audio out (high→low) near the end. */
      fadeOut?: boolean
      /** Fade-in duration in seconds. */
      fadeInSec?: number
      /** Fade-out duration in seconds. */
      fadeOutSec?: number
    }
  | { type: 'preloadMedia'; mediaId: string }
  /** Reinicia el video de contenido actual y lo reproduce desde el principio. */
  | { type: 'replayMedia' }
  | { type: 'setBackground'; mediaId: string | null; loop?: boolean }
  | { type: 'setBackgroundSlideshow'; mediaIds: string[]; intervalSec: number }
  | { type: 'seekMedia'; position: number }
  | { type: 'setMediaPlaying'; playing: boolean }
  | { type: 'setMediaVolume'; volume: number }
  | { type: 'blackout' }
  | { type: 'showLogo' }
  | { type: 'clear' }
  /** Panic stop: clears content, background, slideshow and goes black. */
  | { type: 'stopAll' }

/** Pushed from the projection window up to control so the operator can scrub videos. */
export interface MediaPlaybackState {
  mediaId: string | null
  position: number
  duration: number
  playing: boolean
  /** True exactly once when a (non-loop) video reaches its end — drives the queue. */
  ended?: boolean
}

export interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

/** Configuración visual de la proyección de versículos. */
export interface BibleDisplaySettings {
  /** Id de la fuente subida (BibleFont.id); null = fuente por defecto de la app. */
  fontId: string | null
  /** Tamaño del texto en porcentaje (100 = tamaño estándar). */
  fontSizePct: number
  /** Color del texto del versículo (hex). */
  textColor: string
  /** Texto en negrita. */
  bold: boolean
  /** Sombra detrás del texto para legibilidad sobre fondos claros. */
  textShadow: boolean
  /** Media id (imagen/video de la librería) como fondo de los versículos. */
  backgroundId: string | null
  /** Oscurecimiento del fondo (0–0.8) para que el texto se lea. */
  backgroundDim: number
}

export const DEFAULT_BIBLE_DISPLAY: BibleDisplaySettings = {
  fontId: null,
  fontSizePct: 100,
  textColor: '#ffffff',
  bold: false,
  textShadow: true,
  backgroundId: null,
  backgroundDim: 0.35
}

export interface AppSettings {
  projectionDisplayId: number | null
  mediaFolder: string | null
  audioFolder: string | null
  songsFolder: string | null
  /** Carpeta exclusiva para los videos de loop de "En Vivo" (null = usa mediaFolder). */
  liveLoopFolder: string | null
  /** Carpeta exclusiva para los fondos de versículos (null = usa mediaFolder). */
  bibleBackgroundsFolder: string | null
  /** Bible version (code, e.g. "RVR1909") the Bible page opens with. */
  defaultBibleVersion: string | null
  /** Apariencia de los versículos proyectados. */
  bibleDisplay: BibleDisplaySettings
  /** Fade video audio in (low→high) when a clip starts. */
  videoFadeIn: boolean
  /** Fade video audio out (high→low) as a clip ends. */
  videoFadeOut: boolean
  /** Fade-in duration in seconds (max 10). */
  videoFadeInSec: number
  /** Fade-out duration in seconds (max 10). */
  videoFadeOutSec: number
}
