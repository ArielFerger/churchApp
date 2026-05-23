import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand, AppSettings, DisplayInfo } from '../../src/shared/types/ipc'
import type { MediaItem } from '../../src/shared/types/media'
import type { Song } from '../../src/shared/types/song'
import type { BibleBook } from '../../src/shared/types/bible'

contextBridge.exposeInMainWorld('electronAPI', {
  sendProjectionCommand: (cmd: ProjectionCommand) =>
    ipcRenderer.send(IPC_CHANNELS.PROJECTION_COMMAND, cmd),

  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_DISPLAYS),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, settings),

  showOpenDialog: (
    options: Electron.OpenDialogOptions
  ): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_DIALOG, options),

  getMedia: (): Promise<MediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_MEDIA),

  onMediaUpdated: (callback: (items: MediaItem[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, items: MediaItem[]) => callback(items)
    ipcRenderer.on(IPC_CHANNELS.MEDIA_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEDIA_UPDATED, handler)
  },

  onProjectionState: (callback: (cmd: ProjectionCommand) => void) => {
    const handler = (_: Electron.IpcRendererEvent, cmd: ProjectionCommand) => callback(cmd)
    ipcRenderer.on(IPC_CHANNELS.PROJECTION_STATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTION_STATE, handler)
  },

  getSongs: (): Promise<Song[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_SONGS),

  saveSong: (song: Partial<Song> & { title: string }): Promise<Song> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SONG, song),

  deleteSong: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DELETE_SONG, id),

  onSongsUpdated: (callback: (songs: Song[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, songs: Song[]) => callback(songs)
    ipcRenderer.on(IPC_CHANNELS.SONGS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SONGS_UPDATED, handler)
  },

  getBibleVersions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_VERSIONS),

  getBibleBooks: (version: string): Promise<BibleBook[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_BOOKS, version),

  lookupVerse: (req: {
    version: string
    bookId: string
    chapter: number
    verse: number
    endVerse?: number
  }) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_VERSE, req),

  onShortcut: (callback: (key: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, key: string) => callback(key)
    ipcRenderer.on(IPC_CHANNELS.SHORTCUT_FIRED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_FIRED, handler)
  }
})
