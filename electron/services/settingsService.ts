import Store from 'electron-store'
import { DEFAULT_BIBLE_DISPLAY, type AppSettings } from '../../src/shared/types/ipc'

const defaults: AppSettings = {
  projectionDisplayId: null,
  mediaFolder: null,
  audioFolder: null,
  songsFolder: null,
  liveLoopFolder: null,
  bibleBackgroundsFolder: null,
  defaultBibleVersion: null,
  bibleDisplay: DEFAULT_BIBLE_DISPLAY,
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
  // tener las claves nuevas (p. ej. liveLoopFolder). bibleDisplay se mergea
  // un nivel más adentro para que claves nuevas reciban su default.
  const saved = store.get('settings')
  return {
    ...defaults,
    ...saved,
    bibleDisplay: { ...defaults.bibleDisplay, ...saved?.bibleDisplay }
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial }
  store.set('settings', next)
  return next
}
