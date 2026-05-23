import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { songsService } from '../services/songsService'
import type { Song } from '../../src/shared/types/song'

export function registerSongsHandlers(controlWindow: BrowserWindow): () => void {
  ipcMain.handle(IPC_CHANNELS.GET_SONGS, async (): Promise<Song[]> => {
    await songsService.init()
    return songsService.list()
  })

  ipcMain.handle(
    IPC_CHANNELS.SAVE_SONG,
    async (_event, input: Partial<Song> & { title: string }): Promise<Song> => {
      return songsService.save(input)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DELETE_SONG, async (_event, id: string): Promise<void> => {
    return songsService.delete(id)
  })

  const unsub = songsService.onChange((songs) => {
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.SONGS_UPDATED, songs)
    }
  })

  return unsub
}
