import { useEffect, useMemo, useState } from 'react'
import {
  Film,
  Image as ImageIcon,
  Folder,
  FolderOpen,
  Sparkles,
  Eye,
  Wallpaper,
  X,
  Play,
  Pause,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListPlus,
  ListVideo,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Home,
  Square
} from 'lucide-react'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useMediaPlaybackStore } from '@/shared/store/mediaPlaybackStore'
import { useVideoQueueStore } from '@/shared/store/videoQueueStore'
import { playQueueVideo } from '@/control/hooks/useProjectionBridge'
import {
  itemsInFolder,
  childFolders,
  countInFolder,
  breadcrumbSegments
} from '@/shared/utils/mediaFolders'
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
  // Carpeta actual dentro de la carpeta de media ('' = raíz).
  const [path, setPath] = useState('')

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

  // Si la carpeta actual desaparece (renombrada/borrada), volver a la raíz.
  useEffect(() => {
    if (path && itemsInFolder(media, path).length === 0 && childFolders(media, path).length === 0) {
      setPath('')
    }
  }, [media, path])

  const byType = useMemo(
    () => (filter === 'all' ? media : media.filter((m) => m.type === filter)),
    [media, filter]
  )
  const folders = useMemo(() => childFolders(byType, path), [byType, path])
  const filtered = useMemo(() => itemsInFolder(byType, path), [byType, path])

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

        {/* Breadcrumb de carpetas */}
        <FolderBreadcrumb path={path} onNavigate={setPath} />

        <div className="flex-1 overflow-y-auto p-4">
          {folders.length === 0 && filtered.length === 0 ? (
            <p className="mt-12 text-center text-sm text-slate-500">
              No hay archivos {filter !== 'all' ? `del tipo "${filter}"` : ''} en esta carpeta.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {folders.map((name) => {
                const folderPath = path ? `${path}/${name}` : name
                return (
                  <FolderCard
                    key={`folder-${name}`}
                    name={name}
                    count={countInFolder(byType, folderPath)}
                    onOpen={() => setPath(folderPath)}
                  />
                )
              })}
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

      <aside className="flex w-72 flex-col overflow-y-auto border-l border-slate-700 p-4">
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
        <QueuePanel media={media} />
      </aside>
    </div>
  )
}

/** Fila de navegación: raíz / carpeta / subcarpeta. Oculta en raíz sin subcarpetas. */
function FolderBreadcrumb({
  path,
  onNavigate
}: {
  path: string
  onNavigate: (p: string) => void
}) {
  if (!path) return null
  const segments = breadcrumbSegments(path)
  return (
    <div className="flex items-center gap-1 border-b border-slate-700/60 bg-slate-800/20 px-4 py-1.5 text-xs">
      <button
        type="button"
        onClick={() => onNavigate('')}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
        title="Volver a la raíz"
      >
        <Home className="h-3 w-3" />
        Media
      </button>
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-slate-600" />
          {i === segments.length - 1 ? (
            <span className="px-1 font-medium text-slate-200">{seg.name}</span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(seg.path)}
              className="rounded px-1 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            >
              {seg.name}
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function FolderCard({
  name,
  count,
  onOpen
}: {
  name: string
  count: number
  onOpen: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={onOpen}
        className="group block w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800/40 text-left transition-colors hover:border-amber-500/60 hover:bg-slate-800"
        title={`Abrir carpeta "${name}"`}
      >
        <div className="flex aspect-video items-center justify-center bg-slate-900/60">
          <Folder className="h-12 w-12 text-amber-400/80 transition-transform group-hover:scale-110" />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="truncate text-xs font-medium text-slate-200" title={name}>
            {name}
          </span>
          <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            {count}
          </span>
        </div>
      </button>
    </li>
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
  const queueIds = useVideoQueueStore((s) => s.ids)
  const addToQueue = useVideoQueueStore((s) => s.add)
  const removeFromQueue = useVideoQueueStore((s) => s.remove)
  if (!item) return null
  const src = `media://${item.id}`
  const isVideo = item.type === 'video'
  const queuePos = queueIds.indexOf(item.id)
  return (
    <div className="flex flex-col">
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
        {isVideo &&
          (queuePos === -1 ? (
            <button
              type="button"
              onClick={() => addToQueue(item.id)}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              <ListPlus className="h-4 w-4" />
              Añadir a la cola
            </button>
          ) : (
            <button
              type="button"
              onClick={() => removeFromQueue(item.id)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-purple-500/50 bg-purple-500/10 px-3 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/20"
            >
              <ListVideo className="h-4 w-4" />
              En cola (#{queuePos + 1}) — quitar
            </button>
          ))}
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
 * Cola de reproducción de videos: se arma desde el panel de selección y se
 * reproduce en orden; al terminar cada video pasa solo al siguiente
 * (avance manejado en useProjectionBridge vía el evento `ended`).
 */
function QueuePanel({ media }: { media: MediaItem[] }) {
  const { ids, currentId, active, remove, clear, move, setActive, setCurrent, nextAfter } =
    useVideoQueueStore()

  if (ids.length === 0) return null

  const items = ids
    .map((id) => media.find((m) => m.id === id))
    .filter((m): m is MediaItem => Boolean(m))

  function startQueue(fromId?: string) {
    const first = fromId ?? ids[0]
    if (first) playQueueVideo(first)
  }

  function skipNext() {
    if (!currentId) return
    const next = nextAfter(currentId)
    if (next) playQueueVideo(next)
    else stopQueue()
  }

  function stopQueue() {
    setActive(false)
    setCurrent(null)
    send({ type: 'clear' })
  }

  return (
    <div className="mt-5 border-t border-slate-700 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
          <ListVideo className="h-4 w-4 text-purple-400" />
          Cola de videos
          {active && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              EN VIVO
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => {
            if (active) stopQueue()
            clear()
          }}
          className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-700 hover:text-red-400"
          title="Vaciar la cola"
        >
          Vaciar
        </button>
      </div>

      <ol className="mt-2 space-y-1">
        {items.map((item, i) => {
          const isCurrent = item.id === currentId
          return (
            <li
              key={item.id}
              className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                isCurrent
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-300'
              }`}
            >
              <span className="w-4 shrink-0 text-center font-mono text-[10px] text-slate-500">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => startQueue(item.id)}
                className="min-w-0 flex-1 truncate text-left hover:text-white"
                title={`Reproducir desde "${item.fileName}"`}
              >
                {item.fileName}
              </button>
              <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  title="Subir"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={i === items.length - 1}
                  className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  title="Bajar"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded p-0.5 text-slate-500 hover:text-red-400"
                  title="Quitar de la cola"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex gap-2">
        {!active ? (
          <button
            type="button"
            onClick={() => startQueue()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <Play className="h-3.5 w-3.5" />
            Reproducir cola
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={skipNext}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
              title="Saltar al siguiente video"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Siguiente
            </button>
            <button
              type="button"
              onClick={stopQueue}
              className="flex items-center justify-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              title="Detener la cola"
            >
              <Square className="h-3.5 w-3.5" />
              Detener
            </button>
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-600">
        Al terminar cada video pasa automáticamente al siguiente.
      </p>
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
