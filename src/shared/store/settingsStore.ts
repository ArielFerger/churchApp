import { create } from 'zustand'
import { DEFAULT_BIBLE_DISPLAY, type AppSettings, type DisplayInfo } from '../types/ipc'

interface SettingsState {
  settings: AppSettings | null
  displays: DisplayInfo[]
  loaded: boolean
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<void>
  refreshDisplays: () => Promise<void>
}

const DEFAULTS: AppSettings = {
  projectionDisplayId: null,
  mediaFolder: null,
  audioFolder: null,
  toolsFolder: null,
  downloadCookiesBrowser: null,
  songsFolder: null,
  liveLoopFolder: null,
  bibleBackgroundsFolder: null,
  defaultBibleVersion: null,
  bibleDisplay: DEFAULT_BIBLE_DISPLAY,
  videoFadeIn: true,
  videoFadeOut: false,
  videoFadeInSec: 1,
  videoFadeOutSec: 2.5,
  escuchaModelo: null
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  displays: [],
  loaded: false,

  load: async () => {
    const api = window.electronAPI
    if (!api) {
      set({ settings: DEFAULTS, displays: [], loaded: true })
      return
    }
    const [settings, displays] = await Promise.all([api.getSettings(), api.getDisplays()])
    set({ settings, displays, loaded: true })
  },

  update: async (partial) => {
    const api = window.electronAPI
    if (!api) return
    const next = await api.setSettings(partial)
    set({ settings: next })
  },

  refreshDisplays: async () => {
    const api = window.electronAPI
    if (!api) return
    const displays = await api.getDisplays()
    set({ displays })
  }
}))
