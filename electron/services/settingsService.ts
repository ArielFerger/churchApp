import Store from 'electron-store'
import type { AppSettings } from '../../src/shared/types/ipc'

const defaults: AppSettings = {
  projectionDisplayId: null,
  mediaFolder: null,
  audioFolder: null,
  songsFolder: null
}

interface Schema {
  settings: AppSettings
}

const store = new Store<Schema>({
  name: 'church-projector-settings',
  defaults: { settings: defaults }
})

export function getSettings(): AppSettings {
  return store.get('settings')
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = store.get('settings')
  const next = { ...current, ...partial }
  store.set('settings', next)
  return next
}
