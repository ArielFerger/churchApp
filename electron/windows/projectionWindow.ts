import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'

export function createProjectionWindow(): BrowserWindow {
  const displays = screen.getAllDisplays()
  const targetDisplay = displays.find((d) => !d.bounds.x === false) ?? displays[0]

  log.info('Creating projection window on display:', targetDisplay.id, targetDisplay.bounds)

  const win = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    frame: false,
    fullscreen: !is.dev,
    kiosk: false,
    resizable: false,
    movable: false,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/projection.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/projection.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/projection.html'))
  }

  return win
}
