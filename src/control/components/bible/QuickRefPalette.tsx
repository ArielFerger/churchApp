import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, CornerDownLeft } from 'lucide-react'
import { BIBLE_BOOKS, normalizeBookName, type BookMeta } from '@/shared/utils/bibleBooks'
import type { BibleBookStats } from '@/shared/types/electronAPI'

export interface QuickRef {
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

interface QuickRefPaletteProps {
  /** Version code shown as a badge while building the reference. */
  versionLabel: string
  /** First character that triggered the palette (seeds the book query). */
  initialQuery?: string
  onComplete: (ref: QuickRef) => void
  onClose: () => void
}

type Stage = 'book' | 'chapter' | 'verse'

/** Rank books for the live filter: full-name prefix > abbreviation prefix > contains. */
function filterBooks(query: string): BookMeta[] {
  const q = normalizeBookName(query)
  if (!q) return BIBLE_BOOKS
  const scored: { book: BookMeta; score: number }[] = []
  for (const book of BIBLE_BOOKS) {
    const name = normalizeBookName(book.name)
    const abbrs = book.abbreviations.map(normalizeBookName)
    let score = -1
    if (name.startsWith(q)) score = 3
    else if (abbrs.some((a) => a.startsWith(q))) score = 2
    else if (name.includes(q)) score = 1
    if (score >= 0) scored.push({ book, score })
  }
  // Stable sort keeps canonical order within the same score.
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.book)
}

/**
 * Keyboard-first reference picker. Flow: type book letters → Space/Enter to pick
 * → type chapter → Space/: to advance → type verse (range with "-") → Enter.
 * Backspace on an empty field steps back; Escape closes.
 *
 * Solo deja tipear capítulos y versículos que EXISTEN: los límites reales se
 * cargan de la versión seleccionada (getBibleBookStats), con la metadata
 * canónica como respaldo mientras llegan.
 */
