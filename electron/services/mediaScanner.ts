import { createHash } from 'crypto'
import { extname, basename, dirname, relative, resolve, sep } from 'path'
import { statSync } from 'fs'
import chokidar, { type FSWatcher } from 'chokidar'
import log from 'electron-log'
import type { MediaItem, MediaType } from '../../src/shared/types/media'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.avif'])
const GIF_EXT = new Set(['.gif'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v'])

export function classify(file: string): MediaType | null {
  const ext = extname(file).toLowerCase()
  if (IMAGE_EXT.has(ext)) return 'image'
  if (GIF_EXT.has(ext)) return 'gif'
  if (VIDEO_EXT.has(ext)) return 'video'
  return null
}

/** Stable id derived from the absolute path. Survives renames-by-move. */
export function mediaIdFor(filePath: string): string {
  return createHash('sha1').update(resolve(filePath)).digest('hex').slice(0, 16)
}

/** Subcarpeta relativa a la raíz escaneada, normalizada con "/" ('' = raíz). */
function folderFor(filePath: string, root: string): string {
  const rel = relative(root, dirname(resolve(filePath)))
  if (!rel || rel.startsWith('..')) return ''
  return rel.split(sep).join('/')
}

function toItem(filePath: string, root: string): MediaItem | null {
  const type = classify(filePath)
  if (!type) return null
  let addedAt = new Date().toISOString()
  try {
    addedAt = statSync(filePath).mtime.toISOString()
  } catch {
    // file may have disappeared during scan — keep "now"
  }
  return {
    id: mediaIdFor(filePath),
    filePath: resolve(filePath),
    fileName: basename(filePath),
    type,
    folder: folderFor(filePath, root),
    addedAt
  }
}

/**
 * Watches a folder (recursively) and maintains an in-memory index of media files.
 * Listeners are notified on every change so renderer galleries can re-render.
 */
export class MediaScanner {
  private watcher: FSWatcher | null = null
  private items = new Map<string, MediaItem>()
  private listeners = new Set<(items: MediaItem[]) => void>()
  private currentFolder: string | null = null

  list(): MediaItem[] {
    return [...this.items.values()].sort((a, b) =>
      a.fileName.localeCompare(b.fileName, 'es', { numeric: true, sensitivity: 'base' })
    )
  }

  getById(id: string): MediaItem | undefined {
    return this.items.get(id)
  }

  onChange(fn: (items: MediaItem[]) => void): () => void {
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
    this.items.clear()
    this.emit()

    if (!folder) return

    log.info('mediaScanner: watching', folder)
    this.watcher = chokidar.watch(folder, {
      ignored: (path, stats) => stats?.isFile() === true && classify(path) === null,
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    })

    this.watcher
      .on('add', (file) => this.add(file))
      .on('unlink', (file) => this.remove(file))
      .on('change', (file) => this.add(file)) // re-stat on change
      .on('error', (err) => log.error('mediaScanner error', err))
  }

  private add(file: string): void {
    if (!this.currentFolder) return
    const item = toItem(file, resolve(this.currentFolder))
    if (!item) return
    this.items.set(item.id, item)
    this.emit()
  }

  private remove(file: string): void {
    const id = mediaIdFor(file)
    if (this.items.delete(id)) this.emit()
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
    this.items.clear()
    this.listeners.clear()
  }
}

// Module-level singletons — one per watched root.
// `mediaScanner` indexes la carpeta general de media; `liveMediaScanner` la
// carpeta exclusiva de videos de loop para "En Vivo"; `bibleMediaScanner` la
// carpeta exclusiva de fondos de versículos (si están configuradas).
export const mediaScanner = new MediaScanner()
export const liveMediaScanner = new MediaScanner()
export const bibleMediaScanner = new MediaScanner()
