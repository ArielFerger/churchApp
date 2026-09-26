import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // Con la navegación en un riel vertical, la interfaz entra en notebooks
    // chicas o con la ventana al lado de otra: antes el mínimo era 1024 y aun
    // así la cabecera no entraba.
    minWidth: 880,
    minHeight: 580,
    title: 'Church Projector — Control',
    // El negro de cabina: sin esto, la ventana parpadea en azul mientras carga.
    backgroundColor: '#0e0d0c',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/control.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // El reproductor de música vive en este renderer: si la ventana queda
      // tapada por la de proyección (monitor único), el estrangulamiento de
      // timers en segundo plano entrecorta el audio y los contadores.
      backgroundThrottling: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/control.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/control.html'))
  }

  return win
}
