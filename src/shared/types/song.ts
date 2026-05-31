export type SectionType = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'tag'

export interface Slide {
  id: string
  lines: string[]
}

export interface SongSection {
  id: string
  type: SectionType
  label: string
  slides: Slide[]
}

/**
 * A song.
 *
 * The "modern" representation is `content`: a single string with inline chord
 * markers (`[Am]text`) where blank lines separate projection slides. This
 * matches the way worship leaders actually write lead sheets and lets the
 * editor stay a single textarea.
 *
 * `sections` / `order` are kept for back-compat with songs created before the
 * 2026-05 redesign — they still load, and we synthesize a `content` view of
 * them on demand. New saves use `content` exclusively.
 */
export interface Song {
  id: string
  title: string
  author?: string
  albumId?: string | null
  /** Modern format: raw text with `[Chord]` markers, blank lines = new slide. */
  content?: string
  tags: string[]
  language: string
  createdAt: string
  updatedAt: string
  /** Legacy structured form. Optional going forward. */
  sections?: SongSection[]
  order?: string[]
}

export interface Album {
  id: string
  name: string
}
