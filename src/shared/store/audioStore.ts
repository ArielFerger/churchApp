import { create } from 'zustand'
import type { AudioTrack, AudioPlaylist } from '../types/audio'

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

  /** Playlists guardadas (persisten en disco vía IPC). */
  playlists: AudioPlaylist[]
  playlistsLoaded: boolean
  /** Pestaña activa en la página Audio: null = "Toda la música". */
  activePlaylistId: string | null

  /**
   * Contexto de reproducción: ids ordenados de la playlist desde la que se
   * reprodujo el track actual. null = se reproduce sobre la librería entera.
   * nextTrack/prevTrack avanzan dentro del contexto.
   */
  playContextIds: string[] | null

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
  /** Al principio de la cola: suena después del tema actual. */
  enqueueNext: (id: string) => void
  /** Remove the queue entry at `index`. */
  removeFromQueue: (index: number) => void
  /** Empty the queue. */
  clearQueue: () => void
  /** Pop the first queued track (resolving to a library item, skipping stale ids). */
  consumeQueue: () => AudioTrack | null

  /** Next track: queue first, otherwise the following item in the play context / library. */
  nextTrack: () => AudioTrack | null
  prevTrack: () => AudioTrack | null
  currentTrack: () => AudioTrack | null

  setActivePlaylist: (id: string | null) => void
  setPlayContext: (ids: string[] | null) => void
  loadPlaylists: () => Promise<void>
  createPlaylist: (name: string) => Promise<AudioPlaylist | null>
  renamePlaylist: (id: string, name: string) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  moveTrackInPlaylist: (playlistId: string, trackId: string, dir: -1 | 1) => Promise<void>
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

  playlists: [],
  playlistsLoaded: false,
  activePlaylistId: null,
  playContextIds: null,

  setLibrary: (items) => set({ library: items, libraryLoaded: true }),

  enqueue: (id) => set((s) => ({ queue: [...s.queue, id] })),

  enqueueNext: (id) => set((s) => ({ queue: [id, ...s.queue] })),

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
    // Queue takes priority over playlist/library order.
    const fromQueue = get().consumeQueue()
    if (fromQueue) return fromQueue
    return stepInContext(get(), +1)
  },

  prevTrack: () => stepInContext(get(), -1),

  // ─── Playlists ─────────────────────────────────────────────────────────
  setActivePlaylist: (id) => set({ activePlaylistId: id }),
  setPlayContext: (ids) => set({ playContextIds: ids }),

  loadPlaylists: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ playlists: [], playlistsLoaded: true })
      return
    }
    const playlists = await api.getAudioPlaylists()
    set({ playlists, playlistsLoaded: true })
  },

  createPlaylist: async (name) => {
    const api = window.electronAPI
    if (!api) return null
    const before = get().playlists.map((p) => p.id)
    const playlists = await api.saveAudioPlaylist({ name })
    set({ playlists })
    return playlists.find((p) => !before.includes(p.id)) ?? null
  },

  renamePlaylist: async (id, name) => {
    const api = window.electronAPI
    if (!api) return
    set({ playlists: await api.saveAudioPlaylist({ id, name }) })
  },

  deletePlaylist: async (id) => {
    const api = window.electronAPI
    if (!api) return
    const playlists = await api.deleteAudioPlaylist(id)
    set((s) => ({
      playlists,
      activePlaylistId: s.activePlaylistId === id ? null : s.activePlaylistId
    }))
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    const p = get().playlists.find((x) => x.id === playlistId)
    const api = window.electronAPI
    if (!p || !api || p.trackIds.includes(trackId)) return
    set({
      playlists: await api.saveAudioPlaylist({
        id: p.id,
        name: p.name,
        trackIds: [...p.trackIds, trackId]
      })
    })
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    const p = get().playlists.find((x) => x.id === playlistId)
    const api = window.electronAPI
    if (!p || !api) return
    set({
      playlists: await api.saveAudioPlaylist({
        id: p.id,
        name: p.name,
        trackIds: p.trackIds.filter((t) => t !== trackId)
      })
    })
  },

  moveTrackInPlaylist: async (playlistId, trackId, dir) => {
    const p = get().playlists.find((x) => x.id === playlistId)
    const api = window.electronAPI
    if (!p || !api) return
    const i = p.trackIds.indexOf(trackId)
    const j = i + dir
    if (i === -1 || j < 0 || j >= p.trackIds.length) return
    const trackIds = [...p.trackIds]
    ;[trackIds[i], trackIds[j]] = [trackIds[j], trackIds[i]]
    set({ playlists: await api.saveAudioPlaylist({ id: p.id, name: p.name, trackIds }) })
  }
}))

/**
 * Avanza ±1 dentro del contexto de reproducción (playlist) si hay uno, o
 * dentro de la librería completa si no. Ignora ids que ya no existen.
 */
function stepInContext(
  s: Pick<AudioState, 'library' | 'currentTrackId' | 'playContextIds'>,
  dir: 1 | -1
): AudioTrack | null {
  const { library, currentTrackId, playContextIds } = s
  if (library.length === 0) return null

  const order: AudioTrack[] = playContextIds
    ? playContextIds
        .map((id) => library.find((t) => t.id === id))
        .filter((t): t is AudioTrack => Boolean(t))
    : library

  if (order.length === 0) return null
  if (!currentTrackId) return order[0]
  const idx = order.findIndex((t) => t.id === currentTrackId)
  if (idx === -1) return order[0]
  return order[(idx + dir + order.length) % order.length]
}
