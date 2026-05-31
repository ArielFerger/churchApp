import { Howl } from 'howler'
import type { AudioTrack } from '@/shared/types/audio'

type Listener = (s: EngineSnapshot) => void

export interface EngineSnapshot {
  trackId: string | null
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  isFadingOut: boolean
}

const FADE_OUT_MS = 600

/**
 * Single-track Howler wrapper. Lives in the control renderer — completely
 * detached from the projection per architecture principle #5 ("audio module
 * independiente").
 *
 * Listeners get pushed a fresh snapshot whenever something changes, including
 * a 4×/sec tick while playing so seek bars can animate.
 */
export class AudioEngine {
  private howl: Howl | null = null
  private current: AudioTrack | null = null
  private targetVolume = 0.8
  private fadingOut = false
  private tickHandle: number | null = null
  private listeners = new Set<Listener>()
  private endedListeners = new Set<() => void>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => {
      this.listeners.delete(fn)
    }
  }

  /** Fires when a track reaches its natural end (not on manual stop/pause). */
  onEnded(fn: () => void): () => void {
    this.endedListeners.add(fn)
    return () => {
      this.endedListeners.delete(fn)
    }
  }

  snapshot(): EngineSnapshot {
    return {
      trackId: this.current?.id ?? null,
      isPlaying: this.howl?.playing() ?? false,
      position: this.howl?.seek() ?? 0,
      duration: this.howl?.duration() ?? this.current?.duration ?? 0,
      volume: this.targetVolume,
      isFadingOut: this.fadingOut
    }
  }

  setVolume(v: number): void {
    this.targetVolume = clamp01(v)
    if (this.howl && !this.fadingOut) this.howl.volume(this.targetVolume)
    this.emit()
  }

  /**
   * Load a track but don't auto-play. Used to restore the persisted session
   * so the MiniPlayer shows the right track and the Play button resumes
   * from the saved position.
   */
  prime(track: AudioTrack, position: number): void {
    this.loadTrack(track, position, false)
  }

  /**
   * Start playing a track. If a different track is already playing, fades
   * the old one out briefly before swapping for a clean transition.
   */
  async play(track: AudioTrack, startPosition = 0): Promise<void> {
    if (this.current?.id === track.id && this.howl) {
      // Resume the same track
      if (!this.howl.playing()) this.howl.play()
      this.fadingOut = false
      this.howl.volume(this.targetVolume)
      this.startTicking()
      this.emit()
      return
    }

    this.loadTrack(track, startPosition, true)
  }

  private loadTrack(track: AudioTrack, startPosition: number, autoplay: boolean): void {
    // Different track — stop current then load
    if (this.howl) {
      this.howl.stop()
      this.howl.unload()
      this.howl = null
    }

    const howl = new Howl({
      src: [`audio://${track.id}`],
      html5: true, // streams via the protocol; required for ranges
      volume: this.targetVolume,
      onend: () => {
        this.fadingOut = false
        this.stopTicking()
        this.emit()
        // Notify listeners so the queue can auto-advance. Skip when looping.
        if (!howl.loop()) this.endedListeners.forEach((l) => l())
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error', err)
        this.emit()
      },
      onload: () => {
        if (startPosition > 0) howl.seek(startPosition)
        this.emit()
      },
      onplay: () => {
        this.fadingOut = false
        this.startTicking()
        this.emit()
      },
      onpause: () => {
        this.stopTicking()
        this.emit()
      },
      onstop: () => {
        this.stopTicking()
        this.emit()
      }
    })

    this.howl = howl
    this.current = track
    this.fadingOut = false

    if (autoplay) {
      howl.play()
    }
    this.emit()
  }

  pause(): void {
    if (!this.howl) return
    this.howl.pause()
  }

  /**
   * Brief fade-out, then stop. The UI keeps `currentTrackId` so prev/next
   * still walk from where we were.
   */
  stopWithFade(): void {
    if (!this.howl) return
    this.fadingOut = true
    this.emit()
    this.howl.fade(this.howl.volume(), 0, FADE_OUT_MS)
    setTimeout(() => {
      if (!this.howl) return
      this.howl.stop()
      this.howl.volume(this.targetVolume)
      this.fadingOut = false
      this.emit()
    }, FADE_OUT_MS + 30)
  }

  seek(position: number): void {
    if (!this.howl) return
    this.howl.seek(Math.max(0, position))
    this.emit()
  }

  private startTicking(): void {
    this.stopTicking()
    this.tickHandle = window.setInterval(() => this.emit(), 250)
  }

  private stopTicking(): void {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle)
      this.tickHandle = null
    }
  }

  private emit(): void {
    const snap = this.snapshot()
    this.listeners.forEach((l) => l(snap))
  }

  dispose(): void {
    this.stopTicking()
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
    this.listeners.clear()
    this.endedListeners.clear()
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Singleton engine instance shared across the control renderer.
 * Lives in module scope so React StrictMode double-mounts don't double-play.
 */
export const audioEngine = new AudioEngine()
