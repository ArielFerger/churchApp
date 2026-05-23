import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand } from '../../src/shared/types/ipc'
import { toggleProjectionVisibility } from '../windows/projectionWindow'

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

  // Debug shortcuts captured BEFORE the renderer sees them.
  // Esc = blackout, F11 = toggle projection window visibility.
  const handleShortcut = (
    sourceWin: BrowserWindow,
    input: Electron.Input
  ): void => {
    if (input.type !== 'keyDown') return
    if (input.key === 'Escape') {
      sendToProjection({ type: 'blackout' })
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
