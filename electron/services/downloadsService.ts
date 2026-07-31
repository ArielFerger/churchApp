import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { chmod, mkdir, readdir, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import {
  buildArgs,
  parseFileLine,
  parseProgressLine,
  type DownloadJob,
  type DownloadKind
} from '../../src/shared/utils/downloads'
import { getSettings } from './settingsService'

/**
 * Descargas de YouTube (y de cualquier sitio que yt-dlp soporte).
 *
 * El trabajo pesado lo hacen dos binarios externos: yt-dlp baja, y ffmpeg junta
 * el video con el audio y arma el MP3. No se empaquetan con la app —yt-dlp se
 * desactualiza en semanas cuando YouTube cambia algo, y ffmpeg pesa más que
 * todo el resto junto—, así que se buscan en el disco y se avisa cuando faltan.
 *
 * Las descargas se hacen de a una. Bajar cuatro videos en paralelo por la
 * conexión de una iglesia sólo consigue que las cuatro vayan lentas.
 */

export interface ToolStatus {
  ytDlp: string | null
  ffmpegDir: string | null
  /** Dónde se buscó, para poder mostrarlo si falta algo. */
  searched: string[]
}

const EXE = process.platform === 'win32' ? '.exe' : ''

/** Carpetas donde se busca, en orden de prioridad. */
function candidateDirs(): string[] {
  const dirs: string[] = []
  const configured = getSettings().toolsFolder
  if (configured) dirs.push(configured)
  dirs.push(join(app.getPath('userData'), 'tools'))
  // En desarrollo la app corre desde <repo>; en producción desde resources/.
  dirs.push(join(app.getAppPath(), 'tools'))
  dirs.push(join(app.getAppPath(), '..', 'tools'))
  dirs.push(join(process.resourcesPath ?? app.getAppPath(), 'tools'))
  return [...new Set(dirs)]
}

function findIn(dirs: string[], name: string): string | null {
  for (const dir of dirs) {
    const p = join(dir, name + EXE)
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Resuelve dónde están las herramientas. Si no aparecen en ninguna carpeta
 * conocida se devuelve el nombre pelado: puede estar en el PATH, y si tampoco,
 * el spawn falla con ENOENT y se reporta como corresponde.
 */
export function resolveTools(): ToolStatus {
  const dirs = candidateDirs()
  const ytDlp = findIn(dirs, 'yt-dlp')
  const ffmpeg = findIn(dirs, 'ffmpeg')
  return {
    ytDlp,
    ffmpegDir: ffmpeg ? join(ffmpeg, '..') : null,
    searched: dirs
  }
}

/** La carpeta a la que va cada tipo de descarga, según los Ajustes. */
export function destinationFor(kind: DownloadKind): string | null {
  const s = getSettings()
  return kind === 'audio' ? s.audioFolder : s.mediaFolder
}

// ─── Instalación de las herramientas ─────────────────────────────────────────

/** Releases oficiales. yt-dlp es un ejecutable suelto; ffmpeg viene en un zip. */
const YTDLP_URL: Record<string, string> = {
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
}
const FFMPEG_ZIP_WIN =
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'

export type InstallProgress = (step: string, ratio: number | null) => void

async function fetchToFile(url: string, dest: string, onProgress: InstallProgress, label: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`${label}: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || null
  const chunks: Buffer[] = []
  let got = 0
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
    got += chunk.byteLength
    onProgress(label, total ? got / total : null)
  }
  await writeFile(dest, Buffer.concat(chunks))
}

/**
 * Baja yt-dlp y ffmpeg a la carpeta de herramientas. La descomprensión del zip
 * de ffmpeg se delega al sistema (`Expand-Archive` en Windows, `unzip` en el
 * resto) para no sumar una dependencia de node sólo para esto.
 */
export async function installTools(onProgress: InstallProgress): Promise<ToolStatus> {
  const dir = getSettings().toolsFolder ?? join(app.getPath('userData'), 'tools')
  await mkdir(dir, { recursive: true })

  const ytUrl = YTDLP_URL[process.platform]
  if (!ytUrl) throw new Error(`No hay build de yt-dlp para ${process.platform}`)

  if (!findIn([dir], 'yt-dlp')) {
    await fetchToFile(ytUrl, join(dir, 'yt-dlp' + EXE), onProgress, 'yt-dlp')
    if (process.platform !== 'win32') await chmod(join(dir, 'yt-dlp'), 0o755)
  }

  if (!findIn([dir], 'ffmpeg')) {
    if (process.platform !== 'win32') {
      throw new Error(
        'ffmpeg automático sólo está para Windows. Instalalo con el gestor de paquetes de tu sistema.'
      )
    }
    const zip = join(dir, 'ffmpeg-tmp.zip')
    await fetchToFile(FFMPEG_ZIP_WIN, zip, onProgress, 'ffmpeg')
    onProgress('Descomprimiendo ffmpeg', null)
    const unpack = join(dir, 'ffmpeg-tmp')
    await runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${unpack}' -Force`
    ])
    // El zip trae todo dentro de una carpeta con el número de build adentro.
    for (const name of ['ffmpeg', 'ffprobe']) {
      const found = await findFileDeep(unpack, name + EXE)
      if (!found) throw new Error(`El zip de ffmpeg no traía ${name}${EXE}`)
      await rename(found, join(dir, name + EXE))
    }
    await rm(unpack, { recursive: true, force: true })
    await rm(zip, { force: true })
  }

  return resolveTools()
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(err.trim() || `${cmd} salió con ${code}`))
    )
  })
}

