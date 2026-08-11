import { spawn } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { join } from 'path'
import { app } from 'electron'
import { getSettings } from './settingsService'

/**
 * Lo común a todas las herramientas externas que la app baja y ejecuta
 * (yt-dlp, ffmpeg, whisper): dónde buscarlas, cómo bajarlas sin dejar archivos
 * a medias, y cómo descomprimirlas.
 *
 * Estaba todo adentro de `downloadsService`. Se sacó cuando la Escucha necesitó
 * exactamente lo mismo: tener dos copias de la búsqueda de carpetas garantiza
 * que un día la carpeta configurada en Ajustes valga para una herramienta y no
 * para la otra.
 */

export const EXE = process.platform === 'win32' ? '.exe' : ''

/** Busca un ejecutable en el PATH del sistema. */
export function findInPath(name: string): string | null {
  const raw = process.env.PATH ?? ''
  for (const dir of raw.split(process.platform === 'win32' ? ';' : ':')) {
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

export function runCommand(cmd: string, args: string[]): Promise<void> {
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

/**
 * Descomprime delegándolo al sistema (`Expand-Archive`), para no sumar una
 * dependencia de node sólo para esto.
 */
export async function extraerZip(zip: string, destino: string): Promise<void> {
  // Las comillas simples se duplican para escaparlas: la ruta sale de una
  // opción configurable y del nombre de usuario de Windows, así que un
  // apellido con apóstrofe (O'Brien) rompía el comando — y era una vía de
  // inyección a través de un valor de configuración.
  const psQuote = (p: string): string => `'${p.replace(/'/g, "''")}'`
  await runCommand('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath ${psQuote(zip)} -DestinationPath ${psQuote(destino)} -Force`
  ])
}

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
