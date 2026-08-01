import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  Film,
  FolderOpen,
  KeyRound,
  ListVideo,
  Loader2,
  Music,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import {
  ACTIVOS,
  AUDIO_BITRATES,
  VIDEO_QUALITIES,
  formatBytes,
  formatDuration,
  formatSpeed,
  looksLikePlaylist,
  normalizeUrl,
  type AudioBitrate,
  type DownloadJob,
  type DownloadKind,
  type VideoQuality
} from '@/shared/utils/downloads'
import type { DownloadTools } from '@/shared/types/electronAPI'
import { useSettingsStore } from '@/shared/store/settingsStore'

/**
 * Bajar un video de YouTube (o el audio en MP3) directo a las carpetas que ya
 * usa la app: el video cae en la carpeta de media y el MP3 en la de audio, así
 * aparecen solos en sus secciones sin mover nada a mano.
 */
export default function Downloads() {
  const settings = useSettingsStore((s) => s.settings)
  const [tools, setTools] = useState<DownloadTools | null>(null)
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<DownloadKind>('video')
  const [quality, setQuality] = useState<VideoQuality>('1080')
  const [bitrate, setBitrate] = useState<AudioBitrate>('320')
  const [busy, setBusy] = useState(false)
  const [installing, setInstalling] = useState<{ step: string; ratio: number | null } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Sesión de YouTube (para cuando pide confirmar que no sos un robot)
  const [sesion, setSesion] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginMsg, setLoginMsg] = useState<string | null>(null)

  const refreshSesion = useCallback(async () => {
    setSesion((await window.electronAPI?.youtubeSessionStatus()) ?? false)
  }, [])

  async function handleLogin() {
    setLoginMsg(null)
    setLoggingIn(true)
    try {
      const r = await window.electronAPI?.youtubeLogin()
      setLoginMsg(
        r?.ok
          ? `Listo: se guardó la sesión. Probá la descarga de nuevo.`
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

  const refreshTools = useCallback(async () => {
    setTools((await window.electronAPI?.getDownloadTools()) ?? null)
  }, [])

  useEffect(() => {
    void refreshTools()
    void refreshSesion()
    void window.electronAPI?.getDownloads().then((j) => setJobs(j ?? []))
    const unsub = window.electronAPI?.onDownloadsUpdated((payload) => {
      if (payload.jobs) setJobs(payload.jobs)
      if (payload.install) setInstalling(payload.install)
    })
    return unsub
  }, [refreshTools, refreshSesion])

  const ready = Boolean(tools?.ytDlp && tools?.ffmpegDir)
  const destFolder = kind === 'audio' ? settings?.audioFolder : settings?.mediaFolder
  const normalized = useMemo(() => normalizeUrl(url), [url])

  async function handleInstall() {
    setError(null)
    setInstalling({ step: 'Empezando', ratio: null })
    try {
      setTools((await window.electronAPI?.installDownloadTools()) ?? null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setInstalling(null)
      void refreshTools()
    }
  }

  const opciones = { kind, quality, bitrate }

  function handleAdd() {
    setError(null)
    if (!normalized) {
      setError('Eso no parece un enlace. Pegá la dirección completa del video.')
      return
    }
    void window.electronAPI?.enqueueDownload(normalized, opciones)
    setUrl('')
    inputRef.current?.focus()
  }

  /** Expande la lista y encola un trabajo por video. */
  async function handleAddPlaylist() {
    if (!normalized) return
    setError(null)
    setBusy(true)
    try {
      const r = await window.electronAPI?.enqueuePlaylist(normalized, opciones)
      if (r?.error) setError(r.error)
      else {
        setUrl('')
        inputRef.current?.focus()
      }
    } finally {
      setBusy(false)
    }
  }

  const activos = jobs.filter((j) => ACTIVOS.includes(j.stage))

  /** Si algún trabajo falló porque YouTube pidió identificarse. */
  const bloqueado = jobs.some(
    (j) => j.stage === 'error' && /robot|sesión/i.test(j.error ?? '')
  )

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      <div className="mx-auto max-w-[1000px] px-6 pb-24 pt-6">
        <header className="mb-6 border-b border-slate-700 pb-4">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-100">
            <Download className="h-6 w-6 text-blue-400" />
            Descargar de YouTube
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            El video va a tu carpeta de media y el MP3 a la de audio: aparecen solos
            en esas secciones.
          </p>
        </header>

        {/* Herramientas */}
        {tools && !ready && (
          <section className="mb-6 rounded-lg border border-amber-600/40 bg-amber-950/30 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Faltan las herramientas
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Esto usa dos programas externos: <strong>yt-dlp</strong> (baja el video) y{' '}
              <strong>ffmpeg</strong> (junta video y audio, y arma el MP3). No vienen con
              la app porque yt-dlp se desactualiza cada pocas semanas y conviene tenerlo
              al día.
            </p>
            <ul className="mt-2 text-xs text-slate-400">
              <li>yt-dlp: {tools.ytDlp ?? 'no encontrado'}</li>
              <li>ffmpeg: {tools.ffmpegDir ?? 'no encontrado'}</li>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={!!installing}
                className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                {installing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {installing.step}
                    {installing.ratio !== null &&
                      ` ${Math.round(installing.ratio * 100)}%`}
                  </>
                ) : (
                  <>Descargar las herramientas (~180 MB)</>
                )}
              </button>
              <span className="text-xs text-slate-500">
                o poné la carpeta donde ya las tenés, en Ajustes
              </span>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">
                Dónde se buscó
              </summary>
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-500">
                {tools.searched.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {/* Formulario */}
        <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              placeholder="Pegá acá el enlace del video…"
              aria-label="Enlace del video"
              className="min-w-[280px] flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
            <div className="flex overflow-hidden rounded-md border border-slate-600">
              <button
                type="button"
                onClick={() => setKind('video')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  kind === 'video'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Film className="h-4 w-4" /> Video
              </button>
              <button
                type="button"
                onClick={() => setKind('audio')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  kind === 'audio'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Music className="h-4 w-4" /> MP3
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!ready || !destFolder}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                !ready
                  ? 'Faltan las herramientas'
                  : !destFolder
                    ? 'Falta configurar la carpeta destino'
                    : 'Agregar a la cola'
              }
            >
              <Download className="h-4 w-4" />
              Descargar
            </button>
          </div>

          {/* Calidad */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {kind === 'audio' ? 'Calidad del MP3' : 'Resolución máxima'}
            </span>
            <div className="flex overflow-hidden rounded-md border border-slate-700">
              {kind === 'audio'
                ? AUDIO_BITRATES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBitrate(b.id)}
                      className={`px-2.5 py-1 text-xs transition-colors ${
                        bitrate === b.id
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))
                : VIDEO_QUALITIES.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setQuality(q.id)}
                      title={q.hint}
                      className={`px-2.5 py-1 text-xs transition-colors ${
                        quality === q.id
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <FolderOpen className="h-3.5 w-3.5" />
              {destFolder ? (
                <>Va a <span className="font-mono text-slate-400">{destFolder}</span></>
              ) : (
                <span className="text-amber-400">
                  Configurá la carpeta de {kind === 'audio' ? 'audio' : 'media'} en Ajustes
                </span>
              )}
            </span>
          </div>

          {normalized && looksLikePlaylist(normalized) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-slate-700 bg-slate-900/60 p-2.5">
              <ListVideo className="h-4 w-4 shrink-0 text-blue-400" />
              <span className="text-xs text-slate-300">
                Ese enlace es de una lista. <strong>Descargar</strong> baja sólo ese
                video.
              </span>
              <button
                type="button"
                onClick={() => void handleAddPlaylist()}
                disabled={!ready || !destFolder || busy}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-blue-500/60 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/10 disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo la lista…
                  </>
                ) : (
                  <>Encolar la lista completa</>
                )}
              </button>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </section>

        {/* Sesión del navegador. Aparece sólo cuando hace falta: si las
            descargas andan, no hay motivo para ofrecerlo. */}
        {(bloqueado || settings?.downloadCookiesBrowser) && (
          <section className="mt-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <KeyRound className="h-4 w-4 text-amber-400" />
              YouTube te está pidiendo iniciar sesión
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Pasa cuando la conexión comparte la IP con muchos usuarios (Starlink,
              datos móviles, wifi de un edificio): YouTube no sabe si del otro lado
              hay una persona y pide identificarse.
            </p>

            {sesion ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Sesión de YouTube guardada
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={loggingIn}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
                >
                  Volver a iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="text-xs text-slate-500 transition-colors hover:text-red-400"
                >
                  Borrar la sesión
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={loggingIn}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {loggingIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Esperando a que cierres la ventana…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Iniciar sesión en YouTube
                    </>
                  )}
                </button>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Se abre YouTube en una ventana aparte. Iniciás sesión y pasás la
                  verificación vos mismo, como en cualquier navegador; después cerrás
                  la ventana y la app se queda con esa sesión para las descargas. La
                  contraseña la ponés en la página de Google: la app no la ve.
                </p>
              </div>
            )}

            {loginMsg && <p className="mt-2 text-xs text-slate-400">{loginMsg}</p>}

            <p className="mt-3 text-xs leading-relaxed text-amber-400/80">
              Ojo: bajar mucho material con una cuenta puede hacer que Google la
              marque. Conviene usar una cuenta de la iglesia y no la personal.
            </p>
          </section>
        )}

        {/* Cola */}
        {jobs.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Descargas {activos.length > 0 && `· ${activos.length} en curso`}
              </h2>
              <button
                type="button"
                onClick={() => void window.electronAPI?.clearDownloads()}
                className="text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                Limpiar terminadas
              </button>
            </div>
            <ul className="space-y-2">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
  )
}

function JobRow({ job }: { job: DownloadJob }) {
  const p = job.progress
  const pct = p?.ratio != null ? Math.round(p.ratio * 100) : null

  return (
    <li className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
      <div className="flex items-start gap-3">
        {job.thumbnail ? (
          <img
            src={job.thumbnail}
            alt=""
            className="h-12 w-20 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-slate-900">
            {job.kind === 'audio' ? (
              <Music className="h-4 w-4 text-slate-600" />
            ) : (
              <Film className="h-4 w-4 text-slate-600" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-200">{job.title ?? job.url}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="uppercase">
              {job.kind === 'audio'
                ? `MP3 ${job.bitrate}k`
                : job.quality === 'best'
                  ? 'Video máx.'
                  : `Video ${job.quality}p`}
            </span>
            {job.uploader && <span>· {job.uploader}</span>}
            {job.durationSec != null && <span>· {formatDuration(job.durationSec)}</span>}
          </p>

          {job.stage === 'queued' && (
            <p className="mt-1 text-xs text-slate-500">En espera…</p>
          )}
          {job.stage === 'preparing' && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Consultando el video… (puede tardar hasta un minuto)
            </p>
          )}
          {job.stage === 'processing' && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Procesando con ffmpeg…
            </p>
          )}
          {job.stage === 'downloading' && (
            <>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-200"
                  style={{ width: pct !== null ? `${pct}%` : '30%' }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {pct !== null ? `${pct}% · ` : ''}
                {formatBytes(p?.downloadedBytes ?? null)}
                {p?.totalBytes ? ` de ${formatBytes(p.totalBytes)}` : ''} ·{' '}
                {formatSpeed(p?.speed ?? null)}
                {p?.eta != null && p.eta > 0 ? ` · faltan ${formatDuration(p.eta)}` : ''}
              </p>
            </>
          )}
          {job.stage === 'done' && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Listo{job.filePath ? ` · ${job.filePath.split(/[\\/]/).pop()}` : ''}
            </p>
          )}
          {job.stage === 'canceled' && (
            <p className="mt-1 text-xs text-slate-500">Cancelada</p>
          )}
          {job.stage === 'error' && (
            <>
              <p className="mt-1 text-xs text-red-400">{job.error}</p>
              {job.errorDetail && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                    Ver detalle técnico
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950/70 p-2 font-mono text-[10px] leading-relaxed text-slate-400">
                    {job.errorDetail}
                  </pre>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(job.errorDetail ?? '')}
                    className="mt-1 text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Copiar
                  </button>
                </details>
              )}
            </>
          )}
        </div>

        {ACTIVOS.includes(job.stage) ? (
          <button
            type="button"
            onClick={() => void window.electronAPI?.cancelDownload(job.id)}
            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void window.electronAPI?.removeDownload(job.id)}
            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
            title="Sacar de la lista"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  )
}
