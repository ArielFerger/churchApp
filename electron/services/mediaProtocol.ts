import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import log from 'electron-log'
import { mediaScanner } from './mediaScanner'

export const MEDIA_SCHEME = 'media'

/**
 * Must be called BEFORE `app.whenReady()` so Electron treats the scheme as
 * privileged (supports streaming, CORS, etc — needed for `<video>` seeking).
 */
export function registerMediaSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false,
        corsEnabled: true
      }
    }
  ])
}

/**
 * Handler resolves `media://<id>` to the actual file on disk, gated through
 * the mediaScanner registry — i.e. only files currently in the watched folder
 * are accessible. Arbitrary paths cannot be smuggled in.
 */
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const id = url.hostname || url.pathname.replace(/^\/+/, '')
      const item = mediaScanner.getById(id)
      if (!item) {
        log.warn('media://: unknown id', id)
        return new Response('Not found', { status: 404 })
      }
      const fileUrl = pathToFileURL(item.filePath).toString()
      return net.fetch(fileUrl, { bypassCustomProtocolHandlers: true })
    } catch (err) {
      log.error('media protocol error', err)
      return new Response('Internal error', { status: 500 })
    }
  })
}
