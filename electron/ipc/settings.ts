import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { getSettings, updateSettings } from '../services/settingsService'
import type { AppSettings } from '../../src/shared/types/ipc'

export function registerSettingsHandlers(
  onSettingsChange?: (next: AppSettings, prev: AppSettings) => void
): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => getSettings())

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, partial: Partial<AppSettings>) => {
    const prev = getSettings()
    const next = updateSettings(partial)
    onSettingsChange?.(next, prev)
    return next
  })

  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, (_event, options: Electron.OpenDialogOptions) =>
    dialog.showOpenDialog(options)
  )
}
