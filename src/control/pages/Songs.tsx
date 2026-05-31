import { useEffect, useMemo, useRef, useState } from 'react'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useLiveStore } from '@/shared/store/liveStore'
import type { Song } from '@/shared/types/song'
import type { ProjectionCommand } from '@/shared/types/ipc'
import {
  parseSongContent,
  songMatches,
  synthesizeContent,
  type ChordLine,
  type ChordWord,
  type ContentSlide
} from '@/shared/utils/songParser'

// ─────────────────────────────────────────────────────────────────────────────
// Songs page — warm "songbook" theme adapted from the user's reference mockup.
// Single-panel layout: header → albums chip row → songs chip row → editor
// section (when editing) → preview section with chord rendering + project btn.
// ─────────────────────────────────────────────────────────────────────────────

type View = 'editor' | 'perform'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

export default function Songs() {
  const {
    songs,
    songsLoaded,
    loadSongs,
    subscribeSongs,
    saveSong,
    deleteSong,
    albums,
    loadAlbums,
    subscribeAlbums,
    saveAlbum,
    deleteAlbum
  } = useLibraryStore()
  const lastCommand = useLiveStore((s) => s.lastCommand)

  const [currentSongId, setCurrentSongId] = useState<string | null>(null)
  const [view, setView] = useState<View>('editor')
  const [albumFilter, setAlbumFilter] = useState<string>('all') // 'all' | 'none' | albumId
  const [query, setQuery] = useState('')
  const [showChords, setShowChords] = useState(true)

  // Editor draft (controlled inputs)
  const [titleDraft, setTitleDraft] = useState('')
  const [authorDraft, setAuthorDraft] = useState('')
  const [albumDraft, setAlbumDraft] = useState<string>('')
  const [contentDraft, setContentDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Boot
  useEffect(() => {
    void loadSongs()
    void loadAlbums()
    const u1 = subscribeSongs()
    const u2 = subscribeAlbums()
    return () => {
      u1()
      u2()
    }
  }, [loadSongs, loadAlbums, subscribeSongs, subscribeAlbums])

  // Default-select first song once loaded
  useEffect(() => {
    if (!songsLoaded) return
    if (currentSongId && songs.find((s) => s.id === currentSongId)) return
    if (songs.length > 0) {
      const next = songs[0]
      setCurrentSongId(next.id)
    } else {
      setCurrentSongId(null)
    }
  }, [songsLoaded, songs, currentSongId])

  // Sync draft fields when current song changes (and we're not mid-edit)
  useEffect(() => {
    if (!currentSongId) {
      setTitleDraft('')
      setAuthorDraft('')
      setAlbumDraft('')
      setContentDraft('')
      setDirty(false)
      return
    }
    const s = songs.find((x) => x.id === currentSongId)
    if (!s) return
    setTitleDraft(s.title)
    setAuthorDraft(s.author ?? '')
    setAlbumDraft(s.albumId ?? '')
    setContentDraft(synthesizeContent(s))
    setDirty(false)
  }, [currentSongId, songs])

  // Derived: filtered songs based on album + query
  const filteredSongs = useMemo(() => {
    return songs
      .filter((s) => {
        if (albumFilter === 'all') return true
        if (albumFilter === 'none') return !s.albumId
        return s.albumId === albumFilter
      })
      .filter((s) => songMatches(s, query))
  }, [songs, albumFilter, query])

  const currentSong = currentSongId
    ? (songs.find((s) => s.id === currentSongId) ?? null)
    : null

  // Parse current content into slides for preview
  const slides = useMemo<ContentSlide[]>(
    () => parseSongContent(contentDraft),
    [contentDraft]
  )

  // Which slide is currently LIVE on the projector?
  const liveSlideKey = useMemo<string | null>(() => {
    if (!lastCommand || lastCommand.type !== 'showSlide') return null
    const live = lastCommand.content
    return (
      slides.find((sl) => sl.plainLines.join('|') === live.lines.join('|'))?.key ??
      null
    )
  }, [lastCommand, slides])

  // Counts per album
  const albumCounts = useMemo(() => {
    const all = songs.length
    const none = songs.filter((s) => !s.albumId).length
    const byAlbum = new Map<string, number>()
    for (const s of songs) {
      if (s.albumId) byAlbum.set(s.albumId, (byAlbum.get(s.albumId) ?? 0) + 1)
    }
    return { all, none, byAlbum }
  }, [songs])

  // ─── Actions ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!titleDraft.trim() && !contentDraft.trim()) return
    const base: Partial<Song> & { title: string } = {
      title: titleDraft.trim() || 'Sin título',
      author: authorDraft.trim() || undefined,
      albumId: albumDraft || null,
      content: contentDraft,
      tags: currentSong?.tags ?? [],
      language: currentSong?.language ?? 'es'
    }
    if (currentSong) base.id = currentSong.id
    const saved = await saveSong(base)
    if (saved) {
      setCurrentSongId(saved.id)
      setDirty(false)
      setSaveFlash(true)
      window.setTimeout(() => setSaveFlash(false), 1400)
    }
  }

  function handleNew() {
    const preselectAlbum =
      albumFilter !== 'all' && albumFilter !== 'none' ? albumFilter : ''
    setCurrentSongId(null)
    setTitleDraft('')
    setAuthorDraft('')
    setAlbumDraft(preselectAlbum)
    setContentDraft('')
    setDirty(true)
    setView('editor')
    // Focus title after paint
    window.setTimeout(() => {
      const el = document.getElementById('songTitleInput') as HTMLInputElement | null
      el?.focus()
    }, 0)
  }

  async function handleDelete() {
    if (!currentSong) return
    if (!confirm(`¿Eliminar "${currentSong.title}"?`)) return
    await deleteSong(currentSong.id)
    setCurrentSongId(null)
  }

  async function handleCreateAlbum() {
    const name = prompt('Nombre del nuevo álbum:')
    if (!name || !name.trim()) return
    const saved = await saveAlbum({ name: name.trim() })
    if (saved) setAlbumFilter(saved.id)
  }

  async function handleRenameAlbum() {
    if (albumFilter === 'all' || albumFilter === 'none') return
    const current = albums.find((a) => a.id === albumFilter)
    if (!current) return
    const name = prompt('Nuevo nombre:', current.name)
    if (!name || !name.trim() || name === current.name) return
    await saveAlbum({ id: current.id, name: name.trim() })
  }

  async function handleDeleteAlbum() {
    if (albumFilter === 'all' || albumFilter === 'none') return
    const current = albums.find((a) => a.id === albumFilter)
    if (!current) return
    if (
      !confirm(
        `¿Eliminar el álbum "${current.name}"?\nLas canciones se conservan pero quedan "sin álbum".`
      )
    )
      return
    await deleteAlbum(current.id)
    setAlbumFilter('all')
  }

  function projectSlide(slide: ContentSlide, songTitle: string) {
    send({
      type: 'showSlide',
      content: {
        lines: slide.plainLines,
        songTitle,
        sectionLabel: `Slide ${slide.index + 1}`
      }
    })
  }

  function projectClear() {
    send({ type: 'clear' })
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="songbook h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-6 pb-24 pt-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-songbook-border-soft pb-5">
          <div>
            <h1 className="font-serif text-4xl italic leading-none tracking-tight">
              Cancion<span className="text-songbook-amber">ero</span>
            </h1>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-songbook-ink-faint">
              Letras · Acordes · Proyección
            </p>
          </div>
          <ViewSwitch view={view} onChange={setView} />
        </header>

        {/* Album chips */}
        <Section label="Álbumes">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip
              selected={albumFilter === 'all'}
              onClick={() => setAlbumFilter('all')}
              label="Todas"
              count={albumCounts.all}
            />
            <Chip
              selected={albumFilter === 'none'}
              onClick={() => setAlbumFilter('none')}
              label="Sin álbum"
              count={albumCounts.none}
            />
            {albums.map((a) => (
              <Chip
                key={a.id}
                variant="album"
                selected={albumFilter === a.id}
                onClick={() => setAlbumFilter(a.id)}
                label={a.name}
                count={albumCounts.byAlbum.get(a.id) ?? 0}
              />
            ))}
            <ActionChip onClick={handleCreateAlbum}>＋ Nuevo álbum</ActionChip>
            {albumFilter !== 'all' && albumFilter !== 'none' && (
              <>
                <ActionChip onClick={handleRenameAlbum}>✎ Renombrar</ActionChip>
                <ActionChip danger onClick={handleDeleteAlbum}>
                  ✕ Eliminar álbum
                </ActionChip>
              </>
            )}
          </div>
        </Section>

        {/* Song chips */}
        <Section
          label="Canciones"
          aside={
            <div className="flex items-center gap-2">
              <SearchInput value={query} onChange={setQuery} />
              <button type="button" className="btn-soft" onClick={handleNew}>
                ＋ Nueva canción
              </button>
            </div>
          }
        >
          <div className="mt-3 flex flex-wrap gap-2">
            {!songsLoaded && (
              <p className="empty-state">Cargando canciones…</p>
            )}
            {songsLoaded && filteredSongs.length === 0 && (
              <p className="empty-state">
                {songs.length === 0
                  ? 'No hay canciones todavía.'
                  : 'No hay canciones en este filtro.'}
              </p>
            )}
            {filteredSongs.map((s) => (
              <Chip
                key={s.id}
                selected={s.id === currentSongId}
                onClick={() => setCurrentSongId(s.id)}
                label={s.title || 'Sin título'}
              />
            ))}
          </div>
        </Section>

        {/* Editor / Perform views */}
        {view === 'editor' ? (
          <Section label="Editando">
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px]">
              <input
                id="songTitleInput"
                type="text"
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value)
                  setDirty(true)
                }}
                placeholder="Nombre de la canción"
                className="input-base font-serif text-lg italic"
              />
              <select
                value={albumDraft}
                onChange={(e) => {
                  setAlbumDraft(e.target.value)
                  setDirty(true)
                }}
                className="input-base"
              >
                <option value="">Sin álbum</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <input
                type="text"
                value={authorDraft}
                onChange={(e) => {
                  setAuthorDraft(e.target.value)
                  setDirty(true)
                }}
                placeholder="Autor (opcional)"
                className="input-base"
              />
            </div>

            <div className="mt-3">
              <textarea
                ref={textareaRef}
                value={contentDraft}
                onChange={(e) => {
                  setContentDraft(e.target.value)
                  setDirty(true)
                }}
                placeholder={'[Am]Esta es la [C]letra\nlínea 2…\n\n[F]Nueva estrofa…'}
                className="input-base min-h-[280px] resize-y font-mono text-sm leading-relaxed"
                spellCheck={false}
              />
              <p className="mt-3 font-serif text-[15px] italic leading-relaxed text-songbook-ink-dim">
                Acordes entre corchetes en la posición exacta donde tocan:{' '}
                <code className="rounded bg-songbook-sage/15 px-1.5 py-[0.1rem] font-mono text-[0.78em] not-italic text-songbook-sage">
                  que ge[Am]nial, est[A]a canción
                </code>
                . Una línea en blanco separa slides para proyectar.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleSave()}
                disabled={!dirty && !!currentSong}
              >
                {saveFlash ? '✓ Guardado' : 'Guardar'}
              </button>
              {currentSong && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => void handleDelete()}
                >
                  Eliminar canción
                </button>
              )}
              <button
                type="button"
                className="btn-soft ml-auto"
                onClick={() => setView('perform')}
                disabled={!currentSong && slides.length === 0}
              >
                Pasar a Tocar →
              </button>
            </div>
          </Section>
        ) : (
          <PerformanceView
            song={
              currentSong ?? {
                id: 'draft',
                title: titleDraft || 'Sin título',
                tags: [],
                language: 'es',
                createdAt: '',
                updatedAt: ''
              }
            }
            content={contentDraft}
            slides={slides}
            showChords={showChords}
            onToggleChords={setShowChords}
            liveSlideKey={liveSlideKey}
            onProject={(s) => projectSlide(s, titleDraft || 'Sin título')}
            onClear={projectClear}
            albumName={albums.find((a) => a.id === albumDraft)?.name ?? null}
          />
        )}
      </div>

      {/* Local styles — utility classes scoped to the songbook theme. */}
      <style>{songbookCss}</style>
    </div>
  )
}

