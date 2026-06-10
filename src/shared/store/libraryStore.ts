import { create } from 'zustand'
import type { MediaItem } from '../types/media'
import type { Song, Album } from '../types/song'

interface LibraryState {
  media: MediaItem[]
  mediaLoaded: boolean
  loadMedia: () => Promise<void>
  setMedia: (items: MediaItem[]) => void
  subscribeMedia: () => () => void

  /** Items de la carpeta exclusiva de loops "En Vivo" (vacío si no está configurada). */
  liveMedia: MediaItem[]
  liveMediaLoaded: boolean
  loadLiveMedia: () => Promise<void>
  setLiveMedia: (items: MediaItem[]) => void
  subscribeLiveMedia: () => () => void

  /** Items de la carpeta exclusiva de fondos de versículos (vacío si no está configurada). */
  bibleMedia: MediaItem[]
  bibleMediaLoaded: boolean
  loadBibleMedia: () => Promise<void>
  setBibleMedia: (items: MediaItem[]) => void
  subscribeBibleMedia: () => () => void

  songs: Song[]
  songsLoaded: boolean
  loadSongs: () => Promise<void>
  setSongs: (songs: Song[]) => void
  subscribeSongs: () => () => void
  saveSong: (input: Partial<Song> & { title: string }) => Promise<Song | null>
  deleteSong: (id: string) => Promise<void>

  albums: Album[]
  albumsLoaded: boolean
  loadAlbums: () => Promise<void>
  setAlbums: (albums: Album[]) => void
  subscribeAlbums: () => () => void
  saveAlbum: (input: Partial<Album> & { name: string }) => Promise<Album | null>
  deleteAlbum: (id: string) => Promise<void>
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

  // ─── Live loop media (carpeta aparte para "En Vivo") ───────────────────
  liveMedia: [],
  liveMediaLoaded: false,

  loadLiveMedia: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ liveMedia: [], liveMediaLoaded: true })
      return
    }
    const items = await api.getLiveMedia()
    set({ liveMedia: items, liveMediaLoaded: true })
  },

  setLiveMedia: (items) => set({ liveMedia: items, liveMediaLoaded: true }),

  subscribeLiveMedia: () => {
    const api = window.electronAPI
    if (!api) return () => {}
    return api.onLiveMediaUpdated((items) => get().setLiveMedia(items))
  },

  // ─── Bible backgrounds media (carpeta aparte para fondos de versículos) ─
  bibleMedia: [],
  bibleMediaLoaded: false,

  loadBibleMedia: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ bibleMedia: [], bibleMediaLoaded: true })
      return
    }
    const items = await api.getBibleMedia()
    set({ bibleMedia: items, bibleMediaLoaded: true })
  },

  setBibleMedia: (items) => set({ bibleMedia: items, bibleMediaLoaded: true }),

  subscribeBibleMedia: () => {
    const api = window.electronAPI
    if (!api) return () => {}
    return api.onBibleMediaUpdated((items) => get().setBibleMedia(items))
  },

  // ─── Songs ─────────────────────────────────────────────────────────────
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
  },

  // ─── Albums ────────────────────────────────────────────────────────────
  albums: [],
  albumsLoaded: false,

  loadAlbums: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ albums: [], albumsLoaded: true })
      return
    }
    const albums = await api.getAlbums()
    set({ albums, albumsLoaded: true })
  },

  setAlbums: (albums) => set({ albums, albumsLoaded: true }),

  subscribeAlbums: () => {
    const api = window.electronAPI
    if (!api) return () => {}
    return api.onAlbumsUpdated((albums) => get().setAlbums(albums))
  },

  saveAlbum: async (input) => {
    const api = window.electronAPI
    if (!api) return null
    const saved = await api.saveAlbum(input)
    const albums = [...get().albums.filter((a) => a.id !== saved.id), saved].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    )
    set({ albums })
    return saved
  },

  deleteAlbum: async (id) => {
    const api = window.electronAPI
    if (!api) return
    await api.deleteAlbum(id)
    set({ albums: get().albums.filter((a) => a.id !== id) })
  }
}))
