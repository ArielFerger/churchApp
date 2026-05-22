import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand, AppSettings, DisplayInfo } from '../../src/shared/types/ipc'

contextBridge.exposeInMainWorld('electronAPI', {
  sendProjectionCommand: (cmd: ProjectionCommand) =>
    ipcRenderer.send(IPC_CHANNELS.PROJECTION_COMMAND, cmd),

  getDisplays: (): Promise<DisplayInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_DISPLAYS),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  setSettings: (settings: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, settings),

  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_DIALOG, options)
})
