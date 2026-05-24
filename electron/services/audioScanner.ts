import { app } from 'electron'
import { createHash } from 'crypto'
import { promises as fs, statSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import { parseFile } from 'music-metadata'
import log from 'electron-log'
import type { AudioTrack } from '../../src/shared/types/audio'

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wav', '.wma'])

export function isAudio(file: string): boolean {
  return AUDIO_EXT.has(extname(file).toLowerCase())
}

export function audioIdFor(filePath: string): string {
  return createHash('sha1').update(resolve(filePath)).digest('hex').slice(0, 16)
}

interface CachedArtwork {
  ext: string
  size: number
}

/**
 * Library scanner for the audio module.
 *
 * Walks the configured folder with chokidar; for each new/changed file pulls
 * ID3/Vorbis/iTunes metadata via music-metadata and (if present) writes the
 * embedded cover art to `<userData>/audio-cache/<id>.<ext>` so the renderer
 * can fetch it through the audio:// protocol.
 *
 * Listeners get a flat AudioTrack[] snapshot on every change.
 */
export class AudioScanner {
  private watcher: FSWatcher | null = null
  private tracks = new Map<string, AudioTrack>()
  private artwork = new Map<string, CachedArtwork>()
  private listeners = new Set<(items: AudioTrack[]) => void>()
  private currentFolder: string | null = null
  private cacheDir: string

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? join(app.getPath('userData'), 'audio-cache')
  }

  list(): AudioTrack[] {
    return [...this.tracks.values()].sort((a, b) => {
      const aKey = `${a.artist ?? ''}|${a.album ?? ''}|${a.title}`
      const bKey = `${b.artist ?? ''}|${b.album ?? ''}|${b.title}`
      return aKey.localeCompare(bKey, 'es', { numeric: true, sensitivity: 'base' })
    })
  }

  getById(id: string): AudioTrack | undefined {
    return this.tracks.get(id)
  }

  getArtworkPath(id: string): string | null {
    const meta = this.artwork.get(id)
    if (!meta) return null
    return join(this.cacheDir, `${id}.${meta.ext}`)
  }

  onChange(fn: (items: AudioTrack[]) => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  async setFolder(folder: string | null): Promise<void> {
    if (this.currentFolder === folder) return
    this.currentFolder = folder

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.tracks.clear()
    this.artwork.clear()
    this.emit()

    if (!folder) return

    await fs.mkdir(this.cacheDir, { recursive: true })
    log.info('audioScanner: watching', folder)

    this.watcher = chokidar.watch(folder, {
      ignored: (path, stats) => stats?.isFile() === true && !isAudio(path),
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
    })

    this.watcher
      .on('add', (file) => {
        void this.indexFile(file)
      })
      .on('change', (file) => {
        void this.indexFile(file)
      })
      .on('unlink', (file) => {
        const id = audioIdFor(file)
        if (this.tracks.delete(id)) this.emit()
      })
      .on('error', (err) => log.error('audioScanner error', err))
  }

  private async indexFile(filePath: string): Promise<void> {
    try {
      const id = audioIdFor(filePath)
      const stat = statSync(filePath)
      // Read metadata (ID3v1, ID3v2, Vorbis, iTunes, etc — music-metadata
      // picks based on extension)
      const md = await parseFile(filePath, { duration: true, skipCovers: false })

      const title = md.common.title?.trim() || basename(filePath, extname(filePath))
      const artist = md.common.artist?.trim() || undefined
      const album = md.common.album?.trim() || undefined
      const duration = Math.max(0, Math.round(md.format.duration ?? 0))

      let artworkPath: string | undefined
      const pic = md.common.picture?.[0]
      if (pic && pic.data?.length) {
        const ext = artworkExt(pic.format)
        try {
          const out = join(this.cacheDir, `${id}.${ext}`)
          await fs.writeFile(out, pic.data)
          this.artwork.set(id, { ext, size: pic.data.length })
          artworkPath = out
        } catch (err) {
          log.warn('audioScanner: artwork write failed', id, (err as Error).message)
        }
      }

      const track: AudioTrack = {
        id,
        filePath: resolve(filePath),
        title,
        artist,
        album,
        duration,
        artworkPath,
        addedAt: stat.mtime.toISOString()
      }
      this.tracks.set(id, track)
      this.emit()
    } catch (err) {
      log.warn('audioScanner: failed to index', filePath, (err as Error).message)
    }
  }

  private emit(): void {
    const snapshot = this.list()
    this.listeners.forEach((l) => l(snapshot))
  }

  async dispose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.tracks.clear()
    this.artwork.clear()
    this.listeners.clear()
  }
}

function artworkExt(format: string | undefined): string {
  switch ((format || '').toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}

export const audioScanner = new AudioScanner()
