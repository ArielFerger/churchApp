import { useEffect, useRef } from 'react'
import { useAudioStore } from '@/shared/store/audioStore'
import { audioEngine } from './audioEngine'

/**
 * Mounts once at the top of the control App. Wires together:
 *   - library push updates from main
 *   - engine state → store
 *   - persistence: load last session on mount, save throttled changes
 *
 * Returns nothing; the rest of the UI reads from useAudioStore and calls
 * audioEngine directly.
 */
export function useAudioPlayer(): void {
  const setLibrary = useAudioStore((s) => s.setLibrary)
  const setPlayer = useAudioStore((s) => s.setPlayer)
  const lastSavedAt = useRef(0)

  // Library subscription
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.getAudio().then(setLibrary)
    return api.onAudioUpdated(setLibrary)
  }, [setLibrary])

  // Auto-advance: when a track ends naturally, play the next queued track.
  useEffect(() => {
    return audioEngine.onEnded(() => {
      const next = useAudioStore.getState().consumeQueue()
      if (next) void audioEngine.play(next, 0)
    })
  }, [])

  // Engine → store. Also throttled persistence to disk.
  useEffect(() => {
    const unsub = audioEngine.subscribe((snap) => {
      setPlayer(snap)
      const now = Date.now()
      // Persist at most every 2 s while playing, plus on every pause/stop.
      const shouldPersist =
        !snap.isPlaying || now - lastSavedAt.current > 2000 || snap.position === 0
      if (shouldPersist) {
        lastSavedAt.current = now
        void window.electronAPI?.setAudioState({
          lastTrackId: snap.trackId,
          position: snap.position,
          volume: snap.volume
        })
      }
    })
    return () => {
      unsub()
    }
  }, [setPlayer])

  // Restore last session once the library is loaded for the first time.
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current) return
    const unsub = useAudioStore.subscribe(async (state) => {
      if (hydrated.current) return
      if (!state.libraryLoaded) return
      hydrated.current = true
      const api = window.electronAPI
      if (!api) return
      const persisted = await api.getAudioState()
      if (persisted.volume !== undefined) audioEngine.setVolume(persisted.volume)
      // Restore selection without auto-playing — operator presses play to resume.
      if (persisted.lastTrackId) {
        const track = state.library.find((t) => t.id === persisted.lastTrackId)
        if (track) audioEngine.prime(track, persisted.position ?? 0)
      }
    })
    return unsub
  }, [])
}
