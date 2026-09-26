import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardPaste,
  Download,
  Film,
  FolderOpen,
  KeyRound,
  ListVideo,
  Music,
  Scissors
} from 'lucide-react'
import {
  ACTIVOS,
  AUDIO_BITRATES,
  VIDEO_QUALITIES,
  extraerUrls,
  looksLikePlaylist,
  parseTiempo,
  type AudioBitrate,
  type DownloadKind,
  type SeccionClip,
  type VideoQuality
} from '@/shared/utils/downloads'
import type { DownloadTools } from '@/shared/types/electronAPI'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useDownloadsStore } from '@/shared/store/downloadsStore'
import Boton from '../components/ui/Boton'
import Aviso from '../components/ui/Aviso'
import Interruptor from '../components/ui/Interruptor'
import { EncabezadoPagina, Panel, Rotulo } from '../components/ui/Panel'
import PanelHerramientas from '../components/descargas/PanelHerramientas'
import FilaDescarga from '../components/descargas/FilaDescarga'

/**
 * Bajar videos de YouTube (o el audio en MP3) directo a las carpetas que ya
 * usa la app: el video cae en la carpeta de media y el MP3 en la de audio, así
 * aparecen solos en sus secciones sin mover nada a mano.
 */
export default function Downloads() {
  const settings = useSettingsStore((s) => s.settings)
  const jobs = useDownloadsStore((s) => s.jobs)
  const instalando = useDownloadsStore((s) => s.install)
  const setInstall = useDownloadsStore((s) => s.setInstall)

  const [tools, setTools] = useState<DownloadTools | null>(null)
  const [texto, setTexto] = useState('')
  const [kind, setKind] = useState<DownloadKind>('video')
  const [quality, setQuality] = useState<VideoQuality>('1080')
  const [bitrate, setBitrate] = useState<AudioBitrate>('320')
  const [recortar, setRecortar] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [leyendoLista, setLeyendoLista] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Sesión de YouTube (para cuando pide confirmar que no sos un robot)
  const [sesion, setSesion] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginMsg, setLoginMsg] = useState<string | null>(null)

  const refreshSesion = useCallback(async () => {
    setSesion((await window.electronAPI?.youtubeSessionStatus()) ?? false)
  }, [])

  const refreshTools = useCallback(async () => {
    setTools((await window.electronAPI?.getDownloadTools()) ?? null)
  }, [])

  useEffect(() => {
    void refreshTools()
    void refreshSesion()
  }, [refreshTools, refreshSesion])

  const ready = Boolean(tools?.ytDlp && tools?.ffmpegDir)
  const destFolder = kind === 'audio' ? settings?.audioFolder : settings?.mediaFolder
  const urls = useMemo(() => extraerUrls(texto), [texto])
  const unaLista = urls.length === 1 && looksLikePlaylist(urls[0])

  // El tramo: vacío = video entero. Con algo escrito, tiene que ser válido.
  const seccion: SeccionClip | null | 'invalida' = useMemo(() => {
    if (!recortar || kind === 'audio') return null
    const d = parseTiempo(desde || '0')
    const h = parseTiempo(hasta)
    if (d === null || h === null || h <= d) return 'invalida'
    return { desde: d, hasta: h }
  }, [recortar, kind, desde, hasta])

  async function handleLogin() {
    setLoginMsg(null)
    setLoggingIn(true)
    try {
      const r = await window.electronAPI?.youtubeLogin()
      setLoginMsg(
        r?.ok
          ? 'Listo: se guardó la sesión. Reintentá las descargas que fallaron.'
          : (r?.error ?? 'No se pudo guardar la sesión.')
      )
    } finally {
      setLoggingIn(false)
      void refreshSesion()
    }
  }

  async function handleLogout() {
    await window.electronAPI?.youtubeLogout()
    setLoginMsg('Sesión borrada.')
    void refreshSesion()
  }

  async function handleInstall() {
    setError(null)
    setInstall({ step: 'Empezando', ratio: null })
    try {
      setTools((await window.electronAPI?.installDownloadTools()) ?? null)
      toast.success('Herramientas instaladas')
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setInstall(null)
      void refreshTools()
    }
  }

  async function handleActualizar() {
    setError(null)
    setActualizando(true)
    try {
      const r = await window.electronAPI?.updateYtDlp()
      if (r?.ok) toast.success(r.mensaje)
      else if (r) setError(r.mensaje)
    } finally {
      setActualizando(false)
      setInstall(null)
      void refreshTools()
    }
  }

  function handleAdd() {
    setError(null)
    if (urls.length === 0) {
      setError('Eso no parece un enlace. Pegá la dirección completa del video.')
      return
    }
    if (seccion === 'invalida') {
      setError('El tramo no es válido: "hasta" tiene que ser después de "desde" (por ejemplo 1:30 y 4:05).')
      return
    }
    const opciones = { kind, quality, bitrate, seccion }
    for (const u of urls) void window.electronAPI?.enqueueDownload(u, opciones)
    if (urls.length > 1) toast(`${urls.length} videos en la cola`)
    setTexto('')
    inputRef.current?.focus()
  }

  /** Expande la lista y encola un trabajo por video. */
  async function handleAddPlaylist() {
    if (!urls[0]) return
    setError(null)
    setLeyendoLista(true)
    try {
      const r = await window.electronAPI?.enqueuePlaylist(urls[0], { kind, quality, bitrate })
      if (r?.error) setError(r.error)
      else {
        toast(`${r?.added ?? 0} videos de la lista en la cola`)
        setTexto('')
        inputRef.current?.focus()
      }
    } finally {
      setLeyendoLista(false)
    }
  }

  async function pegar() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setTexto((prev) => (prev ? `${prev} ${t}` : t))
      inputRef.current?.focus()
    } catch {
      inputRef.current?.focus()
    }
  }

  const activos = jobs.filter((j) => ACTIVOS.includes(j.stage)).length
  const listos = jobs.filter((j) => j.stage === 'done').length
  const fallidos = jobs.filter((j) => j.stage === 'error').length

  /**
   * Si algún trabajo falló porque YouTube pidió identificarse. Lo marca el
   * servicio: el mensaje real de YouTube trae un apóstrofo tipográfico que la
   * consola de Windows rompe, así que deducirlo del texto no funcionaba.
   */
  const bloqueado = jobs.some((j) => j.needsLogin)
  const puedeDescargar = ready && Boolean(destFolder) && urls.length > 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-10 pt-5 sm:px-6">
        <EncabezadoPagina icono={<Download className="h-6 w-6" />} titulo="Descargar de YouTube">
          El video va a tu carpeta de media y el MP3 a la de audio: aparecen solos en esas
          secciones. Podés pegar varios enlaces juntos.
        </EncabezadoPagina>

        <PanelHerramientas
          tools={tools}
          instalando={instalando}
          actualizando={actualizando}
          onInstalar={() => void handleInstall()}
          onActualizar={() => void handleActualizar()}
        />

        {/* Formulario */}
        <Panel aria-label="Nueva descarga">
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="flex min-w-[260px] flex-1 items-stretch overflow-hidden rounded-lg border border-cabina-linea-fuerte bg-cabina-negro focus-within:border-listo-borde">
              <input
                ref={inputRef}
                type="text"
                inputMode="url"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                }}
                placeholder="Pegá acá uno o varios enlaces…"
                aria-label="Enlaces de los videos"
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-cabina-tinta placeholder:text-cabina-tinta-tenue focus:ring-0"
              />
              <button
                type="button"
                onClick={() => void pegar()}
                className="flex items-center gap-1.5 border-l border-cabina-linea px-3 text-xs text-cabina-tinta-dim transition-colors hover:bg-cabina-alto hover:text-cabina-tinta"
                title="Pegar del portapapeles"
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Pegar</span>
              </button>
            </div>

            <div role="radiogroup" aria-label="Qué bajar" className="flex overflow-hidden rounded-lg border border-cabina-linea-fuerte">
              {(
                [
                  { id: 'video', label: 'Video', icono: Film },
                  { id: 'audio', label: 'MP3', icono: Music }
                ] as const
              ).map((o) => {
                const Icono = o.icono
                const activo = kind === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => setKind(o.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                      activo
                        ? 'bg-listo-suave font-semibold text-listo'
                        : 'bg-cabina-negro text-cabina-tinta-dim hover:text-cabina-tinta'
                    }`}
                  >
                    <Icono className="h-4 w-4" aria-hidden /> {o.label}
                  </button>
                )
              })}
            </div>

            <Boton
              variante="primario"
              onClick={handleAdd}
              disabled={!puedeDescargar}
              title={
                !ready
                  ? 'Faltan las herramientas'
                  : !destFolder
                    ? 'Falta configurar la carpeta destino en Ajustes'
                    : 'Agregar a la cola'
              }
              icono={<Download className="h-4 w-4" aria-hidden />}
            >
              {urls.length > 1 ? `Descargar ${urls.length}` : 'Descargar'}
            </Boton>
          </div>

          {/* Calidad */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Rotulo>{kind === 'audio' ? 'Calidad del MP3' : 'Resolución máxima'}</Rotulo>
              <div role="radiogroup" className="flex overflow-hidden rounded-md border border-cabina-linea">
                {(kind === 'audio' ? AUDIO_BITRATES : VIDEO_QUALITIES).map((q) => {
                  const activo = kind === 'audio' ? bitrate === q.id : quality === q.id
                  return (
                    <button
                      key={q.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() =>
                        kind === 'audio' ? setBitrate(q.id as AudioBitrate) : setQuality(q.id as VideoQuality)
                      }
                      title={'hint' in q ? q.hint : undefined}
                      className={`px-2.5 py-1 text-xs transition-colors ${
                        activo
                          ? 'bg-cabina-alto font-semibold text-cabina-tinta'
                          : 'text-cabina-tinta-tenue hover:text-cabina-tinta'
                      }`}
                    >
                      {q.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {kind === 'video' && (
              <div className="flex flex-wrap items-center gap-2">
                <Interruptor activo={recortar} onCambio={setRecortar} etiqueta="Bajar sólo un tramo" />
                <span className="inline-flex items-center gap-1 text-xs text-cabina-tinta-dim">
                  <Scissors className="h-3.5 w-3.5" aria-hidden /> Sólo un tramo
                </span>
                {recortar && (
                  <span className="flex items-center gap-1.5 text-xs text-cabina-tinta-tenue">
                    <label className="flex items-center gap-1">
                      desde
                      <input
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        placeholder="0:00"
                        className="w-16 rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1 font-mono text-xs text-cabina-tinta"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      hasta
                      <input
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        placeholder="3:30"
                        className="w-16 rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1 font-mono text-xs text-cabina-tinta"
                        aria-invalid={seccion === 'invalida'}
                      />
                    </label>
                  </span>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 flex min-w-0 items-center gap-1.5 text-xs text-cabina-tinta-tenue">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {destFolder ? (
              <span className="min-w-0 truncate" title={destFolder}>
                Va a <span className="font-mono text-cabina-tinta-dim">{destFolder}</span>
              </span>
            ) : (
              <span className="text-listo">
                Configurá la carpeta de {kind === 'audio' ? 'audio' : 'media'} en Ajustes
              </span>
            )}
          </p>

          {unaLista && (
            <Aviso
              tipo="info"
              className="mt-3"
              acciones={
                <Boton
                  variante="neutro"
                  tamano="sm"
                  onClick={() => void handleAddPlaylist()}
                  disabled={!ready || !destFolder}
                  cargando={leyendoLista}
                  icono={<ListVideo className="h-3.5 w-3.5" aria-hidden />}
                >
                  {leyendoLista ? 'Leyendo la lista…' : 'Encolar la lista completa'}
                </Boton>
              }
            >
              Ese enlace es de una lista. <strong className="text-cabina-tinta">Descargar</strong> baja
              sólo ese video.
            </Aviso>
          )}

          <AnimatePresence>
            {error && (
              <Aviso tipo="falla" className="mt-3">
                {error}
              </Aviso>
            )}
          </AnimatePresence>

          {/* Acceso permanente: si la app no llegara a reconocer el error, sin
              esto no habría forma de iniciar sesión desde ningún lado. */}
          {!bloqueado && !sesion && (
            <p className="mt-3 text-xs text-cabina-tinta-tenue">
              ¿YouTube te pide iniciar sesión?{' '}
              <button
                type="button"
                onClick={() => void handleLogin()}
                disabled={loggingIn}
                className="text-listo underline underline-offset-2 hover:brightness-110 disabled:opacity-50"
              >
                {loggingIn ? 'Esperando…' : 'Iniciá sesión acá'}
              </button>
            </p>
          )}
        </Panel>

        {/* Sesión. Aparece sólo cuando hace falta: si las descargas andan, no
            hay motivo para ofrecerlo. */}
        {(bloqueado || settings?.downloadCookiesBrowser || sesion) && (
          <Panel className="mt-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-cabina-tinta">
              <KeyRound className="h-4 w-4 text-listo" aria-hidden />
              {bloqueado ? 'YouTube te está pidiendo iniciar sesión' : 'Sesión de YouTube'}
            </h2>
            {bloqueado && (
              <p className="mt-2 text-sm leading-relaxed text-cabina-tinta-dim">
                Pasa cuando la conexión comparte la IP con muchos usuarios (Starlink, datos móviles, wifi
                de un edificio): YouTube no sabe si del otro lado hay una persona y pide identificarse.
              </p>
            )}

            {sesion ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-ok">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Sesión de YouTube guardada
                </span>
                <Boton variante="neutro" tamano="sm" onClick={() => void handleLogin()} disabled={loggingIn}>
                  Volver a iniciar sesión
                </Boton>
                <Boton variante="peligro" tamano="sm" onClick={() => void handleLogout()}>
                  Borrar la sesión
                </Boton>
              </div>
            ) : (
              <div className="mt-3">
                <Boton
                  variante="primario"
                  onClick={() => void handleLogin()}
                  cargando={loggingIn}
                  icono={<KeyRound className="h-4 w-4" aria-hidden />}
                >
                  {loggingIn ? 'Esperando a que cierres la ventana…' : 'Iniciar sesión en YouTube'}
                </Boton>
                <p className="mt-2 text-xs leading-relaxed text-cabina-tinta-tenue">
                  Se abre YouTube en una ventana aparte. Iniciás sesión y pasás la verificación vos mismo,
                  como en cualquier navegador; después cerrás la ventana y la app se queda con esa sesión
                  para las descargas. La contraseña la ponés en la página de Google: la app no la ve.
                </p>
              </div>
            )}

            {loginMsg && <p className="mt-2 text-xs text-cabina-tinta-dim">{loginMsg}</p>}

            <p className="mt-3 text-xs leading-relaxed text-listo/80">
              Ojo: bajar mucho material con una cuenta puede hacer que Google la marque. Conviene usar
              una cuenta de la iglesia y no la personal.
            </p>
          </Panel>
        )}

        {/* Cola */}
        {jobs.length > 0 && (
          <section className="mt-6" aria-labelledby="descargas-cola">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Rotulo id="descargas-cola">
                Descargas
                {activos > 0 && ` · ${activos} en curso`}
                {listos > 0 && ` · ${listos} listas`}
                {fallidos > 0 && ` · ${fallidos} con error`}
              </Rotulo>
              {activos < jobs.length && (
                <Boton variante="fantasma" tamano="sm" onClick={() => void window.electronAPI?.clearDownloads()}>
                  Limpiar terminadas
                </Boton>
              )}
            </div>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {jobs.map((job) => (
                  <FilaDescarga key={job.id} job={job} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
