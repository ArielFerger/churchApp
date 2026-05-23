import type { ProjectionCommand, AppSettings, DisplayInfo } from './ipc'
import type { MediaItem } from './media'
import type { Song } from './song'
import type { BibleBook } from './bible'

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
  onProjectionState: (callback: (cmd: ProjectionCommand) => void) => () => void
  getSongs: () => Promise<Song[]>
  saveSong: (song: Partial<Song> & { title: string }) => Promise<Song>
  deleteSong: (id: string) => Promise<void>
  onSongsUpdated: (callback: (songs: Song[]) => void) => () => void
  getBibleVersions: () => Promise<BibleVersionSummary[]>
  getBibleBooks: (version: string) => Promise<BibleBook[]>
  lookupVerse: (req: BibleLookupRequest) => Promise<BibleLookupResult | null>
  onShortcut: (callback: (key: string) => void) => () => void
}

export interface ProjectionElectronAPI {
  onCommand: (callback: (cmd: ProjectionCommand) => void) => () => void
  getMedia: () => Promise<MediaItem[]>
  onMediaUpdated: (callback: (items: MediaItem[]) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ControlElectronAPI
    projectionAPI?: ProjectionElectronAPI
  }
}

export {}
