import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'

// Placeholder — electron-store se configura en Fase 1
const settingsCache: Record<string, unknown> = {}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => settingsCache)

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, partial: Record<string, unknown>) => {
    Object.assign(settingsCache, partial)
  })

  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, (_event, options: Electron.OpenDialogOptions) =>
    dialog.showOpenDialog(options)
  )
}
