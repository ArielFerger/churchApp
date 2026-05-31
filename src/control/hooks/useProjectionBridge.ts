import { useEffect } from 'react'
import { useLiveStore } from '@/shared/store/liveStore'
import { useMediaPlaybackStore } from '@/shared/store/mediaPlaybackStore'
import { useLiveControlsStore } from '@/shared/store/liveControlsStore'

/**
 * Mounts once in the control App. Listens for projection-state echoes from main
 * and reflects them into the liveStore so the LiveIndicator stays in sync —
 * including state changes triggered by keyboard shortcuts (Esc, F11). Also
 * mirrors video playback telemetry into the mediaPlaybackStore for the scrubber.
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
      // keep-alive effect doesn't immediately restart it.
      if (cmd.type === 'stopAll') {
        const lc = useLiveControlsStore.getState()
        lc.setSlideshowActive(false)
        lc.setBackgroundId(null)
      }
    })
    const unsubPlayback = api.onMediaPlayback((state) => setPlayback(state))
    return () => {
      unsubState()
      unsubPlayback()
    }
  }, [apply, setPlayback])
}
