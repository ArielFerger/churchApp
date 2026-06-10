import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  BookOpen,
  Eye,
  Star,
  History,
  X,
  Keyboard,
  AlertCircle,
  Palette
} from 'lucide-react'
import { BIBLE_BOOKS, bookById, findBook, type BookMeta } from '@/shared/utils/bibleBooks'
import { parseReference } from '@/shared/utils/bibleParser'
import { useSettingsStore } from '@/shared/store/settingsStore'
import {
  useBibleHistoryStore,
  historyKey,
  type BibleHistoryEntry
} from '@/shared/store/bibleHistoryStore'
import QuickRefPalette, { type QuickRef } from '@/control/components/bible/QuickRefPalette'
import AppearancePanel from '@/control/components/bible/AppearancePanel'
import type { ProjectionCommand } from '@/shared/types/ipc'
import type {
  BibleBookStats,
  BibleLookupResult,
  BibleVersionSummary
} from '@/shared/types/electronAPI'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

export default function Bible() {
  const [versions, setVersions] = useState<BibleVersionSummary[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string>('JHN')
  const [selectedChapter, setSelectedChapter] = useState<number>(3)
  const [search, setSearch] = useState('')
  const [searchHits, setSearchHits] = useState<BibleLookupResult[] | null>(null)
  // Aviso de referencia inválida (capítulo o versículo inexistente).
  const [searchNotice, setSearchNotice] = useState<string | null>(null)
  // Versículos por capítulo de la versión activa, para validar referencias.
  const [bookStats, setBookStats] = useState<BibleBookStats | null>(null)
  const [verses, setVerses] = useState<{ number: number; text: string }[]>([])
  const [chosenVerse, setChosenVerse] = useState<number | null>(null)
  // Verse number to scroll into view once the chapter has loaded (set when we
  // navigate programmatically from the quick palette or the history chips).
  const [pendingScroll, setPendingScroll] = useState<number | null>(null)
  // First character that opened the keyboard palette; null while it is closed.
  const [paletteSeed, setPaletteSeed] = useState<string | null>(null)
  // Panel de apariencia de versículos (fuente, tamaño, fondo…).
  const [showAppearance, setShowAppearance] = useState(false)

  const settings = useSettingsStore((s) => s.settings)
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const loadSettings = useSettingsStore((s) => s.load)
  const updateSettings = useSettingsStore((s) => s.update)
  const defaultVersion = settings?.defaultBibleVersion ?? null

  const history = useBibleHistoryStore((s) => s.entries)
  const addHistory = useBibleHistoryStore((s) => s.add)
  const removeHistory = useBibleHistoryStore((s) => s.remove)
  const clearHistory = useBibleHistoryStore((s) => s.clear)

  // Load available versions on mount; make sure settings are loaded too so the
  // saved default version is known before we pick the initial one.
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.getBibleVersions().then(setVersions)
  }, [])

  useEffect(() => {
    if (!settingsLoaded) void loadSettings()
  }, [settingsLoaded, loadSettings])

  // Límites reales (capítulos/versículos) de la versión activa.
  useEffect(() => {
    if (!selectedVersion) return
    let alive = true
    void window.electronAPI?.getBibleBookStats(selectedVersion).then((s) => {
      if (alive) setBookStats(s)
    })
    return () => {
      alive = false
    }
  }, [selectedVersion])

  // Pick the initial version once versions and saved settings are available:
  // the saved default if present, otherwise the first one.
  useEffect(() => {
    if (selectedVersion || versions.length === 0 || !settingsLoaded) return
    const preferred = defaultVersion && versions.find((v) => v.version === defaultVersion)
    setSelectedVersion(preferred ? preferred.version : versions[0].version)
  }, [versions, defaultVersion, selectedVersion, settingsLoaded])

  // When version/book/chapter changes, refresh the verses panel.
  useEffect(() => {
    if (!selectedVersion) return
    const api = window.electronAPI
    if (!api) return
    void api
      .lookupVerse({
        version: selectedVersion,
        bookId: selectedBookId,
        chapter: selectedChapter,
        verse: 1,
        endVerse: 200 // generous upper bound to fetch the whole chapter
      })
      .then((res) => setVerses(res?.verses ?? []))
  }, [selectedVersion, selectedBookId, selectedChapter])

  // Scroll the freshly navigated verse into view once its chapter has loaded.
  useEffect(() => {
    if (pendingScroll == null) return
    if (!verses.some((v) => v.number === pendingScroll)) return
    document.getElementById(`bible-verse-${pendingScroll}`)?.scrollIntoView({ block: 'center' })
    setPendingScroll(null)
  }, [pendingScroll, verses])

  // Type anywhere on the Bible tab (no input focused) to open the quick picker.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (paletteSeed !== null) return // palette owns the keyboard while open
      if (showAppearance) return // el panel de apariencia tiene prioridad
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key.length === 1 && /[\p{L}\d]/u.test(e.key)) {
        e.preventDefault()
        setPaletteSeed(e.key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteSeed, showAppearance])

  const book = useMemo<BookMeta | null>(() => bookById(selectedBookId) ?? null, [selectedBookId])

  function record(entry: Omit<BibleHistoryEntry, 'ts'>): void {
    addHistory(entry)
  }

  /** Navigate to a reference and select its verse (used by palette + history). */
  async function openReference(
    ref: { version: string; bookId: string; chapter: number; verse: number; endVerse?: number },
    fallback?: { bookName: string; text: string }
  ): Promise<void> {
    setSelectedVersion(ref.version)
    setSelectedBookId(ref.bookId)
    setSelectedChapter(ref.chapter)
    setChosenVerse(ref.verse)
    setPendingScroll(ref.verse)
    setSearchHits(null)

    const api = window.electronAPI
    const res = api ? await api.lookupVerse(ref) : null
    record({
      bookId: ref.bookId,
      bookName: res?.bookName ?? fallback?.bookName ?? bookById(ref.bookId)?.name ?? ref.bookId,
      chapter: ref.chapter,
      verse: ref.verse,
      endVerse: ref.endVerse,
      version: ref.version,
      text: res?.text ?? fallback?.text ?? ''
    })
  }

  function setDefaultVersion(version: string): void {
    const next = defaultVersion === version ? null : version
    void updateSettings({ defaultBibleVersion: next })
    if (next) setSelectedVersion(next)
  }

  /**
   * Si la referencia menciona un libro válido pero un capítulo/versículo que
   * no existe, devuelve un mensaje explicando el rango disponible.
   */
  function invalidRefNotice(raw: string): string | null {
    const m =
      /^(?<book>(?:[1-3]\s*)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\s]+?)\s+(?<chapter>\d{1,3})(?::(?<verse>\d{1,3}))?/u.exec(
        raw.trim()
      )
    if (!m || !m.groups) return null
    const book = findBook(m.groups.book.replace(/\s+/g, ''))
    if (!book) return null
    const chapter = parseInt(m.groups.chapter, 10)
    const maxChapter = bookStats?.[book.id]?.length ?? book.chapters
    if (chapter < 1 || chapter > maxChapter) {
      return `${book.name} tiene ${maxChapter} capítulos — el capítulo ${chapter} no existe.`
    }
    if (m.groups.verse) {
      const verse = parseInt(m.groups.verse, 10)
      const maxVerse = bookStats?.[book.id]?.[chapter - 1]
      if (maxVerse && (verse < 1 || verse > maxVerse)) {
        return `${book.name} ${chapter} tiene ${maxVerse} versículos — el versículo ${verse} no existe.`
      }
    }
    return null
  }

  async function runSearch(raw: string): Promise<void> {
    setSearch(raw)
    const parsed = parseReference(raw)
    if (!parsed || !selectedVersion) {
      setSearchHits(null)
      // parseReference rechaza capítulos fuera de rango: avisar por qué.
      setSearchNotice(raw.trim() ? invalidRefNotice(raw) : null)
      return
    }
    // Query the selected version + every other available version too, so the
    // operator can compare side by side ("Juan 3:16 en ambas versiones").
    const api = window.electronAPI
    if (!api) return
    const results = await Promise.all(
      versions.map((v) =>
        api.lookupVerse({
          version: v.version,
          bookId: parsed.book.id,
          chapter: parsed.chapter,
          verse: parsed.verse,
          endVerse: parsed.endVerse
        })
      )
    )
    const hits = results.filter((r): r is BibleLookupResult => r !== null)
    setSearchHits(hits)
    // Referencia bien formada pero sin resultados → el versículo no existe.
    setSearchNotice(hits.length === 0 ? (invalidRefNotice(raw) ?? 'Esa referencia no existe en las versiones cargadas.') : null)
    // Also focus the picker on the parsed location.
    setSelectedBookId(parsed.book.id)
    setSelectedChapter(parsed.chapter)
    setChosenVerse(parsed.verse)
  }

  function projectVerse(result: BibleLookupResult): void {
    const range = result.endVerse ? `${result.verse}-${result.endVerse}` : `${result.verse}`
    send({
      type: 'showBibleVerse',
      reference: `${result.bookName} ${result.chapter}:${range}`,
      text: result.text,
      version: result.version.version
    })
    record({
      bookId: result.bookId,
      bookName: result.bookName,
      chapter: result.chapter,
      verse: result.verse,
      endVerse: result.endVerse,
      version: result.version.version,
      text: result.text
    })
  }

  function projectChapterVerse(n: number): void {
    if (!selectedVersion || !book) return
    const verse = verses.find((v) => v.number === n)
    if (!verse) return
    setChosenVerse(n)
    send({
      type: 'showBibleVerse',
      reference: `${book.name} ${selectedChapter}:${n}`,
      text: verse.text,
      version: selectedVersion
    })
    record({
      bookId: book.id,
      bookName: book.name,
      chapter: selectedChapter,
      verse: n,
      version: selectedVersion,
      text: verse.text
    })
  }

  function onPaletteComplete(ref: QuickRef): void {
    setPaletteSeed(null)
    if (!selectedVersion) return
    void openReference({ ...ref, version: selectedVersion })
  }

  if (versions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center text-sm text-slate-400">
          <BookOpen className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3">No hay versiones de la Biblia cargadas.</p>
          <p className="mt-1 text-xs text-slate-500">
            Corré <span className="font-mono">npm run convert-bibles</span> para generar los
            JSON en <span className="font-mono">data/bibles/</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {paletteSeed !== null && selectedVersion && (
        <QuickRefPalette
          versionLabel={selectedVersion}
          initialQuery={paletteSeed}
          onClose={() => setPaletteSeed(null)}
          onComplete={onPaletteComplete}
        />
      )}

      {showAppearance && (
        <AppearancePanel
          versionLabel={selectedVersion ?? ''}
          onClose={() => setShowAppearance(false)}
        />
      )}

      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder='Referencia rápida — ej. "Juan 3:16" o "Jn 3:16-17"'
            value={search}
            onChange={(e) => void runSearch(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setPaletteSeed('')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          title="Búsqueda rápida por teclado — o empezá a escribir el nombre del libro"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Escribí para buscar
        </button>
        <button
          type="button"
          onClick={() => setShowAppearance(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          title="Fuente, tamaño, color y fondo de los versículos proyectados"
        >
          <Palette className="h-3.5 w-3.5" />
          Apariencia
        </button>
        <div className="flex items-center gap-1">
          {versions.map((v) => {
            const isActive = v.version === selectedVersion
            const isDefault = v.version === defaultVersion
            return (
              // items-stretch: ambos segmentos de la píldora con la misma altura
              // (con items-center el botón de la estrella quedaba más bajo).
              <div
                key={v.version}
                className={`flex items-stretch overflow-hidden rounded ${
                  isActive ? 'ring-1 ring-blue-500' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedVersion(v.version)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title={v.name}
                >
                  {v.version}
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultVersion(v.version)}
                  className={`flex items-center px-1.5 transition-colors ${
                    isActive ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                  title={
                    isDefault
                      ? 'Versión predeterminada — clic para quitar'
                      : 'Fijar como versión predeterminada'
                  }
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      isDefault ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Aviso de referencia inválida (capítulo/versículo inexistente) */}
      {searchNotice && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {searchNotice}
        </div>
      )}

      {/* Recent verses */}
      {history.length > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800/20 px-4 py-2">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <History className="h-3.5 w-3.5" />
            Recientes
          </span>
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {history.map((e) => (
              <div
                key={historyKey(e)}
                className="group flex shrink-0 items-center rounded-full border border-slate-700 bg-slate-900/60 hover:border-slate-500"
              >
                <button
                  type="button"
                  onClick={() =>
                    void openReference(
                      {
                        version: e.version,
                        bookId: e.bookId,
                        chapter: e.chapter,
                        verse: e.verse,
                        endVerse: e.endVerse
                      },
                      { bookName: e.bookName, text: e.text }
                    )
                  }
                  className="py-0.5 pl-2.5 pr-1.5 text-xs text-slate-300 group-hover:text-white"
                  title={`${e.version} · ${new Date(e.ts).toLocaleString()}`}
                >
                  {e.bookName} {e.chapter}:{e.verse}
                  {e.endVerse ? `-${e.endVerse}` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => removeHistory(historyKey(e))}
                  className="pr-1.5 text-slate-600 hover:text-red-400"
                  title="Quitar del historial"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => clearHistory()}
            className="shrink-0 rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-700 hover:text-red-400"
            title="Limpiar todo el historial"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Search results */}
      {searchHits && searchHits.length > 0 && (
        <div className="border-b border-slate-700 bg-slate-800/30 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Resultados
          </p>
          <ul className="space-y-2">
            {searchHits.map((hit) => (
              <li
                key={`${hit.version.version}-${hit.bookId}-${hit.chapter}-${hit.verse}`}
                className="rounded-md border border-slate-700 bg-slate-900/60 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">
                    {hit.bookName} {hit.chapter}:{hit.verse}
                    {hit.endVerse ? `-${hit.endVerse}` : ''}
                    <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-normal text-slate-300">
                      {hit.version.version}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => projectVerse(hit)}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    <Eye className="h-3 w-3" />
                    Proyectar
                  </button>
                </div>
                <p className="text-sm text-slate-200">{hit.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigator */}
      <div className="flex flex-1 overflow-hidden">
        {/* Books */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-700">
          <BookList selectedId={selectedBookId} onSelect={setSelectedBookId} />
        </aside>

        {/* Chapters + verses */}
        <section className="flex flex-1 overflow-hidden">
          <div className="flex w-48 shrink-0 flex-col overflow-y-auto border-r border-slate-700 p-2">
            <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              Capítulos
            </p>
            <div className="grid grid-cols-5 gap-1">
              {book &&
                Array.from(
                  // Capítulos reales de la versión cargada (la metadata como respaldo).
                  { length: bookStats?.[book.id]?.length ?? book.chapters },
                  (_, i) => i + 1
                ).map((c) => {
                  const isActive = c === selectedChapter
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSelectedChapter(c)
                        setChosenVerse(null)
                      }}
                      className={`rounded text-xs leading-7 transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {c}
                    </button>
                  )
                })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              {book?.name} {selectedChapter}{' '}
              <span className="text-slate-600">· {selectedVersion}</span>
            </p>
            {verses.length === 0 ? (
              <p className="text-sm text-slate-500">Sin contenido.</p>
            ) : (
              <ul className="space-y-1">
                {verses.map((v) => {
                  const isActive = v.number === chosenVerse
                  return (
                    <li key={v.number} id={`bible-verse-${v.number}`}>
                      <button
                        type="button"
                        onClick={() => projectChapterVerse(v.number)}
                        className={`group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                          isActive
                            ? 'bg-red-500/10 ring-1 ring-red-500/40'
                            : 'hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`shrink-0 font-mono text-xs ${
                            isActive ? 'text-red-300' : 'text-slate-500'
                          }`}
                        >
                          {v.number}
                        </span>
                        <span className="text-sm text-slate-200">{v.text}</span>
                        <Eye
                          className={`mt-0.5 ml-auto h-3 w-3 shrink-0 ${
                            isActive ? 'text-red-400' : 'text-slate-700 group-hover:text-slate-400'
                          }`}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

interface BookListProps {
  selectedId: string
  onSelect: (id: string) => void
}

function BookList({ selectedId, onSelect }: BookListProps) {
  const ot = BIBLE_BOOKS.filter((b) => b.testament === 'OT')
  const nt = BIBLE_BOOKS.filter((b) => b.testament === 'NT')

  return (
    <nav className="p-2">
      <BookGroup label="Antiguo Testamento" books={ot} selectedId={selectedId} onSelect={onSelect} />
      <BookGroup
        label="Nuevo Testamento"
        books={nt}
        selectedId={selectedId}
        onSelect={onSelect}
        className="mt-3"
      />
    </nav>
  )
}

interface BookGroupProps {
  label: string
  books: BookMeta[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

function BookGroup({ label, books, selectedId, onSelect, className }: BookGroupProps) {
  return (
    <div className={className}>
      <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <ul>
        {books.map((b) => {
          const isActive = b.id === selectedId
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{b.name}</span>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-600">
                  {b.id}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
