import { create } from 'zustand'
import type { MediaItem } from '../types/media'

interface LibraryState {
  media: MediaItem[]
  mediaLoaded: boolean
  loadMedia: () => Promise<void>
  setMedia: (items: MediaItem[]) => void
  subscribeMedia: () => () => void
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

  /**
   * Subscribes to push updates from main (scanner change events).
   * Returns the unsubscribe fn.
   */
  subscribeMedia: () => {
    const api = window.electronAPI
    if (!api) return () => {}
    return api.onMediaUpdated((items) => get().setMedia(items))
  }
}))
