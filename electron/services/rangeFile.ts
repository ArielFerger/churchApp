import { createReadStream, promises as fsp } from 'fs'
import { Readable } from 'stream'
import { extname } from 'path'

const MIME: Record<string, string> = {
  // video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg',
  // images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  // audio
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus'
}

function mimeFor(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function toWeb(nodeStream: Readable): ReadableStream {
  // Node's Readable → web ReadableStream so the Response body streams lazily.
  return Readable.toWeb(nodeStream) as unknown as ReadableStream
}

/**
 * Serve a local file as an HTTP response with proper byte-range support.
 *
 * This is what makes `<video>`/`<audio>` seeking work: when the element asks
 * for `Range: bytes=START-`, we return a `206 Partial Content` streaming just
 * that slice with `Content-Range`/`Accept-Ranges`. Relying on `net.fetch` for
 * file:// range support proved unreliable (forward seeks to un-buffered
 * positions failed — "works sometimes"), so we handle the range ourselves.
 */
export async function serveFileWithRange(filePath: string, request: Request): Promise<Response> {
  const stat = await fsp.stat(filePath)
  const size = stat.size
  const ctype = mimeFor(filePath)
  const rangeHeader = request.headers.get('range')

  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0
      let end = m[2] ? parseInt(m[2], 10) : size - 1
      if (Number.isNaN(start)) start = 0
      if (Number.isNaN(end) || end >= size) end = size - 1

      if (start > end || start >= size) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' }
        })
      }

      const chunkSize = end - start + 1
      const stream = toWeb(createReadStream(filePath, { start, end }))
      return new Response(stream, {
        status: 206,
        headers: {
          'Content-Type': ctype,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }
  }

  // No range requested → full file, but advertise range support so the media
  // element knows it can scrub later.
  const stream = toWeb(createReadStream(filePath))
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': ctype,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes'
    }
  })
}
