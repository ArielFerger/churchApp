import type { ProjectionCommand, AppSettings, DisplayInfo, MediaPlaybackState } from './ipc'
import type { MediaCategory, MediaItem, MediaMeta } from './media'
import type { Song, Album } from './song'
import type { BibleBook } from './bible'
import type { AudioTrack, AudioPlaylist } from './audio'
import type { BibleFont } from './fonts'
import type { DownloadJob, DownloadOptions } from '../utils/downloads'
import type { EscuchaStatus, Transcripcion } from './escucha'
import type { WhisperModelId } from '../utils/whisper'

/** Dónde están (o no) yt-dlp y ffmpeg. */
export interface DownloadTools {
  ytDlp: string | null
  ffmpegDir: string | null
  searched: string[]
}

export interface AudioPersistedState {
  lastTrackId: string | null
  position: number
  volume: number
}

export interface BibleVersionSummary {
  version: string
  name: string
  language: string
  bookCount: number
}

export interface BibleLookupRequest {
  version: string
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

export interface BibleLookupResult {
  version: BibleVersionSummary
  bookId: string
  bookName: string
  chapter: number
  verse: number
  endVerse?: number
  text: string
  verses: { number: number; text: string }[]
}

/** Por cada bookId, array donde el índice i = cantidad de versículos del capítulo i+1. */
export type BibleBookStats = Record<string, number[]>


export interface ControlElectronAPI {
  sendProjectionCommand: (cmd: ProjectionCommand) => void
  getDisplays: () => Promise<DisplayInfo[]>
  getSettings: () => Promise<AppSettings>
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  showOpenDialog: (
    options: Electron.OpenDialogOptions
  ) => Promise<Electron.OpenDialogReturnValue>
  getMedia: () => Promise<MediaItem[]>
  onMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  getLiveMedia: () => Promise<MediaItem[]>
  onLiveMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  getBibleMedia: () => Promise<MediaItem[]>
  onBibleMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  /** Categorías + selección "para hoy" del operador (no viven en el disco). */
  getMediaMeta: () => Promise<MediaMeta>
  setMediaCategory: (mediaId: string, category: MediaCategory | null) => Promise<MediaMeta>
  setMediaToday: (mediaId: string, selected: boolean) => Promise<MediaMeta>
  clearMediaToday: () => Promise<MediaMeta>
  onMediaMetaUpdated: (callback: (meta: MediaMeta) => void) => () => void
  onProjectionState: (callback: (cmd: ProjectionCommand) => void) => () => void
  onMediaPlayback: (callback: (state: MediaPlaybackState) => void) => () => void
  showProjection: (opts?: { reload?: boolean }) => Promise<boolean>
  getSongs: () => Promise<Song[]>
  saveSong: (song: Partial<Song> & { title: string }) => Promise<Song>
  deleteSong: (id: string) => Promise<void>
  onSongsUpdated: (callback: (songs: Song[]) => void) => () => void
  getAlbums: () => Promise<Album[]>
  saveAlbum: (album: Partial<Album> & { name: string }) => Promise<Album>
  deleteAlbum: (id: string) => Promise<void>
  onAlbumsUpdated: (callback: (albums: Album[]) => void) => () => void
  getBibleVersions: () => Promise<BibleVersionSummary[]>
  getBibleBooks: (version: string) => Promise<BibleBook[]>
  getBibleBookStats: (version: string) => Promise<BibleBookStats>
  getBibleFonts: () => Promise<BibleFont[]>
  addBibleFonts: (filePaths: string[]) => Promise<BibleFont[]>
  deleteBibleFont: (id: string) => Promise<BibleFont[]>
  onBibleFontsUpdated: (callback: (fonts: BibleFont[]) => void) => () => void
  lookupVerse: (req: BibleLookupRequest) => Promise<BibleLookupResult | null>
  getAudio: () => Promise<AudioTrack[]>
  onAudioUpdated: (callback: (items: AudioTrack[]) => void) => () => void
  getAudioState: () => Promise<AudioPersistedState>
  setAudioState: (partial: Partial<AudioPersistedState>) => Promise<AudioPersistedState>
  getAudioPlaylists: () => Promise<AudioPlaylist[]>
  saveAudioPlaylist: (input: {
    id?: string
    name: string
    trackIds?: string[]
  }) => Promise<AudioPlaylist[]>
  deleteAudioPlaylist: (id: string) => Promise<AudioPlaylist[]>
  onShortcut: (callback: (key: string) => void) => () => void

  getDownloadTools: () => Promise<DownloadTools>
  installDownloadTools: () => Promise<DownloadTools>
  getDownloads: () => Promise<DownloadJob[]>
  enqueueDownload: (url: string, options: Partial<DownloadOptions>) => Promise<DownloadJob>
  enqueuePlaylist: (
    url: string,
    options: Partial<DownloadOptions>
  ) => Promise<{ added: number; error: string | null }>
  cancelDownload: (id: string) => Promise<void>
  removeDownload: (id: string) => Promise<void>
  clearDownloads: () => Promise<void>
  youtubeLogin: () => Promise<{ ok: boolean; cookies: number; error: string | null }>
  youtubeSessionStatus: () => Promise<boolean>
  youtubeLogout: () => Promise<void>
  onDownloadsUpdated: (
    callback: (payload: {
      jobs?: DownloadJob[]
      install?: { step: string; ratio: number | null }
    }) => void
  ) => () => void

  getEscuchaStatus: () => Promise<EscuchaStatus>
  installEscucha: (modelo?: WhisperModelId) => Promise<EscuchaStatus>
  /** Manda una ventana de PCM 16 bits mono. `null` = se descartó por saturación. */
  transcribirVentana: (pcm: Uint8Array, tasa: number) => Promise<Transcripcion | null>
  onEscuchaProgress: (
    callback: (p: { step: string; ratio: number | null }) => void
  ) => () => void
}

export interface ProjectionElectronAPI {
  onCommand: (callback: (cmd: ProjectionCommand) => void) => () => void
  getSettings: () => Promise<AppSettings>
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void
  getBibleFonts: () => Promise<BibleFont[]>
  onBibleFontsUpdated: (callback: (fonts: BibleFont[]) => void) => () => void
  getMedia: () => Promise<MediaItem[]>
  onMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  getLiveMedia: () => Promise<MediaItem[]>
  onLiveMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  getBibleMedia: () => Promise<MediaItem[]>
  onBibleMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  emitPlaybackState: (state: MediaPlaybackState) => void
}

declare global {
  interface Window {
    electronAPI?: ControlElectronAPI
    projectionAPI?: ProjectionElectronAPI
  }
}

export {}
