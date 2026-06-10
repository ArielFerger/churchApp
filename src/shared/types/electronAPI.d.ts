import type { ProjectionCommand, AppSettings, DisplayInfo, MediaPlaybackState } from './ipc'
import type { MediaItem } from './media'
import type { Song, Album } from './song'
import type { BibleBook } from './bible'
import type { AudioTrack, AudioPlaylist } from './audio'

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
}

export interface ProjectionElectronAPI {
  onCommand: (callback: (cmd: ProjectionCommand) => void) => () => void
  getMedia: () => Promise<MediaItem[]>
  onMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  getLiveMedia: () => Promise<MediaItem[]>
  onLiveMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
  emitPlaybackState: (state: MediaPlaybackState) => void
}

declare global {
  interface Window {
    electronAPI?: ControlElectronAPI
    projectionAPI?: ProjectionElectronAPI
  }
}

export {}