// ─── PerformanceView ─────────────────────────────────────────────────────────
interface PerfProps {
  song: Song
  content: string
  slides: ContentSlide[]
  showChords: boolean
  onToggleChords: (v: boolean) => void
  liveSlideKey: string | null
  onProject: (slide: ContentSlide) => void
  onClear: () => void
  albumName: string | null
}

function PerformanceView({
  song,
  slides,
  showChords,
  onToggleChords,
  liveSlideKey,
  onProject,
  onClear,
  albumName
}: PerfProps) {
  return (
    <Section label="Tocar">
      <div className="perf-bar mt-3">
        <div className="now-playing">
          <strong>{song.title || 'Sin título'}</strong>
          {albumName && <> · {albumName}</>}
        </div>
        <div className="divider" />
        <div className="chord-toggle">
          <button
            type="button"
            className={showChords ? 'active' : ''}
            onClick={() => onToggleChords(true)}
          >
            Con acordes
          </button>
          <button
            type="button"
            className={!showChords ? 'active' : ''}
            onClick={() => onToggleChords(false)}
          >
            Sin acordes
          </button>
        </div>
        <button type="button" className="btn-soft ml-auto" onClick={onClear}>
          ⌫ Limpiar
        </button>
      </div>

      {slides.length === 0 ? (
        <p className="empty-state mt-6 text-center">
          Esta canción aún no tiene letra. Volvé al editor para agregar el contenido.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {slides.map((slide) => (
            <SlideCard
              key={slide.key}
              slide={slide}
              showChords={showChords}
              isLive={slide.key === liveSlideKey}
              onProject={() => onProject(slide)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 text-center font-serif text-[13px] italic text-songbook-ink-faint">
        Click en una tarjeta para proyectarla. Los acordes son sólo para el
        operador — la proyección siempre va sin acordes.
      </div>
    </Section>
  )
}

// ─── SlideCard ───────────────────────────────────────────────────────────────
function SlideCard({
  slide,
  showChords,
  isLive,
  onProject
}: {
  slide: ContentSlide
  showChords: boolean
  isLive: boolean
  onProject: () => void
}) {
  return (
    <button
      type="button"
      onClick={onProject}
      className={`slide-card text-left ${isLive ? 'is-live' : ''} ${showChords ? '' : 'no-chords'}`}
    >
      <div className="slide-card-header">
        <span className="slide-card-index">Slide {slide.index + 1}</span>
        {isLive && <span className="live-pip">● LIVE</span>}
      </div>
      <div className="lyrics-stage">
        {slide.lines.map((line, li) => (
          <LineView key={li} line={line} />
        ))}
      </div>
    </button>
  )
}

function LineView({ line }: { line: ChordLine }) {
  if (line.isBlank) return <div className="lyrics-line is-blank" />
  return (
    <div className="lyrics-line">
      {line.words.map((word, wi) => (
        <WordView key={wi} word={word} />
      ))}
    </div>
  )
}

function WordView({ word }: { word: ChordWord }) {
  return (
    <span className="word">
      {word.parts.map((part, pi) => (
        <span className="part" key={pi}>
          <span className="chord">{part.chord ?? ' '}</span>
          <span className="text">{part.text}</span>
        </span>
      ))}
    </span>
  )
}

// ─── Small primitives ────────────────────────────────────────────────────────
function Section({
  label,
  aside,
  children
}: {
  label: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="songbook-panel mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="field-label">{label}</p>
        {aside}
      </div>
      {children}
    </section>
  )
}

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="view-switch">
      <button
        type="button"
        className={view === 'editor' ? 'active' : ''}
        onClick={() => onChange('editor')}
      >
        Editar
      </button>
      <button
        type="button"
        className={view === 'perform' ? 'active' : ''}
        onClick={() => onChange('perform')}
      >
        Tocar
      </button>
    </div>
  )
}

function Chip({
  label,
  count,
  selected,
  variant,
  onClick
}: {
  label: string
  count?: number
  selected?: boolean
  variant?: 'default' | 'album'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${selected ? 'selected' : ''} ${variant === 'album' ? 'is-album' : ''}`}
    >
      {label}
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  )
}

function ActionChip({
  children,
  onClick,
  danger
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip action ${danger ? 'is-danger' : ''}`}
    >
      {children}
    </button>
  )
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="search"
      placeholder="Buscar…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-base h-9 max-w-[200px] py-1.5 text-sm"
    />
  )
}

// ─── Styles (scoped to .songbook root) ───────────────────────────────────────
const songbookCss = `
.songbook {
  /* Warm gradient overlay over the slate-900 app shell */
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(245, 179, 66, 0.08), transparent 70%),
    radial-gradient(ellipse 60% 80% at 80% 100%, rgba(201, 117, 84, 0.05), transparent 60%),
    #14100c;
  color: #f0e3cd;
  font-family: 'Manrope', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.songbook .field-label {
  font-size: 0.72rem;
  color: rgba(240, 227, 205, 0.28);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 600;
}

.songbook .songbook-panel {
  background: rgba(245, 226, 196, 0.04);
  border: 1px solid rgba(245, 226, 196, 0.08);
  border-radius: 14px;
  padding: 1.4rem 1.4rem 1.5rem;
  backdrop-filter: blur(6px);
}

.songbook .view-switch {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(245, 226, 196, 0.08);
  border-radius: 999px;
  padding: 4px;
}
.songbook .view-switch button {
  background: transparent;
  border: none;
  color: rgba(240, 227, 205, 0.55);
  font-family: 'Manrope', sans-serif;
  font-weight: 600;
  font-size: 0.82rem;
  padding: 0.55rem 1.15rem;
  border-radius: 999px;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
}
.songbook .view-switch button.active { background: #f5b342; color: #14100c; }
.songbook .view-switch button:not(.active):hover { color: #f0e3cd; }

.songbook .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.95rem;
  background: rgba(245, 226, 196, 0.04);
  border: 1px solid rgba(245, 226, 196, 0.08);
  border-radius: 999px;
  cursor: pointer;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 0.92rem;
  font-style: italic;
  color: rgba(240, 227, 205, 0.55);
  transition: all 0.2s;
}
.songbook .chip:hover { color: #f0e3cd; border-color: rgba(245, 226, 196, 0.18); }
.songbook .chip.selected {
  background: rgba(245, 179, 66, 0.12);
  border-color: #f5b342;
  color: #f5b342;
}
.songbook .chip.is-album.selected {
  background: rgba(143, 185, 138, 0.12);
  border-color: #8fb98a;
  color: #8fb98a;
}
.songbook .chip-count {
  font-family: 'JetBrains Mono', monospace;
  font-style: normal;
  font-size: 0.72em;
  opacity: 0.6;
}
.songbook .chip.action {
  border-style: dashed;
  color: rgba(240, 227, 205, 0.28);
  font-style: normal;
  font-family: 'Manrope', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}
.songbook .chip.action:hover { color: #f5b342; border-color: #f5b342; }
.songbook .chip.action.is-danger {
  color: rgba(214, 90, 74, 0.85);
  border-color: rgba(214, 90, 74, 0.4);
}
.songbook .chip.action.is-danger:hover {
  background: rgba(214, 90, 74, 0.12);
  color: #d65a4a;
}

.songbook .input-base {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(245, 226, 196, 0.08);
  color: #f0e3cd;
  padding: 0.7rem 0.95rem;
  border-radius: 8px;
  font-family: 'Manrope', sans-serif;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}
.songbook .input-base::placeholder { color: rgba(240, 227, 205, 0.28); }
.songbook .input-base:focus { border-color: #f5b342; }
.songbook textarea.input-base {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.88rem;
  line-height: 1.7;
}
.songbook select.input-base {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path fill='%23f0e3cd' opacity='0.6' d='M2 4l4 4 4-4z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 0.9rem center;
  padding-right: 2.2rem;
  cursor: pointer;
}
.songbook select.input-base option { background: #1c1611; color: #f0e3cd; }

.songbook .btn-primary,
.songbook .btn-soft,
.songbook .btn-danger {
  border: 1px solid rgba(245, 226, 196, 0.18);
  padding: 0.55rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Manrope', sans-serif;
  font-weight: 500;
  font-size: 0.85rem;
  letter-spacing: 0.01em;
  transition: all 0.2s;
}
.songbook .btn-primary {
  background: #f5b342;
  color: #14100c;
  border-color: #f5b342;
  font-weight: 600;
}
.songbook .btn-primary:hover { background: #d4954a; border-color: #d4954a; }
.songbook .btn-primary:disabled {
  background: rgba(245, 179, 66, 0.3);
  border-color: rgba(245, 179, 66, 0.3);
  color: rgba(20, 16, 12, 0.5);
  cursor: not-allowed;
}
.songbook .btn-soft {
  background: transparent;
  color: #f0e3cd;
}
.songbook .btn-soft:hover {
  background: rgba(245, 226, 196, 0.06);
  border-color: rgba(245, 226, 196, 0.3);
}
.songbook .btn-soft:disabled { opacity: 0.4; cursor: not-allowed; }
.songbook .btn-danger {
  background: transparent;
  color: #d65a4a;
  border-color: rgba(214, 90, 74, 0.4);
}
.songbook .btn-danger:hover { background: rgba(214, 90, 74, 0.12); }

.songbook .empty-state {
  font-family: 'Fraunces', Georgia, serif;
  font-style: italic;
  color: rgba(240, 227, 205, 0.28);
  font-size: 0.95rem;
}

.songbook .perf-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(245, 226, 196, 0.08);
  border-radius: 12px;
}
.songbook .now-playing {
  font-family: 'Fraunces', Georgia, serif;
  font-style: italic;
  color: rgba(240, 227, 205, 0.55);
  font-size: 0.95rem;
}
.songbook .now-playing strong { color: #f0e3cd; font-weight: 400; }
.songbook .divider { width: 1px; height: 24px; background: rgba(245, 226, 196, 0.08); }

.songbook .chord-toggle {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(245, 226, 196, 0.08);
  border-radius: 8px;
  padding: 3px;
}
.songbook .chord-toggle button {
  background: transparent;
  border: none;
  color: rgba(240, 227, 205, 0.55);
  font-family: 'Manrope', sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
}
.songbook .chord-toggle button.active { background: #8fb98a; color: #14100c; }

/* Slide cards */
.songbook .slide-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(245, 226, 196, 0.08);
  border-radius: 12px;
  padding: 0.9rem 1.1rem 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  min-height: 140px;
}
.songbook .slide-card:hover {
  border-color: rgba(245, 226, 196, 0.18);
  background: rgba(0, 0, 0, 0.32);
}
.songbook .slide-card.is-live {
  border-color: rgba(214, 90, 74, 0.7);
  box-shadow: 0 0 0 1px rgba(214, 90, 74, 0.35), 0 8px 32px -12px rgba(214, 90, 74, 0.4);
}
.songbook .slide-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.songbook .slide-card-index {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: rgba(240, 227, 205, 0.28);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.songbook .live-pip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 600;
  color: #fff;
  background: #d65a4a;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  letter-spacing: 0.1em;
}

/* Lyrics rendering */
.songbook .lyrics-stage {
  padding-top: 0.5rem;
}
.songbook .lyrics-line {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 400;
  font-size: 1.1rem;
  line-height: 2.2;
  margin-bottom: 0.2rem;
  padding: 0.1rem 0.2rem;
  border-radius: 4px;
}
.songbook .lyrics-line.is-blank { height: 0.6rem; margin: 0; padding: 0; }
.songbook .word {
  display: inline-flex;
  align-items: flex-end;
  vertical-align: bottom;
  margin-right: 0.35rem;
}
.songbook .part {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1;
}
.songbook .part .chord {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 0.5em;
  color: #8fb98a;
  letter-spacing: 0.04em;
  height: 1.4em;
  line-height: 1.4em;
  margin-bottom: 0.1em;
  text-shadow: 0 0 12px rgba(143, 185, 138, 0.3);
  white-space: nowrap;
  min-width: 1px;
}
.songbook .part .text {
  line-height: 1.15;
  white-space: pre;
  color: #f0e3cd;
}
.songbook .slide-card.no-chords .part .chord { display: none; }
`
