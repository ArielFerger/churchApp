import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import log from 'electron-log'
import { getFontById } from './fontsService'

export const FONT_SCHEME = 'appfont'

/**
 * Must run before `app.whenReady()` so the scheme can be fetched by the
 * FontFace API / CSS in both renderer windows.
 */
export function registerFontSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FONT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: false,
        corsEnabled: true
      }
    }
  ])
}

/**
 * Resuelve appfont://<id> al archivo de fuente, gateado por el registro del
 * fontsService — no se pueden colar rutas arbitrarias.
 */
export function registerFontProtocolHandler(): void {
  protocol.handle(FONT_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const id = url.hostname || url.pathname.replace(/^\/+/, '')
      const font = await getFontById(id)
      if (!font) {
        log.warn('appfont://: unknown id', id)
        return new Response('Not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(font.filePath).toString(), {
        bypassCustomProtocolHandlers: true
      })
    } catch (err) {
      log.error('appfont protocol error', err)
      return new Response('Internal error', { status: 500 })
    }
  })
}
