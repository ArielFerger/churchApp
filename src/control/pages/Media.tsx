import { useEffect, useMemo, useState } from 'react'
import {
  Film,
  Image as ImageIcon,
  FolderOpen,
  Sparkles,
  Eye,
  Wallpaper,
  X,
  Play,
  Pause,
  Repeat,
  SkipBack,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useMediaPlaybackStore } from '@/shared/store/mediaPlaybackStore'
import type { MediaItem, MediaType } from '@/shared/types/media'
import type { ProjectionCommand } from '@/shared/types/ipc'

type Filter = 'all' | MediaType

const filterOptions: { value: Filter; label: string; icon: typeof ImageIcon }[] = [
  { value: 'all', label: 'Todos', icon: Sparkles },
  { value: 'image', label: 'Imágenes', icon: ImageIcon },
  { value: 'video', label: 'Videos', icon: Film },
  { value: 'gif', label: 'GIFs', icon: Sparkles }
]

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

export default function Media() {
  const { media, mediaLoaded, loadMedia, subscribeMedia } = useLibraryStore()
  const { settings, loaded: settingsLoaded, load: loadSettings } = useSettingsStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    void loadMedia()
    const unsub = subscribeMedia()
    return unsub
  }, [loadMedia, subscribeMedia])

  useEffect(() => {
    if (!settingsLoaded) void loadSettings()
  }, [settingsLoaded, loadSettings])

  // Preload selected item so showMedia is instant
  useEffect(() => {
    if (selectedId) send({ type: 'preloadMedia', mediaId: selectedId })
  }, [selectedId])

  const filtered = useMemo(
    () => (filter === 'all' ? media : media.filter((m) => m.type === filter)),
    [media, filter]
  )

  if (!settings?.mediaFolder) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md rounded-lg border border-slate-700 bg-slate-800/40 p-6 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 text-sm text-slate-300">
            No hay carpeta de media configurada todavía.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Andá a <span className="font-medium text-slate-300">Ajustes → Carpetas</span> y
            seleccioná una carpeta con imágenes, videos o GIFs.
          </p>
        </div>
      </div>
    )
  }

  if (!mediaLoaded) {
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
          {filterOptions.map((opt) => {
            const Icon = opt.icon
            const isActive = filter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            )
          })}
          <span className="ml-auto text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'} ·{' '}
            <span className="font-mono">{settings.mediaFolder}</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="mt-12 text-center text-sm text-slate-500">
              No hay archivos {filter !== 'all' ? `del tipo "${filter}"` : ''} en la carpeta.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <VideoTransport media={media} />
      </div>

      <aside className="w-72 border-l border-slate-700 p-4">
        {selectedId ? (
          <SelectionPanel
            item={media.find((m) => m.id === selectedId) ?? null}
            onClear={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-xs text-slate-500">
            Hacé clic en un item para verlo y proyectarlo.
          </p>
        )}
      </aside>
    </div>
  )
}

interface MediaCardProps {
  item: MediaItem
  isSelected: boolean
  onSelect: () => void
}

function MediaCard({ item, isSelected, onSelect }: MediaCardProps) {
  const src = `media://${item.id}`
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`group block w-full overflow-hidden rounded-md border bg-slate-950 text-left transition-colors ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/40'
            : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        <div className="aspect-video bg-black">
          {item.type === 'video' ? (
            <video
              src={src}
              className="h-full w-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
          ) : (
            <img
              src={src}
              alt={item.fileName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="truncate text-xs text-slate-300" title={item.fileName}>
            {item.fileName}
          </span>
          <TypeBadge type={item.type} />
        </div>
      </button>
    </li>
  )
}

function TypeBadge({ type }: { type: MediaType }) {
  const styles: Record<MediaType, string> = {
    image: 'bg-emerald-500/15 text-emerald-300',
    video: 'bg-purple-500/15 text-purple-300',
    gif: 'bg-amber-500/15 text-amber-300'
  }
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[type]}`}>
      {type.toUpperCase()}
    </span>
  )
}

interface SelectionPanelProps {
  item: MediaItem | null
  onClear: () => void
}

