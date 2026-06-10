import { useEffect } from 'react'
import { useLiveStore } from '@/shared/store/liveStore'
import { useMediaPlaybackStore } from '@/shared/store/mediaPlaybackStore'
import { useLiveControlsStore } from '@/shared/store/liveControlsStore'
import { useVideoQueueStore } from '@/shared/store/videoQueueStore'
import { useSettingsStore } from '@/shared/store/settingsStore'

/**
 * Mounts once in the control App. Listens for projection-state echoes from main
 * and reflects them into the liveStore so the LiveIndicator stays in sync —
 * including state changes triggered by keyboard shortcuts (Esc, F11). Also
 * mirrors video playback telemetry into the mediaPlaybackStore for the scrubber
 * and advances the video queue when the projected clip ends.
 */
export function useProjectionBridge(): void {
  const apply = useLiveStore((s) => s.apply)
  const setPlayback = useMediaPlaybackStore((s) => s.set)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsubState = api.onProjectionState((cmd) => {
      apply(cmd)
      // A panic stop must also switch off the control-side slideshow so its
      // keep-alive effect doesn't immediately restart it — and kill the queue.
      if (cmd.type === 'stopAll') {
        const lc = useLiveControlsStore.getState()
        lc.setSlideshowActive(false)
        lc.setBackgroundId(null)
        const q = useVideoQueueStore.getState()
        q.setActive(false)
        q.setCurrent(null)
      }
    })
    const unsubPlayback = api.onMediaPlayback((state) => {
      setPlayback(state)
      if (state.ended && state.mediaId) advanceQueue(state.mediaId)
    })
    return () => {
      unsubState()
      unsubPlayback()
    }
  }, [apply, setPlayback])
}

/** Reproduce un video de la cola en proyección con los fades configurados. */
export function playQueueVideo(id: string): void {
  const s = useSettingsStore.getState().settings
  window.electronAPI?.sendProjectionCommand({
    type: 'showMedia',
    mediaId: id,
    mode: 'video',
    loop: false, // un video en cola nunca loopea: al terminar avanza
    fadeIn: s?.videoFadeIn ?? true,
    fadeOut: s?.videoFadeOut ?? false,
    fadeInSec: s?.videoFadeInSec ?? 1,
    fadeOutSec: s?.videoFadeOutSec ?? 2.5
  })
  const q = useVideoQueueStore.getState()
  q.setCurrent(id)
  q.setActive(true)
  // Precalentar el siguiente para que la transición sea instantánea.
  const next = q.nextAfter(id)
  if (next) {
    window.electronAPI?.sendProjectionCommand({ type: 'preloadMedia', mediaId: next })
  }
}

/** Al terminar `endedId`, pasa al siguiente de la cola (o la cierra si era el último). */
function advanceQueue(endedId: string): void {
  const q = useVideoQueueStore.getState()
  if (!q.active || q.currentId !== endedId) return
  const next = q.nextAfter(endedId)
  if (next) {
    playQueueVideo(next)
  } else {
    q.setActive(false)
    q.setCurrent(null)
    // Fin de la cola: limpiar el contenido para no quedar en el último frame.
    window.electronAPI?.sendProjectionCommand({ type: 'clear' })
  }
}
