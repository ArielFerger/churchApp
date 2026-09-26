import { spawn, type ChildProcess, type SpawnOptions } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { chmod, readdir, stat } from 'fs/promises'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { delimiter, join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import extractZip from 'extract-zip'
import {
  clavePlataforma,
  elegirAssetDeRelease,
  urlListaReleases,
  urlUltimaRelease
} from '../../src/shared/utils/githubReleases'
import { getSettings } from './settingsService'

/**
 * Lo común a todas las herramientas externas que la app baja y ejecuta
 * (yt-dlp, ffmpeg, deno, whisper): dónde buscarlas, cómo bajarlas sin dejar
 * archivos a medias, cómo descomprimirlas y cómo matarlas.
 *
 * Estaba todo adentro de `downloadsService`. Se sacó cuando la Escucha necesitó
 * exactamente lo mismo: tener dos copias de la búsqueda de carpetas garantiza
 * que un día la carpeta configurada en Ajustes valga para una herramienta y no
 * para la otra.
 *
 * Todo esto tiene que andar igual en Windows y en Linux. Antes la
 * descompresión era `Expand-Archive` de PowerShell, así que en Linux ni ffmpeg
 * ni whisper se podían instalar desde la app.
 */

export const EXE = process.platform === 'win32' ? '.exe' : ''

/** `win32-x64`, `linux-arm64`…: la clave de las tablas de assets. */
export const PLATAFORMA = clavePlataforma(process.platform, process.arch)

/** Busca un ejecutable en el PATH del sistema. */
export function findInPath(name: string): string | null {
  const raw = process.env.PATH ?? ''
  for (const dir of raw.split(delimiter)) {
    if (!dir) continue
    const p = join(dir, name + EXE)
    try {
      if (existsSync(p)) return p
    } catch {
      /* entrada de PATH inválida */
    }
  }
  return null
}

/** Carpetas donde se busca, en orden de prioridad. */
export function candidateDirs(): string[] {
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

/** La carpeta donde se instala lo que se baja: la configurada, o la de la app. */
export function installDir(): string {
  return getSettings().toolsFolder ?? join(app.getPath('userData'), 'tools')
}

export function findIn(dirs: string[], name: string): string | null {
  for (const dir of dirs) {
    const p = join(dir, name + EXE)
    if (existsSync(p)) return p
  }
  return null
}

export type InstallProgress = (step: string, ratio: number | null) => void

/**
 * Baja a disco en streaming. Acumular los 180 MB de ffmpeg en memoria hacía un
 * pico de ~360 MB al concatenar, y avisar del avance en cada trozo inundaba el
 * IPC con miles de mensajes que dejaban la interfaz pegada; por eso el avance
 * se reporta como mucho cuatro veces por segundo.
 */
export async function fetchToFile(
  url: string,
  dest: string,
  onProgress: InstallProgress,
  label: string
): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15 * 60_000) })
  if (!res.ok || !res.body) throw new Error(`${label}: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || null

  const out = createWriteStream(dest)
  let got = 0
  let ultimoAviso = 0
  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  source.on('data', (chunk: Buffer) => {
    got += chunk.byteLength
    const ahora = Date.now()
    if (ahora - ultimoAviso >= 250) {
      ultimoAviso = ahora
      onProgress(label, total ? got / total : null)
    }
  })
  await pipeline(source, out)
  onProgress(label, 1)
}

/**
 * URL de un asset en la release más nueva de `repo` que lo tenga. Si la API
 * de GitHub no contesta (sin red, o el límite de 60 pedidos por hora), se cae
 * al atajo `latest/download`, que es lo que se usaba antes.
 */
export async function urlDeAsset(repo: string, nombre: string): Promise<string> {
  try {
    const res = await fetch(urlListaReleases(repo), {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'church-projector' },
      signal: AbortSignal.timeout(20_000)
    })
    if (res.ok) {
      const url = elegirAssetDeRelease(await res.json(), nombre)
      if (url) return url
      log.warn(`ninguna release reciente de ${repo} trae ${nombre}`)
    } else {
      log.warn(`API de GitHub respondió ${res.status} para ${repo}`)
    }
  } catch (e) {
    log.warn(`no se pudo consultar la API de GitHub (${repo}):`, String(e))
  }
  return urlUltimaRelease(repo, nombre)
}

export function runCommand(cmd: string, args: string[], opciones: SpawnOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opciones })
    let err = ''
    child.stderr?.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(err.trim() || `${cmd} salió con ${code}`))
    )
  })
}

/**
 * Descomprime un `.zip`, `.tar.gz` o `.tar.xz` en `destino`.
 *
 * - Los zip se abren con `extract-zip` (JavaScript puro, en streaming desde el
 *   disco): el zip de ffmpeg pesa ~190 MB y no hay por qué cargarlo entero en
 *   memoria, ni depender de PowerShell o de que Linux tenga `unzip`.
 * - Los tar se delegan al `tar` del sistema, que existe en toda distribución
 *   Linux (y en Windows 10+). Además conserva los permisos de ejecución y los
 *   enlaces simbólicos de las bibliotecas (`libwhisper.so -> libwhisper.so.1`),
 *   que whisper necesita para arrancar.
 */
export async function extraerArchivo(archivo: string, destino: string): Promise<void> {
  const nombre = archivo.toLowerCase()
  if (nombre.endsWith('.zip')) {
    await extractZip(archivo, { dir: destino })
    return
  }
  if (nombre.endsWith('.tar.gz') || nombre.endsWith('.tgz')) {
    await runCommand('tar', ['-xzf', archivo, '-C', destino])
    return
  }
  if (nombre.endsWith('.tar.xz')) {
    await runCommand('tar', ['-xJf', archivo, '-C', destino])
    return
  }
  throw new Error(`No sé descomprimir ${archivo}`)
}

/** @deprecated nombre viejo; usar `extraerArchivo`. */
export const extraerZip = extraerArchivo

export async function findFileDeep(dir: string, name: string): Promise<string | null> {
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

/**
 * En Linux, lo que se baja no trae el permiso de ejecución (salvo lo que viene
 * en un tar). Sin esto el spawn falla con EACCES y el mensaje no dice nada útil.
 */
export async function hacerEjecutable(ruta: string): Promise<void> {
  if (process.platform === 'win32') return
  try {
    const s = await stat(ruta)
    await chmod(ruta, s.mode | 0o755)
  } catch (e) {
    log.warn('no se pudo marcar como ejecutable:', ruta, String(e))
  }
}

/**
 * Entorno para lanzar un binario que trae sus bibliotecas al lado (whisper).
 * En Windows las DLL de la misma carpeta se encuentran solas; en Linux hay que
 * decírselo al cargador con `LD_LIBRARY_PATH`, o no arranca.
 */
export function entornoConBibliotecas(carpeta: string): NodeJS.ProcessEnv {
  if (process.platform === 'win32') return process.env
  const previo = process.env.LD_LIBRARY_PATH
  return { ...process.env, LD_LIBRARY_PATH: previo ? `${carpeta}${delimiter}${previo}` : carpeta }
}

/**
 * Opciones de spawn para un proceso que después haya que poder matar con todos
 * sus hijos. En Linux se lo pone en su propio grupo (`detached`) para poder
 * matar el grupo entero: yt-dlp lanza ffmpeg, y un SIGTERM sólo al padre deja
 * a ffmpeg vivo escribiendo el archivo.
 */
export function opcionesSpawnMatable(extra: SpawnOptions = {}): SpawnOptions {
  return {
    windowsHide: true,
    ...(process.platform === 'win32' ? {} : { detached: true }),
    ...extra
  }
}

/**
 * Mata el proceso y sus hijos.
 *
 * - Windows: `taskkill /T /F`, que recorre el árbol. Con un handler de 'error'
 *   a propósito: si taskkill no se pudiera lanzar, Node relanzaría el evento
 *   como excepción no capturada y se caería TODA la app, con la proyección al
 *   aire.
 * - Linux/macOS: señal al grupo (`-pid`), que sólo funciona si se lanzó con
 *   `opcionesSpawnMatable`. Si no, al proceso solo.
 */
export function matarArbol(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return // ya murió
  if (!child.pid) return
  if (process.platform === 'win32') {
    const tk = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    tk.on('error', (e) => {
      log.warn('taskkill falló, se intenta kill:', e)
      try {
        child.kill()
      } catch {
        /* ya no está */
      }
    })
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ya no está */
    }
  }
}
