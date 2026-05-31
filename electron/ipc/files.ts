import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { mediaScanner } from '../services/mediaScanner'
import type { MediaItem } from '../../src/shared/types/media'

/**
 * Wires up media-list IPC and broadcasts watcher updates to both renderers.
 * The control window uses the list to render the gallery; the projection
 * window uses it (indirectly via media:// URLs) when displaying items.
 */
export function registerMediaHandlers(
  controlWindow: BrowserWindow,
  projectionWindow: BrowserWindow
): () => void {
  ipcMain.handle(IPC_CHANNELS.GET_MEDIA, (): MediaItem[] => mediaScanner.list())

  const unsub = mediaScanner.onChange((items) => {
    for (const win of [controlWindow, projectionWindow]) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.MEDIA_UPDATED, items)
      }
    }
  })

  return unsub
}
