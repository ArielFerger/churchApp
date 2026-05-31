import { create } from 'zustand'
import type { MediaItem } from '../types/media'
import type { Song, Album } from '../types/song'

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
