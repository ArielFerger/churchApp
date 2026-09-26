import { useEffect, useMemo, useState } from 'react'
import {
  Eye,
  Wallpaper,
  Film,
  Image as ImageIcon,
  Repeat,
  Images,
  Play,
  Square,
  Folder,
  ChevronRight,
  Home
} from 'lucide-react'
import { useLiveStore } from '@/shared/store/liveStore'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useLiveControlsStore } from '@/shared/store/liveControlsStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import {
  itemsInFolder,
  childFolders,
  countInFolder,
  breadcrumbSegments
} from '@/shared/utils/mediaFolders'
import type { ProjectionCommand } from '@/shared/types/ipc'
import type { MediaItem } from '@/shared/types/media'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

export default function Live() {
  const { lastCommand } = useLiveStore()
  const {
    media,
    mediaLoaded,
    loadMedia,
    subscribeMedia,
    liveMedia,
    liveMediaLoaded,
    loadLiveMedia,
    subscribeLiveMedia
  } = useLibraryStore()
  const { settings, loaded: settingsLoaded, load: loadSettings } = useSettingsStore()
  const {
    testSlideText,
    setTestSlideText,
    resetTestSlideText,
    backgroundId,
    setBackgroundId,
    slideshowIds,
    slideshowIntervalSec,
    slideshowActive,
    toggleSlideshowItem,
    clearSlideshow,
    setSlideshowInterval,
    setSlideshowActive
  } = useLiveControlsStore()

  // Carpeta actual dentro del picker de fondo ('' = raíz).
  const [bgPath, setBgPath] = useState('')

  useEffect(() => {
    void loadMedia()
    void loadLiveMedia()
    const unsubMedia = subscribeMedia()
    const unsubLive = subscribeLiveMedia()
    return () => {
      unsubMedia()
      unsubLive()
    }
  }, [loadMedia, subscribeMedia, loadLiveMedia, subscribeLiveMedia])

  useEffect(() => {
    if (!settingsLoaded) void loadSettings()
  }, [settingsLoaded, loadSettings])

  // Fuente del fondo en loop: la carpeta dedicada (si está configurada en
  // Ajustes) o, como antes, la carpeta general de media.
  const hasLiveFolder = Boolean(settings?.liveLoopFolder)
  const bgSource = hasLiveFolder ? liveMedia : media
  const bgSourceLoaded = hasLiveFolder ? liveMediaLoaded : mediaLoaded

  // Si cambia la fuente o la carpeta actual ya no existe, volver a la raíz.
  useEffect(() => {
    setBgPath('')
  }, [hasLiveFolder])
  useEffect(() => {
    if (
      bgPath &&
      itemsInFolder(bgSource, bgPath).length === 0 &&
      childFolders(bgSource, bgPath).length === 0
    ) {
      setBgPath('')
    }
  }, [bgSource, bgPath])

  // Videos first (most useful as looping backgrounds), then images/gifs.
  const bgCandidates = useMemo(
    () =>
      itemsInFolder(bgSource, bgPath).sort((a, b) => {
        const rank = (m: MediaItem) => (m.type === 'video' ? 0 : 1)
        return rank(a) - rank(b)
      }),
    [bgSource, bgPath]
  )
  const bgFolders = useMemo(() => childFolders(bgSource, bgPath), [bgSource, bgPath])

  // Images / gifs available for the slideshow.
  const slideshowCandidates = useMemo(
    () => media.filter((m) => m.type === 'image' || m.type === 'gif'),
    [media]
  )

  // Keep the projection slideshow in sync while it's running.
  useEffect(() => {
    if (slideshowActive && slideshowIds.length > 0) {
      send({
        type: 'setBackgroundSlideshow',
        mediaIds: slideshowIds,
        intervalSec: slideshowIntervalSec
      })
    }
  }, [slideshowActive, slideshowIds, slideshowIntervalSec])

  function projectTestSlide() {
    send({ type: 'showSlide', content: { lines: testSlideText.split('\n') } })
  }

  function setSingleBackground(id: string | null) {
    setBackgroundId(id)
    setSlideshowActive(false) // single bg supersedes any slideshow
    send({ type: 'setBackground', mediaId: id })
  }

  function startSlideshow() {
    if (slideshowIds.length === 0) return
    setBackgroundId(null)
    setSlideshowActive(true)
    send({ type: 'setBackgroundSlideshow', mediaIds: slideshowIds, intervalSec: slideshowIntervalSec })
  }

  function stopSlideshow() {
    setSlideshowActive(false)
    send({ type: 'setBackground', mediaId: null })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Editors */}
      <section className="flex-1 overflow-y-auto p-6">
        <h1 className="text-xl font-semibold">En Vivo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Editá el slide de prueba, ponele un fondo en loop o armá una presentación de imágenes. Las
          acciones rápidas (Detener, Blackout, Limpiar) están siempre arriba a la derecha.
        </p>

        {/* Editable test slide */}
        <div className="mt-6 max-w-3xl rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Slide de prueba
            </h3>
            <button
              type="button"
              onClick={resetTestSlideText}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Restablecer
            </button>
          </div>
          <textarea
            value={testSlideText}
            onChange={(e) => setTestSlideText(e.target.value)}
            rows={Math.max(3, testSlideText.split('\n').length)}
            placeholder="Escribí el texto del slide — una línea por renglón"
            className="mt-2 w-full resize-y rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-listo-borde focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={projectTestSlide}
              disabled={!testSlideText.trim()}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-aire-borde bg-cabina-alto text-cabina-tinta transition-colors hover:bg-aire hover:text-white disabled:opacity-40"
            >
              <Eye className="h-4 w-4" />
              Proyectar slide
            </button>
          </div>
        </div>

        {/* Single background picker */}
        <div className="mt-6 max-w-3xl rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Wallpaper className="h-3.5 w-3.5" />
              Fondo único (loop)
            </h3>
            {backgroundId && (
              <button
                type="button"
                onClick={() => setSingleBackground(null)}
                className="text-xs text-slate-400 hover:text-falla"
              >
                Quitar fondo
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Un video o imagen fijo. Los videos se repiten en loop detrás del contenido.
            {hasLiveFolder ? (
              <>
                {' '}
                Fuente:{' '}
                <span className="font-mono text-slate-400">{settings?.liveLoopFolder}</span>
              </>
            ) : (
              <> Fuente: carpeta de media (podés asignar una carpeta aparte en Ajustes).</>
            )}
          </p>

          {/* Breadcrumb de subcarpetas */}
          {(bgPath || bgFolders.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setBgPath('')}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                  bgPath
                    ? 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    : 'font-medium text-slate-200'
                }`}
                title="Raíz"
              >
                <Home className="h-3 w-3" />
                Raíz
              </button>
              {breadcrumbSegments(bgPath).map((seg, i, arr) => (
                <span key={seg.path} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-slate-600" />
                  {i === arr.length - 1 ? (
                    <span className="px-1 font-medium text-slate-200">{seg.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBgPath(seg.path)}
                      className="rounded px-1 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                    >
                      {seg.name}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {!bgSourceLoaded ? (
            <p className="mt-3 text-xs text-slate-500">Cargando media…</p>
          ) : bgCandidates.length === 0 && bgFolders.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {hasLiveFolder
                ? 'No hay videos en la carpeta de loops. Agregá archivos o cambiala en Ajustes.'
                : 'No hay media. Configurá la carpeta en Ajustes.'}
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {bgFolders.map((name) => {
                const folderPath = bgPath ? `${bgPath}/${name}` : name
                return (
                  <li key={`folder-${name}`}>
                    <button
                      type="button"
                      onClick={() => setBgPath(folderPath)}
                      className="group relative block w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800/60 text-left transition-colors hover:border-listo"
                      title={`Abrir carpeta "${name}"`}
                    >
                      <div className="flex aspect-video flex-col items-center justify-center gap-1">
                        <Folder className="h-7 w-7 text-listo/80 transition-transform group-hover:scale-110" />
                        <span className="max-w-full truncate px-1 text-[10px] text-slate-300">
                          {name}
                        </span>
                      </div>
                      <span className="absolute right-1 top-1 rounded bg-listo-suave px-1 text-[9px] font-medium text-listo">
                        {countInFolder(bgSource, folderPath)}
                      </span>
                    </button>
                  </li>
                )
              })}
              {bgCandidates.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSingleBackground(item.id)}
                    className={`group relative block w-full overflow-hidden rounded-md border bg-black text-left transition-colors ${
                      backgroundId === item.id
                        ? 'border-listo ring-2 ring-listo-borde'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                    title={item.fileName}
                  >
                    <div className="aspect-video">
                      {item.type === 'video' ? (
                        <video
                          src={`media://${item.id}`}
                          className="h-full w-full object-cover"
                          preload="metadata"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={`media://${item.id}`}
                          alt={item.fileName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-slate-200">
                      {item.type === 'video' ? (
                        <Film className="h-3 w-3" />
                      ) : (
                        <ImageIcon className="h-3 w-3" />
                      )}
                    </span>
                    {backgroundId === item.id && item.type === 'video' && (
                      <span className="absolute right-1 top-1 rounded bg-listo p-0.5 text-cabina-negro">
                        <Repeat className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Background slideshow builder */}
        <div className="mt-6 max-w-3xl rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Images className="h-3.5 w-3.5" />
              Presentación de fondo
              {slideshowActive && (
                <span className="rounded-full bg-ok-suave px-2 py-0.5 text-[10px] font-semibold text-ok">
                  EN VIVO
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Tiempo por imagen
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={slideshowIntervalSec}
                  onChange={(e) =>
                    setSlideshowInterval(Math.max(1, Math.min(120, Number(e.target.value) || 1)))
                  }
                  className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-listo-borde focus:outline-none"
                />
                <span className="text-slate-500">seg</span>
              </label>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Elegí varias imágenes (en orden) y se irán pasando solas en loop. Seleccionadas:{' '}
            <span className="font-medium text-slate-300">{slideshowIds.length}</span>
          </p>

          {!mediaLoaded ? (
            <p className="mt-3 text-xs text-slate-500">Cargando media…</p>
          ) : slideshowCandidates.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              No hay imágenes en la carpeta de media.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slideshowCandidates.map((item) => {
                const order = slideshowIds.indexOf(item.id)
                const selected = order !== -1
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleSlideshowItem(item.id)}
                      className={`group relative block w-full overflow-hidden rounded-md border bg-black text-left transition-colors ${
                        selected
                          ? 'border-ok ring-2 ring-ok-borde'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                      title={item.fileName}
                    >
                      <div className="aspect-video">
                        <img
                          src={`media://${item.id}`}
                          alt={item.fileName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {selected && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-listo text-[11px] font-bold text-cabina-negro">
                          {order + 1}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!slideshowActive ? (
              <button
                type="button"
                onClick={startSlideshow}
                disabled={slideshowIds.length === 0}
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-aire-borde bg-cabina-alto text-cabina-tinta transition-colors hover:bg-aire hover:text-white disabled:opacity-40"
              >
                <Play className="h-4 w-4" />
                Iniciar presentación
              </button>
            ) : (
              <button
                type="button"
                onClick={stopSlideshow}
                className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-cabina-negro hover:bg-slate-600"
              >
                <Square className="h-4 w-4" />
                Detener
              </button>
            )}
            {slideshowIds.length > 0 && (
              <button
                type="button"
                onClick={clearSlideshow}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
              >
                Limpiar selección
              </button>
            )}
          </div>
        </div>

        {/* Debug: last command */}
        <details className="mt-6 max-w-3xl">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-slate-400">
            Último comando enviado
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-3 font-mono text-xs text-slate-400">
            {lastCommand ? JSON.stringify(lastCommand, null, 2) : 'ningún comando todavía'}
          </pre>
        </details>
      </section>
    </div>
  )
}
