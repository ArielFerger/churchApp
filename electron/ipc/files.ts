import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { mediaScanner, liveMediaScanner, bibleMediaScanner } from '../services/mediaScanner'
import {
  clearTodaySelection,
  getMeta,
  setCategory,
  setTodaySelected
} from '../services/mediaMetaService'
import { isMediaCategory, type MediaItem, type MediaMeta } from '../../src/shared/types/media'

/**
 * Wires up media-list IPC and broadcasts watcher updates to both renderers.
 * The control window uses the list to render the gallery; the projection
 * window uses it (indirectly via media:// URLs) when displaying items.
 * The "live" scanner indexes the optional dedicated folder for En Vivo loops;
 * the "bible" scanner, the optional dedicated folder for verse backgrounds.
 *
 * También expone los metadatos del operador (categoría de cada archivo y la
 * selección "para hoy"), que solo le interesan a la ventana de control.
 */
export function registerMediaHandlers(
  controlWindow: BrowserWindow,
  projectionWindow: BrowserWindow
): () => void {
  ipcMain.handle(IPC_CHANNELS.GET_MEDIA, (): MediaItem[] => mediaScanner.list())
  ipcMain.handle(IPC_CHANNELS.GET_LIVE_MEDIA, (): MediaItem[] => liveMediaScanner.list())
  ipcMain.handle(IPC_CHANNELS.GET_BIBLE_MEDIA, (): MediaItem[] => bibleMediaScanner.list())

  // La ventana que mutó ya recibe el resultado por el invoke; el broadcast
  // mantiene sincronizada cualquier otra vista abierta sobre los mismos datos.
  const notifyMeta = (meta: MediaMeta): MediaMeta => {
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.MEDIA_META_UPDATED, meta)
    }
    return meta
  }

  ipcMain.handle(IPC_CHANNELS.GET_MEDIA_META, (): Promise<MediaMeta> => getMeta())

  ipcMain.handle(
    IPC_CHANNELS.SET_MEDIA_CATEGORY,
    async (_event, mediaId: string, category: unknown): Promise<MediaMeta> => {
      // El renderer no es de confianza para el tipo: validar antes de persistir.
      const value = isMediaCategory(category) ? category : null
      return notifyMeta(await setCategory(mediaId, value))
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SET_MEDIA_TODAY,
    async (_event, mediaId: string, selected: boolean): Promise<MediaMeta> =>
      notifyMeta(await setTodaySelected(mediaId, selected === true))
  )

  ipcMain.handle(
    IPC_CHANNELS.CLEAR_MEDIA_TODAY,
    async (): Promise<MediaMeta> => notifyMeta(await clearTodaySelection())
  )

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
