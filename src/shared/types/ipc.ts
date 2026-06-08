export type Transition = 'fade' | 'cut'

export interface SlideContent {
  lines: string[]
  songTitle?: string
  sectionLabel?: string
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
}

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
  /** Bible version (code, e.g. "RVR1909") the Bible page opens with. */
  defaultBibleVersion: string | null
  /** Fade video audio in (low→high) when a clip starts. */
  videoFadeIn: boolean
  /** Fade video audio out (high→low) as a clip ends. */
  videoFadeOut: boolean
  /** Fade-in duration in seconds (max 10). */
  videoFadeInSec: number
  /** Fade-out duration in seconds (max 10). */
  videoFadeOutSec: number
}
