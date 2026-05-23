import type { Song, SongSection, Slide } from '../types/song'

/**
 * One playable slide in the order the operator advances through.
 * Carries enough context for the LiveIndicator (which section we're in, slide
 * counter for the deck UI).
 */
export interface PlaySlide {
  /** Stable key for React lists and AnimatePresence diffing. */
  key: string
  sectionId: string
  sectionLabel: string
  slideIndex: number
  slide: Slide
}

/**
 * Resolves `song.order` (e.g. `["v1","chorus","v2","chorus"]`) into a flat
 * sequence of slides. Sections referenced more than once produce distinct
 * `key`s so React keeps them as separate items in the deck.
 */
export function flattenSong(song: Song): PlaySlide[] {
  const sections = new Map<string, SongSection>()
  for (const sec of song.sections) sections.set(sec.id, sec)

  // If no order is set, just walk sections in declaration order.
  const order = song.order.length > 0 ? song.order : song.sections.map((s) => s.id)

  const out: PlaySlide[] = []
  const seenSection = new Map<string, number>()

  for (const sectionId of order) {
    const sec = sections.get(sectionId)
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
