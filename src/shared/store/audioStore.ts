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

  setLibrary: (items: AudioTrack[]) => void
  setPlayer: (s: {
    trackId: string | null
    isPlaying: boolean
    position: number
    duration: number
    volume: number
    isFadingOut: boolean
  }) => void

  /** Resolve the track immediately following the current one in the library. */
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

  setLibrary: (items) => set({ library: items, libraryLoaded: true }),

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
