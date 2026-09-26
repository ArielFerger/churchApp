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
  const avisar = (): void => {
    if (!controlWindow.isDestroyed()) {
      controlWindow.webContents.send(IPC_CHANNELS.ESCUCHA_STATUS_UPDATED, escucha.estadoParaLaPantalla())
    }
  }
  // Cargar un modelo tarda: la pantalla se entera sola cuando está listo o si
  // el servidor se cayó, sin tener que preguntar cada medio segundo.
  escucha.alCambiarServidor(avisar)

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

  ipcMain.handle(IPC_CHANNELS.DELETE_ESCUCHA_MODEL, async (_e, modelo: WhisperModelId) => {
    await escucha.borrarModelo(modelo)
    return escucha.estadoParaLaPantalla()
  })

  ipcMain.handle(IPC_CHANNELS.WARMUP_ESCUCHA, () => escucha.precalentar())
  ipcMain.handle(IPC_CHANNELS.IDLE_ESCUCHA, () => escucha.reposar())

  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIBE_WINDOW,
    // El PCM llega como Uint8Array por structured clone, sin pasar por JSON:
    // un fragmento de 10 s son 320 KB y serializarlo como texto sería absurdo.
    (_e, pcm: Uint8Array, tasa: number, prompt?: string | null) =>
      escucha.transcribirVentana(pcm, tasa, prompt === undefined ? {} : { prompt })
  )

  return () => {
    for (const c of [
      IPC_CHANNELS.GET_ESCUCHA_STATUS,
      IPC_CHANNELS.INSTALL_ESCUCHA,
      IPC_CHANNELS.DELETE_ESCUCHA_MODEL,
      IPC_CHANNELS.WARMUP_ESCUCHA,
      IPC_CHANNELS.IDLE_ESCUCHA,
      IPC_CHANNELS.TRANSCRIBE_WINDOW
    ]) {
      ipcMain.removeHandler(c)
    }
  }
}
