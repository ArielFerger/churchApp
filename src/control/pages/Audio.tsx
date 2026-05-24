import { useMemo, useState } from 'react'
import { Search, Music, Play, FolderOpen, Pause } from 'lucide-react'
import { useAudioStore } from '@/shared/store/audioStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { audioEngine } from '@/control/audio/audioEngine'
import type { AudioTrack } from '@/shared/types/audio'

export default function Audio() {
  const { library, libraryLoaded, currentTrackId, isPlaying } = useAudioStore()
  const { settings, loaded: settingsLoaded } = useSettingsStore()
  const [query, setQuery] = useState('')

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
    <div className="flex h-full flex-col">
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
                  <button
                    type="button"
                    onClick={() => playTrack(track)}
                    className={`group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                      isCurrent ? 'bg-blue-600/10' : 'hover:bg-slate-800/60'
                    }`}
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
                    <span className="shrink-0 font-mono text-xs text-slate-500">
                      {formatTime(track.duration)}
                    </span>
                    <span className="ml-2 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                      {isCurrent && isPlaying ? (
                        <Pause className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Play className="h-4 w-4 text-slate-300" />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
