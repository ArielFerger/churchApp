import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, Save, Pencil, Eye } from 'lucide-react'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useLiveStore } from '@/shared/store/liveStore'
import type { Song, SongSection, Slide } from '@/shared/types/song'
import type { ProjectionCommand } from '@/shared/types/ipc'
import { flattenSong, songMatches, type PlaySlide } from '@/shared/utils/songParser'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

function blankSection(): SongSection {
  return {
    id: `sec-${cryptoRandom()}`,
    type: 'verse',
    label: 'Sección',
    slides: [{ id: `sl-${cryptoRandom()}`, lines: [''] }]
  }
}

function blankSong(): Song {
  const section = blankSection()
  return {
    id: '',
    title: '',
    author: '',
    tags: [],
    language: 'es',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [section],
    order: [section.id]
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10)
}

export default function Songs() {
  const { songs, songsLoaded, loadSongs, subscribeSongs, saveSong, deleteSong } = useLibraryStore()
  const lastCommand = useLiveStore((s) => s.lastCommand)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Song | null>(null)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void loadSongs()
    const unsub = subscribeSongs()
    return unsub
  }, [loadSongs, subscribeSongs])

  // Sync the draft when the selected song changes from outside (e.g. file watcher)
  useEffect(() => {
    if (!selectedId) {
      setDraft(null)
      setEditing(false)
      return
    }
    const found = songs.find((s) => s.id === selectedId) ?? null
    setDraft(found ? structuredClone(found) : null)
  }, [selectedId, songs])

  const filtered = useMemo(() => songs.filter((s) => songMatches(s, query)), [songs, query])

  const deck = useMemo<PlaySlide[]>(() => (draft ? flattenSong(draft) : []), [draft])

  const currentSlideKey = useMemo(() => {
    if (!lastCommand || lastCommand.type !== 'showSlide') return null
    return lastCommand.content.sectionLabel && deck.length > 0
      ? deck.find(
          (p) =>
            p.sectionLabel === lastCommand.content.sectionLabel &&
            p.slide.lines.join('|') === lastCommand.content.lines.join('|')
        )?.key ?? null
      : null
  }, [lastCommand, deck])

  const currentIndex = useMemo(
    () => (currentSlideKey ? deck.findIndex((p) => p.key === currentSlideKey) : -1),
    [currentSlideKey, deck]
  )

  function projectSlide(play: PlaySlide, songTitle: string) {
    send({
      type: 'showSlide',
      content: {
        lines: play.slide.lines,
        songTitle,
        sectionLabel: play.sectionLabel
      }
    })
  }

  function step(dir: -1 | 1) {
    if (!draft || deck.length === 0) return
    const next = currentIndex < 0 ? (dir === 1 ? 0 : deck.length - 1) : currentIndex + dir
    if (next < 0 || next >= deck.length) return
    projectSlide(deck[next], draft.title)
  }

  async function handleSave() {
    if (!draft || !draft.title.trim()) return
    const saved = await saveSong(draft)
    if (saved) {
      setSelectedId(saved.id)
      setEditing(false)
    }
  }

  function handleNew() {
    const blank = blankSong()
    setDraft(blank)
    setSelectedId(null)
    setEditing(true)
  }

  async function handleDelete() {
    if (!selectedId) return
    if (!confirm('¿Borrar esta canción?')) return
    await deleteSong(selectedId)
    setSelectedId(null)
    setDraft(null)
  }

  return (
    <div className="flex h-full">
      {/* List + search */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-700">
        <div className="border-b border-slate-700 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleNew}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva canción
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-1">
          {!songsLoaded && <li className="p-2 text-xs text-slate-500">Cargando…</li>}
          {songsLoaded && filtered.length === 0 && (
            <li className="p-2 text-xs text-slate-500">
              {songs.length === 0 ? 'Aún no hay canciones.' : 'Sin resultados.'}
            </li>
          )}
          {filtered.map((s) => {
            const isSelected = s.id === selectedId
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate font-medium">{s.title}</span>
                  {s.author && (
                    <span className="truncate text-xs text-slate-500">{s.author}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Right: editor + deck */}
      <section className="flex flex-1 flex-col overflow-hidden">
        {!draft ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">
              Seleccioná una canción o creá una nueva.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-2">
              {editing ? (
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Título"
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-lg font-semibold focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h1 className="flex-1 text-lg font-semibold">{draft.title || '(sin título)'}</h1>
              )}

              {editing ? (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!draft.title.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
              )}

              {selectedId && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                  title="Borrar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </header>

            <div className="flex flex-1 overflow-hidden">
              <SlideDeck
                deck={deck}
                currentKey={currentSlideKey}
                onPick={(p) => projectSlide(p, draft.title)}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
              />
              {editing && (
                <Editor draft={draft} onChange={setDraft} />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

interface DeckProps {
  deck: PlaySlide[]
  currentKey: string | null
  onPick: (p: PlaySlide) => void
  onPrev: () => void
  onNext: () => void
}

function SlideDeck({ deck, currentKey, onPick, onPrev, onNext }: DeckProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-xs text-slate-500">
        <span>Slides ({deck.length})</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={deck.length === 0}
            className="rounded p-1 hover:bg-slate-800 disabled:opacity-30"
            title="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={deck.length === 0}
            className="rounded p-1 hover:bg-slate-800 disabled:opacity-30"
            title="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ul className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 xl:grid-cols-3">
        {deck.length === 0 && (
          <li className="col-span-full mt-8 text-center text-xs text-slate-500">
            Esta canción aún no tiene slides.
          </li>
        )}
        {deck.map((p) => {
          const isCurrent = p.key === currentKey
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className={`flex h-full w-full flex-col items-start rounded-md border p-3 text-left transition-colors ${
                  isCurrent
                    ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/50'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
                }`}
              >
                <div className="mb-2 flex w-full items-center justify-between gap-2">
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-300">
                    {p.sectionLabel}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      <Eye className="h-2.5 w-2.5" /> LIVE
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {p.slide.lines.map((line, i) => (
                    <p key={i} className="text-sm text-slate-100">
                      {line || <span className="text-slate-600">(vacío)</span>}
                    </p>
                  ))}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface EditorProps {
  draft: Song
  onChange: (s: Song) => void
}

function Editor({ draft, onChange }: EditorProps) {
  function updateSection(secId: string, fn: (s: SongSection) => SongSection) {
    onChange({
      ...draft,
      sections: draft.sections.map((s) => (s.id === secId ? fn(s) : s))
    })
  }

  function addSection() {
    const sec = blankSection()
    onChange({
      ...draft,
      sections: [...draft.sections, sec],
      order: [...draft.order, sec.id]
    })
  }

  function removeSection(secId: string) {
    onChange({
      ...draft,
      sections: draft.sections.filter((s) => s.id !== secId),
      order: draft.order.filter((id) => id !== secId)
    })
  }

  function addSlide(secId: string) {
    updateSection(secId, (s) => ({
      ...s,
      slides: [...s.slides, { id: `sl-${cryptoRandom()}`, lines: [''] }]
    }))
  }

  function updateSlide(secId: string, slideId: string, fn: (s: Slide) => Slide) {
    updateSection(secId, (s) => ({
      ...s,
      slides: s.slides.map((sl) => (sl.id === slideId ? fn(sl) : sl))
    }))
  }

  function removeSlide(secId: string, slideId: string) {
    updateSection(secId, (s) => ({ ...s, slides: s.slides.filter((sl) => sl.id !== slideId) }))
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-700 bg-slate-900/40">
      <div className="space-y-3 border-b border-slate-700 p-3">
        <Field label="Autor">
          <input
            value={draft.author ?? ''}
            onChange={(e) => onChange({ ...draft, author: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </Field>
        <Field label="Tags (separar por coma)">
          <input
            value={draft.tags.join(', ')}
            onChange={(e) =>
              onChange({
                ...draft,
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              })
            }
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </Field>
        <Field label="Orden (ids de sección separados por coma)">
          <input
            value={draft.order.join(', ')}
            onChange={(e) =>
              onChange({
                ...draft,
                order: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              })
            }
            placeholder={draft.sections.map((s) => s.id).join(', ')}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs focus:border-blue-500 focus:outline-none"
          />
        </Field>
      </div>

      <div className="space-y-3 p-3">
        {draft.sections.map((sec) => (
          <div
            key={sec.id}
            className="rounded-md border border-slate-700 bg-slate-800/40 p-2"
          >
            <div className="mb-2 flex items-center gap-2">
              <select
                value={sec.type}
                onChange={(e) =>
                  updateSection(sec.id, (s) => ({
                    ...s,
                    type: e.target.value as SongSection['type']
                  }))
                }
                className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
              >
                {(['verse', 'chorus', 'bridge', 'intro', 'outro', 'tag'] as const).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={sec.label}
                onChange={(e) => updateSection(sec.id, (s) => ({ ...s, label: e.target.value }))}
                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
              />
              <span className="font-mono text-[10px] text-slate-600">{sec.id}</span>
              <button
                type="button"
                onClick={() => removeSection(sec.id)}
                className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                title="Borrar sección"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <ul className="space-y-2">
              {sec.slides.map((sl) => (
                <li key={sl.id} className="rounded bg-slate-900/60 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-600">{sl.id}</span>
                    <button
                      type="button"
                      onClick={() => removeSlide(sec.id, sl.id)}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <textarea
                    value={sl.lines.join('\n')}
                    onChange={(e) =>
                      updateSlide(sec.id, sl.id, (s) => ({
                        ...s,
                        lines: e.target.value.split('\n')
                      }))
                    }
                    rows={Math.max(2, sl.lines.length)}
                    placeholder="Una línea por fila"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => addSlide(sec.id)}
              className="mt-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100"
            >
              <Plus className="h-3 w-3" />
              Slide
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar sección
        </button>
      </div>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  )
}
