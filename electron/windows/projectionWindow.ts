import { BrowserWindow, screen, type Display } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'

/**
 * Picks the display where the projection window should live.
 * Order of preference:
 *   1. Saved display id from settings (if still present)
 *   2. First non-primary display
 *   3. Primary display (fallback for single-monitor dev)
 */
export function pickTargetDisplay(savedDisplayId: number | null): Display {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()

  if (savedDisplayId !== null) {
    const saved = displays.find((d) => d.id === savedDisplayId)
    if (saved) return saved
  }

  const secondary = displays.find((d) => d.id !== primary.id)
  return secondary ?? primary
}

export function createProjectionWindow(savedDisplayId: number | null): BrowserWindow {
  const target = pickTargetDisplay(savedDisplayId)
  log.info('Creating projection window on display:', target.id, target.bounds)

  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    fullscreen: !is.dev,
    kiosk: false,
    resizable: false,
    movable: false,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/projection.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Allow videos to autoplay WITH sound when projected (no click needed).
      autoplayPolicy: 'no-user-gesture-required',
      // La proyección es la salida: si Chromium la considera tapada (monitor
      // único, otra app encima) estrangula sus timers y llega a pausar el
      // video en pantalla. Acá nunca se estrangula.
      backgroundThrottling: false
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

/**
 * Re-positions the projection window on a different display WITHOUT closing it.
 * Architecture principle #1: the projection window is never closed nor recreated.
 */
export function moveProjectionToDisplay(win: BrowserWindow, displayId: number): void {
  const displays = screen.getAllDisplays()
  const target = displays.find((d) => d.id === displayId)
  if (!target) {
    log.warn('moveProjectionToDisplay: display not found', displayId)
    return
  }
  log.info('Moving projection to display:', displayId, target.bounds)
  win.setFullScreen(false)
  win.setBounds(target.bounds)
  if (!is.dev) win.setFullScreen(true)
}

export function toggleProjectionVisibility(win: BrowserWindow): void {
  if (win.isVisible()) {
    win.hide()
  } else {
    win.show()
  }
}
