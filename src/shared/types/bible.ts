export interface BibleVerse {
  number: number
  text: string
}

export interface BibleChapter {
  number: number
  verses: BibleVerse[]
}

export interface BibleBook {
  id: string
  name: string
  abbreviation?: string
  chapters: BibleChapter[]
}

export interface BibleMetadata {
  version: string
  language: string
  name: string
}

export interface Bible {
  metadata: BibleMetadata
  books: BibleBook[]
}

export interface VerseReference {
  bookId: string
  bookName: string
  chapter: number
  verse: number
  endVerse?: number
}
