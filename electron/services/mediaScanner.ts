import { createHash } from 'crypto'
import { extname, basename, dirname, relative, resolve, sep } from 'path'
import type { Stats } from 'fs'
import chokidar, { type FSWatcher } from 'chokidar'
import log from 'electron-log'
import type { MediaItem, MediaType } from '../../src/shared/types/media'

const byName = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })
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

function toItem(filePath: string, root: string, stats: Stats): MediaItem | null {
  const type = classify(filePath)
  if (!type) return null
  return {
    id: mediaIdFor(filePath),
    filePath: resolve(filePath),
    fileName: basename(filePath),
    type,
    folder: folderFor(filePath, root),
    addedAt: stats.mtime.toISOString(),
    byteSize: stats.size
  }
}

/**
 * Watches a folder (recursively) and maintains an in-memory index of media files.
 * Changes are batched so a directory scan does not flood the renderers.
 */
export class MediaScanner {
  private watcher: FSWatcher | null = null
  private items = new Map<string, MediaItem>()
  private listeners = new Set<(items: MediaItem[]) => void>()
  private currentFolder: string | null = null

  private snapshot: MediaItem[] | null = null
  private timer: ReturnType<typeof setTimeout> | undefined

  list(): MediaItem[] {
    return (this.snapshot ??= [...this.items.values()].sort((a, b) =>
      byName.compare(a.fileName, b.fileName)
    ))
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

    const previous = this.watcher
    this.watcher = null
    clearTimeout(this.timer)
    this.timer = undefined
    this.items.clear()
    this.snapshot = null
    this.emit()
    // Los callbacks del watcher anterior se descartan desde este momento.
    if (previous) await previous.close()
    if (!folder || this.currentFolder !== folder || this.watcher) return

    log.info('mediaScanner: watching', folder)
    const watcher = chokidar.watch(folder, {
      ignored: (path, stats) => stats?.isFile() === true && classify(path) === null,
      alwaysStat: true,
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    })
    this.watcher = watcher
    const update = (file: string, stats?: Stats) => {
      if (this.watcher !== watcher || !stats) return
      const item = toItem(file, folder, stats)
      if (!item) return
      this.items.set(item.id, item)
      this.scheduleUpdate()
    }
    watcher
      .on('add', update)
      .on('change', update)
      .on('unlink', (file) => {
        if (this.watcher === watcher && this.items.delete(mediaIdFor(file))) this.scheduleUpdate()
      })
      .on('error', (err) => log.error('mediaScanner error', err))
  }

  private scheduleUpdate(): void {
    this.snapshot = null
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.emit()
    }, 250)
  }

  private emit(): void {
    const snapshot = this.list()
    this.listeners.forEach((l) => l(snapshot))
  }

  async dispose(): Promise<void> {
    const watcher = this.watcher
    this.watcher = null
    this.currentFolder = null
    clearTimeout(this.timer)
    this.timer = undefined
    this.snapshot = null
    this.items.clear()
    this.listeners.clear()
    await watcher?.close()
  }
}

// Module-level singletons — one per watched root.
// `mediaScanner` indexes la carpeta general de media; `liveMediaScanner` la
// carpeta exclusiva de videos de loop para "En Vivo"; `bibleMediaScanner` la
// carpeta exclusiva de fondos de versículos (si están configuradas).
export const mediaScanner = new MediaScanner()
export const liveMediaScanner = new MediaScanner()
export const bibleMediaScanner = new MediaScanner()
