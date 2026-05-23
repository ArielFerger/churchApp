import { useEffect } from 'react'
import { useLiveStore } from '@/shared/store/liveStore'

/**
 * Mounts once in the control App. Listens for projection-state echoes from main
 * and reflects them into the liveStore so the LiveIndicator stays in sync —
 * including state changes triggered by keyboard shortcuts (Esc, F11).
 */
export function useProjectionBridge(): void {
  const apply = useLiveStore((s) => s.apply)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    return api.onProjectionState((cmd) => apply(cmd))
  }, [apply])
}
