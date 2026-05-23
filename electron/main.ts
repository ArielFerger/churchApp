import { app, BrowserWindow } from 'electron'
import { createControlWindow } from './windows/controlWindow'
import { createProjectionWindow, moveProjectionToDisplay } from './windows/projectionWindow'
import { registerProjectionHandlers } from './ipc/projection'
import { registerSettingsHandlers } from './ipc/settings'
import { registerDisplayHandlers } from './ipc/displays'
import { registerMediaHandlers } from './ipc/files'
import { registerSongsHandlers } from './ipc/songs'
import { registerBibleHandlers } from './ipc/bible'
import { getSettings } from './services/settingsService'
import { mediaScanner } from './services/mediaScanner'
import { songsService } from './services/songsService'
import { bibleService } from './services/bibleService'
import {
  registerMediaSchemeAsPrivileged,
  registerMediaProtocolHandler
} from './services/mediaProtocol'
import log from 'electron-log'

log.initialize()

// MUST run before app is ready.
registerMediaSchemeAsPrivileged()

let controlWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

app.whenReady().then(async () => {
  registerMediaProtocolHandler()

  const settings = getSettings()

  controlWindow = createControlWindow()
  projectionWindow = createProjectionWindow(settings.projectionDisplayId)

  registerProjectionHandlers(controlWindow, projectionWindow)
  registerDisplayHandlers()
  registerMediaHandlers(controlWindow, projectionWindow)
  registerSongsHandlers(controlWindow)
  void songsService.init()
  registerBibleHandlers()
  void bibleService.init()

  registerSettingsHandlers((next, prev) => {
    if (
      next.projectionDisplayId !== prev.projectionDisplayId &&
      next.projectionDisplayId !== null
    ) {
      if (projectionWindow && !projectionWindow.isDestroyed()) {
        moveProjectionToDisplay(projectionWindow, next.projectionDisplayId)
      }
    }
    if (next.mediaFolder !== prev.mediaFolder) {
      void mediaScanner.setFolder(next.mediaFolder).catch((err) => {
        log.error('mediaScanner.setFolder failed', err)
      })
    }
  })

  // Initial scan from persisted folder (if any)
  if (settings.mediaFolder) {
    void mediaScanner.setFolder(settings.mediaFolder).catch((err) => {
      log.error('mediaScanner initial scan failed', err)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      controlWindow = createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void mediaScanner.dispose()
  void songsService.dispose()
})

export { controlWindow, projectionWindow }
