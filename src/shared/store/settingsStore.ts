import { create } from 'zustand'
import { DEFAULT_SETTINGS, type AppSettings, type DisplayInfo } from '../types/ipc'

interface SettingsState {
  settings: AppSettings | null
  displays: DisplayInfo[]
  loaded: boolean
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<void>
  refreshDisplays: () => Promise<void>
}

const DEFAULTS: AppSettings = DEFAULT_SETTINGS

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
