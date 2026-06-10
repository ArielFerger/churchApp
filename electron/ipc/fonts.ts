import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { listFonts, addFonts, deleteFont } from '../services/fontsService'
import type { BibleFont } from '../../src/shared/types/fonts'

/**
 * CRUD de fuentes subidas. Las mutaciones devuelven la lista completa y la
 * difunden a ambas ventanas para que registren/desregistren las FontFace.
 */
export function registerFontsHandlers(
  controlWindow: BrowserWindow,
  projectionWindow: BrowserWindow
): void {
  const broadcast = (fonts: BibleFont[]): void => {
    for (const win of [controlWindow, projectionWindow]) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.BIBLE_FONTS_UPDATED, fonts)
      }
    }
  }

  ipcMain.handle(IPC_CHANNELS.GET_BIBLE_FONTS, async (): Promise<BibleFont[]> => listFonts())

  ipcMain.handle(
    IPC_CHANNELS.ADD_BIBLE_FONTS,
    async (_e, filePaths: string[]): Promise<BibleFont[]> => {
      const fonts = await addFonts(filePaths)
      broadcast(fonts)
      return fonts
    }
  )

  ipcMain.handle(IPC_CHANNELS.DELETE_BIBLE_FONT, async (_e, id: string): Promise<BibleFont[]> => {
    const fonts = await deleteFont(id)
    broadcast(fonts)
    return fonts
  })
}
