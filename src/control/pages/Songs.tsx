import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTransientMessage } from '../hooks/useTransientMessage'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useLiveStore } from '@/shared/store/liveStore'
import type { Song } from '@/shared/types/song'
import type { ProjectionCommand } from '@/shared/types/ipc'
import {
  decodeSongFile,
  normalizeImportedText,
  parseSongContent,
  songMatches,
  synthesizeContent,
  titleFromFileName,
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

/**
 * Ancho de columna del mazo. Cuanto más chico, más pedacitos de canción entran
 * en pantalla — que es lo que se quiere mientras se dirige la reunión.
 */
const DENSITIES = [
  { id: 'xs', label: 'XS', col: 150, font: 0.76 },
  { id: 's', label: 'S', col: 190, font: 0.86 },
  { id: 'm', label: 'M', col: 250, font: 0.98 },
  { id: 'l', label: 'L', col: 330, font: 1.12 }
] as const

type DensityId = (typeof DENSITIES)[number]['id']
const DENSITY_KEY = 'songs.deckDensity'

function loadDensity(): DensityId {
  const saved = localStorage.getItem(DENSITY_KEY)
  return DENSITIES.some((d) => d.id === saved) ? (saved as DensityId) : 's'
}

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
  const [view, setView] = useState<View>('perform')
  const [albumFilter, setAlbumFilter] = useState<string>('all') // 'all' | 'none' | albumId
  const [query, setQuery] = useState('')
  const [showChords, setShowChords] = useState(true)
  const [density, setDensity] = useState<DensityId>(loadDensity)

  // Editor draft (controlled inputs)
  const [titleDraft, setTitleDraft] = useState('')
  const [authorDraft, setAuthorDraft] = useState('')
  const [albumDraft, setAlbumDraft] = useState<string>('')
  const [contentDraft, setContentDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveFlash, mostrarGuardado] = useTransientMessage()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Importación de .txt
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importMsg, setImportMsg] = useTransientMessage()
  const [dragging, setDragging] = useState(false)

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
  const bootedRef = useRef(false)
  useEffect(() => {
    if (!songsLoaded) return
    // Con la biblioteca vacía no hay nada que tocar: arrancar en el editor.
    if (!bootedRef.current) {
      bootedRef.current = true
      if (songs.length === 0) setView('editor')
    }
    if (currentSongId && songs.find((s) => s.id === currentSongId)) return
    setCurrentSongId(songs.length > 0 ? songs[0].id : null)
  }, [songsLoaded, songs, currentSongId])

  /**
   * Qué canción está cargada en el editor. Sirve para cargar los campos UNA
   * vez por canción: antes el efecto dependía de `songs` entero, así que
   * cualquier guardado (propio o de la otra ventana) pisaba lo que estabas
   * escribiendo en el medio.
   */
  const loadedRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (loadedRef.current === currentSongId) return
    if (!currentSongId) {
      // Borrador nuevo: handleNew ya dejó los campos como los quiere.
      loadedRef.current = null
      return
    }
    const s = songs.find((x) => x.id === currentSongId)
    if (!s) return
    setTitleDraft(s.title)
    setAuthorDraft(s.author ?? '')
    setAlbumDraft(s.albumId ?? '')
    setContentDraft(synthesizeContent(s))
    setDirty(false)
    loadedRef.current = currentSongId
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

  /** Slide sobre el que está parado el operador (lo que avanza con el teclado). */
  const [cursor, setCursor] = useState(0)
  useEffect(() => {
    setCursor(0)
  }, [currentSongId])

  /**
   * Qué slide está al aire. Se resuelve comparando la letra proyectada, pero
   * dando prioridad al cursor: un coro que se repite tiene dos slides con el
   * mismo texto y sin esto siempre se marcaría el primero.
   */
  const liveIndex = useMemo<number | null>(() => {
    if (!lastCommand || lastCommand.type !== 'showSlide') return null
    const live = lastCommand.content.lines.join('|')
    if (slides[cursor]?.plainLines.join('|') === live) return cursor
    const i = slides.findIndex((sl) => sl.plainLines.join('|') === live)
    return i === -1 ? null : i
  }, [lastCommand, slides, cursor])

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
      mostrarGuardado('✓ Guardado', 1400)
    }
  }

  /**
   * Autoguardado. Una vez que la canción existe, escribir no exige acordarse de
   * apretar Guardar. Las nuevas se crean a mano a propósito: si no, cualquier
   * tecla suelta dejaría borradores vacíos tirados en la biblioteca.
   */
  useEffect(() => {
    if (!dirty || !currentSong) return
    const t = window.setTimeout(() => void handleSave(), 900)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, titleDraft, authorDraft, albumDraft, contentDraft, currentSong])

  /** Cambiar de canción sin perder lo que se estaba escribiendo. */
  function selectSong(id: string) {
    if (id === currentSongId) return
    if (dirty && !confirm('Hay cambios sin guardar en esta canción. ¿Descartarlos?')) return
    setCurrentSongId(id)
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

  /**
   * Importar letras desde archivos `.txt`. Un txt ya es una canción: el nombre
   * del archivo pasa a ser el título y las líneas en blanco que ya trae el
   * texto separan los slides, que es como está escrita cualquier letra.
   */
  async function importTxtFiles(fileList: FileList | File[]) {
    const files = [...fileList].filter((f) => /\.txt$/i.test(f.name))
    if (files.length === 0) {
      setImportMsg('Sólo se pueden importar archivos .txt', 2600)
      return
    }
    const albumId =
      albumFilter !== 'all' && albumFilter !== 'none' ? albumFilter : null

    let first: Song | null = null
    let ok = 0
    const vacios: string[] = []
    for (let i = 0; i < files.length; i++) {
      setImportMsg(`Importando ${i + 1} de ${files.length}…`)
      const file = files[i]
      const bytes = new Uint8Array(await file.arrayBuffer())
      const content = normalizeImportedText(decodeSongFile(bytes))
      if (!content) {
        vacios.push(file.name)
        continue
      }
      const saved = await saveSong({
        title: titleFromFileName(file.name),
        content,
        albumId,
        tags: [],
        language: 'es'
      })
      if (saved) {
        ok += 1
        first ??= saved
      }
    }

    const partes = [`${ok} ${ok === 1 ? 'canción importada' : 'canciones importadas'}`]
    if (vacios.length) partes.push(`${vacios.length} vacío(s) salteado(s)`)
    setImportMsg(partes.join(' · '), 3600)

    // Saltar a la primera importada, salvo que haya algo sin guardar en curso.
    if (first && !dirty) {
      setCurrentSongId(first.id)
      setView('perform')
    }
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

  const songTitle = titleDraft || 'Sin título'

  const projectAt = useCallback(
    (index: number) => {
      const slide = slides[index]
      if (!slide) return
      setCursor(index)
      // A la pantalla va sólo la letra: ni el título ni el nombre de la parte.
      send({ type: 'showSlide', content: { lines: slide.plainLines } })
    },
    [slides]
  )

  const projectClear = useCallback(() => send({ type: 'clear' }), [])

  /**
   * Teclado del mazo. Dirigir una reunión con el mouse es incómodo: con las
   * flechas / barra espaciadora se pasa de slide sin soltar nada.
   */
  useEffect(() => {
    if (view !== 'perform') return
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const step = (delta: number): void => {
        e.preventDefault()
        const next = Math.min(slides.length - 1, Math.max(0, (liveIndex ?? cursor) + delta))
        projectAt(next)
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          return step(1)
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          return step(-1)
        case 'Home':
          e.preventDefault()
          return projectAt(0)
        case 'End':
          e.preventDefault()
          return projectAt(slides.length - 1)
        case 'Enter':
          e.preventDefault()
          return projectAt(cursor)
        case 'Escape':
          e.preventDefault()
          return projectClear()
        default:
          if (/^[1-9]$/.test(e.key)) {
            e.preventDefault()
            projectAt(Number(e.key) - 1)
          }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, slides.length, liveIndex, cursor, projectAt, projectClear])

  // ─── Render ────────────────────────────────────────────────────────────
  const perform = view === 'perform'

  return (
    <div
      className={`songbook h-full overflow-y-auto ${dragging ? 'is-dropping' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        // Sólo apagar cuando el puntero sale de verdad de la página, no al
        // cruzar de un hijo a otro.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(false)
        void importTxtFiles(e.dataTransfer.files)
      }}
    >
      <div className="mx-auto max-w-[1500px] px-6 pb-24 pt-5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void importTxtFiles(e.target.files)
            e.target.value = '' // permite reimportar el mismo archivo
          }}
        />
        {/* Header — en Tocar se achica: cada pixel de arriba es un pedacito de
            canción menos que entra en el mazo. */}
        <header
          className={`flex flex-wrap items-end justify-between gap-4 border-b border-cabina-linea ${
            perform ? 'mb-3 pb-3' : 'mb-6 pb-5'
          }`}
        >
          <div>
            <h1
              className={`font-serif italic leading-none tracking-tight ${
                perform ? 'text-2xl' : 'text-4xl'
              }`}
            >
              Cancion<span className="text-listo">ero</span>
            </h1>
            {!perform && (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-cabina-tinta-tenue">
                Letras · Acordes · Proyección
              </p>
            )}
          </div>
          <ViewSwitch view={view} onChange={setView} />
        </header>

        {/* Album chips — en Tocar viven como un desplegable dentro de Canciones */}
        {!perform && (
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
        )}

        {/* Song chips */}
        <Section
          label="Canciones"
          aside={
            <div className="flex items-center gap-2">
              {perform && (
                <select
                  value={albumFilter}
                  onChange={(e) => setAlbumFilter(e.target.value)}
                  className="input-base is-sm w-[150px]"
                  title="Filtrar por álbum"
                >
                  <option value="all">Todos ({albumCounts.all})</option>
                  <option value="none">Sin álbum ({albumCounts.none})</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({albumCounts.byAlbum.get(a.id) ?? 0})
                    </option>
                  ))}
                </select>
              )}
              <SearchInput value={query} onChange={setQuery} />
              <button
                type="button"
                className="btn-soft whitespace-nowrap"
                onClick={() => fileInputRef.current?.click()}
                title="Cada .txt se convierte en una canción. También podés arrastrarlos acá."
              >
                ↓ Importar .txt
              </button>
              <button
                type="button"
                className="btn-soft whitespace-nowrap"
                onClick={handleNew}
              >
                ＋ Nueva canción
              </button>
            </div>
          }
        >
          {importMsg && <p className="import-msg mt-3">{importMsg}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!songsLoaded && (
              <p className="empty-state">Cargando canciones…</p>
            )}
            {songsLoaded && filteredSongs.length === 0 && (
              <p className="empty-state">
                {songs.length === 0
                  ? 'No hay canciones todavía. Arrastrá acá tus .txt con letras, o escribí una.'
                  : 'No hay canciones en este filtro.'}
              </p>
            )}
            {filteredSongs.map((s) => (
              <Chip
                key={s.id}
                selected={s.id === currentSongId}
                onClick={() => selectSong(s.id)}
                label={s.title || 'Sin título'}
              />
            ))}
          </div>
        </Section>

        {/* Editor / Perform views */}
        {!perform ? (
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
                placeholder={
                  '# Verso 1\n[Am]Esta es la [C]letra\nlínea 2…\n\n# Coro\n[F]Nueva estrofa…'
                }
                className="input-base min-h-[280px] resize-y font-mono text-sm leading-relaxed"
                spellCheck={false}
              />
              <ul className="mt-3 space-y-1.5 font-serif text-[15px] italic leading-relaxed text-cabina-tinta-dim">
                <li>
                  <strong className="not-italic">Una línea en blanco</strong> separa
                  un slide del siguiente.
                </li>
                <li>
                  <code className="rounded bg-ok-suave px-1.5 py-[0.1rem] font-mono text-[0.78em] not-italic text-ok">
                    # Coro
                  </code>{' '}
                  al principio de una estrofa le pone nombre a esa parte. Se ve en
                  el mazo pero <strong className="not-italic">no se proyecta</strong>.
                </li>
                <li>
                  Acordes entre corchetes, en la posición exacta donde tocan:{' '}
                  <code className="rounded bg-ok-suave px-1.5 py-[0.1rem] font-mono text-[0.78em] not-italic text-ok">
                    que ge[Am]nial, est[A]a canción
                  </code>
                  .
                </li>
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleSave()}
                disabled={!dirty && !!currentSong}
              >
                {currentSong ? 'Guardar' : 'Crear canción'}
              </button>
              {currentSong && (
                <span className="save-status">
                  {dirty ? 'Guardando…' : (saveFlash ?? 'Se guarda solo')}
                </span>
              )}
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
            title={songTitle}
            slides={slides}
            showChords={showChords}
            onToggleChords={setShowChords}
            density={density}
            onDensity={(d) => {
              setDensity(d)
              localStorage.setItem(DENSITY_KEY, d)
            }}
            liveIndex={liveIndex}
            cursor={cursor}
            onProject={projectAt}
            onClear={projectClear}
            onEdit={() => setView('editor')}
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
  title: string
  slides: ContentSlide[]
  showChords: boolean
  onToggleChords: (v: boolean) => void
  density: DensityId
  onDensity: (d: DensityId) => void
  liveIndex: number | null
  cursor: number
  onProject: (index: number) => void
  onClear: () => void
  onEdit: () => void
  albumName: string | null
}

function PerformanceView({
  title,
  slides,
  showChords,
  onToggleChords,
  density,
  onDensity,
  liveIndex,
  cursor,
  onProject,
  onClear,
  onEdit,
  albumName
}: PerfProps) {
  const dens = DENSITIES.find((d) => d.id === density) ?? DENSITIES[1]
  const at = liveIndex ?? cursor
  const liveRef = useRef<HTMLButtonElement | null>(null)

  // Seguir con la vista al slide que está al aire, para no perderlo de vista
  // en canciones largas cuando se avanza con el teclado.
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [liveIndex])

  return (
    <Section label="Tocar">
      <div className="perf-bar mt-3">
        <div className="now-playing">
          <strong>{title}</strong>
          {albumName && <> · {albumName}</>}
        </div>

        {slides.length > 0 && (
          <>
            <div className="divider" />
            <div className="deck-nav">
              <button
                aria-label="Slide anterior (←)"
                type="button"
                onClick={() => onProject(at - 1)}
                disabled={at <= 0}
                title="Slide anterior (←)"
              >
                ‹
              </button>
              <span className="deck-pos">
                {liveIndex === null ? '—' : liveIndex + 1}
                <em>/{slides.length}</em>
              </span>
              <button
                aria-label="Slide siguiente (→ o barra espaciadora)"
                type="button"
                onClick={() => onProject(at + 1)}
                disabled={at >= slides.length - 1}
                title="Slide siguiente (→ o barra espaciadora)"
              >
                ›
              </button>
            </div>
          </>
        )}

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

        <div className="density-toggle" title="Tamaño de los cuadros">
          {DENSITIES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === density ? 'active' : ''}
              onClick={() => onDensity(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-soft" onClick={onEdit}>
            ✎ Editar letra
          </button>
          <button type="button" className="btn-soft" onClick={onClear} title="Esc">
            ⌫ Limpiar
          </button>
        </div>
      </div>

      {slides.length === 0 ? (
        <p className="empty-state mt-6 text-center">
          Esta canción aún no tiene letra. Tocá <strong>Editar letra</strong> para
          agregarla.
        </p>
      ) : (
        <div
          className="deck mt-4"
          style={
            {
              '--deck-col': `${dens.col}px`,
              '--deck-font': `${dens.font}rem`
            } as React.CSSProperties
          }
        >
          {slides.map((slide, i) => (
            <SlideCard
              key={slide.key}
              ref={i === at ? liveRef : undefined}
              slide={slide}
              showChords={showChords}
              isLive={i === liveIndex}
              onProject={() => onProject(i)}
            />
          ))}
        </div>
      )}

      {slides.length > 0 && (
        <div className="mt-5 text-center font-serif text-[13px] italic text-cabina-tinta-tenue">
          <kbd>←</kbd> <kbd>→</kbd> o <kbd>espacio</kbd> pasan de slide ·{' '}
          <kbd>1</kbd>–<kbd>9</kbd> saltan directo · <kbd>Esc</kbd> limpia la
          pantalla. Los acordes son sólo para vos: la proyección siempre va sin
          acordes.
        </div>
      )}
    </Section>
  )
}

// ─── SlideCard ───────────────────────────────────────────────────────────────
const SlideCard = forwardRef<
  HTMLButtonElement,
  {
    slide: ContentSlide
    showChords: boolean
    isLive: boolean
    onProject: () => void
  }
>(function SlideCard({ slide, showChords, isLive, onProject }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onProject}
      className={`slide-card text-left ${isLive ? 'is-live' : ''} ${showChords ? '' : 'no-chords'}`}
    >
      <div className="slide-card-header">
        <span className="slide-card-index">
          <span className="num">{slide.index + 1}</span>
          {slide.label && <span className="label">{slide.label}</span>}
        </span>
        {isLive && <span className="live-pip">●</span>}
      </div>
      <div className="lyrics-stage">
        {slide.lines.map((line, li) => (
          <LineView key={li} line={line} />
        ))}
      </div>
    </button>
  )
})

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
      className="input-base is-sm max-w-[180px]"
    />
  )
}

// ─── Styles (scoped to .songbook root) ───────────────────────────────────────
const songbookCss = `
/* Esta pantalla tenía su propio tema ("cancionero": serif, degradados cálidos,
   otra familia tipográfica) que no se parecía en nada al resto de la app. El
   problema no era que fuera feo sino que contaba otra historia: decía "estás
   leyendo un libro" cuando en realidad estás manejando una salida en vivo.
   Ahora usa los mismos tokens de cabina que todo lo demás, y el serif queda
   sólo dentro de las tarjetas de letra, donde sí significa algo: eso es texto
   que se proyecta, no interfaz.

   Los nombres de clase (.songbook, .chip, .slide-card…) se conservan para no
   reescribir 1400 líneas de JSX; lo que cambió es a qué apuntan. */
.songbook {
  --ct-negro: #0e0d0c;
  --ct-panel: #191614;
  --ct-alto: #221d19;
  --ct-tinta: #efe6d6;
  --ct-dim: rgba(239, 230, 214, 0.72);
  --ct-tenue: rgba(239, 230, 214, 0.58);
  --ct-linea: rgba(239, 230, 214, 0.14);
  --ct-linea-fuerte: rgba(239, 230, 214, 0.32);
  --ct-aire: #e2483b;
  /* Antes decía var(--ct-listo): se referenciaba a sí misma, la variable
     quedaba inválida y todo acento ámbar de esta sección desaparecía (el
     botón activo "Editar" era texto oscuro sobre fondo oscuro). */
  --ct-listo: #f5b342;
  --ct-ok: #8fb98a;

  background: var(--ct-negro);
  color: var(--ct-tinta);
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.songbook .field-label {
  font-size: 0.72rem;
  color: var(--ct-tenue);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 600;
}

.songbook .songbook-panel {
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 14px;
  padding: 1.4rem 1.4rem 1.5rem;
  backdrop-filter: blur(6px);
}

.songbook .view-switch {
  display: inline-flex;
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 999px;
  padding: 4px;
}
.songbook .view-switch button {
  background: transparent;
  border: none;
  color: var(--ct-dim);
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-weight: 600;
  font-size: 0.82rem;
  padding: 0.55rem 1.15rem;
  border-radius: 999px;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
}
.songbook .view-switch button.active { background: var(--ct-listo); color: var(--ct-negro); }
.songbook .view-switch button:not(.active):hover { color: var(--ct-tinta); }

.songbook .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.95rem;
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 999px;
  cursor: pointer;
  /* El serif queda SÓLO dentro de las tarjetas de letra, donde significa algo:
     "esto es texto que se proyecta". Acá era la voz de documento que
     contradecía el trabajo real de la pantalla. */
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--ct-dim);
  transition: all 0.2s;
}
.songbook .chip:hover { color: var(--ct-tinta); border-color: var(--ct-linea-fuerte); }
.songbook .chip.selected {
  background: rgba(245, 179, 66, 0.12);
  border-color: var(--ct-listo);
  color: var(--ct-listo);
}
.songbook .chip.is-album.selected {
  background: rgba(143, 185, 138, 0.12);
  border-color: var(--ct-ok);
  color: var(--ct-ok);
}
.songbook .chip-count {
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
  font-style: normal;
  font-size: 0.72em;
  opacity: 0.6;
}
.songbook .chip.action {
  border-style: dashed;
  color: var(--ct-tenue);
  font-style: normal;
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}
.songbook .chip.action:hover { color: var(--ct-listo); border-color: var(--ct-listo); }
.songbook .chip.action.is-danger {
  color: rgba(214, 90, 74, 0.85);
  border-color: var(--ct-aire);
}
.songbook .chip.action.is-danger:hover {
  background: rgba(214, 90, 74, 0.12);
  color: var(--ct-aire);
}

.songbook .input-base {
  width: 100%;
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  color: var(--ct-tinta);
  padding: 0.7rem 0.95rem;
  border-radius: 8px;
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}
.songbook .input-base::placeholder { color: var(--ct-tenue); }
.songbook .input-base:focus { border-color: var(--ct-listo); }
.songbook textarea.input-base {
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
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
.songbook select.input-base option { background: var(--ct-panel); color: var(--ct-tinta); }
/* Variante chica para las barras de herramientas. Va acá y no con clases de
   Tailwind porque .songbook .input-base gana por especificidad y el padding
   grande recortaba el texto dentro de un alto fijo. */
.songbook .input-base.is-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
  border-radius: 7px;
}
.songbook select.input-base.is-sm {
  padding-right: 1.9rem;
  background-position: right 0.6rem center;
}

.songbook .btn-primary,
.songbook .btn-soft,
.songbook .btn-danger {
  border: 1px solid var(--ct-linea-fuerte);
  padding: 0.55rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-weight: 500;
  font-size: 0.85rem;
  letter-spacing: 0.01em;
  transition: all 0.2s;
}
.songbook .btn-primary {
  background: var(--ct-listo);
  color: var(--ct-negro);
  border-color: var(--ct-listo);
  font-weight: 600;
}
.songbook .btn-primary:hover { background: var(--ct-listo); border-color: var(--ct-listo); }
.songbook .btn-primary:disabled {
  background: rgba(245, 179, 66, 0.3);
  border-color: rgba(245, 179, 66, 0.3);
  color: rgba(20, 16, 12, 0.5);
  cursor: not-allowed;
}
.songbook .btn-soft {
  background: transparent;
  color: var(--ct-tinta);
}
.songbook .btn-soft:hover {
  background: var(--ct-alto);
  border-color: var(--ct-linea-fuerte);
}
.songbook .btn-soft:disabled { opacity: 0.4; cursor: not-allowed; }
.songbook .btn-danger {
  background: transparent;
  color: var(--ct-aire);
  border-color: var(--ct-aire);
}
.songbook .btn-danger:hover { background: rgba(214, 90, 74, 0.12); }

/* Soltar .txt en cualquier parte de la página los importa. */
.songbook.is-dropping {
  outline: 2px dashed var(--ct-listo);
  outline-offset: -10px;
}
.songbook .import-msg {
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.82rem;
  color: var(--ct-listo);
}

.songbook .save-status {
  align-self: center;
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.75rem;
  color: var(--ct-tenue);
  letter-spacing: 0.02em;
}

.songbook .empty-state {
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  color: var(--ct-tenue);
  font-size: 0.95rem;
}

.songbook .perf-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 12px;
}
.songbook .now-playing {
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-weight: 600;
  color: var(--ct-dim);
  font-size: 0.95rem;
}
.songbook .now-playing strong { color: var(--ct-tinta); font-weight: 400; }
.songbook .divider { width: 1px; height: 24px; background: var(--ct-linea); }

.songbook .chord-toggle {
  display: inline-flex;
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 8px;
  padding: 3px;
}
.songbook .chord-toggle button {
  background: transparent;
  border: none;
  color: var(--ct-dim);
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
}
.songbook .chord-toggle button.active { background: var(--ct-ok); color: var(--ct-negro); }

/* Navegación del mazo + tamaño de los cuadros */
.songbook .deck-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.songbook .deck-nav button {
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  color: var(--ct-tinta);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  transition: all 0.15s;
}
.songbook .deck-nav button:hover:not(:disabled) { border-color: var(--ct-listo); color: var(--ct-listo); }
.songbook .deck-nav button:disabled { opacity: 0.25; cursor: not-allowed; }
.songbook .deck-pos {
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
  font-size: 0.8rem;
  color: var(--ct-listo);
  min-width: 3.2rem;
  text-align: center;
}
.songbook .deck-pos em {
  font-style: normal;
  color: var(--ct-tenue);
}

.songbook .density-toggle {
  display: inline-flex;
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 8px;
  padding: 3px;
}
.songbook .density-toggle button {
  background: transparent;
  border: none;
  color: var(--ct-tenue);
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
  font-weight: 600;
  font-size: 0.68rem;
  padding: 0.35rem 0.5rem;
  border-radius: 5px;
  cursor: pointer;
  min-width: 26px;
}
.songbook .density-toggle button.active { background: var(--ct-listo); color: var(--ct-negro); }

.songbook kbd {
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
  font-style: normal;
  font-size: 0.85em;
  background: var(--ct-negro);
  border: 1px solid var(--ct-linea);
  border-radius: 4px;
  padding: 0.1em 0.4em;
  color: var(--ct-dim);
}

/* Mazo: tantas columnas como entren para el ancho elegido. align-items:start
   deja que cada cuadro mida lo que mide su letra en vez de estirarse al más
   alto de la fila — así entran más pedacitos en pantalla. */
.songbook .deck {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--deck-col), 1fr));
  align-items: start;
  gap: 0.6rem;
}

