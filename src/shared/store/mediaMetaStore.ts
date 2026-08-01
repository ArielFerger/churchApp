import { create } from 'zustand'
import type { MediaCategory, MediaMeta } from '../types/media'
import { emptyMeta, withCategory, withToday } from '../utils/mediaMeta'

interface MediaMetaState {
  meta: MediaMeta
  loaded: boolean
  load: () => Promise<void>
  /** Suscripción a los cambios empujados desde main. Devuelve el unsubscribe. */
  subscribe: () => () => void
  setCategory: (mediaId: string, category: MediaCategory | null) => Promise<void>
  toggleToday: (mediaId: string) => Promise<void>
  clearToday: () => Promise<void>
}

/**
 * Espejo en el renderer de `media-meta.json`. Las mutaciones se aplican
 * localmente primero (la UI responde en el acto) y después main devuelve el
 * estado autoritativo, que reemplaza al optimista.
 */
export const useMediaMetaStore = create<MediaMetaState>((set, get) => ({
  meta: emptyMeta(),
  loaded: false,

  load: async () => {
    const api = window.electronAPI
    if (!api?.getMediaMeta) {
      set({ loaded: true })
      return
    }
    set({ meta: await api.getMediaMeta(), loaded: true })
  },

  subscribe: () => {
    const api = window.electronAPI
    if (!api?.onMediaMetaUpdated) return () => {}
    return api.onMediaMetaUpdated((meta) => set({ meta, loaded: true }))
  },

  setCategory: async (mediaId, category) => {
    set({ meta: withCategory(get().meta, mediaId, category) })
    const meta = await window.electronAPI?.setMediaCategory(mediaId, category)
    if (meta) set({ meta })
  },

  toggleToday: async (mediaId) => {
    const selected = !get().meta.today.ids.includes(mediaId)
    set({ meta: withToday(get().meta, mediaId, selected) })
    const meta = await window.electronAPI?.setMediaToday(mediaId, selected)
    if (meta) set({ meta })
  },

  clearToday: async () => {
    set({ meta: { ...get().meta, today: { ...get().meta.today, ids: [] } } })
    const meta = await window.electronAPI?.clearMediaToday()
    if (meta) set({ meta })
  }
}))