async function findFileDeep(dir: string, name: string): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      const found = await findFileDeep(full, name)
      if (found) return found
    } else if (e.name.toLowerCase() === name.toLowerCase()) {
      return full
    }
  }
  return null
}

// ─── Estado ──────────────────────────────────────────────────────────────────

type Listener = (jobs: DownloadJob[]) => void

let jobs: DownloadJob[] = []
let running: { id: string; child: ChildProcessWithoutNullStreams } | null = null
let listeners: Listener[] = []
let seq = 0

function emit(): void {
  const snapshot = jobs.map((j) => ({ ...j }))
  for (const l of listeners) l(snapshot)
}

function patch(id: string, changes: Partial<DownloadJob>): void {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...changes } : j))
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

function runYtDlp(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const { ytDlp } = resolveTools()
  return new Promise((resolve, reject) => {
    const child = spawn(ytDlp ?? `yt-dlp${EXE}`, args, { windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, out, err }))
  })
}

/** Pide los datos del video sin bajarlo, para mostrar de qué se trata. */
export async function probe(url: string): Promise<{
  title: string | null
  uploader: string | null
  durationSec: number | null
  thumbnail: string | null
}> {
  const { out } = await runYtDlp([
    url,
    '--no-playlist',
    '--skip-download',
    '--no-warnings',
    '--dump-single-json'
  ])
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

/**
 * Mata el proceso y sus hijos. yt-dlp lanza ffmpeg como hijo, y en Windows un
 * kill sobre el padre lo deja huérfano mordiendo el archivo de salida.
 */
function killTree(child: ChildProcessWithoutNullStreams): void {
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
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
      destDir,
      ffmpegDir: tools.ffmpegDir
    })

    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(tools.ytDlp ?? `yt-dlp${EXE}`, args, { windowsHide: true })
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

    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString()
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const l of lines) handleLine(l)
    })

    child.stderr.on('data', (chunk: Buffer) => {
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
      running = null
      const current = jobs.find((j) => j.id === job.id)
      if (current?.stage === 'canceled') return resolve()
      if (current?.stage === 'error') return resolve()

      if (code === 0) {
        patch(job.id, { stage: 'done', filePath, progress: null })
      } else {
        // yt-dlp escribe el motivo real en la última línea de ERROR.
        const reason =
          stderr
            .split(/\r?\n/)
            .filter((l) => l.trim().startsWith('ERROR'))
            .pop()
            ?.replace(/^ERROR:\s*/, '') ?? `yt-dlp terminó con código ${code}`
        log.warn('descarga fallida:', reason)
        patch(job.id, { stage: 'error', error: reason })
      }
      resolve()
    })
  })
}

/** Arranca la próxima descarga si no hay ninguna corriendo. */
async function pump(): Promise<void> {
  if (running) return
  const next = jobs.find((j) => j.stage === 'queued')
  if (!next) return

  // Los datos del video son un lujo: si el probe falla, se baja igual.
  try {
    const meta = await probe(next.url)
    if (jobs.find((j) => j.id === next.id)?.stage === 'queued') patch(next.id, meta)
  } catch {
    /* sin metadatos */
  }
  const still = jobs.find((j) => j.id === next.id)
  if (!still || still.stage !== 'queued') return void pump()

  await runJob(still)
  void pump()
}

export function enqueue(url: string, kind: DownloadKind): DownloadJob {
  seq += 1
  const job: DownloadJob = {
    id: `dl-${Date.now()}-${seq}`,
    url,
    kind,
    stage: 'queued',
    title: null,
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

export function cancel(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (!job) return
  if (job.stage === 'done' || job.stage === 'error') return
  patch(id, { stage: 'canceled', progress: null })
  if (running?.id === id) {
    killTree(running.child)
    running = null
  }
}

/** Saca de la lista lo que ya no está corriendo. */
export function clearFinished(): void {
  jobs = jobs.filter((j) => j.stage === 'queued' || j.stage === 'downloading' || j.stage === 'processing')
  emit()
}

export function remove(id: string): void {
  cancel(id)
  jobs = jobs.filter((j) => j.id !== id)
  emit()
}