/* Slide cards */
.songbook .slide-card {
  background: var(--ct-panel);
  border: 1px solid var(--ct-linea);
  border-radius: 10px;
  padding: 0.5rem 0.65rem 0.6rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}
.songbook .slide-card:hover {
  border-color: var(--ct-linea-fuerte);
  background: var(--ct-alto);
}
.songbook .slide-card.is-live {
  border-color: var(--ct-aire);
  background: rgba(214, 90, 74, 0.08);
  box-shadow: 0 0 0 1px rgba(214, 90, 74, 0.35), 0 8px 32px -12px var(--ct-aire);
}
.songbook .slide-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}
.songbook .slide-card-index {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.songbook .slide-card-index .num {
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
  font-size: 0.62rem;
  color: var(--ct-tenue);
}
.songbook .slide-card-index .label {
  font-family: 'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ct-ok);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.songbook .slide-card.is-live .slide-card-index .label { color: #e8a596; }
.songbook .live-pip {
  font-size: 0.6rem;
  color: var(--ct-aire);
  flex-shrink: 0;
}

/* Lyrics rendering */
.songbook .lyrics-line {
  font-family: 'Source Serif 4 Variable', Georgia, serif;
  font-weight: 400;
  font-size: var(--deck-font, 0.86rem);
  line-height: 1.32;
  margin-bottom: 0.1rem;
}
.songbook .lyrics-line.is-blank { height: 0.4rem; margin: 0; }
/* Con acordes cada línea necesita el renglón de arriba para el cifrado. */
.songbook .slide-card:not(.no-chords) .lyrics-line { margin-bottom: 0.22rem; }
.songbook .word {
  display: inline-flex;
  align-items: flex-end;
  vertical-align: bottom;
  margin-right: 0.28rem;
}
.songbook .part {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1;
}
.songbook .part .chord {
  font-family: 'JetBrains Mono Variable', Consolas, ui-monospace, monospace;
  font-weight: 600;
  font-size: 0.66em;
  color: var(--ct-ok);
  letter-spacing: 0.02em;
  height: 1.2em;
  line-height: 1.2em;
  margin-bottom: 0.05em;
  text-shadow: 0 0 12px rgba(143, 185, 138, 0.3);
  white-space: nowrap;
  min-width: 1px;
}
/* Sin acordes el renglón de arriba no hace falta: se recupera esa altura. */
.songbook .slide-card.no-chords .part { line-height: inherit; }
.songbook .part .text {
  line-height: 1.15;
  white-space: pre;
  color: var(--ct-tinta);
}
.songbook .slide-card.no-chords .part .chord { display: none; }
`
