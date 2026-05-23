import { useEffect, useMemo, useState } from 'react'
import { Film, Image as ImageIcon, FolderOpen, Sparkles, Eye, Wallpaper, X } from 'lucide-react'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
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
  if (!item) return null
  const src = `media://${item.id}`
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
        {item.type === 'video' ? (
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

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => send({ type: 'showMedia', mediaId: item.id, mode: item.type })}
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
