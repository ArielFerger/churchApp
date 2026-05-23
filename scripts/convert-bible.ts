/**
 * convert-bible.ts — fetches and normalizes Bibles into the app schema.
 *
 * Two sources supported out of the box:
 *
 *   - RVR1909 (Reina-Valera 1909) — bibliadelpueblo/ReinaValera1909
 *     Format: one Markdown file per book with `# <chapter>` headings and
 *     `^<verse>^ text` markers.
 *
 *   - RVA-2015 (Reina-Valera Actualizada 2015) — mrk214/bible-data-es-spa
 *     Format: a single large JSON keyed by book/chapter/verse.
 *
 * Usage:
 *   npx tsx scripts/convert-bible.ts          # all sources
 *   npx tsx scripts/convert-bible.ts rvr1909  # one source
 *
 * Outputs:
 *   data/bibles/rvr1909.json
 *   data/bibles/rva2015.json
 */

import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { BIBLE_BOOKS, type BookMeta } from '../src/shared/utils/bibleBooks.js'
import type { Bible, BibleBook, BibleChapter, BibleVerse } from '../src/shared/types/bible.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'data', 'bibles')

// ─────────────────────────────────────────────────────────────────────────────
// RVR1909 — bibliadelpueblo/ReinaValera1909 (Markdown)
// ─────────────────────────────────────────────────────────────────────────────

interface RVRBookSource {
  meta: BookMeta
  /** Number prefix used in the source repo's filenames. */
  fileNumber: number
  /** File slug (no extension), URL-encoded as needed. */
  slug: string
}

const RVR1909_REPO = 'https://raw.githubusercontent.com/bibliadelpueblo/ReinaValera1909/master'

const RVR1909_SOURCES: RVRBookSource[] = [
  { meta: book('GEN'), fileNumber: 1, slug: 'Génesis' },
  { meta: book('EXO'), fileNumber: 2, slug: 'Éxodo' },
  { meta: book('LEV'), fileNumber: 3, slug: 'Levítico' },
  { meta: book('NUM'), fileNumber: 4, slug: 'Números' },
  { meta: book('DEU'), fileNumber: 5, slug: 'Deuteronomio' },
  { meta: book('JOS'), fileNumber: 6, slug: 'Josué' },
  { meta: book('JDG'), fileNumber: 7, slug: 'Jueces' },
  { meta: book('RUT'), fileNumber: 8, slug: 'Rut' },
  { meta: book('1SA'), fileNumber: 9, slug: '1 Samuel' },
  { meta: book('2SA'), fileNumber: 10, slug: '2 Samuel' },
  { meta: book('1KI'), fileNumber: 11, slug: '1 Reyes' },
  { meta: book('2KI'), fileNumber: 12, slug: '2 Reyes' },
  { meta: book('1CH'), fileNumber: 13, slug: '1 Crónicas' },
  { meta: book('2CH'), fileNumber: 14, slug: '2 Crónicas' },
  { meta: book('EZR'), fileNumber: 15, slug: 'Esdras' },
  { meta: book('NEH'), fileNumber: 16, slug: 'Nehemías' },
  { meta: book('EST'), fileNumber: 17, slug: 'Ester' },
  { meta: book('JOB'), fileNumber: 18, slug: 'Job' },
  { meta: book('PSA'), fileNumber: 19, slug: 'Salmos' },
  { meta: book('PRO'), fileNumber: 20, slug: 'Proverbios' },
  { meta: book('ECC'), fileNumber: 21, slug: 'Eclesiastés' },
  { meta: book('SNG'), fileNumber: 22, slug: 'Cantar de los Cantares' },
  { meta: book('ISA'), fileNumber: 23, slug: 'Isaías' },
  { meta: book('JER'), fileNumber: 24, slug: 'Jeremías' },
  { meta: book('LAM'), fileNumber: 25, slug: 'Lamentaciones' },
  { meta: book('EZK'), fileNumber: 26, slug: 'Ezequiel' },
  { meta: book('DAN'), fileNumber: 27, slug: 'Daniel' },
  { meta: book('HOS'), fileNumber: 28, slug: 'Oseas' },
  { meta: book('JOL'), fileNumber: 29, slug: 'Joel' },
  { meta: book('AMO'), fileNumber: 30, slug: 'Amós' },
  { meta: book('OBA'), fileNumber: 31, slug: 'Abdías' },
  { meta: book('JON'), fileNumber: 32, slug: 'Jonás' },
  { meta: book('MIC'), fileNumber: 33, slug: 'Miqueas' },
  { meta: book('NAM'), fileNumber: 34, slug: 'Nahum' },
  { meta: book('HAB'), fileNumber: 35, slug: 'Habacuc' },
  { meta: book('ZEP'), fileNumber: 36, slug: 'Sofonías' },
  { meta: book('HAG'), fileNumber: 37, slug: 'Hageo' },
  { meta: book('ZEC'), fileNumber: 38, slug: 'Zacarías' },
  { meta: book('MAL'), fileNumber: 39, slug: 'Malaquías' },
  { meta: book('MAT'), fileNumber: 40, slug: 'San Mateo' },
  { meta: book('MRK'), fileNumber: 41, slug: 'Marcos' },
  { meta: book('LUK'), fileNumber: 42, slug: 'San Lucas' },
  { meta: book('JHN'), fileNumber: 43, slug: 'Juan' },
  { meta: book('ACT'), fileNumber: 44, slug: 'Hechos' },
  { meta: book('ROM'), fileNumber: 45, slug: 'Romanos' },
  { meta: book('1CO'), fileNumber: 46, slug: '1 Corintios' },
  { meta: book('2CO'), fileNumber: 47, slug: '2 Corintios' },
  { meta: book('GAL'), fileNumber: 48, slug: 'Gálatas' },
  { meta: book('EPH'), fileNumber: 49, slug: 'Efesios' },
  { meta: book('PHP'), fileNumber: 50, slug: 'Filipenses' },
  { meta: book('COL'), fileNumber: 51, slug: 'Colosenses' },
  { meta: book('1TH'), fileNumber: 52, slug: '1 Tesalonicenses' },
  { meta: book('2TH'), fileNumber: 53, slug: '2 Tesalonicenses' },
  { meta: book('1TI'), fileNumber: 54, slug: '1 Timoteo' },
  { meta: book('2TI'), fileNumber: 55, slug: '2 Timoteo' },
  { meta: book('TIT'), fileNumber: 56, slug: 'Tito' },
  { meta: book('PHM'), fileNumber: 57, slug: 'Filemón' },
  { meta: book('HEB'), fileNumber: 58, slug: 'Hebreos' },
  { meta: book('JAS'), fileNumber: 59, slug: 'Santiago' },
  { meta: book('1PE'), fileNumber: 60, slug: '1 Pedro' },
  { meta: book('2PE'), fileNumber: 61, slug: '2 Pedro' },
  { meta: book('1JN'), fileNumber: 62, slug: '1 Juan' },
  { meta: book('2JN'), fileNumber: 63, slug: '2 Juan' },
  { meta: book('3JN'), fileNumber: 64, slug: '3 Juan' },
  { meta: book('JUD'), fileNumber: 65, slug: 'Judas' },
  { meta: book('REV'), fileNumber: 66, slug: 'Apocalipsis' }
]

