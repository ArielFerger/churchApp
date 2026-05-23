import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand } from '../../src/shared/types/ipc'
import type { MediaItem } from '../../src/shared/types/media'

contextBridge.exposeInMainWorld('projectionAPI', {
  onCommand: (callback: (cmd: ProjectionCommand) => void) => {
    const handler = (_: Electron.IpcRendererEvent, cmd: ProjectionCommand) => callback(cmd)
    ipcRenderer.on(IPC_CHANNELS.PROJECTION_COMMAND, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTION_COMMAND, handler)
  },

  getMedia: (): Promise<MediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_MEDIA),

  onMediaUpdated: (callback: (items: MediaItem[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, items: MediaItem[]) => callback(items)
    ipcRenderer.on(IPC_CHANNELS.MEDIA_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEDIA_UPDATED, handler)
  }
})
