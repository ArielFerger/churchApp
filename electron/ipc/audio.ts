import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { audioScanner } from '../services/audioScanner'
import {
  getAudioState,
  setAudioState,
  type AudioPersistedState
} from '../services/audioStateService'
import type { AudioTrack } from '../../src/shared/types/audio'

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

  const unsub = audioScanner.onChange((items) => {
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.AUDIO_UPDATED, items)
    }
  })

  return unsub
}
