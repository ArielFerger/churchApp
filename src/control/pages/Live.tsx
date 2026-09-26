import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  Eye,
  Film,
  Folder,
  Home,
  Image as ImageIcon,
  Images,
  Play,
  Radio,
  Repeat,
  RotateCcw,
  Square,
  Terminal,
  Wallpaper,
  X
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
import Boton from '../components/ui/Boton'
import { EncabezadoPagina, Panel, Rotulo } from '../components/ui/Panel'
import { fundido } from '../components/ui/movimiento'
import { useMenuContextual } from '../components/ui/MenuContextual'
import { menuParaMedia } from '../menus'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

/** Grilla de miniaturas que se adapta al ancho: de 2 columnas a las que entren. */
const GRILLA = 'grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2'

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
  const abrirMenu = useMenuContextual()

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

  // Videos primero (lo más útil como fondo en loop), después imágenes y GIFs.
  const bgCandidates = useMemo(
    () =>
      itemsInFolder(bgSource, bgPath).sort((a, b) => {
        const rank = (m: MediaItem) => (m.type === 'video' ? 0 : 1)
        return rank(a) - rank(b)
      }),
    [bgSource, bgPath]
  )
  const bgFolders = useMemo(() => childFolders(bgSource, bgPath), [bgSource, bgPath])

  // Imágenes y GIFs disponibles para la presentación.
  const slideshowCandidates = useMemo(
    () => media.filter((m) => m.type === 'image' || m.type === 'gif'),
    [media]
  )

  // Mantener sincronizada la presentación de la proyección mientras corre.
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
    setSlideshowActive(false) // un fondo único reemplaza a la presentación
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

  const fondoActual = useMemo(
    () => (backgroundId ? [...media, ...liveMedia].find((m) => m.id === backgroundId) ?? null : null),
    [backgroundId, media, liveMedia]
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-5 sm:px-6">
        <EncabezadoPagina icono={<Radio className="h-6 w-6" />} titulo="En Vivo">
          Probá la pantalla con un slide, ponele un fondo en loop o armá una presentación de
          imágenes. Detener, Blackout y Limpiar están siempre arriba a la derecha.
        </EncabezadoPagina>

        {/* Qué fondo hay ahora: se ve de un vistazo sin buscar en las grillas. */}
        <EstadoFondo
          fondo={fondoActual}
          presentacion={slideshowActive ? slideshowIds.length : 0}
          onQuitar={() => (slideshowActive ? stopSlideshow() : setSingleBackground(null))}
        />

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Slide de prueba */}
            <Panel aria-labelledby="vivo-slide">
              <div className="flex items-center justify-between">
                <Rotulo id="vivo-slide">Slide de prueba</Rotulo>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  onClick={resetTestSlideText}
                  icono={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                >
                  Restablecer
                </Boton>
              </div>
              <textarea
                value={testSlideText}
                onChange={(e) => setTestSlideText(e.target.value)}
                rows={Math.max(3, testSlideText.split('\n').length)}
                placeholder="Escribí el texto del slide — una línea por renglón"
                aria-label="Texto del slide de prueba"
                className="mt-2 w-full resize-y rounded-lg border border-cabina-linea-fuerte bg-cabina-negro px-3 py-2 font-letra text-base text-cabina-tinta placeholder:text-cabina-tinta-tenue"
              />
              <div className="mt-3">
                <Boton
                  variante="aire"
                  onClick={projectTestSlide}
                  disabled={!testSlideText.trim()}
                  icono={<Eye className="h-4 w-4" aria-hidden />}
                >
                  Proyectar slide
                </Boton>
              </div>
            </Panel>

            {/* Fondo único */}
            <Panel aria-labelledby="vivo-fondo">
              <div className="flex items-center justify-between gap-2">
                <Rotulo id="vivo-fondo" className="flex items-center gap-1.5">
                  <Wallpaper className="h-3.5 w-3.5" aria-hidden />
                  Fondo único (loop)
                </Rotulo>
                {backgroundId && (
                  <Boton variante="peligro" tamano="sm" onClick={() => setSingleBackground(null)}>
                    Quitar fondo
                  </Boton>
                )}
              </div>
              <p className="mt-1 text-xs text-cabina-tinta-tenue">
                Un video o una imagen fija detrás del contenido. Los videos se repiten en loop.{' '}
                {hasLiveFolder ? (
                  <span className="block truncate" title={settings?.liveLoopFolder ?? undefined}>
                    Fuente: <span className="font-mono text-cabina-tinta-dim">{settings?.liveLoopFolder}</span>
                  </span>
                ) : (
                  <>Fuente: carpeta de media (podés asignar una carpeta aparte en Ajustes).</>
                )}
              </p>

              {/* Breadcrumb de subcarpetas */}
              {(bgPath || bgFolders.length > 0) && (
                <nav aria-label="Carpetas de fondos" className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setBgPath('')}
                    aria-current={bgPath ? undefined : 'location'}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                      bgPath
                        ? 'text-cabina-tinta-dim hover:bg-cabina-alto hover:text-cabina-tinta'
                        : 'font-medium text-cabina-tinta'
                    }`}
                  >
                    <Home className="h-3 w-3" aria-hidden />
                    Raíz
                  </button>
                  {breadcrumbSegments(bgPath).map((seg, i, arr) => (
                    <span key={seg.path} className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 text-cabina-tinta-tenue" aria-hidden />
                      {i === arr.length - 1 ? (
                        <span className="px-1 font-medium text-cabina-tinta" aria-current="location">
                          {seg.name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBgPath(seg.path)}
                          className="rounded px-1 py-0.5 text-cabina-tinta-dim hover:bg-cabina-alto hover:text-cabina-tinta"
                        >
                          {seg.name}
                        </button>
                      )}
                    </span>
                  ))}
                </nav>
              )}

              {!bgSourceLoaded ? (
                <p className="mt-3 text-xs text-cabina-tinta-tenue">Cargando media…</p>
              ) : bgCandidates.length === 0 && bgFolders.length === 0 ? (
                <p className="mt-3 text-xs text-cabina-tinta-tenue">
                  {hasLiveFolder
                    ? 'No hay videos en la carpeta de loops. Agregá archivos o cambiala en Ajustes.'
                    : 'No hay media. Configurá la carpeta en Ajustes.'}
                </p>
              ) : (
                <ul className={`mt-3 ${GRILLA}`}>
                  {bgFolders.map((name) => {
                    const folderPath = bgPath ? `${bgPath}/${name}` : name
                    return (
                      <li key={`folder-${name}`}>
                        <button
                          type="button"
                          onClick={() => setBgPath(folderPath)}
                          aria-label={`Abrir carpeta ${name}`}
                          className="group relative block w-full overflow-hidden rounded-lg border border-cabina-linea bg-cabina-alto text-left transition-colors hover:border-listo-borde"
                        >
                          <div className="flex aspect-video flex-col items-center justify-center gap-1">
                            <Folder
                              className="h-7 w-7 text-listo/80 transition-transform group-hover:scale-110"
                              aria-hidden
                            />
                            <span className="max-w-full truncate px-1 text-[11px] text-cabina-tinta-dim">
                              {name}
                            </span>
                          </div>
                          <span className="absolute right-1 top-1 rounded bg-listo-suave px-1 font-mono text-[10px] font-medium text-listo">
                            {countInFolder(bgSource, folderPath)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {bgCandidates.map((item) => {
                    const alAire = backgroundId === item.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSingleBackground(item.id)}
                          onContextMenu={(e) => abrirMenu(e, menuParaMedia(item))}
                          aria-pressed={alAire}
                          aria-label={`${alAire ? 'Fondo al aire: ' : 'Poner de fondo: '}${item.fileName}`}
                          title={item.fileName}
                          className={`group relative block w-full overflow-hidden rounded-lg border bg-black text-left transition-colors ${
                            alAire
                              ? 'border-aire ring-2 ring-aire-borde'
                              : 'border-cabina-linea hover:border-cabina-tinta-tenue'
                          }`}
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
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                          <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-white" aria-hidden>
                            {item.type === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                          </span>
                          {alAire && (
                            <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-aire px-1 py-0.5 font-mono text-[9px] font-bold text-white" aria-hidden>
                              {item.type === 'video' && <Repeat className="h-2.5 w-2.5" />}
                              AL AIRE
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* Presentación de fondo */}
          <Panel aria-labelledby="vivo-presentacion" className={slideshowActive ? 'border-aire-borde' : ''}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Rotulo id="vivo-presentacion" className="flex items-center gap-1.5">
                <Images className="h-3.5 w-3.5" aria-hidden />
                Presentación de fondo
                {slideshowActive && (
                  <span className="rounded bg-aire px-1.5 py-0.5 text-[10px] font-bold text-white">
                    AL AIRE
                  </span>
                )}
              </Rotulo>
              <label className="flex items-center gap-1.5 text-xs text-cabina-tinta-dim">
                Tiempo por imagen
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={slideshowIntervalSec}
                  onChange={(e) =>
                    setSlideshowInterval(Math.max(1, Math.min(120, Number(e.target.value) || 1)))
                  }
                  className="w-16 rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1 text-sm text-cabina-tinta"
                />
                <span className="text-cabina-tinta-tenue">seg</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-cabina-tinta-tenue">
              Elegí varias imágenes en orden: se van pasando solas, en loop. Seleccionadas:{' '}
              <span className="font-mono font-medium text-cabina-tinta">{slideshowIds.length}</span>
            </p>

            {!mediaLoaded ? (
              <p className="mt-3 text-xs text-cabina-tinta-tenue">Cargando media…</p>
            ) : slideshowCandidates.length === 0 ? (
              <p className="mt-3 text-xs text-cabina-tinta-tenue">No hay imágenes en la carpeta de media.</p>
            ) : (
              <ul className={`mt-3 ${GRILLA}`}>
                {slideshowCandidates.map((item) => {
                  const order = slideshowIds.indexOf(item.id)
                  const selected = order !== -1
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggleSlideshowItem(item.id)}
                        onContextMenu={(e) => abrirMenu(e, menuParaMedia(item))}
                        aria-pressed={selected}
                        aria-label={
                          selected ? `${item.fileName}, número ${order + 1} de la presentación` : item.fileName
                        }
                        title={item.fileName}
                        className={`group relative block w-full overflow-hidden rounded-lg border bg-black text-left transition-colors ${
                          selected
                            ? slideshowActive
                              ? 'border-aire ring-2 ring-aire-borde'
                              : 'border-listo ring-2 ring-listo-borde'
                            : 'border-cabina-linea hover:border-cabina-tinta-tenue'
                        }`}
                      >
                        <div className="aspect-video">
                          <img
                            src={`media://${item.id}`}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <AnimatePresence>
                          {selected && (
                            <motion.span
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              transition={fundido}
                              className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                                slideshowActive ? 'bg-aire text-white' : 'bg-listo text-cabina-negro'
                              }`}
                              aria-hidden
                            >
                              {order + 1}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!slideshowActive ? (
                <Boton
                  variante="aire"
                  onClick={startSlideshow}
                  disabled={slideshowIds.length === 0}
                  icono={<Play className="h-4 w-4" aria-hidden />}
                >
                  Iniciar presentación
                </Boton>
              ) : (
                <Boton variante="neutro" onClick={stopSlideshow} icono={<Square className="h-4 w-4" aria-hidden />}>
                  Detener presentación
                </Boton>
              )}
              {slideshowIds.length > 0 && (
                <Boton variante="fantasma" onClick={clearSlideshow}>
                  Limpiar selección
                </Boton>
              )}
            </div>
          </Panel>
        </div>

        {/* Diagnóstico: el último comando que salió hacia la proyección */}
        <details className="mt-6">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] uppercase tracking-rotulo text-cabina-tinta-tenue hover:text-cabina-tinta-dim">
            <Terminal className="h-3.5 w-3.5" aria-hidden />
            Último comando enviado
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-cabina-panel p-3 font-mono text-xs text-cabina-tinta-dim">
            {lastCommand ? JSON.stringify(lastCommand, null, 2) : 'ningún comando todavía'}
          </pre>
        </details>
      </div>
    </div>
  )
}

/** La franja que dice qué fondo está al aire ahora, con el botón para sacarlo. */
function EstadoFondo({
  fondo,
  presentacion,
  onQuitar
}: {
  fondo: MediaItem | null
  presentacion: number
  onQuitar: () => void
}) {
  const hay = Boolean(fondo) || presentacion > 0
  return (
    <AnimatePresence initial={false}>
      {hay && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={fundido}
          className="overflow-hidden"
        >
          <div
            role="status"
            className="mb-4 flex items-center gap-3 rounded-xl border border-aire-borde bg-aire-suave px-4 py-2.5"
          >
            <Wallpaper className="h-4 w-4 shrink-0 text-aire" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-sm text-cabina-tinta">
              <span className="font-mono text-[11px] font-bold uppercase tracking-rotulo text-aire">
                Fondo al aire
              </span>{' '}
              {presentacion > 0
                ? `Presentación de ${presentacion} ${presentacion === 1 ? 'imagen' : 'imágenes'}`
                : fondo?.fileName}
            </p>
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={onQuitar}
              icono={<X className="h-3.5 w-3.5" aria-hidden />}
            >
              Quitar
            </Boton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
