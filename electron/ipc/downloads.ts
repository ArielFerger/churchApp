import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import * as downloads from '../services/downloadsService'
import type { DownloadJob, DownloadOptions } from '../../src/shared/utils/downloads'

export function registerDownloadsHandlers(controlWindow: BrowserWindow): () => void {
  const send = (channel: string, payload: unknown): void => {
    if (!controlWindow.isDestroyed()) controlWindow.webContents.send(channel, payload)
  }

  ipcMain.handle(IPC_CHANNELS.GET_DOWNLOAD_TOOLS, () => downloads.resolveTools())

  ipcMain.handle(IPC_CHANNELS.INSTALL_DOWNLOAD_TOOLS, async () => {
    // El avance de la instalación viaja por el mismo canal que la lista de
    // descargas no: tiene su propia forma, así que se manda como evento suelto.
    return downloads.installTools((step, ratio) =>
      send(IPC_CHANNELS.DOWNLOADS_UPDATED, { install: { step, ratio } })
    )
  })

  ipcMain.handle(IPC_CHANNELS.GET_DOWNLOADS, (): DownloadJob[] => downloads.list())

  ipcMain.handle(
    IPC_CHANNELS.ENQUEUE_DOWNLOAD,
    (_e, url: string, options: Partial<DownloadOptions>): DownloadJob =>
      downloads.enqueue(url, options)
  )

  ipcMain.handle(
    IPC_CHANNELS.ENQUEUE_PLAYLIST,
    (_e, url: string, options: Partial<DownloadOptions>) =>
      downloads.enqueuePlaylist(url, options)
  )

  ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOAD, (_e, id: string) => downloads.cancel(id))
  ipcMain.handle(IPC_CHANNELS.REMOVE_DOWNLOAD, (_e, id: string) => downloads.remove(id))
  ipcMain.handle(IPC_CHANNELS.CLEAR_DOWNLOADS, () => downloads.clearFinished())

  const unsub = downloads.onChange((jobs) =>
    send(IPC_CHANNELS.DOWNLOADS_UPDATED, { jobs })
  )

  return () => {
    unsub()
    for (const c of [
      IPC_CHANNELS.GET_DOWNLOAD_TOOLS,
      IPC_CHANNELS.INSTALL_DOWNLOAD_TOOLS,
      IPC_CHANNELS.GET_DOWNLOADS,
      IPC_CHANNELS.ENQUEUE_DOWNLOAD,
      IPC_CHANNELS.ENQUEUE_PLAYLIST,
      IPC_CHANNELS.CANCEL_DOWNLOAD,
      IPC_CHANNELS.REMOVE_DOWNLOAD,
      IPC_CHANNELS.CLEAR_DOWNLOADS
    ]) {
      ipcMain.removeHandler(c)
    }
  }
}
