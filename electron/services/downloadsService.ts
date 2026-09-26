import { spawn, type ChildProcess } from 'child_process'
import { existsSync, statSync } from 'fs'
import { mkdir, readdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { app, session, shell, BrowserWindow } from 'electron'
import log from 'electron-log'
import {
  buildArgs,
  buildPlaylistArgs,
  buildProbeArgs,
  explainError,
  isBotCheckError,
  lastMeaningfulLine,
  parseFileLine,
  parsePlaylistEntries,
  parseProgressLine,
  hasAuthCookies,
  toNetscapeCookies,
  ACTIVOS,
  DEFAULT_OPTIONS,
  DENO_ASSETS,
  FFMPEG_ASSETS,
  FFMPEG_URL_BASE,
  YTDLP_ASSETS,
  type DownloadJob,
  type DownloadOptions,
  type JsRuntime
} from '../../src/shared/utils/downloads'
import type { DownloadTools, ToolsUpdateResult } from '../../src/shared/types/electronAPI'
import { getSettings } from './settingsService'
import {
  candidateDirs,
  EXE,
  extraerArchivo,
  fetchToFile,
  findFileDeep,
  findIn,
  findInPath,
  hacerEjecutable,
  installDir,
  matarArbol,
  opcionesSpawnMatable,
  PLATAFORMA,
  urlDeAsset,
  type InstallProgress
} from './toolsPaths'

export type { InstallProgress }

/**
 * Descargas de YouTube (y de cualquier sitio que yt-dlp soporte).
 *
 * El trabajo pesado lo hacen binarios externos: yt-dlp baja, ffmpeg junta el
 * video con el audio y arma el MP3, y un intérprete de JavaScript (deno o
 * node) resuelve el desafío que YouTube pone para entregar los formatos. No se
 * empaquetan con la app —yt-dlp se desactualiza en semanas cuando YouTube
 * cambia algo, y ffmpeg pesa más que todo el resto junto—, así que se buscan
 * en el disco y se ofrecen bajar cuando faltan, en Windows y en Linux.
 *
 * Las descargas se hacen de a una. Bajar cuatro videos en paralelo por la
 * conexión de una iglesia sólo consigue que las cuatro vayan lentas.
 */

export type ToolStatus = DownloadTools

/**
 * Busca un intérprete de JavaScript. yt-dlp lo necesita para resolver el
 * desafío de firma de YouTube, y sólo habilita `deno` por su cuenta: con node
 * instalado igual hay que nombrárselo, si no lo reporta como no disponible y
 * las descargas de YouTube se cuelgan sin explicar nada.
 */
function findJsRuntime(dirs: string[]): JsRuntime | null {
  const orden: JsRuntime['name'][] = ['deno', 'node', 'bun', 'quickjs']
  for (const name of orden) {
    const local = findIn(dirs, name)
    if (local) return { name, path: local }
    const inPath = findInPath(name)
    if (inPath) return { name, path: inPath }
  }
  return null
}

/** Versión de yt-dlp, cacheada por ruta y fecha de modificación del binario. */
const versiones = new Map<string, string | null>()

function versionDe(bin: string): Promise<string | null> {
  let clave = bin
  try {
    clave = `${bin}|${statSync(bin).mtimeMs}`
  } catch {
    /* si no se puede leer, no se cachea por fecha */
  }
  if (versiones.has(clave)) return Promise.resolve(versiones.get(clave) ?? null)
  return new Promise((resolve) => {
    let out = ''
    let child: ChildProcess
    try {
      child = spawn(bin, ['--version'], { windowsHide: true })
    } catch {
      return resolve(null)
    }
    const timer = setTimeout(() => {
      matarArbol(child)
      resolve(null)
    }, 15_000)
    child.stdout?.on('data', (d) => (out += d))
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on('close', () => {
      clearTimeout(timer)
      const v = out.trim().split(/\s+/)[0] || null
      versiones.set(clave, v)
      resolve(v)
    })
  })
}

/**
 * Resuelve dónde están las herramientas: primero en las carpetas conocidas y
 * después en el PATH. Buscar en el PATH importa — quien ya instaló yt-dlp con
 * winget, chocolatey o el gestor de paquetes de su Linux no tiene por qué
 * bajarse otros 180 MB.
 */
export function resolveTools(): Omit<ToolStatus, 'ytDlpVersion'> {
  const dirs = candidateDirs()
  const ytDlp = findIn(dirs, 'yt-dlp') ?? findInPath('yt-dlp')
  const ffmpeg = findIn(dirs, 'ffmpeg') ?? findInPath('ffmpeg')
  return {
    ytDlp,
    ffmpegDir: ffmpeg ? dirname(ffmpeg) : null,
    jsRuntime: findJsRuntime(dirs),
    searched: [...dirs, '(PATH del sistema)'],
    instalable: Boolean(YTDLP_ASSETS[PLATAFORMA])
  }
}

/** Lo mismo más la versión de yt-dlp, que exige lanzarlo (una vez por binario). */
export async function herramientas(): Promise<ToolStatus> {
  const t = resolveTools()
  return { ...t, ytDlpVersion: t.ytDlp ? await versionDe(t.ytDlp) : null }
}

/** La carpeta a la que va cada tipo de descarga, según los Ajustes. */
export function destinationFor(kind: DownloadOptions['kind']): string | null {
  const s = getSettings()
  return kind === 'audio' ? s.audioFolder : s.mediaFolder
}

// ─── Sesión de YouTube ───────────────────────────────────────────────────────

/**
 * Archivo de cookies para yt-dlp. Es una credencial: da acceso a la cuenta de
 * YouTube de quien inició sesión, así que vive en userData y no se loguea ni se
 * muestra nunca su contenido.
 */
function cookiesPath(): string {
  return join(app.getPath('userData'), 'youtube-cookies.txt')
}

export function hasYoutubeSession(): boolean {
  return existsSync(cookiesPath())
}

/** Ruta del archivo si existe; `null` si no hay sesión guardada. */
function cookiesFileOrNull(): string | null {
  return hasYoutubeSession() ? cookiesPath() : null
}

export async function clearYoutubeSession(): Promise<void> {
  // yt-dlp no sólo lee el archivo de cookies: lo REESCRIBE al terminar, con
  // las cookies actualizadas que le devolvió el servidor (el archivo lleva
  // adentro "generated by yt-dlp"). Por eso borrarlo con una descarga en curso
  // no alcanza: el proceso, al morir, lo vuelve a crear y la sesión "borrada"
  // reaparece sola un segundo y medio después. Primero se corta todo lo que lo
  // esté usando, y recién ahí se borra.
  if (running) cancel(running.id)
  for (const c of auxiliares) matarArbol(c)
  auxiliares.clear()
  await new Promise((r) => setTimeout(r, 1500))

  await rm(cookiesPath(), { force: true })
  await session.fromPartition(YT_PARTITION).clearStorageData()

  if (existsSync(cookiesPath())) {
    // Alguien lo volvió a escribir igual: mejor saberlo que mentirle al usuario.
    log.warn('la sesión de YouTube reapareció después de borrarla')
    await rm(cookiesPath(), { force: true })
  }
}

export const YT_PARTITION = 'persist:youtube-login'

/**
 * Abre YouTube en una ventana propia para que la persona inicie sesión y pase
 * la verificación de "no soy un robot" ella misma. Cuando cierra la ventana, se
 * exporta la sesión resultante al formato que yt-dlp entiende.
 *
 * La verificación la hace un humano en la página real de Google: la app no ve
 * la contraseña ni intenta resolver el desafío por su cuenta.
 */
let loginEnCurso: {
  win: BrowserWindow
  promesa: Promise<{ ok: boolean; cookies: number; error: string | null }>
} | null = null

export function openYoutubeLogin(parent?: BrowserWindow): Promise<{
  ok: boolean
  cookies: number
  error: string | null
}> {
  // Si ya hay una ventana abierta, traerla al frente en vez de abrir otra: si
  // quedó detrás de la ventana de control, el usuario ve "esperando a que
  // cierres la ventana" sin ninguna ventana a la vista que pueda cerrar.
  if (loginEnCurso && !loginEnCurso.win.isDestroyed()) {
    if (loginEnCurso.win.isMinimized()) loginEnCurso.win.restore()
    loginEnCurso.win.show()
    loginEnCurso.win.focus()
    return loginEnCurso.promesa
  }

  // La ventana se crea FUERA del ejecutor de la promesa: el ejecutor corre de
  // forma síncrona, así que guardar ahí una referencia a `promesa` la tocaba
  // antes de que existiera y tiraba ReferenceError.
  let win: BrowserWindow
  try {
    win = new BrowserWindow({
      width: 1000,
      height: 760,
      parent,
      title: 'Iniciar sesión en YouTube',
      autoHideMenuBar: true,
      webPreferences: {
        partition: YT_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        // Ventana de un tercero: nada de la app tiene que estar accesible acá.
        sandbox: true
      }
    })
  } catch (e) {
    return Promise.resolve({ ok: false, cookies: 0, error: String(e) })
  }

  const promesa = new Promise<{ ok: boolean; cookies: number; error: string | null }>((resolve) => {
    win.on('closed', () => {
      loginEnCurso = null
      void (async () => {
        try {
          const all = await session.fromPartition(YT_PARTITION).cookies.get({})
          // Sólo lo de Google/YouTube: no tiene sentido llevarse otra cosa. El
          // dominio es opcional en el tipo de Electron, y sin dominio la cookie
          // no sirve para nada en el archivo.
          const utiles = all
            .filter((c) => c.domain && /youtube\.com$|google\.com$/.test(c.domain))
            .map((c) => ({
              name: c.name,
              value: c.value,
              domain: c.domain as string,
              path: c.path ?? '/',
              secure: Boolean(c.secure),
              expirationDate: c.expirationDate
            }))
          // Cargar youtube.com ya deja cookies de consentimiento y de
          // visitante, así que contar cookies no dice nada: hay que ver si
          // están las de autenticación. Guardar una sesión sin login daría a
          // entender que quedó todo listo cuando en realidad no cambia nada.
          if (!hasAuthCookies(utiles)) {
            return resolve({
              ok: false,
              cookies: utiles.length,
              error:
                'No se detectó una sesión iniciada. Abrí de nuevo, entrá con tu cuenta de Google y recién ahí cerrá la ventana.'
            })
          }
          await writeFile(cookiesPath(), toNetscapeCookies(utiles), 'utf-8')
          log.info(`sesión de YouTube guardada (${utiles.length} cookies)`)
          resolve({ ok: true, cookies: utiles.length, error: null })
        } catch (e) {
          resolve({ ok: false, cookies: 0, error: String(e) })
        }
      })()
    })

    void win.loadURL('https://www.youtube.com/')
  })

  loginEnCurso = { win, promesa }
  return promesa
}

// ─── Instalación de las herramientas ─────────────────────────────────────────

/** Baja un binario suelto con escritura atómica y lo deja ejecutable. */
async function bajarBinario(
  url: string,
  destino: string,
  onProgress: InstallProgress,
  etiqueta: string
): Promise<void> {
  // Escritura atómica: si se corta la luz a mitad, un yt-dlp truncado queda
  // para siempre y la app lo da por instalado, fallando en cada descarga sin
  // ofrecer forma de arreglarlo desde la interfaz.
  const tmp = destino + '.descargando'
  await fetchToFile(url, tmp, onProgress, etiqueta)
  await rename(tmp, destino)
  await hacerEjecutable(destino)
}

/** Descomprime un paquete y sube a `dir` los ejecutables pedidos. */
async function instalarDesdePaquete(
  url: string,
  nombrePaquete: string,
  dir: string,
  ejecutables: string[],
  onProgress: InstallProgress,
  etiqueta: string
): Promise<void> {
  const paquete = join(dir, `${etiqueta}-tmp-${nombrePaquete}`)
  const tmp = join(dir, `${etiqueta}-tmp`)
  try {
    await fetchToFile(url, paquete, onProgress, etiqueta)
    onProgress(`Descomprimiendo ${etiqueta}`, null)
    await rm(tmp, { recursive: true, force: true })
    await mkdir(tmp, { recursive: true })
    await extraerArchivo(paquete, tmp)
    // Los paquetes traen todo dentro de una carpeta con el número de build.
    for (const name of ejecutables) {
      const found = await findFileDeep(tmp, name + EXE)
      if (!found) throw new Error(`El paquete de ${etiqueta} no traía ${name}${EXE}`)
      const destino = join(dir, name + EXE)
      await rm(destino, { force: true })
      await rename(found, destino)
      await hacerEjecutable(destino)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
    await rm(paquete, { force: true }).catch(() => {})
  }
}

/**
 * Baja lo que falte: yt-dlp, ffmpeg (con ffprobe) y, si no hay ningún
 * intérprete de JavaScript, deno. Igual en Windows y en Linux: la
 * descompresión ya no depende de PowerShell.
 */
export async function installTools(onProgress: InstallProgress): Promise<ToolStatus> {
  const dir = installDir()
  await mkdir(dir, { recursive: true })
  const actual = resolveTools()

  const ytAsset = YTDLP_ASSETS[PLATAFORMA]
  if (!ytAsset) throw new Error(`No hay un yt-dlp publicado para ${PLATAFORMA}`)
  if (!actual.ytDlp) {
    onProgress('Buscando la última versión de yt-dlp', null)
    await bajarBinario(
      await urlDeAsset('yt-dlp/yt-dlp', ytAsset),
      join(dir, 'yt-dlp' + EXE),
      onProgress,
      'yt-dlp'
    )
  }

  if (!actual.ffmpegDir) {
    const asset = FFMPEG_ASSETS[PLATAFORMA]
    if (!asset) {
      throw new Error(
        `No hay un ffmpeg listo para ${PLATAFORMA}. Instalalo con el gestor de paquetes del sistema.`
      )
    }
    await instalarDesdePaquete(
      FFMPEG_URL_BASE + asset,
      asset,
      dir,
      ['ffmpeg', 'ffprobe'],
      onProgress,
      'ffmpeg'
    )
  }

  if (!actual.jsRuntime) {
    const asset = DENO_ASSETS[PLATAFORMA]
    if (asset) {
      onProgress('Buscando la última versión de deno', null)
      await instalarDesdePaquete(
        await urlDeAsset('denoland/deno', asset),
        asset,
        dir,
        ['deno'],
        onProgress,
        'deno'
      )
    } else {
      log.warn(`no hay deno publicado para ${PLATAFORMA}; YouTube puede fallar`)
    }
  }

  return herramientas()
}

/**
 * Baja la última versión de yt-dlp. YouTube cambia algo cada pocas semanas y
 * un yt-dlp viejo es la causa número uno de "no anda la descarga".
 *
 * Se reemplaza el binario en su lugar (atómico: primero se baja al lado y
 * recién después se renombra encima). Si el que se usa vino del PATH del
 * sistema —instalado con winget o con el gestor de paquetes—, no se lo toca:
 * se baja una copia propia a la carpeta de herramientas, que tiene prioridad.
 */
export async function actualizarYtDlp(onProgress: InstallProgress): Promise<ToolsUpdateResult> {
  if (running || auxiliares.size > 0) {
    return {
      ok: false,
      version: null,
      mensaje: 'Hay descargas en curso: esperá a que terminen para actualizar yt-dlp.'
    }
  }
  const asset = YTDLP_ASSETS[PLATAFORMA]
  if (!asset) return { ok: false, version: null, mensaje: `No hay un yt-dlp publicado para ${PLATAFORMA}` }

  const actual = resolveTools().ytDlp
  const antes = actual ? await versionDe(actual) : null
  const propio = actual && candidateDirs().some((d) => actual.startsWith(d))
  const destino = propio && actual ? actual : join(installDir(), 'yt-dlp' + EXE)
  await mkdir(dirname(destino), { recursive: true })

  try {
    onProgress('Buscando la última versión de yt-dlp', null)
    await bajarBinario(await urlDeAsset('yt-dlp/yt-dlp', asset), destino, onProgress, 'yt-dlp')
  } catch (e) {
    return { ok: false, version: antes, mensaje: `No se pudo actualizar: ${String(e)}` }
  }
  const despues = await versionDe(destino)
  return {
    ok: true,
    version: despues,
    mensaje:
      antes && despues && antes === despues
        ? `yt-dlp ya estaba al día (${despues}).`
        : `yt-dlp actualizado${antes ? ` de ${antes}` : ''} a ${despues ?? 'la última versión'}.`
  }
}

// ─── Estado ──────────────────────────────────────────────────────────────────

type Listener = (jobs: DownloadJob[]) => void

let jobs: DownloadJob[] = []
let running: { id: string; child: ChildProcess } | null = null
let listeners: Listener[] = []
let seq = 0
/**
 * Evita que `pump` se ejecute dos veces a la vez. Sin esto, encolar una lista
 * de 50 videos disparaba 50 `pump()` en la misma vuelta del event loop —
 * `running` recién se asigna dentro de `runJob`, así que todos veían la cola
 * libre y lanzaban su propio yt-dlp. Cincuenta procesos a la vez clavaban la
 * máquina y, de paso, era justo el patrón de tráfico que hace que YouTube
 * conteste con un CAPTCHA: la app se autoinfligía el bloqueo.
 */
let pumping = false
/** Procesos de probe/lista, para poder matarlos al cerrar la app. */
const auxiliares = new Set<ChildProcess>()

function emit(): void {
  const snapshot = jobs.map((j) => ({ ...j }))
  for (const l of listeners) l(snapshot)
}

/**
 * Con una lista larga, yt-dlp escribe varias líneas de progreso por segundo y
 * cada una serializaba la cola entera por IPC. Los cambios de progreso se
 * agrupan a ~4 por segundo; los de etapa (empezó, terminó, falló) salen ya.
 */
let emitPendiente: NodeJS.Timeout | null = null
function emitThrottled(): void {
  if (emitPendiente) return
  emitPendiente = setTimeout(() => {
    emitPendiente = null
    emit()
  }, 250)
}

function patch(id: string, changes: Partial<DownloadJob>): void {
  const antes = jobs.find((j) => j.id === id)
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...changes } : j))

  // Un tick de progreso trae `stage` también, pero repitiendo el que ya estaba:
  // lo que decide es si la etapa cambió de verdad.
  const cambioEtapa = changes.stage !== undefined && changes.stage !== antes?.stage
  const soloProgreso =
    !cambioEtapa && Object.keys(changes).every((k) => k === 'progress' || k === 'stage')

  if (soloProgreso) return emitThrottled()
  if (emitPendiente) {
    clearTimeout(emitPendiente)
    emitPendiente = null
  }
  emit()
}

