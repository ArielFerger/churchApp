import { useEffect, useMemo, useState } from 'react'
import {
  Film,
  Image as ImageIcon,
  Folder,
  FolderOpen,
  Sparkles,
  Eye,
  X,
  Play,
  Pause,
  Repeat,
  RotateCcw,
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
  Clock,
  Square,
  Search,
  Star,
  Tag,
  CalendarCheck
} from 'lucide-react'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useMediaPlaybackStore } from '@/shared/store/mediaPlaybackStore'
import { useVideoQueueStore } from '@/shared/store/videoQueueStore'
import { useMediaMetaStore } from '@/shared/store/mediaMetaStore'
import { playQueueVideo } from '@/control/hooks/useProjectionBridge'
import {
  itemsInFolder,
  childFolders,
  countInFolder,
  breadcrumbSegments,
  searchMedia
} from '@/shared/utils/mediaFolders'
import { todayItems } from '@/shared/utils/mediaMeta'
import {
  MEDIA_CATEGORIES,
  categoryInfo,
  type MediaCategory,
  type MediaItem,
  type MediaType
} from '@/shared/types/media'
import type { ProjectionCommand } from '@/shared/types/ipc'
import { useMenuContextual } from '../components/ui/MenuContextual'
import { menuParaMedia } from '../menus'

type Filter = 'all' | MediaType
/** Filtro de categoría: todas, una en concreto, o solo las que no tienen. */
type CategoryFilter = 'all' | MediaCategory | 'none'

const filterOptions: { value: Filter; label: string; icon: typeof ImageIcon }[] = [
  { value: 'all', label: 'Todos', icon: Sparkles },
  { value: 'image', label: 'Imágenes', icon: ImageIcon },
  { value: 'video', label: 'Videos', icon: Film },
  { value: 'gif', label: 'GIFs', icon: Sparkles }
]

function typeLabel(filter: Filter): string {
  return filterOptions.find((o) => o.value === filter)?.label.toLowerCase() ?? 'todos'
}

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