function book(id: string): BookMeta {
  const found = BIBLE_BOOKS.find((b) => b.id === id)
  if (!found) throw new Error(`Unknown book id: ${id}`)
  return found
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

/**
 * Parses one of bibliadelpueblo's Markdown book files into chapters/verses.
 *
 * The format places every verse marker `^N^` followed by its text on the
 * same line as the chapter's content, with no newline between verses. Some
 * lines also contain `^^` (paragraph markers) and `^[**X:Y** ref]` cross-
 * references — both stripped.
 */
function parseRvrMarkdown(md: string): BibleChapter[] {
  // Strip cross-reference annotations: `^[ ... ]`
  const cleaned = md.replace(/\^\[[^\]]*\]/g, '')
  // Strip empty paragraph markers: `^^`
  const noPara = cleaned.replace(/\^\^/g, '')

  // Split into chapter blocks via `# N` headings at line start.
  const chapters: BibleChapter[] = []
  const chapterRegex = /^#\s+(\d+)\s*$/gm
  const matches = [...noPara.matchAll(chapterRegex)]

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const chapterNum = parseInt(m[1], 10)
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : noPara.length
    const body = noPara.slice(start, end)

    // Verses: `^N^ text` until the next `^N^` or end of block.
    const verseRegex = /\^(\d+)\^\s*([\s\S]*?)(?=\^\d+\^|$)/g
    const verses: BibleVerse[] = []
    let vm: RegExpExecArray | null
    while ((vm = verseRegex.exec(body)) !== null) {
      const num = parseInt(vm[1], 10)
      // Strip `## subtitles` and collapse whitespace.
      const text = vm[2]
        .replace(/^##.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) verses.push({ number: num, text })
    }
    chapters.push({ number: chapterNum, verses })
  }

  return chapters
}

