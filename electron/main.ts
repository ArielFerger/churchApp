import { app, BrowserWindow } from 'electron'
import { createControlWindow } from './windows/controlWindow'
import { createProjectionWindow, moveProjectionToDisplay } from './windows/projectionWindow'
import { registerProjectionHandlers } from './ipc/projection'
import { registerSettingsHandlers } from './ipc/settings'
import { registerDisplayHandlers } from './ipc/displays'
import { registerMediaHandlers } from './ipc/files'
import { registerSongsHandlers } from './ipc/songs'
import { registerBibleHandlers } from './ipc/bible'
import { registerAudioHandlers } from './ipc/audio'
import { getSettings } from './services/settingsService'
import { mediaScanner, liveMediaScanner, bibleMediaScanner } from './services/mediaScanner'
import { songsService } from './services/songsService'
import { bibleService } from './services/bibleService'
import { audioScanner } from './services/audioScanner'
import {
  registerMediaSchemeAsPrivileged,
  registerMediaProtocolHandler
} from './services/mediaProtocol'
import {
  registerAudioSchemeAsPrivileged,
  registerAudioProtocolHandler
} from './services/audioProtocol'
import {
  registerFontSchemeAsPrivileged,
  registerFontProtocolHandler
} from './services/fontProtocol'
import { registerFontsHandlers } from './ipc/fonts'
import { registerDownloadsHandlers } from './ipc/downloads'
import { dispose as disposeDownloads, YT_PARTITION } from './services/downloadsService'
import { instalarPermisos } from './services/permisos'
import { registerEscuchaHandlers } from './ipc/escucha'
import {
  dispose as disposeEscucha,
  limpiarTemporales as limpiarTemporalesEscucha
} from './services/escuchaService'
import { IPC_CHANNELS } from '../src/shared/constants'
import log from 'electron-log'

log.initialize()

/**
 * Una sola instancia. Abrir la app dos veces (doble clic de más en el acceso
 * directo, algo que pasa) creaba DOS ventanas de proyección peleándose por el
 * mismo monitor, y dos procesos queriendo la misma entrada de audio. La
 * segunda instancia se cierra y trae al frente la ventana de la primera.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

/**
 * Linux: preferir X11 (vía XWayland) cuando está disponible. En Wayland puro
 * una app no puede elegir en qué posición de qué monitor abre una ventana, y
 * la de proyección TIENE que caer en el proyector. Electron 36 ya arranca en
 * X11 por defecto, pero las versiones siguientes pasan a Wayland: esto deja
 * fijada la decisión. Si alguien la quiere cambiar, alcanza con definir
 * ELECTRON_OZONE_PLATFORM_HINT o pasar --ozone-platform.
 */
if (
  process.platform === 'linux' &&
  process.env.DISPLAY &&
  !process.env.ELECTRON_OZONE_PLATFORM_HINT &&
  !app.commandLine.hasSwitch('ozone-platform')
) {
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}

// MUST run before app is ready.
registerMediaSchemeAsPrivileged()
registerAudioSchemeAsPrivileged()
registerFontSchemeAsPrivileged()

let controlWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

app.on('second-instance', () => {
  if (controlWindow && !controlWindow.isDestroyed()) {
    if (controlWindow.isMinimized()) controlWindow.restore()
    controlWindow.show()
    controlWindow.focus()
  }
})

app.whenReady().then(async () => {
  instalarPermisos(YT_PARTITION)
  registerMediaProtocolHandler()
  registerAudioProtocolHandler()
  registerFontProtocolHandler()

  const settings = getSettings()

  controlWindow = createControlWindow()
  projectionWindow = createProjectionWindow(settings.projectionDisplayId)

  registerProjectionHandlers(controlWindow, projectionWindow)
  registerDisplayHandlers()
  registerMediaHandlers(controlWindow, projectionWindow)
  registerSongsHandlers(controlWindow)
  void songsService.init()
  registerBibleHandlers()
  void bibleService.init()
  registerAudioHandlers(controlWindow)
  registerFontsHandlers(controlWindow, projectionWindow)
  registerDownloadsHandlers(controlWindow)
  registerEscuchaHandlers(controlWindow)
  // Si la app se cerró de golpe con la Escucha andando, pueden haber quedado
  // ventanas de audio en la carpeta temporal. No se guarda audio: se borran.
  void limpiarTemporalesEscucha()

  registerSettingsHandlers((next, prev) => {
    // La proyección refleja en vivo los cambios de apariencia de versículos.
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.webContents.send(IPC_CHANNELS.SETTINGS_UPDATED, next)
    }
    if (
      next.projectionDisplayId !== prev.projectionDisplayId &&
      next.projectionDisplayId !== null
    ) {
      if (projectionWindow && !projectionWindow.isDestroyed()) {
        moveProjectionToDisplay(projectionWindow, next.projectionDisplayId)
      }
    }
    if (next.mediaFolder !== prev.mediaFolder) {
      void mediaScanner.setFolder(next.mediaFolder).catch((err) => {
        log.error('mediaScanner.setFolder failed', err)
      })
    }
    if (next.liveLoopFolder !== prev.liveLoopFolder) {
      void liveMediaScanner.setFolder(next.liveLoopFolder).catch((err) => {
        log.error('liveMediaScanner.setFolder failed', err)
      })
    }
    if (next.bibleBackgroundsFolder !== prev.bibleBackgroundsFolder) {
      void bibleMediaScanner.setFolder(next.bibleBackgroundsFolder).catch((err) => {
        log.error('bibleMediaScanner.setFolder failed', err)
      })
    }
    if (next.audioFolder !== prev.audioFolder) {
      void audioScanner.setFolder(next.audioFolder).catch((err) => {
        log.error('audioScanner.setFolder failed', err)
      })
    }
  })

  // Initial scan from persisted folders (if any)
  if (settings.mediaFolder) {
    void mediaScanner.setFolder(settings.mediaFolder).catch((err) => {
      log.error('mediaScanner initial scan failed', err)
    })
  }
  if (settings.liveLoopFolder) {
    void liveMediaScanner.setFolder(settings.liveLoopFolder).catch((err) => {
      log.error('liveMediaScanner initial scan failed', err)
    })
  }
  if (settings.bibleBackgroundsFolder) {
    void bibleMediaScanner.setFolder(settings.bibleBackgroundsFolder).catch((err) => {
      log.error('bibleMediaScanner initial scan failed', err)
    })
  }
  if (settings.audioFolder) {
    void audioScanner.setFolder(settings.audioFolder).catch((err) => {
      log.error('audioScanner initial scan failed', err)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      controlWindow = createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void mediaScanner.dispose()
  void liveMediaScanner.dispose()
  void bibleMediaScanner.dispose()
  void audioScanner.dispose()
  void songsService.dispose()
  // yt-dlp lanza ffmpeg como hijo y ambos sobreviven al cierre: sin esto quedan
  // procesos invisibles comiendo ancho de banda y reteniendo el archivo .part.
  disposeDownloads()
  disposeEscucha()
  void limpiarTemporalesEscucha()
})

export { controlWindow, projectionWindow }
