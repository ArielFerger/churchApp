import { app, BrowserWindow } from 'electron'
import { createControlWindow } from './windows/controlWindow'
import { createProjectionWindow, moveProjectionToDisplay } from './windows/projectionWindow'
import { registerProjectionHandlers } from './ipc/projection'
import { registerSettingsHandlers } from './ipc/settings'
import { registerDisplayHandlers } from './ipc/displays'
import { getSettings } from './services/settingsService'
import log from 'electron-log'

log.initialize()

let controlWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

app.whenReady().then(async () => {
  const settings = getSettings()

  controlWindow = createControlWindow()
  projectionWindow = createProjectionWindow(settings.projectionDisplayId)

  registerProjectionHandlers(controlWindow, projectionWindow)
  registerDisplayHandlers()
  registerSettingsHandlers((next, prev) => {
    if (next.projectionDisplayId !== prev.projectionDisplayId && next.projectionDisplayId !== null) {
      if (projectionWindow && !projectionWindow.isDestroyed()) {
        moveProjectionToDisplay(projectionWindow, next.projectionDisplayId)
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      controlWindow = createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export { controlWindow, projectionWindow }
