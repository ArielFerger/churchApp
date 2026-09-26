import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, rm, writeFile } from 'fs/promises'
import { cpus } from 'os'
import { join, dirname } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { TASA, wavDesdePcm16 } from '../../src/shared/utils/audioVentanas'
import type {
  EscuchaStatus,
  MotorWhisper,
  Transcripcion,
  WhisperStatus
} from '../../src/shared/types/escucha'
import {
  audioCtxPara,
  buildWhisperArgs,
  CARPETA_MODELOS,
  CARPETA_WHISPER,
  explicarErrorWhisper,
  hilosSugeridos,
  MODELO_POR_DEFECTO,
  modeloPorId,
  modeloUrl,
  NOMBRES_BINARIO,
  NOMBRES_SERVIDOR,
  parseRespuestaServidor,
  parseTranscripcion,
  PROMPT_BIBLICO,
  ultimaLineaUtil,
  WHISPER_ASSETS,
  WHISPER_MODELS,
  WHISPER_REPO,
  type WhisperModelId
} from '../../src/shared/utils/whisper'
import { getSettings } from './settingsService'
import {
  candidateDirs,
  entornoConBibliotecas,
  EXE,
  extraerArchivo,
  fetchToFile,
  findFileDeep,
  findInPath,
  hacerEjecutable,
  installDir,
  matarArbol,
  opcionesSpawnMatable,
  PLATAFORMA,
  urlDeAsset,
  type InstallProgress
} from './toolsPaths'
import { ServidorWhisper, type EstadoServidor } from './whisperServidor'

/**
 * Transcripción de voz con whisper.cpp, para el módulo Escucha.
 *
 * Mismo trato que yt-dlp y ffmpeg: un binario externo que se baja de su
 * release oficial, se busca en el disco y se ejecuta. No se empaqueta con la
 * app —el modelo solo pesa más que todo el instalador— y no se usa ningún
 * servicio en la nube: el audio del sermón no sale de esta máquina.
 *
 * Este servicio es deliberadamente tonto: recibe audio y devuelve texto.
 * Entender ese texto (encontrar las citas bíblicas) es trabajo de
 * `src/shared/utils/escuchaBiblica.ts`, que son funciones puras.
 */

/**
 * Whisper no es un ejecutable suelto: necesita sus bibliotecas al lado. Por
 * eso vive en su propia carpeta dentro de la de herramientas, y el modelo en
 * una subcarpeta de esa. Así se puede borrar todo el módulo con una sola
 * carpeta.
 */
function carpetasWhisper(): string[] {
  return candidateDirs().map((d) => join(d, CARPETA_WHISPER))
}

function buscarEn(nombres: string[]): string | null {
  for (const dir of carpetasWhisper()) {
    for (const name of nombres) {
      const p = join(dir, name + EXE)
      if (existsSync(p)) return p
    }
  }
  return null
}

function buscarBinario(): string | null {
  const local = buscarEn(NOMBRES_BINARIO)
  if (local) return local
  for (const dir of candidateDirs()) {
    const p = join(dir, 'whisper-cli' + EXE)
    if (existsSync(p)) return p
  }
  // En Linux hay distribuciones que empaquetan whisper.cpp (Arch, Nix…). A
  // propósito no se busca `main` en el PATH: es demasiado genérico y
  // terminaría ejecutando cualquier cosa que se llame así.
  return findInPath('whisper-cli')
}

function buscarServidor(): string | null {
  return buscarEn(NOMBRES_SERVIDOR) ?? findInPath('whisper-server')
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
    serverPath: buscarServidor(),
    modelo,
    modelPath: buscarModelo(modelo),
    instalados: WHISPER_MODELS.filter((m) => buscarModelo(m.id)).map((m) => m.id),
    searched: carpetasWhisper(),
    instalable: Boolean(WHISPER_ASSETS[PLATAFORMA])
  }
}

/** Qué motor se va a usar con lo que hay instalado. */
function motorDisponible(estado: WhisperStatus): MotorWhisper | null {
  if (estado.serverPath && !servidor.inestable) return 'servidor'
  if (estado.binPath) return 'cli'
  return null
}

/** Todo lo que la pantalla necesita de una: dónde está whisper y qué falta. */
export function estadoParaLaPantalla(): EscuchaStatus {
  const estado = resolveWhisper()
  return {
    ...estado,
    falta: queFalta(estado),
    descartadas: ventanasDescartadas(),
    motor: motorDisponible(estado),
    servidor: servidor.estado,
    errorServidor: servidor.error
  }
}

/** Si falta algo, el texto que explica qué. `null` = está todo listo. */
export function queFalta(estado: WhisperStatus = resolveWhisper()): string | null {
  const hayPrograma = Boolean(estado.binPath || estado.serverPath)
  if (!hayPrograma && !estado.modelPath) return 'Faltan el programa de transcripción y el modelo.'
  if (!hayPrograma) return 'Falta el programa de transcripción (whisper).'
  if (!estado.modelPath) return `Falta el modelo ${modeloPorId(estado.modelo).label}.`
  return null
}

