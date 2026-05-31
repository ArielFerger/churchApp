import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand, MediaPlaybackState } from '../../src/shared/types/ipc'
import { toggleProjectionVisibility, moveProjectionToDisplay } from '../windows/projectionWindow'
import { getSettings } from '../services/settingsService'

export function registerProjectionHandlers(
  controlWindow: BrowserWindow,
  projectionWindow: BrowserWindow
): void {
  const sendToProjection = (cmd: ProjectionCommand): void => {
    if (!projectionWindow.isDestroyed()) {
      projectionWindow.webContents.send(IPC_CHANNELS.PROJECTION_COMMAND, cmd)
    }
  }

  ipcMain.on(IPC_CHANNELS.PROJECTION_COMMAND, (_event, cmd: ProjectionCommand) => {
    sendToProjection(cmd)
    // Mirror state back to control so LiveIndicator stays in sync
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.PROJECTION_STATE, cmd)
    }
  })

  // Video playback telemetry: projection → control (for the scrubber/transport).
  ipcMain.on(IPC_CHANNELS.MEDIA_PLAYBACK_STATE, (_event, state: MediaPlaybackState) => {
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.MEDIA_PLAYBACK_STATE, state)
    }
  })

  // Recover the projection window if it got hidden (F11), sent to the wrong
  // monitor, or buried behind other windows. Reconnects it to the configured
  // display and brings it to the front. As a last resort (renderer stuck/blank)
  // it reloads the projection page.
  ipcMain.handle(IPC_CHANNELS.SHOW_PROJECTION, (_event, opts?: { reload?: boolean }) => {
    if (projectionWindow.isDestroyed()) {
      log.warn('SHOW_PROJECTION: projection window is destroyed')
      return false
    }
    const settings = getSettings()
    if (settings.projectionDisplayId != null) {
      moveProjectionToDisplay(projectionWindow, settings.projectionDisplayId)
    }
    if (!projectionWindow.isVisible()) projectionWindow.show()
    projectionWindow.focus()
    if (opts?.reload) projectionWindow.webContents.reload()
    return true
  })

  // Debug shortcuts captured BEFORE the renderer sees them.
  // Esc = blackout, F11 = toggle projection window visibility.
  const handleShortcut = (
    sourceWin: BrowserWindow,
    input: Electron.Input
  ): void => {
    if (input.type !== 'keyDown') return
    if (input.key === 'Escape') {
      // Panic stop: black out AND stop every presentation (slideshow, video…).
      sendToProjection({ type: 'stopAll' })
      if (!controlWindow.isDestroyed()) {
        controlWindow.webContents.send(IPC_CHANNELS.PROJECTION_STATE, { type: 'stopAll' })
      }
    } else if (input.key === 'F11') {
      toggleProjectionVisibility(projectionWindow)
    } else {
      return
    }
    sourceWin.webContents.send(IPC_CHANNELS.SHORTCUT_FIRED, input.key)
  }

  controlWindow.webContents.on('before-input-event', (_event, input) => {
    handleShortcut(controlWindow, input)
  })

  projectionWindow.webContents.on('before-input-event', (_event, input) => {
    handleShortcut(projectionWindow, input)
  })
}
