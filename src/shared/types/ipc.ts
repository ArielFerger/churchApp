import type { WhisperModelId } from '../utils/whisper'

export type Transition = 'fade' | 'cut'

/**
 * Lo único que va a la pantalla es la letra. El título de la canción y el
 * nombre de la parte ("Coro") son ayudas de cabina y se quedan en el control.
 */
export interface SlideContent {
  lines: string[]
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
  /**
   * Carpeta con yt-dlp y ffmpeg para las descargas de YouTube. `null` = buscar
   * en las ubicaciones por defecto y en el PATH.
   */
  toolsFolder: string | null
  /**
   * Navegador del que tomar la sesión de YouTube ya iniciada. `null` = ninguno.
   *
   * Sirve cuando YouTube contesta "iniciá sesión para confirmar que no sos un
   * robot", que pasa en conexiones con IP compartida. No evade el control: lo
   * responde, identificándose con la cuenta del propio usuario.
   */
  downloadCookiesBrowser: string | null
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
  /**
   * Modelo de whisper que usa la Escucha para transcribir. `null` = el
   * recomendado. Se guarda acá y no en el módulo porque cambiarlo obliga a
   * bajar otro archivo de cientos de MB: es una decisión, no un botón.
   */
  escuchaModelo: WhisperModelId | null
  /**
   * `deviceId` de la entrada de audio que usa la Escucha (la salida de la
   * consola de sonido). `null` = la entrada por defecto de Windows.
   */
  escuchaDispositivoId: string | null
}
