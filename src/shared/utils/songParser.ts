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
  /**
   * Nombre de la sección (`Coro`, `Verso 1`, `Puente`), escrito como una línea
   * `# Coro` dentro de la estrofa. Es sólo para el operador: nunca se proyecta.
   */
  label: string | null
  /** Parsed lines with chord metadata. */
  lines: ChordLine[]
  /** Just the plain text of each line — what gets projected. */
  plainLines: string[]
}

/** Una línea `# Coro` marca el nombre de la sección, no letra. */
const LABEL_RE = /^\s*#\s*(.*)$/

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
 *
 * Una línea `# Coro` dentro de la estrofa le pone nombre al slide y se saca de
 * la letra — sirve para que el operador reconozca las partes de un vistazo sin
 * que "Coro" termine proyectado en la pantalla.
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

    let label: string | null = null
    const body: string[] = []
    for (const raw of buffer) {
      const m = LABEL_RE.exec(raw)
      if (m) {
        if (label === null) label = m[1].trim() || null
        continue
      }
      body.push(raw)
    }
    buffer = []
    // Una estrofa que sólo tenía la etiqueta no es un slide proyectable.
    if (body.length === 0) return

    slides.push({
      key: `slide-${idx}`,
      index: idx,
      label,
      lines: body.map(parseChordLine),
      plainLines: body.map(stripChords)
    })
    idx += 1
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

// ─── Importar canciones desde archivos de texto ──────────────────────────────

/**
 * Decodifica el contenido crudo de un `.txt`. Se intenta UTF-8 en modo estricto
 * y, si el archivo no es UTF-8 válido, se cae a windows-1252: los `.txt` de
 * letras suelen venir de Word o del Bloc de notas viejo y ahí las eñes y las
 * tildes están en esa codificación. Sin esto "corazón" llega como "corazÃ³n".
 */
export function decodeSongFile(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  }
}

/**
 * Deja el texto de un `.txt` listo para el editor: saca el BOM, normaliza los
 * saltos de línea de Windows y colapsa los huecos de varias líneas en blanco a
 * uno solo — si no, cada hueco grande generaría slides de más.
 */
export function normalizeImportedText(raw: string): string {
  return raw
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Nombre de la canción a partir del nombre del archivo: sin extensión, con los
 * guiones bajos como espacios y sin el número de pista de adelante.
 *
 * El número sólo se saca si viene con separador ("01 - Sublime gracia"), para
 * no arruinar una canción que empiece con un número ("40 días").
 */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  const clean = base
    .replace(/^\d{1,3}\s*[-–_.)]\s+/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || base.trim() || 'Sin título'
}

// ─── Legacy → modern content synthesis ───────────────────────────────────────

/**
 * If a song has only the legacy `sections` model, build a `content` string
 * from it so the new editor can show it. Cada slide viejo pasa a ser una
 * estrofa separada por una línea en blanco, y la etiqueta de la sección
 * ("Coro", "Verso 1") se conserva como línea `# label`: así una canción vieja
 * abre en el mazo ya con sus partes nombradas. (No chord recovery — legacy
 * songs didn't have chord data.)
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
      const head = sec.label.trim() ? `# ${sec.label.trim()}\n` : ''
      stanzas.push(head + slide.lines.join('\n'))
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
      sectionLabel: cs.label ?? `Slide ${cs.index + 1}`,
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