// ─── Servidor ────────────────────────────────────────────────────────────────

let avisarEstado: (e: EstadoServidor) => void = () => {}

/** Para que el IPC le avise a la pantalla cuando el modelo terminó de cargar. */
export function alCambiarServidor(fn: (e: EstadoServidor) => void): void {
  avisarEstado = fn
}

const servidor = new ServidorWhisper((e) => avisarEstado(e))

/** Apagado por inactividad: el modelo ocupa RAM que el resto de la app usa. */
let apagadoProgramado: NodeJS.Timeout | null = null
const APAGAR_TRAS_MS = 10 * 60_000

/**
 * Arranca el servidor con el modelo elegido, si hay servidor instalado. Se
 * llama al apretar "Escuchar", para que el modelo se cargue mientras el
 * operador todavía no necesita nada, y no con la primera frase del pastor.
 */
export async function precalentar(): Promise<EscuchaStatus> {
  if (apagadoProgramado) {
    clearTimeout(apagadoProgramado)
    apagadoProgramado = null
  }
  const estado = resolveWhisper()
  if (!queFalta(estado) && estado.serverPath && estado.modelPath && !servidor.inestable) {
    try {
      await servidor.asegurar(estado.serverPath, estado.modelPath, hilosSugeridos(cpus().length))
    } catch (e) {
      // No es fatal: si hay CLI, se transcribe con él.
      log.warn('no arrancó whisper-server, se usa el CLI:', String(e))
    }
  }
  return estadoParaLaPantalla()
}

