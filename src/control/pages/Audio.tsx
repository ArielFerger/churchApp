import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Music,
  Play,
  FolderOpen,
  Pause,
  ListPlus,
  ListMusic,
  X,
  Trash2,
  Plus,
  Check,
  Pencil,
  ChevronUp,
  ChevronDown,
  Library
} from 'lucide-react'
import { useAudioStore } from '@/shared/store/audioStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { audioEngine } from '@/control/audio/audioEngine'
import type { AudioTrack, AudioPlaylist } from '@/shared/types/audio'

export default function Audio() {
  const {
    library,
    libraryLoaded,
    currentTrackId,
    isPlaying,
    queue,
    enqueue,
    playlists,
    playlistsLoaded,
    activePlaylistId,
    setActivePlaylist,
    setPlayContext,
    loadPlaylists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    moveTrackInPlaylist
  } = useAudioStore()
  const { settings, loaded: settingsLoaded } = useSettingsStore()
  const [query, setQuery] = useState('')
  const [showQueue, setShowQueue] = useState(false)
  // Track con el menú "agregar a playlist" abierto (null = ninguno).
  const [menuFor, setMenuFor] = useState<string | null>(null)
  // Creación de playlist desde la barra de pestañas.
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!playlistsLoaded) void loadPlaylists()
  }, [playlistsLoaded, loadPlaylists])

  const activePlaylist = activePlaylistId
    ? (playlists.find((p) => p.id === activePlaylistId) ?? null)
    : null

  // Tracks visibles: librería completa o los de la playlist activa (en su orden).
  const baseTracks = useMemo<AudioTrack[]>(() => {
    if (!activePlaylist) return library
    return activePlaylist.trackIds
      .map((id) => library.find((t) => t.id === id))
      .filter((t): t is AudioTrack => Boolean(t))
  }, [library, activePlaylist])

  const filtered = useMemo(() => {
    if (!query.trim()) return baseTracks
    const q = query.toLowerCase()
    return baseTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false)
    )
  }, [baseTracks, query])

  /** Reproducir/pausar un track fijando el contexto (playlist u orden de librería). */
  const playTrack = (track: AudioTrack) => {
    if (track.id === currentTrackId && isPlaying) {
      audioEngine.pause()
    } else {
      setPlayContext(activePlaylist ? activePlaylist.trackIds : null)
      void audioEngine.play(track, 0)
    }
  }

  const playPlaylistFromStart = () => {
    const first = baseTracks[0]
    if (!first || !activePlaylist) return
    setPlayContext(activePlaylist.trackIds)
    void audioEngine.play(first, 0)
  }

  if (!settingsLoaded) return null

  if (!settings?.audioFolder) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md rounded-lg border border-slate-700 bg-slate-800/40 p-6 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 text-sm text-slate-300">
            No hay carpeta de audio configurada todavía.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Andá a <span className="font-medium text-slate-300">Ajustes → Carpetas</span> y
            seleccioná una carpeta con archivos MP3, FLAC, M4A, etc.
          </p>
        </div>
      </div>
    )
  }

  if (!libraryLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Pestañas: Toda la música + playlists */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-700 px-4 pt-2">
          <Tab
            label="Toda la música"
            icon={<Library className="h-3.5 w-3.5" />}
            count={library.length}
            active={activePlaylistId === null}
            onClick={() => setActivePlaylist(null)}
          />
          {playlists.map((p) => (
            <Tab
              key={p.id}
              label={p.name}
              icon={<ListMusic className="h-3.5 w-3.5" />}
              count={p.trackIds.length}
              active={activePlaylistId === p.id}
              onClick={() => setActivePlaylist(p.id)}
            />
          ))}
          {creating ? (
            <InlineNameInput
              placeholder="Nombre de la playlist…"
              onSubmit={async (name) => {
                setCreating(false)
                if (!name.trim()) return
                const created = await createPlaylist(name)
                if (created) setActivePlaylist(created.id)
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mb-1.5 ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-slate-400 hover:text-white"
              title="Crear una playlist nueva"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva playlist
            </button>
          )}
        </div>

        {/* Encabezado de la playlist activa */}
        {activePlaylist && (
          <PlaylistHeader
            playlist={activePlaylist}
            trackCount={baseTracks.length}
            onPlay={playPlaylistFromStart}
            onRename={(name) => void renamePlaylist(activePlaylist.id, name)}
            onDelete={() => void deletePlaylist(activePlaylist.id)}
          />
        )}

        <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder={
                activePlaylist ? `Buscar en "${activePlaylist.name}"…` : 'Buscar título, artista, álbum…'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'track' : 'tracks'}
          </span>
          <button
            type="button"
            onClick={() => setShowQueue((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
              showQueue
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Mostrar/ocultar cola"
          >
            <ListMusic className="h-3.5 w-3.5" />
            Cola
            {queue.length > 0 && (
              <span className="rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white">
                {queue.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="mt-12 px-6 text-center text-sm text-slate-500">
              {activePlaylist
                ? activePlaylist.trackIds.length === 0
                  ? 'Playlist vacía. Desde "Toda la música", usá el botón + de cada track para agregarlo acá.'
                  : 'Sin resultados.'
                : library.length === 0
                  ? 'No se encontraron archivos de audio en la carpeta.'
                  : 'Sin resultados.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filtered.map((track, rowIndex) => {
                const isCurrent = track.id === currentTrackId
                return (
                  <li key={track.id} className="relative">
                    <div
                      className={`group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                        isCurrent ? 'bg-blue-600/10' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-800">
                          {track.artworkPath ? (
                            <img
                              src={`audio://${track.id}/artwork`}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Music className="h-4 w-4 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm ${
                              isCurrent ? 'font-medium text-white' : 'text-slate-200'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {track.artist || 'Sin artista'}
                            {track.album ? ` · ${track.album}` : ''}
                          </p>
                        </div>
                      </button>

                      <span className="shrink-0 font-mono text-xs text-slate-500">
                        {formatTime(track.duration)}
                      </span>

                      {/* Reordenar / quitar — solo dentro de una playlist sin filtro */}
                      {activePlaylist && !query.trim() && (
                        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => void moveTrackInPlaylist(activePlaylist.id, track.id, -1)}
                            disabled={rowIndex === 0}
                            className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-white disabled:opacity-30"
                            title="Subir"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveTrackInPlaylist(activePlaylist.id, track.id, 1)}
                            disabled={rowIndex === filtered.length - 1}
                            className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-white disabled:opacity-30"
                            title="Bajar"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeTrackFromPlaylist(activePlaylist.id, track.id)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                            title="Quitar de la playlist"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}

                      {/* Agregar a playlist */}
                      <button
                        type="button"
                        onClick={() => setMenuFor(menuFor === track.id ? null : track.id)}
                        className={`shrink-0 rounded p-1 transition-opacity hover:bg-slate-700 hover:text-emerald-300 ${
                          menuFor === track.id
                            ? 'text-emerald-300 opacity-100'
                            : 'text-slate-500 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Agregar a una playlist"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => enqueue(track.id)}
                        className="shrink-0 rounded p-1 text-slate-500 opacity-0 transition-opacity hover:bg-slate-700 hover:text-blue-300 group-hover:opacity-100"
                        title="Agregar a la cola"
                      >
                        <ListPlus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                        title={isCurrent && isPlaying ? 'Pausar' : 'Reproducir'}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="h-4 w-4 text-blue-400" />
                        ) : (
                          <Play className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                    </div>

                    {menuFor === track.id && (
                      <PlaylistMenu trackId={track.id} onClose={() => setMenuFor(null)} />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {showQueue && <QueuePanel onClose={() => setShowQueue(false)} />}
    </div>
  )
}

function Tab({
  label,
  icon,
  count,
  active,
  onClick
}: {
  label: string
  icon: React.ReactNode
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-blue-500 bg-slate-800/60 font-medium text-white'
          : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-100'
      }`}
      title={label}
    >
      {icon}
      <span className="max-w-[140px] truncate">{label}</span>
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function InlineNameInput({
  placeholder,
  initial = '',
  onSubmit,
  onCancel
}: {
  placeholder: string
  initial?: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit(value)
        else if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => (value.trim() ? onSubmit(value) : onCancel())}
      className="mb-1.5 ml-1 w-44 shrink-0 rounded-md border border-blue-500 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
    />
  )
}

function PlaylistHeader({
  playlist,
  trackCount,
  onPlay,
  onRename,
  onDelete
}: {
  playlist: AudioPlaylist
  trackCount: number
  onPlay: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // El estado de confirmación caduca solo, por si el operador se arrepiente.
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  return (
    <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800/30 px-4 py-2">
      <ListMusic className="h-4 w-4 shrink-0 text-blue-400" />
      {editing ? (
        <InlineNameInput
          placeholder="Nombre…"
          initial={playlist.name}
          onSubmit={(name) => {
            setEditing(false)
            if (name.trim() && name.trim() !== playlist.name) onRename(name.trim())
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <h2 className="truncate text-sm font-medium text-slate-100">{playlist.name}</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-white"
            title="Renombrar playlist"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </>
      )}
      <span className="text-xs text-slate-500">
        {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onPlay}
          disabled={trackCount === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          title="Reproducir la playlist desde el principio"
        >
          <Play className="h-3.5 w-3.5" />
          Reproducir
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirmDelete) onDelete()
            else setConfirmDelete(true)
          }}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
            confirmDelete
              ? 'bg-red-600 font-medium text-white hover:bg-red-500'
              : 'text-slate-400 hover:bg-slate-700 hover:text-red-300'
          }`}
          title="Eliminar la playlist (los archivos de música no se tocan)"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmDelete ? '¿Eliminar?' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}

/** Menú flotante por track: tilde para agregar/quitar de cada playlist. */
function PlaylistMenu({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const { playlists, addTrackToPlaylist, removeTrackFromPlaylist, createPlaylist } =
    useAudioStore()
  const [creating, setCreating] = useState(false)

  return (
    <>
      {/* Capa para cerrar al hacer clic afuera */}
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-10 top-10 z-40 w-60 overflow-hidden rounded-md border border-slate-600 bg-slate-800 shadow-xl">
        <p className="border-b border-slate-700 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Agregar a playlist
        </p>
        <ul className="max-h-48 overflow-y-auto py-1">
          {playlists.length === 0 && !creating && (
            <li className="px-3 py-1.5 text-xs text-slate-500">No hay playlists todavía.</li>
          )}
          {playlists.map((p) => {
            const included = p.trackIds.includes(trackId)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() =>
                    void (included
                      ? removeTrackFromPlaylist(p.id, trackId)
                      : addTrackToPlaylist(p.id, trackId))
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      included
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-600 text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                    {p.trackIds.length}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-slate-700 p-1.5">
          {creating ? (
            <InlineNameInput
              placeholder="Nombre de la playlist…"
              onSubmit={async (name) => {
                setCreating(false)
                if (!name.trim()) return
                const created = await createPlaylist(name)
                if (created) await addTrackToPlaylist(created.id, trackId)
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva playlist con este track
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function QueuePanel({ onClose }: { onClose: () => void }) {
  const { queue, library, removeFromQueue, clearQueue } = useAudioStore()
  const tracks = queue
    .map((id, index) => ({ track: library.find((t) => t.id === id) ?? null, index }))
    .filter((x): x is { track: AudioTrack; index: number } => x.track !== null)

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-700 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
          <ListMusic className="h-4 w-4 text-blue-400" />
          Cola ({tracks.length})
        </h3>
        <div className="flex items-center gap-1">
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={clearQueue}
              className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
              title="Vaciar cola"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
            title="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tracks.length === 0 ? (
          <p className="mt-6 px-2 text-center text-xs text-slate-500">
            La cola está vacía. Pasá el mouse sobre un track y tocá{' '}
            <ListPlus className="inline h-3 w-3" /> para agregarlo.
          </p>
        ) : (
          <ol className="space-y-1">
            {tracks.map(({ track, index }, ordinal) => (
              <li
                key={`${track.id}-${index}`}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-800/60"
              >
                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-600">
                  {ordinal + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-200">{track.title}</p>
                  <p className="truncate text-[10px] text-slate-500">
                    {track.artist || 'Sin artista'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromQueue(index)}
                  className="shrink-0 rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Quitar de la cola"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
