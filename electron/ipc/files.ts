import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { mediaScanner, liveMediaScanner, bibleMediaScanner } from '../services/mediaScanner'
import type { MediaItem } from '../../src/shared/types/media'

/**
 * Wires up media-list IPC and broadcasts watcher updates to both renderers.
 * The control window uses the list to render the gallery; the projection
 * window uses it (indirectly via media:// URLs) when displaying items.
 * The "live" scanner indexes the optional dedicated folder for En Vivo loops;
 * the "bible" scanner, the optional dedicated folder for verse backgrounds.
 */
export function registerMediaHandlers(
  controlWindow: BrowserWindow,
  projectionWindow: BrowserWindow
): () => void {
  ipcMain.handle(IPC_CHANNELS.GET_MEDIA, (): MediaItem[] => mediaScanner.list())
  ipcMain.handle(IPC_CHANNELS.GET_LIVE_MEDIA, (): MediaItem[] => liveMediaScanner.list())
  ipcMain.handle(IPC_CHANNELS.GET_BIBLE_MEDIA, (): MediaItem[] => bibleMediaScanner.list())

  const broadcast = (channel: string) => (items: MediaItem[]) => {
    for (const win of [controlWindow, projectionWindow]) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, items)
      }
    }
  }

  const unsubMedia = mediaScanner.onChange(broadcast(IPC_CHANNELS.MEDIA_UPDATED))
  const unsubLive = liveMediaScanner.onChange(broadcast(IPC_CHANNELS.LIVE_MEDIA_UPDATED))
  const unsubBible = bibleMediaScanner.onChange(broadcast(IPC_CHANNELS.BIBLE_MEDIA_UPDATED))

  return () => {
    unsubMedia()
    unsubLive()
    unsubBible()
  }
}
