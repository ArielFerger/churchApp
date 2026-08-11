import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, rm } from 'fs/promises'
import { cpus } from 'os'
import { join, dirname } from 'path'
import log from 'electron-log'
import {
  buildWhisperArgs,
  CARPETA_MODELOS,
  CARPETA_WHISPER,
  explicarErrorWhisper,
  hilosSugeridos,
  MODELO_POR_DEFECTO,
  modeloPorId,
  modeloUrl,
  NOMBRES_BINARIO,
  parseTranscripcion,
  PROMPT_BIBLICO,
  ultimaLineaUtil,
  WHISPER_BIN_URL,
  WHISPER_MODELS,
  type WhisperModelId
} from '../../src/shared/utils/whisper'
import { getSettings } from './settingsService'
import {
  candidateDirs,
  EXE,
  extraerZip,
  fetchToFile,
  findFileDeep,
  installDir,
  type InstallProgress
} from './toolsPaths'

/**
 * Transcripción de voz con whisper.cpp, para el módulo Escucha.
 *
 * Mismo trato que yt-dlp y ffmpeg: un binario externo que se baja de su
 * release oficial, se busca en el disco y se spawnea. No se empaqueta con la
 * app —el modelo solo pesa más que todo el instalador— y no se usa ningún
 * servicio en la nube: el audio del sermón no sale de esta máquina.
 *
 * Este servicio es deliberadamente tonto: recibe un WAV y devuelve texto.
 * Entender ese texto (encontrar las citas bíblicas) es trabajo de
 * `src/shared/utils/escuchaBiblica.ts`, que son funciones puras.
 */

export interface WhisperStatus {
  /** Ruta del ejecutable, o `null` si todavía no está. */
  binPath: string | null
  /** Modelo elegido en Ajustes. */
  modelo: WhisperModelId
  /** Ruta del `.bin` del modelo elegido, o `null` si falta bajarlo. */
  modelPath: string | null
  /** Modelos que ya están en disco, para no ofrecer bajarlos de nuevo. */
  instalados: WhisperModelId[]
  /** Dónde se buscó, para poder mostrarlo cuando falta algo. */
  searched: string[]
}

/**
 * Whisper no es un ejecutable suelto: necesita sus DLL al lado. Por eso vive en
 * su propia carpeta dentro de la de herramientas, y el modelo en una subcarpeta
 * de esa. Así se puede borrar todo el módulo con una sola carpeta.
 */
function carpetasWhisper(): string[] {
  return candidateDirs().map((d) => join(d, CARPETA_WHISPER))
}

function buscarBinario(): string | null {
  for (const dir of carpetasWhisper()) {
    for (const name of NOMBRES_BINARIO) {
      const p = join(dir, name + EXE)
      if (existsSync(p)) return p
    }
  }
  // A propósito no se busca en el PATH con el nombre `main`: es demasiado
  // genérico y terminaría ejecutando cualquier cosa que se llame así.
  for (const dir of candidateDirs()) {
    const p = join(dir, 'whisper-cli' + EXE)
    if (existsSync(p)) return p
  }
  return null
}

function buscarModelo(id: WhisperModelId): string | null {
  const archivo = modeloPorId(id).archivo
  for (const dir of carpetasWhisper()) {
    const p = join(dir, CARPETA_MODELOS, archivo)
    if (existsSync(p)) return p
  }
  // Un modelo dejado a mano junto a las otras herramientas también vale.
  for (const dir of candidateDirs()) {
    const p = join(dir, archivo)
    if (existsSync(p)) return p
  }
  return null
}

export function modeloElegido(): WhisperModelId {
  return modeloPorId(getSettings().escuchaModelo ?? MODELO_POR_DEFECTO).id
}

export function resolveWhisper(): WhisperStatus {
  const modelo = modeloElegido()
  return {
    binPath: buscarBinario(),
    modelo,
    modelPath: buscarModelo(modelo),
    instalados: WHISPER_MODELS.filter((m) => buscarModelo(m.id)).map((m) => m.id),
    searched: carpetasWhisper()
  }
}

/** Si falta algo, el texto que explica qué. `null` = está todo listo. */
export function queFalta(estado: WhisperStatus = resolveWhisper()): string | null {
  if (!estado.binPath && !estado.modelPath)
    return 'Faltan el programa de transcripción y el modelo.'
  if (!estado.binPath) return 'Falta el programa de transcripción (whisper).'
  if (!estado.modelPath) return `Falta el modelo ${modeloPorId(estado.modelo).label}.`
  return null
}

// ─── Instalación ─────────────────────────────────────────────────────────────

/**
 * Baja el binario de whisper y el modelo elegido. Igual que las descargas: en
 * streaming, con escritura atómica —un `.bin` truncado por un corte de luz se
 * ve igual que uno bueno, y whisper falla con un error incomprensible en cada
 * intento— y avisando el avance, que con 148 MB por una conexión de iglesia
 * son varios minutos.
 */
