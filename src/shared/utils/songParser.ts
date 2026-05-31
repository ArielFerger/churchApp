import type { Song, SongSection, Slide } from '../types/song'

// ─── Chord-annotated content parsing ─────────────────────────────────────────

/**
 * A piece of a word — chord that lands on this syllable plus the text that
 * follows it (up to the next chord or the next whitespace). A "word" is a
 * sequence of one or more `Part`s; the chord can be `null` if no chord lands
 * there. This matches the mockup's data model exactly.
 */
export interface ChordPart {
  chord: string | null
  text: string
}

export interface ChordWord {
  text: string // the plain text of the word, useful for clean projection
  parts: ChordPart[]
}

export interface ChordLine {
  isBlank: boolean
  words: ChordWord[]
}

/** A single projection slide (one "stanza" in the editor — split on blank lines). */
export interface ContentSlide {
  /** Stable key for React. */
  key: string
  /** Index within the song. */
  index: number
  /** Parsed lines with chord metadata. */
  lines: ChordLine[]
  /** Just the plain text of each line — what gets projected. */
  plainLines: string[]
}

const CHORD_RE = /\[([^\]]+)\]/g

/**
 * Parse one line of chord-annotated text. Tokens look like
 * `que ge[Am]nial, est[A]a canción` and we want the `[Am]` to "land" on the
 * letter immediately after it.
 */
export function parseChordLine(line: string): ChordLine {
  if (line.trim() === '') return { isBlank: true, words: [] }

  // Split into (chord?, text) tokens.
  type Token = { chord: string | null; text: string }
  const tokens: Token[] = []
  let lastIdx = 0
  let pendingChord: string | null = null
  let m: RegExpExecArray | null
  CHORD_RE.lastIndex = 0
  while ((m = CHORD_RE.exec(line)) !== null) {
    const before = line.substring(lastIdx, m.index)
    if (pendingChord !== null || before.length > 0) {
      tokens.push({ chord: pendingChord, text: before })
    }
    pendingChord = m[1]
    lastIdx = m.index + m[0].length
  }
  const tail = line.substring(lastIdx)
  if (pendingChord !== null || tail.length > 0) {
    tokens.push({ chord: pendingChord, text: tail })
  }

  // Group tokens into words split on whitespace.
  const words: ChordWord[] = []
  let currentWord: ChordWord | null = null
  let chordWaiting: string | null = null

  const flushWaitingAsEmpty = (): void => {
    if (chordWaiting !== null) {
      if (!currentWord) currentWord = { text: '', parts: [] }
      currentWord.parts.push({ chord: chordWaiting, text: '' })
      chordWaiting = null
    }
  }

  for (const tok of tokens) {
    if (tok.chord !== null) {
      flushWaitingAsEmpty()
      chordWaiting = tok.chord
    }
    if (tok.text === '') continue
    const pieces = tok.text.split(/(\s+)/).filter((p) => p.length > 0)
    for (const piece of pieces) {
      if (/^\s+$/.test(piece)) {
        flushWaitingAsEmpty()
        if (currentWord) {
          words.push(currentWord)
          currentWord = null
        }
      } else {
        if (!currentWord) currentWord = { text: '', parts: [] }
        currentWord.parts.push({ chord: chordWaiting, text: piece })
        currentWord.text += piece
        chordWaiting = null
      }
    }
  }
  flushWaitingAsEmpty()
  if (currentWord) words.push(currentWord)

  return { isBlank: false, words }
}

/** Plain text of a line (chord markers stripped). Used for projection. */
export function stripChords(line: string): string {
  return line.replace(CHORD_RE, '')
}

/**
 * Split a song's `content` field into projection slides. A new slide begins
 * after a blank line; consecutive non-blank lines stay on the same slide.
 */
export function parseSongContent(content: string): ContentSlide[] {
  const rawLines = content.split('\n')
  const slides: ContentSlide[] = []
  let buffer: string[] = []
  let idx = 0

  const flush = (): void => {
    if (buffer.length === 0) return
    // Drop trailing blank lines within a slide.
    while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') buffer.pop()
    if (buffer.length === 0) return
    const lines = buffer.map(parseChordLine)
    const plainLines = buffer.map(stripChords)
    slides.push({
      key: `slide-${idx}`,
      index: idx,
      lines,
      plainLines
    })
    idx += 1
    buffer = []
  }

  for (const raw of rawLines) {
    if (raw.trim() === '') {
      flush()
    } else {
      buffer.push(raw)
    }
  }
  flush()
  return slides
}

// ─── Legacy → modern content synthesis ───────────────────────────────────────

/**
 * If a song has only the legacy `sections` model, build a `content` string
 * from it so the new editor can show it. Each legacy slide becomes a stanza,
 * stanzas separated by blank lines, section labels written as `# label` lines
 * which the parser preserves as plain text. (No chord recovery — legacy songs
 * didn't have chord data.)
 */
export function synthesizeContent(song: Song): string {
  if (song.content && song.content.length > 0) return song.content
  if (!song.sections || song.sections.length === 0) return ''
  const sectionsById = new Map<string, SongSection>()
  for (const sec of song.sections) sectionsById.set(sec.id, sec)
  const order =
    song.order && song.order.length > 0 ? song.order : song.sections.map((s) => s.id)

  const stanzas: string[] = []
  for (const secId of order) {
    const sec = sectionsById.get(secId)
    if (!sec) continue
    for (const slide of sec.slides) {
      stanzas.push(slide.lines.join('\n'))
    }
  }
  return stanzas.join('\n\n')
}

/** A single playable slide in deck order — derived from `content`. */
export interface PlaySlide {
  key: string
  sectionId: string
  sectionLabel: string
  slideIndex: number
  slide: Slide
}

/**
 * Resolve a song to its play deck. Prefers `content`; falls back to legacy
 * `sections`/`order` when content is absent.
 */
export function flattenSong(song: Song): PlaySlide[] {
  if (song.content && song.content.length > 0) {
    return parseSongContent(song.content).map((cs) => ({
      key: cs.key,
      sectionId: 'content',
      sectionLabel: `Slide ${cs.index + 1}`,
      slideIndex: cs.index,
      slide: { id: cs.key, lines: cs.plainLines }
    }))
  }

  // Legacy fallback
  const sections = song.sections ?? []
  const order = song.order && song.order.length > 0 ? song.order : sections.map((s) => s.id)
  const sectionsById = new Map<string, SongSection>()
  for (const sec of sections) sectionsById.set(sec.id, sec)

  const out: PlaySlide[] = []
  const seenSection = new Map<string, number>()
  for (const sectionId of order) {
    const sec = sectionsById.get(sectionId)
    if (!sec) continue
    const occurrence = (seenSection.get(sectionId) ?? 0) + 1
    seenSection.set(sectionId, occurrence)
    sec.slides.forEach((slide, idx) => {
      out.push({
        key: `${sectionId}#${occurrence}#${slide.id || idx}`,
        sectionId,
        sectionLabel: sec.label,
        slideIndex: idx,
        slide
      })
    })
  }
  return out
}

/** Quick filter: case-insensitive substring across title, author, tags. */
export function songMatches(song: Song, query: string): boolean {
  if (!query.trim()) return true
  const needle = query.toLowerCase()
  if (song.title.toLowerCase().includes(needle)) return true
  if (song.author?.toLowerCase().includes(needle)) return true
  if (song.tags.some((t) => t.toLowerCase().includes(needle))) return true
  return false
}
