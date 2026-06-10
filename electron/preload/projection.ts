import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type { ProjectionCommand, MediaPlaybackState, AppSettings } from '../../src/shared/types/ipc'
import type { MediaItem } from '../../src/shared/types/media'
import type { BibleFont } from '../../src/shared/types/fonts'

contextBridge.exposeInMainWorld('projectionAPI', {
  onCommand: (callback: (cmd: ProjectionCommand) => void) => {
    const handler = (_: Electron.IpcRendererEvent, cmd: ProjectionCommand) => callback(cmd)
    ipcRenderer.on(IPC_CHANNELS.PROJECTION_COMMAND, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTION_COMMAND, handler)
  },

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings)
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_UPDATED, handler)
  },

  getBibleFonts: (): Promise<BibleFont[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_FONTS),

  onBibleFontsUpdated: (callback: (fonts: BibleFont[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, fonts: BibleFont[]) => callback(fonts)
    ipcRenderer.on(IPC_CHANNELS.BIBLE_FONTS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BIBLE_FONTS_UPDATED, handler)
  },

  getMedia: (): Promise<MediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_MEDIA),

  onMediaUpdated: (callback: (items: MediaItem[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, items: MediaItem[]) => callback(items)
    ipcRenderer.on(IPC_CHANNELS.MEDIA_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEDIA_UPDATED, handler)
  },

  getLiveMedia: (): Promise<MediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_LIVE_MEDIA),

  onLiveMediaUpdated: (callback: (items: MediaItem[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, items: MediaItem[]) => callback(items)
    ipcRenderer.on(IPC_CHANNELS.LIVE_MEDIA_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LIVE_MEDIA_UPDATED, handler)
  },

  getBibleMedia: (): Promise<MediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_MEDIA),

  onBibleMediaUpdated: (callback: (items: MediaItem[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, items: MediaItem[]) => callback(items)
    ipcRenderer.on(IPC_CHANNELS.BIBLE_MEDIA_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BIBLE_MEDIA_UPDATED, handler)
  },

  /** Report current video playback state up to the control window. */
  emitPlaybackState: (state: MediaPlaybackState) =>
    ipcRenderer.send(IPC_CHANNELS.MEDIA_PLAYBACK_STATE, state)
})
