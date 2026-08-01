import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Church Projector — Control',
    backgroundColor: '#0f172a',
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
