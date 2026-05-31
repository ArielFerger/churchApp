import { create } from 'zustand'
import type { AudioTrack } from '../types/audio'

interface AudioState {
  library: AudioTrack[]
  libraryLoaded: boolean

  // Player state mirrors AudioEngine.snapshot()
  currentTrackId: string | null
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  isFadingOut: boolean

  /** Ordered list of queued track ids (next-up plays first). */
  queue: string[]

  setLibrary: (items: AudioTrack[]) => void
  setPlayer: (s: {
    trackId: string | null
    isPlaying: boolean
    position: number
    duration: number
    volume: number
    isFadingOut: boolean
  }) => void

  /** Append a track to the end of the queue. */
  enqueue: (id: string) => void
  /** Remove the queue entry at `index`. */
  removeFromQueue: (index: number) => void
  /** Empty the queue. */
  clearQueue: () => void
  /** Pop the first queued track (resolving to a library item, skipping stale ids). */
  consumeQueue: () => AudioTrack | null

  /** Next track: queue first, otherwise the following library item. */
  nextTrack: () => AudioTrack | null
  prevTrack: () => AudioTrack | null
  currentTrack: () => AudioTrack | null
}

export const useAudioStore = create<AudioState>((set, get) => ({
  library: [],
  libraryLoaded: false,

  currentTrackId: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  isFadingOut: false,
  queue: [],

  setLibrary: (items) => set({ library: items, libraryLoaded: true }),

  enqueue: (id) => set((s) => ({ queue: [...s.queue, id] })),

  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),

  clearQueue: () => set({ queue: [] }),

  consumeQueue: () => {
    const { queue, library } = get()
    if (queue.length === 0) return null
    // Skip ids that no longer resolve (e.g. file removed).
    let rest = [...queue]
    while (rest.length > 0) {
      const [head, ...tail] = rest
      const track = library.find((t) => t.id === head)
      rest = tail
      if (track) {
        set({ queue: rest })
        return track
      }
    }
    set({ queue: [] })
    return null
  },

  setPlayer: (s) =>
    set({
      currentTrackId: s.trackId,
      isPlaying: s.isPlaying,
      position: s.position,
      duration: s.duration,
      volume: s.volume,
      isFadingOut: s.isFadingOut
    }),

  currentTrack: () => {
    const { library, currentTrackId } = get()
    if (!currentTrackId) return null
    return library.find((t) => t.id === currentTrackId) ?? null
  },

  nextTrack: () => {
    // Queue takes priority over library order.
    const fromQueue = get().consumeQueue()
    if (fromQueue) return fromQueue
    const { library, currentTrackId } = get()
    if (library.length === 0) return null
    if (!currentTrackId) return library[0]
    const idx = library.findIndex((t) => t.id === currentTrackId)
    if (idx === -1) return library[0]
    return library[(idx + 1) % library.length]
  },

  prevTrack: () => {
    const { library, currentTrackId } = get()
    if (library.length === 0) return null
    if (!currentTrackId) return library[0]
    const idx = library.findIndex((t) => t.id === currentTrackId)
    if (idx === -1) return library[0]
    return library[(idx - 1 + library.length) % library.length]
  }
}))
