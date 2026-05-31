import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import log from 'electron-log'
import type { Bible, BibleBook, BibleMetadata } from '../../src/shared/types/bible'

export interface VersionSummary {
  version: string
  name: string
  language: string
  bookCount: number
}

export interface VerseLookupRequest {
  version: string
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

export interface VerseLookupResult {
  version: VersionSummary
  bookId: string
  bookName: string
  chapter: number
  verse: number
  endVerse?: number
  /** Concatenated text (joined with single space) of the requested range. */
  text: string
  /** Individual verses, in case the renderer wants to format them separately. */
  verses: { number: number; text: string }[]
}

/**
 * Loads all *.json files from data/bibles/ into memory. The folder lives in
 * the repo during dev, and is shipped via electron-builder's `extraResources`
 * in production (resolved under `process.resourcesPath/data/bibles`).
 */
export class BibleService {
  private bibles = new Map<string, Bible>()
  private ready = false

  async init(): Promise<void> {
    if (this.ready) return
    const dir = this.dataDir()
    log.info('bibleService: loading from', dir)

    let files: string[] = []
    try {
      files = await fs.readdir(dir)
    } catch (err) {
      log.warn('bibleService: bibles dir missing', dir, (err as Error).message)
      this.ready = true
      return
    }

    const jsons = files.filter((f) => f.toLowerCase().endsWith('.json'))
    for (const f of jsons) {
      try {
        const raw = await fs.readFile(join(dir, f), 'utf-8')
        const parsed = JSON.parse(raw) as Bible
        if (!validate(parsed)) {
          log.warn('bibleService: invalid Bible file, skipping', f)
          continue
        }
        this.bibles.set(parsed.metadata.version, parsed)
        log.info(`bibleService: loaded ${parsed.metadata.version} (${parsed.books.length} libros)`)
      } catch (err) {
        log.error(`bibleService: failed to load ${f}`, err)
      }
    }
    this.ready = true
  }

  async getVersions(): Promise<VersionSummary[]> {
    await this.init()
    return [...this.bibles.values()].map(toSummary).sort((a, b) => a.name.localeCompare(b.name))
  }

  async lookup(req: VerseLookupRequest): Promise<VerseLookupResult | null> {
    await this.init()
    const bible = this.bibles.get(req.version)
    if (!bible) return null

    const book = bible.books.find((b) => b.id === req.bookId)
    if (!book) return null

    const chapter = book.chapters.find((c) => c.number === req.chapter)
    if (!chapter) return null

    const endVerse = req.endVerse ?? req.verse
    const verses = chapter.verses.filter(
      (v) => v.number >= req.verse && v.number <= endVerse
    )
    if (verses.length === 0) return null

    return {
      version: toSummary(bible),
      bookId: book.id,
      bookName: book.name,
      chapter: req.chapter,
      verse: req.verse,
      endVerse: req.endVerse,
      text: verses.map((v) => v.text).join(' '),
      verses
    }
  }

  /** All books available in a version (used by UI to show only what loaded). */
  async getBooks(version: string): Promise<BibleBook[]> {
    await this.init()
    return this.bibles.get(version)?.books ?? []
  }

  private dataDir(): string {
    if (is.dev) {
      // dev: project root / data / bibles
      return resolve(app.getAppPath(), 'data', 'bibles')
    }
    return join(process.resourcesPath, 'data', 'bibles')
  }
}

function toSummary(b: Bible): VersionSummary {
  return {
    version: b.metadata.version,
    name: b.metadata.name,
    language: b.metadata.language,
    bookCount: b.books.length
  }
}

function validate(b: Bible): boolean {
  return Boolean(
    b &&
      isMeta(b.metadata) &&
      Array.isArray(b.books) &&
      b.books.every(
        (book) =>
          typeof book.id === 'string' &&
          typeof book.name === 'string' &&
          Array.isArray(book.chapters)
      )
  )
}

function isMeta(m: unknown): m is BibleMetadata {
  if (!m || typeof m !== 'object') return false
  const meta = m as Record<string, unknown>
  return (
    typeof meta.version === 'string' &&
    typeof meta.language === 'string' &&
    typeof meta.name === 'string'
  )
}

export const bibleService = new BibleService()