async function buildRvr1909(): Promise<Bible> {
  console.log('• RVR1909 — fetching 66 books from bibliadelpueblo/ReinaValera1909')
  const books: BibleBook[] = []

  // Sequential to avoid hammering the host; logs progress.
  for (const src of RVR1909_SOURCES) {
    const fileName = `${String(src.fileNumber).padStart(2, '0')}-${src.slug}.md`
    const url = `${RVR1909_REPO}/${encodeURI(fileName)}`
    process.stdout.write(`  ${src.meta.id.padEnd(3)} ${src.meta.name.padEnd(28)}`)
    try {
      const md = await fetchText(url)
      const chapters = parseRvrMarkdown(md)
      books.push({ id: src.meta.id, name: src.meta.name, chapters })
      const verseCount = chapters.reduce((n, c) => n + c.verses.length, 0)
      console.log(`✓ ${chapters.length} cap · ${verseCount} v`)
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`)
      books.push({ id: src.meta.id, name: src.meta.name, chapters: [] })
    }
  }

  return {
    metadata: { version: 'RVR1909', language: 'es', name: 'Reina-Valera 1909' },
    books
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RVA-2015 — mrk214/bible-data-es-spa
// ─────────────────────────────────────────────────────────────────────────────

const RVA2015_URL =
  'https://raw.githubusercontent.com/mrk214/bible-data-es-spa/main/data/es___spa___spa/RVA2015_vid_1782.json'

/**
 * Maps mrk214's book numbers (1..66 Protestant order) to our OSIS ids by
 * position. The source uses index-based ordering matching the standard
 * Protestant canon, so a 1:1 positional mapping holds.
 */
const POSITION_TO_ID: string[] = BIBLE_BOOKS.map((b) => b.id)

interface MrkBible {
  // Each implementation varies slightly. We accept either:
  // - { verses: [{book_id, chapter, verse, text}, ...] }
  // - [{book_id, chapter, verse, text}, ...]
  // - { books: [{book_id, chapters: [{chapter, verses: [...]}]}] }
  // Detected at runtime.
  [k: string]: unknown
}

async function buildRva2015(): Promise<Bible> {
  console.log('• RVA-2015 — fetching from mrk214/bible-data-es-spa (~25 MB)')
  const raw = await fetchText(RVA2015_URL)
  const parsed = JSON.parse(raw) as MrkBible

  const books = reshapeMrk(parsed)
  return {
    metadata: { version: 'RVA2015', language: 'es', name: 'Reina-Valera Actualizada 2015' },
    books
  }
}

interface MrkItem {
  type: string
  verse_numbers: number[]
  lines: string[]
}

interface MrkChapter {
  chapter_usfm: string
  items?: MrkItem[]
  current?: { usfm: string }
}

interface MrkBook {
  book_usfm: string
  name?: string
  chapters?: MrkChapter[]
}

interface MrkRoot {
  books?: MrkBook[]
}

function parseMrkChapter(items: MrkItem[]): BibleVerse[] {
  // We walk items in order. Verse items contribute their lines to the
  // current verse number. Headings/paragraph breaks (no verse_numbers) are
  // ignored for our text-only output. When a single item spans multiple
  // verse numbers, the same text is attached to each — Phase 4 priority is
  // making lookups succeed; per-verse splitting is a Fase 7 refinement.
  const verses = new Map<number, string[]>()

  for (const item of items) {
    if (!item.verse_numbers || item.verse_numbers.length === 0) continue
    const text = (item.lines ?? []).join(' ').replace(/\s+/g, ' ').trim()
    if (!text) continue
    for (const n of item.verse_numbers) {
      const arr = verses.get(n) ?? []
      arr.push(text)
      verses.set(n, arr)
    }
  }

  return [...verses.entries()]
    .map(([number, chunks]) => ({ number, text: chunks.join(' ') }))
    .sort((a, b) => a.number - b.number)
}

/**
 * Tries common shapes used by the mrk214 dataset and reshapes into our schema.
 * The current shape is `{ books: [{ book_usfm, chapters: [{ items: [...] }] }] }`
 * where each chapter has an `items` array carrying verse_numbers + lines.
 */
function reshapeMrk(parsed: MrkBible): BibleBook[] {
  const root = parsed as MrkRoot

  // Preferred path: native shape with items.
  if (Array.isArray(root.books)) {
    const out: BibleBook[] = []
    const byBookUsfm = new Map<string, MrkBook>()
    for (const b of root.books) byBookUsfm.set(b.book_usfm, b)

    for (const meta of BIBLE_BOOKS) {
      const src = byBookUsfm.get(meta.id)
      if (!src || !src.chapters) {
        out.push({ id: meta.id, name: meta.name, chapters: [] })
        continue
      }
      const chapters: BibleChapter[] = src.chapters
        .map((ch) => {
          const items = ch.items ?? []
          const m = /\.(\d+)$/.exec(ch.chapter_usfm)
          const number = m ? parseInt(m[1], 10) : 0
          const verses = parseMrkChapter(items)
          return { number, verses }
        })
        .filter((c) => c.number > 0 && c.verses.length > 0)
        .sort((a, b) => a.number - b.number)
      out.push({ id: meta.id, name: src.name ?? meta.name, chapters })
    }
    return out
  }

  return reshapeMrkFlatFallback(parsed)
}

/**
 * Legacy fallback for flat `[{book_id, chapter, verse, text}]`-style sources.
 */
function reshapeMrkFlatFallback(parsed: MrkBible): BibleBook[] {
  const flatten = (rows: Array<Record<string, unknown>>): BibleBook[] => {
    // Group by book → chapter
    type ChMap = Map<number, BibleVerse[]>
    const byBook = new Map<number, ChMap>()

    for (const r of rows) {
      const bookNum =
        toInt(r.book_id) ?? toInt(r.book) ?? toInt(r.book_number) ?? toInt(r.book_num)
      const ch = toInt(r.chapter) ?? toInt(r.chapter_id) ?? toInt(r.chapter_number)
      const v = toInt(r.verse) ?? toInt(r.verse_id) ?? toInt(r.verse_number)
      const text = String(r.text ?? r.verse_text ?? r.content ?? '').trim()
      if (!bookNum || !ch || !v || !text) continue

      let chs = byBook.get(bookNum)
      if (!chs) {
        chs = new Map()
        byBook.set(bookNum, chs)
      }
      let verses = chs.get(ch)
      if (!verses) {
        verses = []
        chs.set(ch, verses)
      }
      verses.push({ number: v, text })
    }

    const books: BibleBook[] = []
    for (let i = 0; i < POSITION_TO_ID.length; i++) {
      const bookNum = i + 1
      const chs = byBook.get(bookNum)
      const id = POSITION_TO_ID[i]
      const meta = BIBLE_BOOKS[i]
      if (!chs) {
        books.push({ id, name: meta.name, chapters: [] })
        continue
      }
      const chapters: BibleChapter[] = [...chs.entries()]
        .sort(([a], [b]) => a - b)
        .map(([num, verses]) => ({
          number: num,
          verses: verses.sort((a, b) => a.number - b.number)
        }))
      books.push({ id, name: meta.name, chapters })
    }
    return books
  }

  // Attempt 1: flat array
  if (Array.isArray(parsed)) {
    return flatten(parsed as Array<Record<string, unknown>>)
  }
  // Attempt 2: { verses: [...] }
  if (Array.isArray((parsed as { verses?: unknown }).verses)) {
    return flatten((parsed as { verses: Array<Record<string, unknown>> }).verses)
  }
  // Attempt 3: { resultset: { row: [...] } } or similar (Sword-style)
  if (typeof parsed === 'object' && parsed !== null) {
    const dive = (obj: unknown): Array<Record<string, unknown>> | null => {
      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object') return obj as Array<Record<string, unknown>>
        return null
      }
      if (obj && typeof obj === 'object') {
        for (const v of Object.values(obj)) {
          const found = dive(v)
          if (found) return found
        }
      }
      return null
    }
    const rows = dive(parsed)
    if (rows) return flatten(rows)
  }

  throw new Error('RVA-2015 source: unrecognized JSON shape')
}

function toInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10)
  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function writeBible(bible: Bible, fileName: string): Promise<void> {
  await mkdir(outDir, { recursive: true })
  const out = resolve(outDir, fileName)
  await writeFile(out, JSON.stringify(bible) + '\n', 'utf-8')
  const totalVerses = bible.books.reduce(
    (n, b) => n + b.chapters.reduce((m, c) => m + c.verses.length, 0),
    0
  )
  console.log(
    `✓ Wrote ${out} — ${bible.books.filter((b) => b.chapters.length).length}/${bible.books.length} libros, ${totalVerses} versículos`
  )
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).map((a) => a.toLowerCase())
  const all = args.length === 0
  const want = (key: string): boolean => all || args.includes(key)

  if (want('rvr1909')) {
    const bible = await buildRvr1909()
    await writeBible(bible, 'rvr1909.json')
  }

  if (want('rva2015')) {
    const bible = await buildRva2015()
    await writeBible(bible, 'rva2015.json')
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