export default function QuickRefPalette({
  versionLabel,
  initialQuery = '',
  onComplete,
  onClose
}: QuickRefPaletteProps) {
  const [stage, setStage] = useState<Stage>('book')
  const [bookQuery, setBookQuery] = useState(initialQuery)
  const [book, setBook] = useState<BookMeta | null>(null)
  const [chapterStr, setChapterStr] = useState('')
  const [verseStr, setVerseStr] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [stats, setStats] = useState<BibleBookStats | null>(null)

  const filtered = useMemo(() => filterBooks(bookQuery), [bookQuery])
  const listRef = useRef<HTMLUListElement>(null)

  // Límites reales de la versión activa (cuántos capítulos / versículos hay).
  useEffect(() => {
    let alive = true
    void window.electronAPI?.getBibleBookStats(versionLabel).then((s) => {
      if (alive) setStats(s)
    })
    return () => {
      alive = false
    }
  }, [versionLabel])

  const maxChapter = book ? (stats?.[book.id]?.length ?? book.chapters) : 0
  const chapterNum = parseInt(chapterStr, 10)
  const maxVerse =
    book && Number.isFinite(chapterNum) ? (stats?.[book.id]?.[chapterNum - 1] ?? 0) : 0

  // Keep the highlighted row in view and within bounds as the list narrows.
  useEffect(() => {
    if (highlight > filtered.length - 1) setHighlight(Math.max(0, filtered.length - 1))
  }, [filtered.length, highlight])

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  function pickBook(b: BookMeta): void {
    setBook(b)
    setStage('chapter')
    setChapterStr('')
  }

  /** ¿"12" o "12-15" es un versículo/rango válido para el capítulo elegido? */
  function isValidVerseInput(candidate: string): boolean {
    const m = /^(\d+)(?:-(\d*))?$/.exec(candidate)
    if (!m) return false
    const start = parseInt(m[1], 10)
    if (start < 1) return false
    if (maxVerse > 0 && start > maxVerse) return false
    if (m[2]) {
      const end = parseInt(m[2], 10)
      if (maxVerse > 0 && end > maxVerse) return false
    }
    return true
  }

  function finalize(): void {
    if (!book) return
    const chapter = parseInt(chapterStr, 10)
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > maxChapter) return
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(verseStr.trim())
    let verse = m ? parseInt(m[1], 10) : 1
    if (verse < 1) verse = 1
    if (maxVerse > 0 && verse > maxVerse) return // versículo inexistente: no completar
    let endVerse = m && m[2] ? parseInt(m[2], 10) : undefined
    if (endVerse !== undefined) {
      if (maxVerse > 0 && endVerse > maxVerse) endVerse = maxVerse
      if (endVerse <= verse) endVerse = undefined
    }
    onComplete({ bookId: book.id, chapter, verse, endVerse })
  }

  // Single source of truth for the keyboard state machine.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key

      if (k === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (stage === 'book') {
        if (k === 'ArrowDown') {
          e.preventDefault()
          setHighlight((h) => Math.min(filtered.length - 1, h + 1))
        } else if (k === 'ArrowUp') {
          e.preventDefault()
          setHighlight((h) => Math.max(0, h - 1))
        } else if (k === ' ' || k === 'Enter') {
          e.preventDefault()
          const b = filtered[highlight]
          if (b) pickBook(b)
        } else if (k === 'Backspace') {
          e.preventDefault()
          if (bookQuery) setBookQuery((s) => s.slice(0, -1))
          else onClose()
        } else if (k.length === 1 && /[\p{L}\d]/u.test(k)) {
          e.preventDefault()
          setBookQuery((s) => s + k)
          setHighlight(0)
        }
        return
      }

      if (stage === 'chapter') {
        if (k === ' ' || k === ':' || k === 'Enter') {
          e.preventDefault()
          if (chapterStr) setStage('verse')
        } else if (k === 'Backspace') {
          e.preventDefault()
          if (chapterStr) setChapterStr((s) => s.slice(0, -1))
          else {
            setStage('book')
            setBook(null)
          }
        } else if (/^\d$/.test(k) && book) {
          e.preventDefault()
          // Solo aceptar el dígito si el capítulo resultante existe en el libro.
          const next = chapterStr + k
          const n = parseInt(next, 10)
          if (n >= 1 && n <= maxChapter) setChapterStr(next)
        }
        return
      }

      // stage === 'verse'
      if (k === 'Enter' || k === ' ') {
        e.preventDefault()
        finalize()
      } else if (k === 'Backspace') {
        e.preventDefault()
        if (verseStr) setVerseStr((s) => s.slice(0, -1))
        else setStage('chapter')
      } else if (/^\d$/.test(k)) {
        e.preventDefault()
        // Solo aceptar el dígito si el versículo (o rango) resultante existe.
        const next = verseStr + k
        if (isValidVerseInput(next)) setVerseStr(next)
      } else if ((k === '-' || k === '–') && verseStr && !verseStr.includes('-')) {
        e.preventDefault()
        setVerseStr((s) => s + '-')
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, bookQuery, book, chapterStr, verseStr, highlight, filtered, maxChapter, maxVerse])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Reference being built */}
        <div className="flex items-center gap-3 border-b border-slate-700 px-6 py-5">
          <BookOpen className="h-6 w-6 shrink-0 text-blue-400" />
          <div className="flex flex-1 items-baseline gap-2 text-3xl">
            <Field active={stage === 'book'} muted={stage !== 'book'}>
              {book ? book.name : bookQuery || 'libro…'}
            </Field>
            {(stage === 'chapter' || stage === 'verse') && (
              <Field active={stage === 'chapter'} muted={stage !== 'chapter'}>
                {chapterStr || '_'}
              </Field>
            )}
            {stage === 'verse' && (
              <>
                <span className="text-slate-500">:</span>
                <Field active muted={false}>
                  {verseStr || '_'}
                </Field>
              </>
            )}
          </div>
          {/* Rango disponible del paso actual (capítulos o versículos reales). */}
          {stage === 'chapter' && maxChapter > 0 && (
            <span className="shrink-0 rounded bg-slate-700/60 px-2 py-1 text-xs text-slate-400">
              1–{maxChapter}
            </span>
          )}
          {stage === 'verse' && maxVerse > 0 && (
            <span className="shrink-0 rounded bg-slate-700/60 px-2 py-1 text-xs text-slate-400">
              1–{maxVerse}
            </span>
          )}
          <span className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300">
            {versionLabel}
          </span>
        </div>

        {/* Book list (only while picking the book) */}
        {stage === 'book' && (
          <ul ref={listRef} className="max-h-[26rem] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-base text-slate-500">Sin coincidencias</li>
            ) : (
              filtered.map((b, i) => {
                const isActive = i === highlight
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        pickBook(b)
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex w-full items-center justify-between rounded px-4 py-2 text-left text-base transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      <span
                        className={`ml-2 shrink-0 font-mono text-xs ${
                          isActive ? 'text-blue-200' : 'text-slate-600'
                        }`}
                      >
                        {b.chapters} cap.
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        )}

        {/* Hint footer */}
        <div className="flex items-center gap-4 border-t border-slate-700 px-6 py-3 text-xs text-slate-500">
          {stage === 'book' && (
            <>
              <Hint keys="↑ ↓">elegir</Hint>
              <Hint keys="Espacio">seleccionar libro</Hint>
            </>
          )}
          {stage === 'chapter' && (
            <>
              <Hint keys="0-9">capítulo {maxChapter > 0 ? `(1–${maxChapter})` : ''}</Hint>
              <Hint keys="Espacio">ir al versículo</Hint>
            </>
          )}
          {stage === 'verse' && (
            <>
              <Hint keys="0-9 / -">
                versículo o rango {maxVerse > 0 ? `(1–${maxVerse})` : ''}
              </Hint>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3.5 w-3.5" />
                abrir
              </span>
            </>
          )}
          <span className="ml-auto">
            <Hint keys="Esc">cerrar</Hint>
          </span>
        </div>
      </div>
    </div>
  )
}

function Field({
  children,
  active,
  muted
}: {
  children: React.ReactNode
  active: boolean
  muted: boolean
}) {
  return (
    <span
      className={`${active ? 'font-semibold text-white' : muted ? 'text-slate-400' : 'text-slate-200'} ${
        active ? 'border-b-2 border-blue-500' : ''
      }`}
    >
      {children}
    </span>
  )
}

function Hint({ keys, children }: { keys: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded border border-slate-600 bg-slate-900 px-1.5 font-mono text-[11px] text-slate-300">
        {keys}
      </kbd>
      {children}
    </span>
  )
}
