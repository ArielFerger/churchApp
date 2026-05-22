import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand } from '../../src/shared/types/ipc'

export function registerProjectionHandlers(
  controlWindow: BrowserWindow,
  projectionWindow: BrowserWindow
): void {
  ipcMain.on(IPC_CHANNELS.PROJECTION_COMMAND, (_event, cmd: ProjectionCommand) => {
    if (!projectionWindow.isDestroyed()) {
      projectionWindow.webContents.send(IPC_CHANNELS.PROJECTION_COMMAND, cmd)
    }
  })

  // Esc = blackout (debug shortcut handled in renderer)
  controlWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      if (!projectionWindow.isDestroyed()) {
        projectionWindow.webContents.send(IPC_CHANNELS.PROJECTION_COMMAND, { type: 'blackout' })
      }
    }
  })
}
