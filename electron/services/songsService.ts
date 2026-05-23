import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import chokidar, { type FSWatcher } from 'chokidar'
import log from 'electron-log'
import type { Song } from '../../src/shared/types/song'

/**
 * Songs live as one JSON file per song under `<userData>/songs/<id>.json`.
 * No DB — keeps the format diffable, syncable, and trivially backed up.
 */
export class SongsService {
  private dir: string
  private cache = new Map<string, Song>()
  private watcher: FSWatcher | null = null
  private listeners = new Set<(songs: Song[]) => void>()
  private ready = false

  constructor(baseDir?: string) {
    this.dir = baseDir ?? join(app.getPath('userData'), 'songs')
  }

  async init(): Promise<void> {
    if (this.ready) return
    await fs.mkdir(this.dir, { recursive: true })
    await this.scan()
    this.startWatching()
    this.ready = true
    log.info('songsService: ready', this.dir)
  }

  list(): Song[] {
    return [...this.cache.values()].sort((a, b) =>
      a.title.localeCompare(b.title, 'es', { numeric: true, sensitivity: 'base' })
    )
  }

  get(id: string): Song | undefined {
    return this.cache.get(id)
  }

  onChange(fn: (songs: Song[]) => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /**
   * Persist a song. If `id` is missing or empty, generates a new id from the
   * title; otherwise updates the existing file. Always bumps `updatedAt`.
   */
  async save(input: Partial<Song> & { title: string }): Promise<Song> {
    if (!this.ready) await this.init()
    const now = new Date().toISOString()
    const isNew = !input.id || !this.cache.has(input.id)

    const song: Song = {
      id: input.id || makeId(input.title),
      title: input.title.trim(),
      author: input.author,
      tags: input.tags ?? [],
      language: input.language ?? 'es',
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      sections: input.sections ?? [],
      order: input.order ?? []
    }

    const file = this.fileFor(song.id)
    await fs.writeFile(file, JSON.stringify(song, null, 2), 'utf-8')
    this.cache.set(song.id, song)
    this.emit()
    log.info(`songsService: ${isNew ? 'created' : 'updated'} ${song.id}`)
    return song
  }

  async delete(id: string): Promise<void> {
    const file = this.fileFor(id)
    try {
      await fs.unlink(file)
    } catch (err) {
      log.warn('songsService.delete: file missing', id, (err as Error).message)
    }
    this.cache.delete(id)
    this.emit()
  }

  private fileFor(id: string): string {
    return join(this.dir, `${id}.json`)
  }

  private async scan(): Promise<void> {
    const entries = await fs.readdir(this.dir).catch(() => [] as string[])
    const jsons = entries.filter((f) => f.endsWith('.json'))
    this.cache.clear()
    for (const f of jsons) {
      const song = await this.readFile(join(this.dir, f))
      if (song) this.cache.set(song.id, song)
    }
  }

  private async readFile(path: string): Promise<Song | null> {
    try {
      const raw = await fs.readFile(path, 'utf-8')
      const parsed = JSON.parse(raw) as Song
      if (!parsed.id || !parsed.title) {
        log.warn('songsService: skipping malformed file', path)
        return null
      }
      return parsed
    } catch (err) {
      log.warn('songsService: failed to read', path, (err as Error).message)
      return null
    }
  }

  private startWatching(): void {
    if (this.watcher) return
    this.watcher = chokidar.watch(this.dir, {
      ignored: (p) => !p.endsWith('.json') && p !== this.dir,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    })
    const reload = async (path: string): Promise<void> => {
      const song = await this.readFile(path)
      if (song) {
        this.cache.set(song.id, song)
        this.emit()
      }
    }
    this.watcher
      .on('add', (p) => void reload(p))
      .on('change', (p) => void reload(p))
      .on('unlink', (p) => {
        const id = idFromFile(p)
        if (id && this.cache.delete(id)) this.emit()
      })
      .on('error', (err) => log.error('songsService watcher error', err))
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
    this.cache.clear()
    this.listeners.clear()
    this.ready = false
  }
}

function makeId(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = createHash('sha1')
    .update(title + Date.now())
    .digest('hex')
    .slice(0, 6)
  return slug ? `${slug}-${suffix}` : suffix
}

function idFromFile(path: string): string | null {
  const m = /([^\\/]+)\.json$/.exec(path)
  return m ? m[1] : null
}

export const songsService = new SongsService()