export function onChange(listener: Listener): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function list(): DownloadJob[] {
  return jobs.map((j) => ({ ...j }))
}

// ─── yt-dlp ──────────────────────────────────────────────────────────────────

/**
 * Corre yt-dlp y espera a que termine. El timeout no es opcional: sin él, un
 * yt-dlp colgado deja la promesa sin resolver, `pump` queda trabado esperándola
 * y la cola entera se detiene para siempre — el usuario ve "En espera…" en
 * todos los videos y la única salida es cerrar la app.
 */
function runYtDlp(
  args: string[],
  timeoutMs = 60_000
): Promise<{ code: number; out: string; err: string }> {
  const { ytDlp } = resolveTools()
  return new Promise((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawn(ytDlp ?? `yt-dlp${EXE}`, args, opcionesSpawnMatable())
    } catch (e) {
      return reject(e)
    }
    auxiliares.add(child)

    let out = ''
    let err = ''
    let cerrado = false
    const timer = setTimeout(() => {
      if (cerrado) return
      matarArbol(child)
      cerrado = true
      auxiliares.delete(child)
      reject(new Error(`yt-dlp no respondió en ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    const terminar = (fn: () => void): void => {
      if (cerrado) return
      cerrado = true
      clearTimeout(timer)
      auxiliares.delete(child)
      fn()
    }

    child.stdout?.on('data', (d) => (out += d))
    child.stderr?.on('data', (d) => (err += d))
    child.on('error', (e) => terminar(() => reject(e)))
    child.on('close', (code) => terminar(() => resolve({ code: code ?? -1, out, err })))
  })
}

/** Pide los datos del video sin bajarlo, para mostrar de qué se trata. */
export async function probe(url: string): Promise<{
  title: string | null
  uploader: string | null
  durationSec: number | null
  thumbnail: string | null
}> {
  const { out, err } = await runYtDlp(
    buildProbeArgs(
      url,
      resolveTools().jsRuntime,
      getSettings().downloadCookiesBrowser,
      cookiesFileOrNull()
    ),
    45_000
  )
  if (err.trim()) log.debug('probe stderr:', err.trim().slice(-2000))
  try {
    const j = JSON.parse(out)
    return {
      title: typeof j.title === 'string' ? j.title : null,
      uploader: typeof j.uploader === 'string' ? j.uploader : (j.channel ?? null),
      durationSec: typeof j.duration === 'number' ? j.duration : null,
      thumbnail: typeof j.thumbnail === 'string' ? j.thumbnail : null
    }
  } catch {
    return { title: null, uploader: null, durationSec: null, thumbnail: null }
  }
}

/** Mata todo lo que esté corriendo. Se llama al cerrar la app. */
export function dispose(): void {
  if (running) matarArbol(running.child)
  running = null
  for (const c of auxiliares) matarArbol(c)
  auxiliares.clear()
  listeners = []
}

function runJob(job: DownloadJob): Promise<void> {
  return new Promise((resolve) => {
    const destDir = destinationFor(job.kind)
    if (!destDir) {
      patch(job.id, {
        stage: 'error',
        error:
          job.kind === 'audio'
            ? 'Falta configurar la carpeta de audio en Ajustes.'
            : 'Falta configurar la carpeta de media en Ajustes.'
      })
      return resolve()
    }

    const tools = resolveTools()
    const args = buildArgs({
      url: job.url,
      kind: job.kind,
      quality: job.quality,
      bitrate: job.bitrate,
      seccion: job.seccion ?? null,
      destDir,
      ffmpegDir: tools.ffmpegDir,
      jsRuntime: tools.jsRuntime,
      cookiesBrowser: getSettings().downloadCookiesBrowser,
      cookiesFile: cookiesFileOrNull()
    })

    let child: ChildProcess
    try {
      child = spawn(tools.ytDlp ?? `yt-dlp${EXE}`, args, opcionesSpawnMatable())
    } catch (e) {
      patch(job.id, { stage: 'error', error: String(e) })
      return resolve()
    }

    running = { id: job.id, child }
    patch(job.id, { stage: 'downloading' })

    let filePath: string | null = null
    let stderr = ''
    let pending = ''

    const handleLine = (line: string): void => {
      const prog = parseProgressLine(line)
      if (prog) {
        patch(job.id, { stage: prog.stage, progress: prog.progress })
        return
      }
      const f = parseFileLine(line)
      if (f) filePath = f
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      pending += chunk.toString()
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const l of lines) handleLine(l)
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (e) => {
      const msg =
        (e as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'No se encontró yt-dlp. Instalá las herramientas desde esta misma pantalla.'
          : String(e)
      patch(job.id, { stage: 'error', error: msg })
    })

    child.on('close', (code) => {
      if (pending) handleLine(pending)
      // Sólo soltar el puesto si el que cerró es realmente el que estaba
      // corriendo: si no, un proceso que tarda en morir después de cancelarlo
      // borra la referencia al que ya arrancó en su lugar, y a partir de ahí
      // corren dos en paralelo y el segundo queda incancelable.
      if (running?.id === job.id) running = null

      const current = jobs.find((j) => j.id === job.id)
      // Si alcanzó a terminar bien justo mientras lo cancelaban, vale como
      // hecho: el archivo está en la carpeta, decir "cancelada" haría que el
      // usuario lo baje de nuevo al pedo.
      if (code === 0 && filePath) {
        patch(job.id, { stage: 'done', filePath, progress: null, error: null })
        return resolve()
      }
      if (current?.stage === 'canceled') return resolve()
      if (current?.stage === 'error') return resolve()

      if (code === 0) {
        patch(job.id, { stage: 'done', filePath, progress: null })
      } else {
        const detalle = stderr.trim()
        const reason =
          explainError(detalle) ?? lastMeaningfulLine(detalle) ?? `yt-dlp terminó con código ${code}`
        log.error('descarga fallida:', job.url, '\n', detalle.slice(-8000))
        patch(job.id, {
          stage: 'error',
          error: reason,
          // La pantalla no tiene que adivinar leyendo el texto del error: se lo
          // marca acá, donde está el stderr crudo.
          needsLogin: isBotCheckError(detalle),
          // El stderr crudo va al job para que se pueda ver y copiar desde la
          // pantalla: sin esto, diagnosticar exige reproducir el fallo a mano.
          errorDetail: detalle.slice(-8000) || null
        })
      }
      resolve()
    })
  })
}

/** Arranca la próxima descarga si no hay ninguna corriendo. */
async function pump(): Promise<void> {
  if (pumping || running) return
  pumping = true
  try {
    const next = jobs.find((j) => j.stage === 'queued')
    if (!next) return

    // Consultar el video puede tardar casi un minuto. Sin avisarlo, la fila
    // quedaba en "En espera…" sin moverse y parecía que la app estaba trabada.
    patch(next.id, { stage: 'preparing' })

    // Los datos del video son un lujo: si el probe falla, se baja igual. Lo que
    // ya se sabía (el título que trajo la lista) no se pisa con un null.
    if (!next.title || !next.thumbnail) {
      try {
        const meta = await probe(next.url)
        const current = jobs.find((j) => j.id === next.id)
        if (current?.stage === 'preparing') {
          patch(next.id, {
            title: meta.title ?? current.title,
            uploader: meta.uploader ?? current.uploader,
            durationSec: meta.durationSec ?? current.durationSec,
            thumbnail: meta.thumbnail ?? current.thumbnail
          })
        }
      } catch (e) {
        log.warn('no se pudieron leer los datos del video:', String(e))
      }
    }

    // Sigue en 'preparing' salvo que lo hayan cancelado mientras se consultaba.
    const still = jobs.find((j) => j.id === next.id)
    if (still?.stage === 'preparing') await runJob(still)
  } finally {
    pumping = false
  }
  // Fuera del candado, para que la próxima vuelta lo tome limpio.
  if (jobs.some((j) => j.stage === 'queued')) void pump()
}

export function enqueue(
  url: string,
  options: Partial<DownloadOptions> = {},
  title: string | null = null
): DownloadJob {
  const o = { ...DEFAULT_OPTIONS, ...options }
  seq += 1
  const job: DownloadJob = {
    id: `dl-${Date.now()}-${seq}`,
    url,
    kind: o.kind,
    quality: o.quality,
    bitrate: o.bitrate,
    seccion: o.seccion ?? null,
    stage: 'queued',
    title,
    uploader: null,
    durationSec: null,
    thumbnail: null,
    progress: null,
    filePath: null,
    error: null,
    createdAt: Date.now()
  }
  jobs = [...jobs, job]
  emit()
  void pump()
  return job
}

/**
 * Expande una lista de reproducción y encola un trabajo por video, en vez de
 * dejar que yt-dlp la baje entera de un saque: así cada video muestra su propio
 * avance y se puede cancelar uno sin perder los demás.
 */
export async function enqueuePlaylist(
  url: string,
  options: Partial<DownloadOptions> = {}
): Promise<{ added: number; error: string | null }> {
  let out: string
  let err: string
  let code: number
  try {
    ;({ out, err, code } = await runYtDlp(
      buildPlaylistArgs(
        url,
        resolveTools().jsRuntime,
        getSettings().downloadCookiesBrowser,
        cookiesFileOrNull()
      ),
      90_000
    ))
  } catch (e) {
    return { added: 0, error: String(e instanceof Error ? e.message : e) }
  }

  const entries = parsePlaylistEntries(out)
  if (entries.length === 0) {
    const detalle = err.trim()
    const reason =
      explainError(detalle) ?? lastMeaningfulLine(detalle) ?? `No se encontró ningún video (código ${code})`
    log.error('lista fallida:', url, '\n', detalle.slice(-4000))
    return { added: 0, error: reason }
  }
  // Un recorte no tiene sentido aplicado a toda una lista.
  for (const e of entries) enqueue(e.url, { ...options, seccion: null }, e.title)
  return { added: entries.length, error: null }
}

export function cancel(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (!job) return
  if (job.stage === 'done' || job.stage === 'error') return
  patch(id, { stage: 'canceled', progress: null })
  if (running?.id === id) {
    matarArbol(running.child)
    // No se toca `running`: lo limpia el handler de 'close' cuando el proceso
    // realmente muera. Soltarlo acá deja arrancar otra descarga mientras la
    // anterior todavía agoniza, y ahí corren dos a la vez.
    void limpiarParciales(job)
  }
}

/**
 * Vuelve a poner en cola una descarga que falló o se canceló, con las mismas
 * opciones. Lo más común después de iniciar sesión en YouTube o de actualizar
 * yt-dlp: antes había que volver a pegar el enlace.
 */
export function retry(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (!job || (job.stage !== 'error' && job.stage !== 'canceled')) return
  patch(id, {
    stage: 'queued',
    error: null,
    errorDetail: null,
    needsLogin: false,
    progress: null,
    filePath: null
  })
  void pump()
}

/** Abre el explorador de archivos con la descarga seleccionada. */
export function showInFolder(id: string): boolean {
  const job = jobs.find((j) => j.id === id)
  if (job?.filePath && existsSync(job.filePath)) {
    shell.showItemInFolder(job.filePath)
    return true
  }
  const dir = job ? destinationFor(job.kind) : null
  if (dir && existsSync(dir)) {
    void shell.openPath(dir)
    return true
  }
  return false
}

/**
 * Borra los `.part` que quedaron de una descarga cortada. Un kill forzado no
 * le da a yt-dlp la chance de limpiar, y esos archivos —invisibles para la app,
 * porque el scanner filtra por extensión— se acumulan de a cientos de MB hasta
 * llenar el disco sin que nadie entienda por qué.
 */
async function limpiarParciales(job: DownloadJob): Promise<void> {
  const dir = destinationFor(job.kind)
  if (!dir) return
  // Darle tiempo al proceso a soltar el archivo antes de intentar borrarlo.
  await new Promise((r) => setTimeout(r, 1500))
  try {
    for (const f of await readdir(dir)) {
      if (!/\.part$|\.ytdl$/i.test(f)) continue
      try {
        await rm(join(dir, f), { force: true })
        log.info('descarga cancelada: se borró el parcial', f)
      } catch {
        /* sigue en uso: quedará para el próximo barrido */
      }
    }
  } catch {
    /* la carpeta puede haber desaparecido */
  }
}

/** Saca de la lista lo que ya no está corriendo. */
export function clearFinished(): void {
  jobs = jobs.filter((j) => ACTIVOS.includes(j.stage))
  emit()
}

export function remove(id: string): void {
  cancel(id)
  jobs = jobs.filter((j) => j.id !== id)
  emit()
}
