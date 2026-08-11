import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import * as escucha from '../services/escuchaService'
import type { WhisperModelId } from '../../src/shared/utils/whisper'
import type { EscuchaStatus } from '../../src/shared/types/escucha'

/**
 * Canales del módulo Escucha.
 *
 * El audio va en un solo sentido —renderer → main— y como bytes crudos: el
 * micrófono sólo existe en el renderer, y whisper sólo existe en el main.
 * Nada de esto sale de la máquina.
 */
export function registerEscuchaHandlers(controlWindow: BrowserWindow): () => void {
  ipcMain.handle(
    IPC_CHANNELS.GET_ESCUCHA_STATUS,
    (): EscuchaStatus => escucha.estadoParaLaPantalla()
  )

  ipcMain.handle(IPC_CHANNELS.INSTALL_ESCUCHA, async (_e, modelo?: WhisperModelId) => {
    await escucha.installWhisper((step, ratio) => {
      if (!controlWindow.isDestroyed()) {
        controlWindow.webContents.send(IPC_CHANNELS.ESCUCHA_PROGRESS, { step, ratio })
      }
    }, modelo)
    return escucha.estadoParaLaPantalla()
  })

  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIBE_WINDOW,
    // El PCM llega como Uint8Array por structured clone, sin pasar por JSON:
    // una ventana de 6 s son 192 KB y serializarla como texto sería absurdo.
    (_e, pcm: Uint8Array, tasa: number) => escucha.transcribirVentana(pcm, tasa)
  )

  return () => {
    for (const c of [
      IPC_CHANNELS.GET_ESCUCHA_STATUS,
      IPC_CHANNELS.INSTALL_ESCUCHA,
      IPC_CHANNELS.TRANSCRIBE_WINDOW
    ]) {
      ipcMain.removeHandler(c)
    }
  }
}
