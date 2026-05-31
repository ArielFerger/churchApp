import { useEffect, useMemo, useState } from 'react'
import { Search, BookOpen, Eye } from 'lucide-react'
import { BIBLE_BOOKS, bookById, type BookMeta } from '@/shared/utils/bibleBooks'
import { parseReference } from '@/shared/utils/bibleParser'
import type { ProjectionCommand } from '@/shared/types/ipc'
import type {
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
  const [verses, setVerses] = useState<{ number: number; text: string }[]>([])
  const [chosenVerse, setChosenVerse] = useState<number | null>(null)

  // Load available versions on mount.
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.getBibleVersions().then((vs) => {
      setVersions(vs)
      if (vs.length > 0 && !selectedVersion) setSelectedVersion(vs[0].version)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const book = useMemo<BookMeta | null>(() => bookById(selectedBookId) ?? null, [selectedBookId])

  async function runSearch(raw: string): Promise<void> {
    setSearch(raw)
    const parsed = parseReference(raw)
    if (!parsed || !selectedVersion) {
      setSearchHits(null)
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
    setSearchHits(results.filter((r): r is BibleLookupResult => r !== null))
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
        <div className="flex items-center gap-1">
          {versions.map((v) => {
            const isActive = v.version === selectedVersion
            return (
              <button
                key={v.version}
                type="button"
                onClick={() => setSelectedVersion(v.version)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title={v.name}
              >
                {v.version}
              </button>
            )
          })}
        </div>
      </div>

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
                Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => {
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
                    <li key={v.number}>
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
