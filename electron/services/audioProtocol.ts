import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import log from 'electron-log'
import { audioScanner } from './audioScanner'
import { serveFileWithRange } from './rangeFile'

export const AUDIO_SCHEME = 'audio'

/**
 * Must run before `app.whenReady()` so Electron treats the scheme as
 * privileged — needed for streaming + range requests (Howler seeks).
 */
export function registerAudioSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: AUDIO_SCHEME,
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
 * Resolves URLs of the form:
 *   audio://<id>            → the audio file itself
 *   audio://<id>/artwork    → the cached cover art for that track
 *
 * Lookups go through audioScanner's registry, so arbitrary file paths cannot
 * be smuggled in.
 */
export function registerAudioProtocolHandler(): void {
  protocol.handle(AUDIO_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const id = url.hostname
      const subpath = url.pathname.replace(/^\/+/, '')

      if (subpath === 'artwork') {
        const artwork = audioScanner.getArtworkPath(id)
        if (!artwork) return new Response('No artwork', { status: 404 })
        return net.fetch(pathToFileURL(artwork).toString(), {
          bypassCustomProtocolHandlers: true
        })
      }

      const track = audioScanner.getById(id)
      if (!track) {
        log.warn('audio://: unknown id', id)
        return new Response('Not found', { status: 404 })
      }
      // Real byte-range support so Howler's html5 audio can fast-forward/seek.
      return serveFileWithRange(track.filePath, request)
    } catch (err) {
      log.error('audio protocol error', err)
      return new Response('Internal error', { status: 500 })
    }
  })
}
