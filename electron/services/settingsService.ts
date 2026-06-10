import Store from 'electron-store'
import type { AppSettings } from '../../src/shared/types/ipc'

const defaults: AppSettings = {
  projectionDisplayId: null,
  mediaFolder: null,
  audioFolder: null,
  songsFolder: null,
  liveLoopFolder: null,
  defaultBibleVersion: null,
  videoFadeIn: true,
  videoFadeOut: false,
  videoFadeInSec: 1,
  videoFadeOutSec: 2.5
}

interface Schema {
  settings: AppSettings
}

const store = new Store<Schema>({
  name: 'church-projector-settings',
  defaults: { settings: defaults }
})

export function getSettings(): AppSettings {
  // Merge sobre defaults: settings guardados por versiones viejas pueden no
  // tener las claves nuevas (p. ej. liveLoopFolder).
  return { ...defaults, ...store.get('settings') }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial }
  store.set('settings', next)
  return next
}
