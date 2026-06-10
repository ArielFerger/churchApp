import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { audioScanner } from '../services/audioScanner'
import {
  getAudioState,
  setAudioState,
  type AudioPersistedState
} from '../services/audioStateService'
import {
  getPlaylists,
  savePlaylist,
  deletePlaylist,
  type SavePlaylistInput
} from '../services/audioPlaylistsService'
import type { AudioTrack, AudioPlaylist } from '../../src/shared/types/audio'

export function registerAudioHandlers(controlWindow: BrowserWindow): () => void {
  ipcMain.handle(IPC_CHANNELS.GET_AUDIO, (): AudioTrack[] => audioScanner.list())

  ipcMain.handle(
    IPC_CHANNELS.GET_AUDIO_STATE,
    async (): Promise<AudioPersistedState> => getAudioState()
  )

  ipcMain.handle(
    IPC_CHANNELS.SET_AUDIO_STATE,
    async (_e, partial: Partial<AudioPersistedState>): Promise<AudioPersistedState> =>
      setAudioState(partial)
  )

  ipcMain.handle(
    IPC_CHANNELS.GET_AUDIO_PLAYLISTS,
    async (): Promise<AudioPlaylist[]> => getPlaylists()
  )

  ipcMain.handle(
    IPC_CHANNELS.SAVE_AUDIO_PLAYLIST,
    async (_e, input: SavePlaylistInput): Promise<AudioPlaylist[]> => savePlaylist(input)
  )

  ipcMain.handle(
    IPC_CHANNELS.DELETE_AUDIO_PLAYLIST,
    async (_e, id: string): Promise<AudioPlaylist[]> => deletePlaylist(id)
  )

  const unsub = audioScanner.onChange((items) => {
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.AUDIO_UPDATED, items)
    }
  })

  return unsub
}
