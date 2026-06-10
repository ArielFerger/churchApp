import { useEffect, useRef } from 'react'
import type { MediaItem } from '@/shared/types/media'

export interface PlaybackInfo {
  position: number
  duration: number
  playing: boolean
}

interface Props {
  item: MediaItem
  /** When true, the media plays / animates. When false, it's loaded but paused/hidden. */
  active: boolean
  /** Loop the playback. Used for the background layer and looping content clips. */
  loop?: boolean
  /** object-fit mode. */
  fit?: 'cover' | 'contain'
  /** Mute audio. Backgrounds stay muted; foreground content videos play sound. */
  muted?: boolean
  /** Ramp volume 0→`volume` when the clip becomes active (smooth audio entrance). */
  fadeAudio?: boolean
  /** Ramp volume `volume`→0 over the last seconds before the clip ends. */
  fadeOut?: boolean
  /** Fade-in duration in seconds (clamped 0.2–10). */
  fadeInSec?: number
  /** Fade-out duration in seconds (clamped 0.2–10). */
  fadeOutSec?: number
  /** Target volume 0..1 (operator-controlled). */
  volume?: number
  /** Desired play state while active. Lets the operator pause/resume from control. */
  playing?: boolean
  /** Imperative seek: bump `nonce` to jump to `position` (seconds). */
  seekSignal?: { position: number; nonce: number } | null
  /** Called ~4×/sec while playing, plus on play/pause/seek, with current timing. */
  onPlayback?: (info: PlaybackInfo) => void
  /** Called once when a non-loop video finishes (drives the play queue). */
  onEnded?: () => void
}

const FADE_STEPS = 30

/** Keep fade durations sane: between 0.2s and the 10s ceiling. */
function clampSec(s: number): number {
  if (!Number.isFinite(s)) return 1
  return Math.max(0.2, Math.min(10, s))
}

/**
 * Renders an image/video/gif from the media:// protocol. Mounting with
 * `active=false` already loads the media (preload) so flipping `active` true
 * plays instantly with no fetch round-trip.
 */
export default function MediaSlide({
  item,
  active,
  loop = false,
  fit = 'contain',
  muted = true,
  fadeAudio = false,
  fadeOut = false,
  fadeInSec = 1,
  fadeOutSec = 2.5,
  volume = 1,
  playing = true,
  seekSignal = null,
  onPlayback,
  onEnded
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fadeHandle = useRef<number | null>(null)
  const targetVol = useRef(volume)
  targetVol.current = volume
  const src = `media://${item.id}`
  const fadeInMs = clampSec(fadeInSec) * 1000
  const fadeOutSeconds = clampSec(fadeOutSec)

  const clearFade = (): void => {
    if (fadeHandle.current !== null) {
      window.clearInterval(fadeHandle.current)
      fadeHandle.current = null
    }
  }

  const rampVolume = (v: HTMLVideoElement): void => {
    clearFade()
    let step = 0
    v.volume = 0
    fadeHandle.current = window.setInterval(() => {
      step += 1
      // Ramp toward the live target so volume changes mid-fade are honored.
      v.volume = Math.min(targetVol.current, (step / FADE_STEPS) * targetVol.current)
      if (step >= FADE_STEPS) {
        v.volume = targetVol.current
        clearFade()
      }
    }, fadeInMs / FADE_STEPS)
  }

  // Activate / deactivate playback.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) {
      v.currentTime = 0
      if (fadeAudio && !muted) rampVolume(v)
      else v.volume = targetVol.current
      if (playing !== false) {
        const p = v.play()
        if (p) p.catch(() => undefined)
      }
    } else {
      clearFade()
      v.pause()
    }
    return clearFade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, item.id])

  // Live volume changes (operator dragging the slider) — apply once the
  // entrance fade has finished so we don't clobber the ramp.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !active) return
    if (fadeHandle.current === null) v.volume = volume
  }, [volume, active])

  // Respond to play/pause toggles while active.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !active) return
    if (playing) {
      const p = v.play()
      if (p) p.catch(() => undefined)
    } else {
      v.pause()
    }
  }, [playing, active])

  // Imperative seek.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !active || !seekSignal) return
    v.currentTime = Math.max(0, seekSignal.position)
  }, [seekSignal, active])

  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain'

  if (item.type === 'video') {
    const report = (): void => {
      const v = videoRef.current
      if (!v || !onPlayback) return
      onPlayback({
        position: v.currentTime,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        playing: !v.paused
      })
    }
    const onTimeUpdate = (): void => {
      const v = videoRef.current
      if (!v) return
      // Audio fade-out: ramp volume down over the last seconds. Skipped while
      // the entrance fade is still running, when muted, or when looping.
      if (fadeOut && !loop && !muted && fadeHandle.current === null) {
        const dur = v.duration
        if (Number.isFinite(dur) && dur > 0) {
          const remaining = dur - v.currentTime
          if (remaining <= fadeOutSeconds) {
            v.volume = Math.max(
              0,
              Math.min(targetVol.current, targetVol.current * (remaining / fadeOutSeconds))
            )
          }
        }
      }
      report()
    }
    return (
      <video
        ref={videoRef}
        src={src}
        className={`h-full w-full ${objectFit}`}
        preload="auto"
        muted={muted}
        playsInline
        loop={loop}
        autoPlay={active}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onPlayback ? report : undefined}
        onPlay={onPlayback ? report : undefined}
        onPause={onPlayback ? report : undefined}
        onEnded={active && !loop ? onEnded : undefined}
      />
    )
  }

  // image / gif → same element. GIFs animate natively once attached.
  return (
    <img
      src={src}
      alt=""
      className={`h-full w-full ${objectFit}`}
      decoding="async"
      draggable={false}
    />
  )
}
