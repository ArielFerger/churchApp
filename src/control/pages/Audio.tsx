import { useMemo, useState } from 'react'
import { Search, Music, Play, FolderOpen, Pause, ListPlus, ListMusic, X, Trash2 } from 'lucide-react'
import { useAudioStore } from '@/shared/store/audioStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { audioEngine } from '@/control/audio/audioEngine'
import type { AudioTrack } from '@/shared/types/audio'

export default function Audio() {
  const { library, libraryLoaded, currentTrackId, isPlaying, queue, enqueue } = useAudioStore()
  const { settings, loaded: settingsLoaded } = useSettingsStore()
  const [query, setQuery] = useState('')
  const [showQueue, setShowQueue] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return library
    const q = query.toLowerCase()
    return library.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false)
    )
  }, [library, query])

  const playTrack = (track: AudioTrack) => {
    if (track.id === currentTrackId && isPlaying) {
      audioEngine.pause()
    } else {
      void audioEngine.play(track, 0)
    }
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
        <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Buscar título, artista, álbum…"
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
            <p className="mt-12 text-center text-sm text-slate-500">
              {library.length === 0
                ? 'No se encontraron archivos de audio en la carpeta.'
                : 'Sin resultados.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filtered.map((track) => {
                const isCurrent = track.id === currentTrackId
                return (
                  <li key={track.id}>
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
