import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import type {
  ProjectionCommand,
  AppSettings,
  DisplayInfo,
  MediaPlaybackState
} from '../../src/shared/types/ipc'
import type { MediaCategory, MediaItem, MediaMeta } from '../../src/shared/types/media'
import type { Song, Album } from '../../src/shared/types/song'
import type { BibleBook } from '../../src/shared/types/bible'
import type { AudioTrack, AudioPlaylist } from '../../src/shared/types/audio'
import type { BibleFont } from '../../src/shared/types/fonts'
import type { DownloadJob, DownloadOptions } from '../../src/shared/utils/downloads'
import type { ToolStatus as DownloadTools } from '../services/downloadsService'
import type { EscuchaStatus, Transcripcion } from '../../src/shared/types/escucha'
import type { WhisperModelId } from '../../src/shared/utils/whisper'

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

  getMediaMeta: (): Promise<MediaMeta> => ipcRenderer.invoke(IPC_CHANNELS.GET_MEDIA_META),

  setMediaCategory: (mediaId: string, category: MediaCategory | null): Promise<MediaMeta> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_MEDIA_CATEGORY, mediaId, category),

  setMediaToday: (mediaId: string, selected: boolean): Promise<MediaMeta> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_MEDIA_TODAY, mediaId, selected),

  clearMediaToday: (): Promise<MediaMeta> => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_MEDIA_TODAY),

  onMediaMetaUpdated: (callback: (meta: MediaMeta) => void) => {
    const handler = (_: Electron.IpcRendererEvent, meta: MediaMeta) => callback(meta)
    ipcRenderer.on(IPC_CHANNELS.MEDIA_META_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEDIA_META_UPDATED, handler)
  },

  onProjectionState: (callback: (cmd: ProjectionCommand) => void) => {
    const handler = (_: Electron.IpcRendererEvent, cmd: ProjectionCommand) => callback(cmd)
    ipcRenderer.on(IPC_CHANNELS.PROJECTION_STATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTION_STATE, handler)
  },

  onMediaPlayback: (callback: (state: MediaPlaybackState) => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: MediaPlaybackState) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.MEDIA_PLAYBACK_STATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEDIA_PLAYBACK_STATE, handler)
  },

  showProjection: (opts?: { reload?: boolean }): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_PROJECTION, opts),

  getSongs: (): Promise<Song[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_SONGS),

  saveSong: (song: Partial<Song> & { title: string }): Promise<Song> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SONG, song),

  deleteSong: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DELETE_SONG, id),

  onSongsUpdated: (callback: (songs: Song[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, songs: Song[]) => callback(songs)
    ipcRenderer.on(IPC_CHANNELS.SONGS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SONGS_UPDATED, handler)
  },

  getAlbums: (): Promise<Album[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ALBUMS),

  saveAlbum: (album: Partial<Album> & { name: string }): Promise<Album> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_ALBUM, album),

  deleteAlbum: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALBUM, id),

  onAlbumsUpdated: (callback: (albums: Album[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, albums: Album[]) => callback(albums)
    ipcRenderer.on(IPC_CHANNELS.ALBUMS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ALBUMS_UPDATED, handler)
  },

  getBibleVersions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_VERSIONS),

  getBibleBooks: (version: string): Promise<BibleBook[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_BOOKS, version),

  getBibleBookStats: (version: string): Promise<Record<string, number[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_BOOK_STATS, version),

  getBibleFonts: (): Promise<BibleFont[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_BIBLE_FONTS),

  addBibleFonts: (filePaths: string[]): Promise<BibleFont[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_BIBLE_FONTS, filePaths),

  deleteBibleFont: (id: string): Promise<BibleFont[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_BIBLE_FONT, id),

  onBibleFontsUpdated: (callback: (fonts: BibleFont[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, fonts: BibleFont[]) => callback(fonts)
    ipcRenderer.on(IPC_CHANNELS.BIBLE_FONTS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BIBLE_FONTS_UPDATED, handler)
  },

  lookupVerse: (req: {
    version: string
    bookId: string
    chapter: number
    verse: number
    endVerse?: number
  }) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_VERSE, req),

  getAudio: (): Promise<AudioTrack[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_AUDIO),

  onAudioUpdated: (callback: (items: AudioTrack[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, items: AudioTrack[]) => callback(items)
    ipcRenderer.on(IPC_CHANNELS.AUDIO_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_UPDATED, handler)
  },

  getAudioState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_AUDIO_STATE),

  setAudioState: (partial: { lastTrackId?: string | null; position?: number; volume?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_AUDIO_STATE, partial),

  getAudioPlaylists: (): Promise<AudioPlaylist[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AUDIO_PLAYLISTS),

  saveAudioPlaylist: (input: {
    id?: string
    name: string
    trackIds?: string[]
  }): Promise<AudioPlaylist[]> => ipcRenderer.invoke(IPC_CHANNELS.SAVE_AUDIO_PLAYLIST, input),

  deleteAudioPlaylist: (id: string): Promise<AudioPlaylist[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_AUDIO_PLAYLIST, id),

  onShortcut: (callback: (key: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, key: string) => callback(key)
    ipcRenderer.on(IPC_CHANNELS.SHORTCUT_FIRED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_FIRED, handler)
  },

  // ─── Descargas de YouTube ───────────────────────────────────────────────
  getDownloadTools: (): Promise<DownloadTools> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_DOWNLOAD_TOOLS),

  installDownloadTools: (): Promise<DownloadTools> =>
    ipcRenderer.invoke(IPC_CHANNELS.INSTALL_DOWNLOAD_TOOLS),

  getDownloads: (): Promise<DownloadJob[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_DOWNLOADS),

  enqueueDownload: (
    url: string,
    options: Partial<DownloadOptions>
  ): Promise<DownloadJob> =>
    ipcRenderer.invoke(IPC_CHANNELS.ENQUEUE_DOWNLOAD, url, options),

  enqueuePlaylist: (
    url: string,
    options: Partial<DownloadOptions>
  ): Promise<{ added: number; error: string | null }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ENQUEUE_PLAYLIST, url, options),

  cancelDownload: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_DOWNLOAD, id),

  removeDownload: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_DOWNLOAD, id),

  clearDownloads: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_DOWNLOADS),

  youtubeLogin: (): Promise<{ ok: boolean; cookies: number; error: string | null }> =>
    ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_LOGIN),

  youtubeSessionStatus: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_SESSION_STATUS),

  youtubeLogout: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_LOGOUT),

  onDownloadsUpdated: (
    callback: (payload: {
      jobs?: DownloadJob[]
      install?: { step: string; ratio: number | null }
    }) => void
  ) => {
    const handler = (_: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) =>
      callback(payload)
    ipcRenderer.on(IPC_CHANNELS.DOWNLOADS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOADS_UPDATED, handler)
  },

  // ─── Escucha ────────────────────────────────────────────────────────────
  getEscuchaStatus: (): Promise<EscuchaStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ESCUCHA_STATUS),

  installEscucha: (modelo?: WhisperModelId): Promise<EscuchaStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.INSTALL_ESCUCHA, modelo),

  transcribirVentana: (pcm: Uint8Array, tasa: number): Promise<Transcripcion | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIBE_WINDOW, pcm, tasa),

  onEscuchaProgress: (callback: (p: { step: string; ratio: number | null }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: Parameters<typeof callback>[0]) => callback(p)
    ipcRenderer.on(IPC_CHANNELS.ESCUCHA_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ESCUCHA_PROGRESS, handler)
  }
})
