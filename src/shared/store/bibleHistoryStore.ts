import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** A verse (or verse range) that was opened from the Bible page. */
export interface BibleHistoryEntry {
  bookId: string
  bookName: string
  chapter: number
  verse: number
  endVerse?: number
  version: string
  /** Cached verse text, so a recent entry can be re-projected without a lookup. */
  text: string
  /** Epoch ms when it was last opened. */
  ts: number
}

interface BibleHistoryState {
  entries: BibleHistoryEntry[]
  add: (entry: Omit<BibleHistoryEntry, 'ts'>) => void
  remove: (key: string) => void
  clear: () => void
}

const MAX_ENTRIES = 20

/** Stable identity for a reference, independent of version/timestamp. */
export function historyKey(e: {
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
  version: string
}): string {
  return `${e.version}-${e.bookId}-${e.chapter}-${e.verse}-${e.endVerse ?? ''}`
}

export const useBibleHistoryStore = create<BibleHistoryState>()(
  persist(
    (set) => ({
      entries: [],

      add: (entry) =>
        set((state) => {
          const key = historyKey(entry)
          // Drop any existing entry for the same reference, then unshift the
          // fresh one so re-opening a verse just bumps it to the top.
          const without = state.entries.filter((e) => historyKey(e) !== key)
          const next: BibleHistoryEntry = { ...entry, ts: Date.now() }
          return { entries: [next, ...without].slice(0, MAX_ENTRIES) }
        }),

      remove: (key) =>
        set((state) => ({ entries: state.entries.filter((e) => historyKey(e) !== key) })),

      clear: () => set({ entries: [] })
    }),
    { name: 'church-projector-bible-history' }
  )
)
