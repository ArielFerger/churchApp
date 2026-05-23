import { create } from 'zustand'
import type { MediaItem } from '../types/media'
import type { Song } from '../types/song'

interface LibraryState {
  media: MediaItem[]
  mediaLoaded: boolean
  loadMedia: () => Promise<void>
  setMedia: (items: MediaItem[]) => void
  subscribeMedia: () => () => void

  songs: Song[]
  songsLoaded: boolean
  loadSongs: () => Promise<void>
  setSongs: (songs: Song[]) => void
  subscribeSongs: () => () => void
  saveSong: (input: Partial<Song> & { title: string }) => Promise<Song | null>
  deleteSong: (id: string) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  media: [],
  mediaLoaded: false,

  loadMedia: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ media: [], mediaLoaded: true })
      return
    }
    const items = await api.getMedia()
    set({ media: items, mediaLoaded: true })
  },

  setMedia: (items) => set({ media: items, mediaLoaded: true }),

  subscribeMedia: () => {
    const api = window.electronAPI
    if (!api) return () => {}
    return api.onMediaUpdated((items) => get().setMedia(items))
  },

  songs: [],
  songsLoaded: false,

  loadSongs: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ songs: [], songsLoaded: true })
      return
    }
    const songs = await api.getSongs()
    set({ songs, songsLoaded: true })
  },

  setSongs: (songs) => set({ songs, songsLoaded: true }),

  subscribeSongs: () => {
    const api = window.electronAPI
    if (!api) return () => {}
    return api.onSongsUpdated((songs) => get().setSongs(songs))
  },

  saveSong: async (input) => {
    const api = window.electronAPI
    if (!api) return null
    const saved = await api.saveSong(input)
    // We'll also receive a push via SONGS_UPDATED, but eager-update for snappier UX
    const songs = [...get().songs.filter((s) => s.id !== saved.id), saved].sort((a, b) =>
      a.title.localeCompare(b.title, 'es', { numeric: true, sensitivity: 'base' })
    )
    set({ songs })
    return saved
  },

  deleteSong: async (id) => {
    const api = window.electronAPI
    if (!api) return
    await api.deleteSong(id)
    set({ songs: get().songs.filter((s) => s.id !== id) })
  }
}))
