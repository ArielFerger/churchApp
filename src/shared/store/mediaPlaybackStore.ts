import { create } from 'zustand'
import type { MediaPlaybackState } from '../types/ipc'

interface MediaPlaybackStore extends MediaPlaybackState {
  /** Operator-set output volume (0..1) for the projected video. */
  volume: number
  set: (s: MediaPlaybackState) => void
  setVolume: (v: number) => void
}

/**
 * Mirror of the projection window's currently-playing video, pushed up over IPC
 * so the control window can render a scrubber / transport for it. `volume` is
 * owned by control (not reported by projection) and survives telemetry updates
 * because zustand's `set` shallow-merges.
 */
export const useMediaPlaybackStore = create<MediaPlaybackStore>((set) => ({
  mediaId: null,
  position: 0,
  duration: 0,
  playing: false,
  ended: false,
  volume: 1,
  // Normalizar `ended` en cada update: como `set` hace merge superficial, un
  // tick sin la clave dejaría el `ended:true` anterior pegado para siempre.
  set: (s) => set({ ...s, ended: s.ended ?? false }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) })
}))
