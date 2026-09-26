import { app, ipcMain, dialog, shell } from 'electron'
import { existsSync } from 'fs'
import { release, type as tipoSistema } from 'os'
import { dirname } from 'path'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../src/shared/constants'
import { getSettings, updateSettings } from '../services/settingsService'
import { mediaScanner, liveMediaScanner, bibleMediaScanner } from '../services/mediaScanner'
import { audioScanner } from '../services/audioScanner'
import type { AppSettings } from '../../src/shared/types/ipc'
import type { AppInfo, CarpetaAbrible } from '../../src/shared/types/electronAPI'

/** Las carpetas de Ajustes que se pueden abrir por nombre. */
const CARPETAS_DE_AJUSTES = new Set<keyof AppSettings>([
  'mediaFolder',
  'audioFolder',
  'songsFolder',
  'liveLoopFolder',
  'bibleBackgroundsFolder',
  'toolsFolder'
])

function archivoDeRegistro(): string | null {
  try {
    return log.transports.file.getFile().path
  } catch {
    return null
  }
}

export function registerSettingsHandlers(
  onSettingsChange?: (next: AppSettings, prev: AppSettings) => void
): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => getSettings())

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, partial: Partial<AppSettings>) => {
    const prev = getSettings()
    const next = updateSettings(partial)
    onSettingsChange?.(next, prev)
    return next
  })

  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, (_event, options: Electron.OpenDialogOptions) =>
    dialog.showOpenDialog(options)
  )

  // Lo que hace falta para pedir ayuda: qué versión, en qué sistema, y dónde
  // están los datos y el registro de errores.
  ipcMain.handle(
    IPC_CHANNELS.GET_APP_INFO,
    (): AppInfo => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      plataforma: `${process.platform}-${process.arch}`,
      sistema: `${tipoSistema()} ${release()}`,
      datos: app.getPath('userData'),
      registro: archivoDeRegistro()
    })
  )

  /**
   * Muestra un archivo de la biblioteca en el explorador, con el archivo
   * seleccionado. Se pide por id y la ruta la resuelven los escáneres: la
   * ventana nunca maneja rutas del disco.
   */
  ipcMain.handle(
    IPC_CHANNELS.SHOW_ITEM_IN_FOLDER,
    (_event, tipo: 'media' | 'audio', id: string): boolean => {
      const item =
        tipo === 'audio'
          ? audioScanner.getById(id)
          : (mediaScanner.getById(id) ?? liveMediaScanner.getById(id) ?? bibleMediaScanner.getById(id))
      if (!item || !existsSync(item.filePath)) return false
      shell.showItemInFolder(item.filePath)
      return true
    }
  )

  /**
   * Abre una carpeta en el explorador del sistema. El renderer pide por
   * NOMBRE (datos, registro, o una de las carpetas de Ajustes), nunca por
   * ruta: así la ventana no puede usar esto para abrir cualquier cosa.
   */
  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_event, cual: CarpetaAbrible): Promise<boolean> => {
    let ruta: string | null = null
    if (cual === 'datos') ruta = app.getPath('userData')
    else if (cual === 'registro') {
      const archivo = archivoDeRegistro()
      if (archivo && existsSync(archivo)) {
        shell.showItemInFolder(archivo)
        return true
      }
      ruta = archivo ? dirname(archivo) : null
    } else if (CARPETAS_DE_AJUSTES.has(cual)) {
      ruta = (getSettings()[cual] as string | null) ?? null
    }
    if (!ruta || !existsSync(ruta)) return false
    const error = await shell.openPath(ruta)
    return error === ''
  })
}
