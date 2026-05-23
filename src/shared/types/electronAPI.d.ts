import type { ProjectionCommand, AppSettings, DisplayInfo } from './ipc'
import type { MediaItem } from './media'
import type { Song } from './song'

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
