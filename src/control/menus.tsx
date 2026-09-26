import {
  CalendarCheck,
  Copy,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  ListEnd,
  ListPlus,
  ListVideo,
  Play,
  Repeat,
  Tag,
  Trash2,
  Wallpaper,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { useLiveControlsStore } from '@/shared/store/liveControlsStore'
import { useMediaMetaStore } from '@/shared/store/mediaMetaStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useVideoQueueStore } from '@/shared/store/videoQueueStore'
import { useAudioStore } from '@/shared/store/audioStore'
import { MEDIA_CATEGORIES, type MediaItem } from '@/shared/types/media'
import type { AudioTrack } from '@/shared/types/audio'
import type { EntradaMenu } from './components/ui/MenuContextual'

/**
 * Las opciones de clic derecho de cada cosa de la biblioteca.
 *
 * Viven acá y no en cada página porque el mismo archivo aparece en varios
 * lados (la galería de Media, los fondos de En Vivo, la fila "para hoy") y
 * tiene que ofrecer lo mismo en todos. Leen el estado al momento de abrir el
 * menú (`getState()`), así una opción dice "Quitar de la cola" si ya está.
 */

const icono = 'h-4 w-4'

function copiar(texto: string, aviso: string): void {
  void navigator.clipboard.writeText(texto).then(() => toast.success(aviso))
}

// ─── Archivos de media ───────────────────────────────────────────────────────

/** Muestra un archivo en la pantalla, con los fundidos de Ajustes. */
export function mostrarMedia(item: MediaItem, loop = false): void {
  const s = useSettingsStore.getState().settings
  const esVideo = item.type === 'video'
  window.electronAPI?.sendProjectionCommand({
    type: 'showMedia',
    mediaId: item.id,
    mode: item.type,
    loop: esVideo && loop,
    fadeIn: esVideo ? (s?.videoFadeIn ?? true) : false,
    fadeOut: esVideo ? (s?.videoFadeOut ?? false) : false,
    fadeInSec: s?.videoFadeInSec ?? 1,
    fadeOutSec: s?.videoFadeOutSec ?? 2.5
  })
}

/** Lo pone (o lo saca) como fondo en loop, detrás de letras y versículos. */
export function alternarFondo(item: MediaItem): void {
  const lc = useLiveControlsStore.getState()
  const quitar = lc.backgroundId === item.id
  lc.setBackgroundId(quitar ? null : item.id)
  lc.setSlideshowActive(false)
  window.electronAPI?.sendProjectionCommand({ type: 'setBackground', mediaId: quitar ? null : item.id })
}

export function menuParaMedia(item: MediaItem, extra: { alElegir?: () => void } = {}): EntradaMenu[] {
  const esVideo = item.type === 'video'
  const meta = useMediaMetaStore.getState()
  const cola = useVideoQueueStore.getState()
  const lc = useLiveControlsStore.getState()
  const categoria = meta.meta.categories[item.id] ?? null
  const hoy = meta.meta.today.ids.includes(item.id)
  const enCola = cola.ids.includes(item.id)
  const esFondo = lc.backgroundId === item.id
  const enPresentacion = lc.slideshowIds.includes(item.id)

  return [
    { titulo: item.fileName },
    {
      etiqueta: 'Mostrar en proyección',
      icono: <Eye className={icono} />,
      variante: 'aire',
      onSelect: () => {
        extra.alElegir?.()
        mostrarMedia(item)
      }
    },
    esVideo && {
      etiqueta: 'Mostrar en loop',
      icono: <Repeat className={icono} />,
      variante: 'aire',
      onSelect: () => mostrarMedia(item, true)
    },
    {
      etiqueta: esFondo ? 'Quitar de fondo' : 'Poner de fondo',
      icono: <Wallpaper className={icono} />,
      variante: esFondo ? 'normal' : 'aire',
      onSelect: () => alternarFondo(item)
    },
    'separador',
    esVideo && !enCola && {
      etiqueta: 'Añadir a la cola de videos',
      icono: <ListPlus className={icono} />,
      detalle: cola.ids.length ? `${cola.ids.length} en cola` : undefined,
      onSelect: () => {
        cola.add(item.id)
        toast('En la cola de videos', { description: item.fileName })
      }
    },
    esVideo && {
      etiqueta: 'Reproducir a continuación',
      icono: <ListEnd className={icono} />,
      onSelect: () => {
        cola.addNext(item.id)
        toast('Sigue después del video actual', { description: item.fileName })
      }
    },
    esVideo && enCola && {
      etiqueta: 'Quitar de la cola',
      icono: <ListVideo className={icono} />,
      onSelect: () => cola.remove(item.id)
    },
    !esVideo && {
      etiqueta: enPresentacion ? 'Quitar de la presentación' : 'Agregar a la presentación',
      icono: <ImageIcon className={icono} />,
      detalle: enPresentacion ? `#${lc.slideshowIds.indexOf(item.id) + 1}` : undefined,
      onSelect: () => lc.toggleSlideshowItem(item.id)
    },
    {
      etiqueta: hoy ? 'Sacar de "para hoy"' : 'Marcar para hoy',
      icono: <CalendarCheck className={icono} />,
      onSelect: () => void meta.toggleToday(item.id)
    },
    {
      etiqueta: 'Categoría',
      icono: <Tag className={icono} />,
      submenu: [
        ...MEDIA_CATEGORIES.map((c) => ({
          etiqueta: c.label,
          marcado: categoria === c.value,
          onSelect: () => void meta.setCategory(item.id, categoria === c.value ? null : c.value)
        })),
        'separador' as const,
        {
          etiqueta: 'Sin categoría',
          marcado: categoria === null,
          onSelect: () => void meta.setCategory(item.id, null)
        }
      ]
    },
    'separador',
    {
      etiqueta: 'Mostrar en la carpeta',
      icono: <FolderOpen className={icono} />,
      onSelect: () => void window.electronAPI?.showItemInFolder('media', item.id)
    },
    {
      etiqueta: 'Copiar el nombre',
      icono: <Copy className={icono} />,
      onSelect: () => copiar(item.fileName, 'Nombre copiado')
    }
  ]
}

// ─── Temas de música ─────────────────────────────────────────────────────────

export function menuParaTema(
  track: AudioTrack,
  opciones: {
    reproducir: () => void
    sonando: boolean
    /** Si se está mirando una playlist, para ofrecer sacarlo de ella. */
    playlistActiva?: { id: string; name: string } | null
  }
): EntradaMenu[] {
  const a = useAudioStore.getState()
  return [
    { titulo: track.title },
    {
      etiqueta: opciones.sonando ? 'Pausar' : 'Reproducir',
      icono: <Play className={icono} />,
      onSelect: opciones.reproducir
    },
    {
      etiqueta: 'Reproducir a continuación',
      icono: <ListEnd className={icono} />,
      onSelect: () => {
        a.enqueueNext(track.id)
        toast('Suena después del tema actual', { description: track.title })
      }
    },
    {
      etiqueta: 'Agregar a la cola',
      icono: <ListPlus className={icono} />,
      detalle: a.queue.length ? `${a.queue.length} en cola` : undefined,
      onSelect: () => {
        a.enqueue(track.id)
        toast('En la cola', { description: track.title })
      }
    },
    {
      etiqueta: 'Playlists',
      icono: <ListVideo className={icono} />,
      deshabilitado: a.playlists.length === 0,
      detalle: a.playlists.length === 0 ? 'ninguna' : undefined,
      submenu: a.playlists.map((p) => {
        const esta = p.trackIds.includes(track.id)
        return {
          etiqueta: p.name,
          marcado: esta,
          onSelect: () =>
            void (esta ? a.removeTrackFromPlaylist(p.id, track.id) : a.addTrackToPlaylist(p.id, track.id))
        }
      })
    },
    opciones.playlistActiva && {
      etiqueta: `Quitar de «${opciones.playlistActiva.name}»`,
      icono: <X className={icono} />,
      variante: 'peligro',
      onSelect: () => void a.removeTrackFromPlaylist(opciones.playlistActiva!.id, track.id)
    },
    'separador',
    {
      etiqueta: 'Mostrar en la carpeta',
      icono: <FolderOpen className={icono} />,
      onSelect: () => void window.electronAPI?.showItemInFolder('audio', track.id)
    },
    {
      etiqueta: 'Copiar el título',
      icono: <Copy className={icono} />,
      onSelect: () =>
        copiar(track.artist ? `${track.title} — ${track.artist}` : track.title, 'Título copiado')
    }
  ]
}

export const iconos = { Copy, Eye, Trash2, FolderOpen, X, Play }
export { copiar }