/** Se llama al detener la Escucha: el servidor se apaga si nadie lo vuelve a usar. */
export function reposar(): void {
  if (apagadoProgramado) clearTimeout(apagadoProgramado)
  apagadoProgramado = setTimeout(() => {
    apagadoProgramado = null
    servidor.detener()
  }, APAGAR_TRAS_MS)
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

  // Hace falta el servidor además del CLI: si sólo está el viejo CLI, se
  // reinstala el paquete para sumarlo (las instalaciones de antes no lo usaban).
  if (!buscarBinario() || !buscarServidor()) {
    const asset = WHISPER_ASSETS[PLATAFORMA]
    if (!asset) {
      throw new Error(
        `No hay un paquete de whisper publicado para ${PLATAFORMA}. Compilalo con ` +
          `scripts/herramientas/instalar_herramientas.py --compilar-whisper, o dejá ` +
          `whisper-cli y whisper-server en ${dir}.`
      )
    }
    // Si el servidor viejo está corriendo, en Windows los archivos están
    // bloqueados y no se pueden reemplazar.
    servidor.detener()

    const ext = asset.endsWith('.tar.gz') ? '.tar.gz' : '.zip'
    const paquete = join(dir, 'whisper-tmp' + ext)
    onProgress('Buscando la última versión de whisper', null)
    await fetchToFile(await urlDeAsset(WHISPER_REPO, asset), paquete, onProgress, 'whisper')
    onProgress('Descomprimiendo whisper', null)
    const tmp = join(dir, 'whisper-tmp')
    await rm(tmp, { recursive: true, force: true })
    await mkdir(tmp, { recursive: true })
    await extraerArchivo(paquete, tmp)

    // El paquete cambió de forma entre versiones (a veces todo en la raíz, a
    // veces dentro de `Release/` o de `whisper-bin-ubuntu-x64/`). En vez de
    // adivinar, se busca el ejecutable y se sube su carpeta entera: las
    // bibliotecas que necesita están justamente ahí.
    const exe =
      (await findFileDeep(tmp, 'whisper-cli' + EXE)) ?? (await findFileDeep(tmp, 'main' + EXE))
    if (!exe) throw new Error('El paquete de whisper no traía el ejecutable')
    const origen = dirname(exe)
    for (const nombre of await readdir(origen)) {
      const destino = join(dir, nombre)
      await rm(destino, { recursive: true, force: true })
      await rename(join(origen, nombre), destino)
    }
    for (const nombre of [...NOMBRES_BINARIO, ...NOMBRES_SERVIDOR]) {
      const p = join(dir, nombre + EXE)
      if (existsSync(p)) await hacerEjecutable(p)
    }
    await rm(tmp, { recursive: true, force: true })
    await rm(paquete, { force: true })
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

/**
 * Borra un modelo que ya no se usa, para recuperar espacio. El elegido no se
 * deja borrar: la Escucha quedaría rota hasta el próximo domingo.
 */
export async function borrarModelo(id: WhisperModelId): Promise<WhisperStatus> {
  if (id === modeloElegido()) throw new Error('No se puede borrar el modelo que está en uso.')
  const ruta = buscarModelo(id)
  if (ruta) await rm(ruta, { force: true })
  return resolveWhisper()
}

// ─── Transcripción ───────────────────────────────────────────────────────────

/** Procesos del CLI vivos, para poder matarlos al cerrar la app. */
const corriendo = new Set<ChildProcess>()

export interface OpcionesTranscripcion {
  /** Idioma del audio. `auto` deja que whisper lo detecte. */
  idioma?: string
  /** Contexto para el reconocedor. Por defecto, el vocabulario bíblico. */
  prompt?: string | null
  /** Corta el proceso si no contestó. Un fragmento de 10 s no debería pasar de 5. */
  timeoutMs?: number
}

/**
 * Transcribe un WAV (16 kHz, mono, 16 bits) con el CLI y devuelve el texto.
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
  return { texto: parseTranscripcion(out), ms, modelo: estado.modelo, motor: 'cli' }
}

// ─── Ventanas en vivo ────────────────────────────────────────────────────────

/**
 * Una transcripción a la vez. Si llega un fragmento mientras whisper todavía
 * está con el anterior, se **descarta** en vez de encolarlo: en vivo, una cola
 * significa que cada fragmento sale más tarde que el anterior y la Escucha se
 * va quedando atrás del predicador para siempre. Perder uno duele mucho menos,
 * y el que viene arrastra el final del anterior (ver `segmentadorVoz.ts`).
 */
let ocupado = false
let descartadas = 0

/** Cuántas ventanas se descartaron por saturación. La pantalla lo muestra. */
export function ventanasDescartadas(): number {
  return descartadas
}

let seq = 0

/**
 * Transcribe un fragmento de audio crudo (PCM de 16 bits, mono).
 *
 * Devuelve `null` si se descartó por saturación.
 *
 * Con el servidor, el audio viaja en memoria y nunca toca el disco. Con el
 * CLI hace falta un WAV temporal, que se borra apenas termina pase lo que pase:
 * el audio del sermón no se guarda en ningún lado. Es una promesa explícita
 * del módulo, no un detalle de implementación.
 */
export async function transcribirVentana(
  pcm: Uint8Array,
  tasa: number = TASA,
  opciones: OpcionesTranscripcion = {}
): Promise<Transcripcion | null> {
  if (ocupado) {
    descartadas += 1
    log.warn(`escucha: fragmento descartado, whisper todavía trabajando (${descartadas} en total)`)
    return null
  }
  ocupado = true
  // `pcm` llega como bytes desde el renderer; la vista de 16 bits se arma
  // sobre el mismo buffer, sin copiar.
  const muestras = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength >> 1)
  const wav = wavDesdePcm16(muestras, tasa)
  const prompt = opciones.prompt === undefined ? PROMPT_BIBLICO : opciones.prompt

  try {
    const estado = resolveWhisper()
    const falta = queFalta(estado)
    if (falta) throw new Error(falta)

    if (motorDisponible(estado) === 'servidor' && estado.serverPath && estado.modelPath) {
      try {
        await servidor.asegurar(estado.serverPath, estado.modelPath, hilosSugeridos(cpus().length))
        const { json, ms } = await servidor.transcribir(wav, {
          prompt,
          idioma: opciones.idioma,
          timeoutMs: opciones.timeoutMs ?? 30_000,
          audioCtx: audioCtxPara((muestras.length / tasa) * 1000)
        })
        return {
          texto: parseRespuestaServidor(json, prompt ?? undefined),
          ms,
          modelo: estado.modelo,
          motor: 'servidor'
        }
      } catch (e) {
        if (!estado.binPath) throw e
        log.warn('whisper-server falló, este fragmento va por el CLI:', String(e))
      }
    }

    const dir = join(app.getPath('temp'), 'church-escucha')
    seq += 1
    const ruta = join(dir, `ventana-${seq}.wav`)
    try {
      await mkdir(dir, { recursive: true })
      await writeFile(ruta, wav)
      return await transcribirWav(ruta, { timeoutMs: 30_000, ...opciones, prompt })
    } finally {
      await rm(ruta, { force: true }).catch(() => {
        /* ya no está, o el antivirus lo tiene tomado */
      })
    }
  } finally {
    ocupado = false
  }
}

/**
 * Borra los WAV que puedan haber quedado de una sesión anterior (si la app se
 * cerró de golpe, el `finally` no llegó a correr). Se llama al arrancar.
 */
export async function limpiarTemporales(): Promise<void> {
  await rm(join(app.getPath('temp'), 'church-escucha'), { recursive: true, force: true }).catch(
    () => {
      /* no había nada */
    }
  )
}

function correr(
  bin: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawn(bin, args, opcionesSpawnMatable({ env: entornoConBibliotecas(dirname(bin)) }))
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
      matarArbol(child)
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

    child.stdout?.on('data', (d) => (out += d))
    child.stderr?.on('data', (d) => (err += d))
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

/** Mata cualquier transcripción en curso y el servidor. Se llama al cerrar la app. */
export function dispose(): void {
  if (apagadoProgramado) clearTimeout(apagadoProgramado)
  servidor.detener()
  for (const c of corriendo) matarArbol(c)
  corriendo.clear()
}
