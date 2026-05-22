import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand } from '../../src/shared/types/ipc'

contextBridge.exposeInMainWorld('projectionAPI', {
  onCommand: (callback: (cmd: ProjectionCommand) => void) => {
    const handler = (_: Electron.IpcRendererEvent, cmd: ProjectionCommand) => callback(cmd)
    ipcRenderer.on(IPC_CHANNELS.PROJECTION_COMMAND, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTION_COMMAND, handler)
  }
})
