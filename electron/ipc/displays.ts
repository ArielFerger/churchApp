import { ipcMain, screen } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { DisplayInfo } from '../../src/shared/types/ipc'

export function registerDisplayHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_DISPLAYS, (): DisplayInfo[] => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === screen.getPrimaryDisplay().id
    }))
  })
}