export async function installWhisper(
  onProgress: InstallProgress,
  modelo: WhisperModelId = modeloElegido()
): Promise<WhisperStatus> {
  const dir = join(installDir(), CARPETA_WHISPER)
  await mkdir(join(dir, CARPETA_MODELOS), { recursive: true })

  if (!buscarBinario()) {
    const url = WHISPER_BIN_URL[process.platform]
    if (!url || process.platform !== 'win32') {
      throw new Error(
        'La instalación automática de whisper sólo está para Windows. En Linux, compilá whisper.cpp y ' +
          `dejá whisper-cli en ${dir}.`
      )
    }
    const zip = join(dir, 'whisper-tmp.zip')
    await fetchToFile(url, zip, onProgress, 'whisper')
    onProgress('Descomprimiendo whisper', null)
    const tmp = join(dir, 'whisper-tmp')
    await rm(tmp, { recursive: true, force: true })
    await extraerZip(zip, tmp)

    // El zip cambió de forma entre versiones (a veces todo en la raíz, a veces
    // dentro de `Release/`). En vez de adivinar, se busca el ejecutable y se
    // sube su carpeta entera: las DLL que necesita están justamente ahí.
    const exe =
      (await findFileDeep(tmp, 'whisper-cli' + EXE)) ?? (await findFileDeep(tmp, 'main' + EXE))
    if (!exe) throw new Error('El zip de whisper no traía el ejecutable')
    const origen = dirname(exe)
    for (const nombre of await readdir(origen)) {
      await rename(join(origen, nombre), join(dir, nombre))
    }
    await rm(tmp, { recursive: true, force: true })
    await rm(zip, { force: true })
  }

  if (!buscarModelo(modelo)) {
    const meta = modeloPorId(modelo)
    const destino = join(dir, CARPETA_MODELOS, meta.archivo)
    const parcial = destino + '.descargando'
    await fetchToFile(modeloUrl(modelo), parcial, onProgress, `modelo ${meta.label}`)
    await rename(parcial, destino)
  }

  return resolveWhisper()
}

// ─── Transcripción ───────────────────────────────────────────────────────────

/** Procesos vivos, para poder matarlos al cerrar la app. */
const corriendo = new Set<ChildProcessWithoutNullStreams>()

export interface OpcionesTranscripcion {
  /** Idioma del audio. `auto` deja que whisper lo detecte. */
  idioma?: string
  /** Contexto para el reconocedor. Por defecto, el vocabulario bíblico. */
  prompt?: string | null
  /** Corta el proceso si no contestó. Una ventana de 6 s no debería pasar de 5. */
  timeoutMs?: number
}

export interface Transcripcion {
  texto: string
  /** Cuánto tardó whisper, en ms. Es el número que hay que vigilar en vivo. */
  ms: number
  modelo: WhisperModelId
}

/**
 * Transcribe un WAV (16 kHz, mono, 16 bits) y devuelve el texto.
 *
 * El timeout no es opcional por la misma razón que en las descargas: un
 * proceso colgado deja la promesa sin resolver y, en vivo, la Escucha se queda
 * muda sin que nadie entienda por qué.
 */
export async function transcribirWav(
  wavPath: string,
  opciones: OpcionesTranscripcion = {}
): Promise<Transcripcion> {
  const estado = resolveWhisper()
  const falta = queFalta(estado)
  if (falta || !estado.binPath || !estado.modelPath) {
    throw new Error(falta ?? 'Whisper no está instalado.')
  }
  if (!existsSync(wavPath)) throw new Error(`No existe el audio a transcribir: ${wavPath}`)

  const args = buildWhisperArgs({
    modelPath: estado.modelPath,
    wavPath,
    idioma: opciones.idioma ?? 'es',
    hilos: hilosSugeridos(cpus().length),
    prompt: opciones.prompt === undefined ? PROMPT_BIBLICO : opciones.prompt
  })

  const arranque = Date.now()
  const { code, out, err } = await correr(estado.binPath, args, opciones.timeoutMs ?? 120_000)
  const ms = Date.now() - arranque

  if (code !== 0) {
    log.error('whisper falló:', err.trim().slice(-4000))
    throw new Error(
      explicarErrorWhisper(err) ?? ultimaLineaUtil(err) ?? `whisper terminó con código ${code}`
    )
  }
  return { texto: parseTranscripcion(out), ms, modelo: estado.modelo }
}

function correr(
  bin: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(bin, args, { windowsHide: true })
    } catch (e) {
      return reject(e)
    }
    corriendo.add(child)

    let out = ''
    let err = ''
    let cerrado = false
    const timer = setTimeout(() => {
      if (cerrado) return
      cerrado = true
      matar(child)
      corriendo.delete(child)
      reject(new Error(`whisper no respondió en ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    const terminar = (fn: () => void): void => {
      if (cerrado) return
      cerrado = true
      clearTimeout(timer)
      corriendo.delete(child)
      fn()
    }

    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) =>
      terminar(() =>
        reject(
          (e as NodeJS.ErrnoException).code === 'ENOENT'
            ? new Error('No se encontró whisper. Instalalo desde la sección Escucha.')
            : e
        )
      )
    )
    child.on('close', (code) => terminar(() => resolve({ code: code ?? -1, out, err })))
  })
}

function matar(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null) return // ya murió
  try {
    child.kill(process.platform === 'win32' ? undefined : 'SIGTERM')
  } catch {
    /* ya no está */
  }
}

/** Mata cualquier transcripción en curso. Se llama al cerrar la app. */
export function dispose(): void {
  for (const c of corriendo) matar(c)
  corriendo.clear()
}
