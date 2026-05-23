import { findBook, type BookMeta } from './bibleBooks'

export interface ParsedReference {
  book: BookMeta
  chapter: number
  verse: number
  endVerse?: number
}

/**
 * Parse a freeform reference like:
 *   "Juan 3:16"
 *   "Jn 3:16"
 *   "1 Cor 13:4-7"
 *   "1Co 13:4"
 *   "Salmos 23"   (whole chapter, defaults to verse 1)
 *   "salmos 23:1"
 *
 * Tolerant to accents, casing, extra spaces, and dot abbreviations ("Jn.").
 * Returns null if the book can't be resolved.
 */
export function parseReference(input: string): ParsedReference | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Match: <book> <chapter>[:<verse>[-<endVerse>]]
  // <book> = optional number prefix (1/2/3) + word(s)
  // The book is everything up to the LAST whitespace before the chapter number.
  const match =
    /^(?<book>(?:[1-3]\s*)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\s]+?)\s+(?<chapter>\d{1,3})(?::(?<verse>\d{1,3})(?:\s*[-–]\s*(?<endVerse>\d{1,3}))?)?$/u.exec(
      trimmed
    )

  if (!match || !match.groups) return null
  const { book: bookStr, chapter, verse, endVerse } = match.groups

  const book = findBook(bookStr.replace(/\s+/g, ''))
  if (!book) return null

  const chapterNum = parseInt(chapter, 10)
  if (chapterNum < 1 || chapterNum > book.chapters) return null

  const verseNum = verse ? parseInt(verse, 10) : 1
  const endVerseNum = endVerse ? parseInt(endVerse, 10) : undefined

  if (endVerseNum !== undefined && endVerseNum < verseNum) return null

  return { book, chapter: chapterNum, verse: verseNum, endVerse: endVerseNum }
}

/** Format a parsed reference back to canonical Spanish ("Juan 3:16" or "Juan 3:16-17"). */
export function formatReference(ref: ParsedReference): string {
  const range = ref.endVerse ? `${ref.verse}-${ref.endVerse}` : `${ref.verse}`
  return `${ref.book.name} ${ref.chapter}:${range}`
}