function SelectionPanel({ item, onClear }: SelectionPanelProps) {
  const [loop, setLoop] = useState(false)
  const settings = useSettingsStore((s) => s.settings)
  if (!item) return null
  const src = `media://${item.id}`
  const isVideo = item.type === 'video'
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">Seleccionado</h3>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
          title="Limpiar selección"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 overflow-hidden rounded-md border border-slate-700 bg-black">
        {isVideo ? (
          <video src={src} className="aspect-video w-full" controls muted playsInline />
        ) : (
          <img src={src} alt={item.fileName} className="aspect-video w-full object-contain" />
        )}
      </div>

      <p className="mt-3 truncate text-xs text-slate-400" title={item.fileName}>
        {item.fileName}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600" title={item.filePath}>
        {item.filePath}
      </p>

      {isVideo && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0"
          />
          <Repeat className="h-3.5 w-3.5 text-slate-500" />
          Repetir en loop
        </label>
      )}

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() =>
            send({
              type: 'showMedia',
              mediaId: item.id,
              mode: item.type,
              loop: isVideo && loop,
              fadeIn: isVideo ? (settings?.videoFadeIn ?? true) : false,
              fadeOut: isVideo ? (settings?.videoFadeOut ?? false) : false,
              fadeInSec: settings?.videoFadeInSec ?? 1,
              fadeOutSec: settings?.videoFadeOutSec ?? 2.5
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Eye className="h-4 w-4" />
          Mostrar en proyección
        </button>
        <button
          type="button"
          onClick={() => send({ type: 'setBackground', mediaId: item.id })}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
        >
          <Wallpaper className="h-4 w-4" />
          Usar como fondo
        </button>
        <button
          type="button"
          onClick={() => send({ type: 'setBackground', mediaId: null })}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
        >
          Quitar fondo
        </button>
      </div>
    </div>
  )
}

/**
 * Transport bar for the video currently playing on the projector. Appears only
 * when a video is live; lets the operator scrub, pause/resume, and restart.
 */
function VideoTransport({ media }: { media: MediaItem[] }) {
  const { mediaId, position, duration, playing, volume, setVolume } = useMediaPlaybackStore()
  // Local scrub state so dragging the slider feels smooth (not fighting telemetry).
  const [scrub, setScrub] = useState<number | null>(null)

  if (!mediaId) return null
  const item = media.find((m) => m.id === mediaId)
  if (!item || item.type !== 'video') return null

  const setVideoVolume = (v: number) => {
    setVolume(v)
    send({ type: 'setMediaVolume', volume: v })
  }

  const shown = scrub ?? position
  const pct = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0

  return (
    <div className="flex items-center gap-3 border-t border-slate-700 bg-slate-900/80 px-4 py-2.5">
      <Film className="h-4 w-4 shrink-0 text-purple-300" />
      <span className="max-w-[180px] truncate text-xs text-slate-300" title={item.fileName}>
        {item.fileName}
      </span>

      <button
        type="button"
        onClick={() => send({ type: 'seekMedia', position: 0 })}
        className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
        title="Reiniciar"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => send({ type: 'setMediaPlaying', playing: !playing })}
        className="rounded-full bg-white p-2 text-slate-900 hover:bg-slate-200"
        title={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
      </button>

      <span className="w-10 text-right font-mono text-[10px] text-slate-500">
        {formatTime(shown)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step="0.1"
        value={shown}
        onChange={(e) => {
          const pos = parseFloat(e.target.value)
          setScrub(pos)
          send({ type: 'seekMedia', position: pos }) // live scrub on the projector
        }}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
        className="seek-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(168 85 247) ${pct}%, rgb(51 65 85) ${pct}%, rgb(51 65 85) 100%)`
        }}
      />
      <span className="w-10 font-mono text-[10px] text-slate-500">{formatTime(duration)}</span>

      {/* Video output volume */}
      <div className="flex shrink-0 items-center gap-1.5 border-l border-slate-700 pl-3">
        <button
          type="button"
          onClick={() => setVideoVolume(volume > 0 ? 0 : 1)}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          title={volume > 0 ? 'Silenciar' : 'Activar sonido'}
        >
          {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
          className="seek-range h-1.5 w-24 cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(168 85 247) ${volume * 100}%, rgb(51 65 85) ${volume * 100}%, rgb(51 65 85) 100%)`
          }}
          title={`Volumen del video: ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