export default function Media() {
  const { media, mediaLoaded, loadMedia, subscribeMedia } = useLibraryStore()
  const { settings, loaded: settingsLoaded, load: loadSettings } = useSettingsStore()
  const meta = useMediaMetaStore((s) => s.meta)
  const loadMeta = useMediaMetaStore((s) => s.load)
  const subscribeMeta = useMediaMetaStore((s) => s.subscribe)
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Carpeta actual dentro de la carpeta de media ('' = raíz).
  const [path, setPath] = useState('')

  useEffect(() => {
    void loadMedia()
    const unsub = subscribeMedia()
    return unsub
  }, [loadMedia, subscribeMedia])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => subscribeMeta(), [subscribeMeta])

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

  const searching = query.trim().length > 0

  const visible = useMemo(() => {
    const byType = filter === 'all' ? media : media.filter((m) => m.type === filter)
    if (categoryFilter === 'all') return byType
    return byType.filter((m) => {
      const category = meta.categories[m.id]
      return categoryFilter === 'none' ? !category : category === categoryFilter
    })
  }, [media, filter, categoryFilter, meta.categories])

  // Buscando: resultados planos de toda la librería. Si no, la carpeta abierta.
  const folders = useMemo(
    () => (searching ? [] : childFolders(visible, path)),
    [searching, visible, path]
  )
  const filtered = useMemo(
    () => (searching ? searchMedia(visible, query) : itemsInFolder(visible, path)),
    [searching, visible, query, path]
  )

  // "Para hoy" ignora los filtros a propósito: es la lista del servicio y tiene
  // que estar completa aunque el operador esté filtrando por tipo o categoría.
  const forToday = useMemo(() => todayItems(media, meta), [media, meta])
  const categoryCounts = useCategoryCounts(media, meta.categories)
  // Si el archivo seleccionado se borra del disco, el panel vuelve al vacío en
  // vez de quedar en blanco (SelectionPanel devolvía null con item === null).
  const selectedItem = useMemo(
    () => (selectedId ? (media.find((m) => m.id === selectedId) ?? null) : null),
    [media, selectedId]
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
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-4 py-2">
          {filterOptions.map((opt) => {
            const Icon = opt.icon
            const isActive = filter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  isActive
                    ? 'bg-listo text-cabina-negro'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {opt.label}
              </button>
            )
          })}

          <SearchBox value={query} onChange={setQuery} />

          {/* La ruta puede ser larguísima: se corta con "…" y entera va en el
              título. Antes empujaba los filtros fuera de la pantalla. */}
          <span
            className="min-w-0 max-w-full flex-1 truncate text-xs text-slate-500"
            title={settings.mediaFolder ?? undefined}
          >
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'} ·{' '}
            <span className="font-mono">{settings.mediaFolder}</span>
          </span>
        </div>

        <CategoryFilterBar
          value={categoryFilter}
          onChange={setCategoryFilter}
          counts={categoryCounts}
        />

        <TodayStrip items={forToday} selectedId={selectedId} onSelect={setSelectedId} />

        {/* Breadcrumb de carpetas — sin sentido mientras se busca en todo */}
        {!searching && <FolderBreadcrumb path={path} onNavigate={setPath} />}

        <div className="flex-1 overflow-y-auto p-4">
          {searching && (
            <p className="mb-3 text-xs text-slate-500">
              {filtered.length === 0
                ? 'Sin resultados'
                : `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`}{' '}
              para <span className="font-medium text-slate-300">“{query.trim()}”</span> en toda la
              carpeta de media.
            </p>
          )}
          {folders.length === 0 && filtered.length === 0 ? (
            <p className="mt-12 text-center text-sm text-slate-500">
              {searching
                ? 'Ningún archivo coincide con la búsqueda.'
                : `No hay archivos ${filter !== 'all' ? `del tipo "${typeLabel(filter)}"` : ''} en esta carpeta.`}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {folders.map((name) => {
                const folderPath = path ? `${path}/${name}` : name
                return (
                  <FolderCard
                    key={`folder-${name}`}
                    name={name}
                    count={countInFolder(visible, folderPath)}
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
                  category={meta.categories[item.id] ?? null}
                  isToday={meta.today.ids.includes(item.id)}
                  showFolder={searching}
                />
              ))}
            </ul>
          )}
        </div>

        <VideoTransport media={media} />
      </div>

      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-slate-700 p-4 xl:w-80" aria-label="Detalle del archivo elegido">
        {selectedItem ? (
          <SelectionPanel
            // key: resetea el checkbox de loop y la duración al cambiar de item
            key={selectedItem.id}
            item={selectedItem}
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

/** Cuántos items hay por categoría (y cuántos sin categorizar). */
function useCategoryCounts(
  media: MediaItem[],
  categories: Record<string, MediaCategory>
): Record<CategoryFilter, number> {
  return useMemo(() => {
    const counts = { all: media.length, none: 0 } as Record<CategoryFilter, number>
    for (const c of MEDIA_CATEGORIES) counts[c.value] = 0
    for (const item of media) {
      const category = categories[item.id]
      if (category) counts[category] += 1
      else counts.none += 1
    }
    return counts
  }, [media, categories])
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative ml-2 min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('')
        }}
        placeholder="Buscar por nombre o carpeta…"
        aria-label="Buscar archivos de media"
        className="w-full rounded-md border border-slate-700 bg-slate-900 py-1 pl-7 pr-7 text-xs text-slate-100 placeholder:text-slate-600 focus:border-listo-borde focus:outline-none"
      />
      {value && (
        <button
          aria-label="Limpiar búsqueda"
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
          title="Limpiar búsqueda"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function CategoryFilterBar({
  value,
  onChange,
  counts
}: {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
  counts: Record<CategoryFilter, number>
}) {
  const options: { value: CategoryFilter; label: string; activeClass: string }[] = [
    { value: 'all', label: 'Todas', activeClass: 'bg-cabina-tinta text-cabina-negro' },
    ...MEDIA_CATEGORIES.map((c) => ({
      value: c.value as CategoryFilter,
      label: c.label,
      activeClass: c.activeClass
    })),
    { value: 'none', label: 'Sin categoría', activeClass: 'bg-cabina-tinta text-cabina-negro' }
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700/60 bg-slate-800/20 px-4 py-1.5">
      <span className="inline-flex items-center gap-1 pr-1 text-[11px] uppercase tracking-wider text-slate-500">
        <Tag className="h-3 w-3" />
        Categoría
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
            value === opt.value
              ? opt.activeClass
              : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          {opt.label}
          <span className="ml-1 opacity-60">{counts[opt.value] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Fila fija arriba con los archivos marcados para el servicio de hoy. Es una
 * selección momentánea: se vacía sola cuando cambia el día.
 */
function TodayStrip({
  items,
  selectedId,
  onSelect
}: {
  items: MediaItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const toggleToday = useMediaMetaStore((s) => s.toggleToday)
  const clearToday = useMediaMetaStore((s) => s.clearToday)
  const abrirMenu = useMenuContextual()
  if (items.length === 0) return null
  return (
    <section className="border-b border-listo-borde bg-listo-suave px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium text-listo">
          <CalendarCheck className="h-3.5 w-3.5" />
          Para hoy
          <span className="rounded-full bg-listo-suave px-1.5 text-[10px]">{items.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => void clearToday()}
          className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-700 hover:text-falla"
          title="Sacar todos los archivos de la lista de hoy"
        >
          Vaciar
        </button>
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <div
              className={`group relative w-32 overflow-hidden rounded-md border bg-black ${
                item.id === selectedId
                  ? 'border-listo ring-2 ring-listo-borde'
                  : 'border-listo-borde hover:border-listo'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                onContextMenu={(e) => {
                  onSelect(item.id)
                  abrirMenu(e, menuParaMedia(item))
                }}
                className="block w-full text-left"
                title={item.fileName}
              >
                <div className="aspect-video">
                  <Thumb item={item} />
                </div>
                <span className="block truncate px-1.5 py-1 text-[10px] text-slate-300">
                  {item.fileName}
                </span>
              </button>
              <button
                aria-label="Sacar de la lista de hoy"
                type="button"
                onClick={() => void toggleToday(item.id)}
                className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-listo opacity-0 transition-opacity hover:text-falla group-hover:opacity-100 focus-visible:opacity-100"
                title="Sacar de la lista de hoy"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
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
        className="group block w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800/40 text-left transition-colors hover:border-listo hover:bg-slate-800"
        title={`Abrir carpeta "${name}"`}
      >
        <div className="flex aspect-video items-center justify-center bg-slate-900/60">
          <Folder className="h-12 w-12 text-listo/80 transition-transform group-hover:scale-110" />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="truncate text-xs font-medium text-slate-200" title={name}>
            {name}
          </span>
          <span className="shrink-0 rounded bg-listo-suave px-1.5 py-0.5 text-[10px] font-medium text-listo">
            {count}
          </span>
        </div>
      </button>
    </li>
  )
}

/** Miniatura sin controles: video mudo con metadata o imagen perezosa. */
function Thumb({ item, onDuration }: { item: MediaItem; onDuration?: (d: number) => void }) {
  const src = `media://${item.id}`
  if (item.type === 'video') {
    return (
      <video
        src={src}
        className="h-full w-full object-cover"
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
      />
    )
  }
  return (
    <img src={src} alt={item.fileName} className="h-full w-full object-cover" loading="lazy" />
  )
}

interface MediaCardProps {
  item: MediaItem
  isSelected: boolean
  onSelect: () => void
  category: MediaCategory | null
  isToday: boolean
  /** En resultados de búsqueda mostramos la carpeta donde vive el archivo. */
  showFolder?: boolean
}

function MediaCard({
  item,
  isSelected,
  onSelect,
  category,
  isToday,
  showFolder = false
}: MediaCardProps) {
  const toggleToday = useMediaMetaStore((s) => s.toggleToday)
  const abrirMenu = useMenuContextual()
  // Duración leída del propio <video> una vez cargada la metadata.
  const [duration, setDuration] = useState<number | null>(null)
  const info = category ? categoryInfo(category) : undefined
  return (
    <li>
      <div
        className={`group relative overflow-hidden rounded-md border bg-slate-950 transition-colors ${
          isSelected
            ? 'border-listo ring-2 ring-listo-borde'
            : isToday
              ? 'border-listo-borde'
              : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          onContextMenu={(e) => {
            // Clic derecho también lo elige: el panel de la derecha muestra
            // de qué archivo se trata mientras se decide qué hacer.
            onSelect()
            abrirMenu(e, menuParaMedia(item))
          }}
          aria-pressed={isSelected}
          aria-label={`${item.fileName}${isToday ? ', marcado para hoy' : ''}`}
          className="block w-full text-left"
        >
          <div className="relative aspect-video bg-black">
            <Thumb item={item} onDuration={setDuration} />
            {item.type === 'video' && duration !== null && (
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                {formatDuration(duration)}
              </span>
            )}
            {info && (
              <span
                className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${info.badgeClass}`}
              >
                {info.label}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-slate-300" title={item.fileName}>
                {item.fileName}
              </span>
              {showFolder && (
                <span
                  className="block truncate text-[10px] text-slate-600"
                  title={item.folder || 'raíz'}
                >
                  {item.folder || 'raíz'}
                </span>
              )}
            </span>
            <TypeBadge type={item.type} />
          </div>
        </button>

        {/* Marcar para hoy — siempre visible si está marcado, si no al hover */}
        <button
          aria-label={isToday ? 'Sacar de la lista de hoy' : 'Marcar para hoy'}
          type="button"
          onClick={() => void toggleToday(item.id)}
          aria-pressed={isToday}
          className={`absolute right-1 top-1 rounded bg-black/70 p-1 transition-opacity ${
            isToday
              ? 'text-listo opacity-100'
              : 'text-slate-300 opacity-0 hover:text-listo focus:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
          title={isToday ? 'Sacar de la lista de hoy' : 'Marcar para hoy'}
        >
          <Star className="h-3.5 w-3.5" fill={isToday ? 'currentColor' : 'none'} />
        </button>
      </div>
    </li>
  )
}

function TypeBadge({ type }: { type: MediaType }) {
  // El tipo no es un estado: va en gris. El verde, el ámbar y el rojo dicen
  // en qué situación está algo (listo, preparado, al aire), no qué es.
  const styles: Record<MediaType, string> = {
    image: 'bg-cabina-alto text-cabina-tinta-dim',
    video: 'bg-cabina-alto text-cabina-tinta-dim',
    gif: 'bg-cabina-alto text-cabina-tinta-dim'
  }
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[type]}`}>
      {type.toUpperCase()}
    </span>
  )
}

interface SelectionPanelProps {
  item: MediaItem
  onClear: () => void
}

function SelectionPanel({ item, onClear }: SelectionPanelProps) {
  const [loop, setLoop] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const settings = useSettingsStore((s) => s.settings)
  const queueIds = useVideoQueueStore((s) => s.ids)
  const addToQueue = useVideoQueueStore((s) => s.add)
  const removeFromQueue = useVideoQueueStore((s) => s.remove)
  const meta = useMediaMetaStore((s) => s.meta)
  const setCategory = useMediaMetaStore((s) => s.setCategory)
  const toggleToday = useMediaMetaStore((s) => s.toggleToday)
  const src = `media://${item.id}`
  const isVideo = item.type === 'video'
  const queuePos = queueIds.indexOf(item.id)
  const category = meta.categories[item.id] ?? null
  const isToday = meta.today.ids.includes(item.id)
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">Seleccionado</h3>
        <button
          aria-label="Limpiar selección"
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
          <video
            src={src}
            className="aspect-video w-full"
            controls
            muted
            playsInline
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          />
        ) : (
          <img src={src} alt={item.fileName} className="aspect-video w-full object-contain" />
        )}
      </div>

      <p className="mt-3 truncate text-xs text-slate-400" title={item.fileName}>
        {item.fileName}
      </p>
      {isVideo && duration !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          Duración: <span className="font-medium">{formatDuration(duration)}</span>
        </p>
      )}
      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600" title={item.filePath}>
        {item.filePath}
      </p>

      {/* Categoría del archivo — se guarda al instante */}
      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
          <Tag className="h-3 w-3" />
          Categoría
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MEDIA_CATEGORIES.map((c) => {
            const active = category === c.value
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                // Volver a tocar la categoría activa la saca.
                onClick={() => void setCategory(item.id, active ? null : c.value)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                  active
                    ? c.activeClass
                    : 'border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void toggleToday(item.id)}
        aria-pressed={isToday}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          isToday
            ? 'bg-listo-suave text-listo hover:bg-listo/30'
            : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
        }`}
      >
        <Star className="h-3.5 w-3.5" fill={isToday ? 'currentColor' : 'none'} />
        {isToday ? 'En la lista de hoy' : 'Marcar para hoy'}
      </button>

      {isVideo && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-listo focus:ring-0"
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
          className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold border border-aire-borde bg-cabina-alto text-cabina-tinta transition-colors hover:bg-aire hover:text-white"
        >
          <Eye className="h-4 w-4" />
          Mostrar en proyección
        </button>
        {isVideo &&
          (queuePos === -1 ? (
            <button
              type="button"
              onClick={() => addToQueue(item.id)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-listo-borde px-3 py-2 text-sm font-medium text-listo transition-colors hover:bg-listo-suave"
            >
              <ListPlus className="h-4 w-4" aria-hidden />
              Añadir a la cola
            </button>
          ) : (
            <button
              type="button"
              onClick={() => removeFromQueue(item.id)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-listo-borde bg-listo-suave px-3 py-2 text-sm font-medium text-listo transition-colors hover:bg-listo/25"
            >
              <ListVideo className="h-4 w-4" aria-hidden />
              En cola (#{queuePos + 1}) — quitar
            </button>
          ))}
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
          <ListVideo className="h-4 w-4 text-listo" aria-hidden />
          Cola de videos
          {active && (
            <span className="rounded bg-aire px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
              AL AIRE
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => {
            if (active) stopQueue()
            clear()
          }}
          className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-700 hover:text-falla"
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
                  ? 'border-aire-borde bg-aire-suave text-cabina-tinta'
                  : 'border-slate-700 bg-slate-800/40 text-slate-300'
              }`}
              aria-current={isCurrent ? 'true' : undefined}
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
              <span className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex">
                <button
                  aria-label="Subir"
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  title="Subir"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  aria-label="Bajar"
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={i === items.length - 1}
                  className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  title="Bajar"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  aria-label="Quitar de la cola"
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded p-0.5 text-slate-500 hover:text-falla"
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border border-aire-borde bg-cabina-alto text-cabina-tinta transition-colors hover:bg-aire hover:text-white"
          >
            <Play className="h-3.5 w-3.5" />
            Reproducir cola
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={skipNext}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-cabina-tinta hover:bg-slate-600"
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
  const { mediaId, position, duration, playing, ended, volume, setVolume } =
    useMediaPlaybackStore()
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
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-aire-borde bg-aire-suave px-4 py-2.5"
      role="group"
      aria-label={`Video al aire: ${item.fileName}`}
    >
      {/* Es lo que la congregación está viendo: rojo de "al aire". */}
      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-rotulo text-aire">
        <Film className="h-4 w-4" aria-hidden />
        Al aire
      </span>
      <span className="min-w-0 max-w-[220px] truncate text-xs text-cabina-tinta" title={item.fileName}>
        {item.fileName}
      </span>

      <button
        aria-label="Reiniciar"
        type="button"
        onClick={() => send({ type: 'seekMedia', position: 0 })}
        className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
        title="Reiniciar"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      {ended ? (
        // El clip terminó: el botón principal lo reproduce de nuevo desde el inicio.
        <button
          type="button"
          onClick={() => send({ type: 'replayMedia' })}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border border-aire-borde bg-cabina-alto text-cabina-tinta transition-colors hover:bg-aire hover:text-white"
          title="Reproducir de nuevo"
        >
          <RotateCcw className="h-4 w-4" />
          De nuevo
        </button>
      ) : (
        <button
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          type="button"
          onClick={() => send({ type: 'setMediaPlaying', playing: !playing })}
          className="rounded-full bg-cabina-tinta p-2 text-cabina-negro hover:bg-white"
          title={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 pl-0.5" aria-hidden />}
        </button>
      )}

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
        className="seek-range h-1.5 min-w-[120px] flex-1 cursor-pointer appearance-none rounded-full"
        aria-label="Posición del video"
        aria-valuetext={`${formatTime(shown)} de ${formatTime(duration)}`}
        style={{
          background: `linear-gradient(to right, #e2483b 0%, #e2483b ${pct}%, #332e29 ${pct}%, #332e29 100%)`
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
          aria-label={volume > 0 ? 'Silenciar el video' : 'Activar el sonido del video'}
        >
          {volume > 0 ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
          className="seek-range h-1.5 w-24 cursor-pointer appearance-none rounded-full"
          aria-label="Volumen del video"
          aria-valuetext={`${Math.round(volume * 100)} por ciento`}
          style={{
            background: `linear-gradient(to right, #efe6d6 0%, #efe6d6 ${volume * 100}%, #332e29 ${volume * 100}%, #332e29 100%)`
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

/**
 * Duración legible en horas/minutos/segundos. Adaptativo: muestra las horas
 * solo si las hay. Ej: "45s", "4m 12s", "1h 05m 12s".
 */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`
  if (m > 0) return `${m}m ${pad(s)}s`
  return `${s}s`
}
