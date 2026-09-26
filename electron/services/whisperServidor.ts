import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { dirname } from 'path'
import log from 'electron-log'
import { buildServerArgs, explicarErrorWhisper, ultimaLineaUtil } from '../../src/shared/utils/whisper'
import { entornoConBibliotecas, matarArbol, opcionesSpawnMatable } from './toolsPaths'

/**
 * `whisper-server` como proceso persistente.
 *
 * La primera versión de la Escucha lanzaba `whisper-cli` por cada ventana de
 * audio. Cada lanzamiento vuelve a leer el modelo del disco y a inicializarlo:
 * con el modelo base eso es la mayor parte del tiempo de cada ventana (medido:
 * ~3,4 s por fragmento contra ~1,3 s con el servidor ya cargado), y con modelos
 * más precisos directamente no daba el tiempo.
 *
 * El servidor carga el modelo una vez y atiende pedidos HTTP. Escucha sólo en
 * 127.0.0.1 y en un puerto elegido al azar: el audio del sermón no sale de la
 * máquina ni se puede pedir desde otra PC de la red. Tampoco pasa por disco: el
 * WAV viaja en memoria dentro del pedido.
 */

export type EstadoServidor = 'apagado' | 'cargando' | 'listo' | 'error'

export interface RespuestaServidor {
  json: unknown
  ms: number
}

/** Un puerto libre en 127.0.0.1, preguntándole al sistema. */
function puertoLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const dir = srv.address()
      const puerto = typeof dir === 'object' && dir ? dir.port : 0
      srv.close(() => (puerto ? resolve(puerto) : reject(new Error('sin puerto libre'))))
    })
  })
}

const espera = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export class ServidorWhisper {
  private child: ChildProcess | null = null
  private puerto = 0
  private clave: string | null = null
  private arrancando: Promise<void> | null = null
  private stderr = ''
  private caidas: number[] = []
  private _estado: EstadoServidor = 'apagado'
  private _error: string | null = null
  private onEstado: (e: EstadoServidor) => void

  constructor(onEstado: (e: EstadoServidor) => void = () => {}) {
    this.onEstado = onEstado
  }

  get estado(): EstadoServidor {
    return this._estado
  }

  get error(): string | null {
    return this._error
  }

  /**
   * ¿Se cayó demasiadas veces seguidas? Tres caídas en dos minutos: algo está
   * roto de verdad (binario incompatible, modelo corrupto) y reintentar sólo
   * ocupa la CPU. El servicio pasa entonces al CLI.
   */
  get inestable(): boolean {
    const hace2min = Date.now() - 120_000
    return this.caidas.filter((t) => t > hace2min).length >= 3
  }

  private setEstado(e: EstadoServidor, error: string | null = null): void {
    this._estado = e
    this._error = error
    this.onEstado(e)
  }

  /**
   * Deja el servidor corriendo con este modelo. Si ya está con el mismo, no
   * hace nada; si está con otro (se cambió en Ajustes), lo reinicia.
   */
  async asegurar(binServidor: string, modelPath: string, hilos: number): Promise<void> {
    const clave = `${binServidor}|${modelPath}|${hilos}`
    if (this.child && this.clave === clave) {
      if (this.arrancando) await this.arrancando
      if (this._estado === 'listo') return
    }
    if (this.arrancando && this.clave === clave) return this.arrancando

    this.detener()
    this.clave = clave
    this.arrancando = this.arrancar(binServidor, modelPath, hilos).finally(() => {
      this.arrancando = null
    })
    return this.arrancando
  }

  private async arrancar(bin: string, modelPath: string, hilos: number): Promise<void> {
    this.setEstado('cargando')
    this.stderr = ''
    this.puerto = await puertoLibre()

    const child = spawn(
      bin,
      buildServerArgs({ modelPath, puerto: this.puerto, hilos }),
      opcionesSpawnMatable({
        // El servidor busca su carpeta `public/` relativa al directorio de
        // trabajo; con el de la app como cwd se evita que sirva archivos de
        // cualquier otro lado.
        cwd: dirname(bin),
        env: entornoConBibliotecas(dirname(bin))
      })
    )
    this.child = child
    child.stderr?.on('data', (d: Buffer) => {
      this.stderr = (this.stderr + d.toString()).slice(-8000)
    })
    // stdout también hay que drenarlo: si el buffer del pipe se llena, el
    // proceso se bloquea escribiendo y deja de atender pedidos.
    child.stdout?.on('data', () => {})
    child.on('error', (e) => {
      log.error('whisper-server no arrancó:', e)
      if (this.child === child) {
        this.child = null
        this.setEstado('error', String(e))
      }
    })
    child.on('exit', (code, signal) => {
      if (this.child !== child) return // ya se lo reemplazó a propósito
      this.child = null
      const detalle = this.stderr.trim()
      log.warn(`whisper-server terminó (código ${code}, señal ${signal})`, detalle.slice(-2000))
      this.caidas.push(Date.now())
      this.setEstado(
        'error',
        explicarErrorWhisper(detalle) ?? ultimaLineaUtil(detalle) ?? `whisper-server terminó (${code})`
      )
    })

    // Esperar a que cargue el modelo. Mientras tanto /health contesta 503. Un
    // modelo grande en un disco lento puede tardar; más de 90 s es que algo
    // anda mal.
    const limite = Date.now() + 90_000
    while (Date.now() < limite) {
      if (this.child !== child) throw new Error(this._error ?? 'whisper-server se cerró al arrancar')
      try {
        const res = await fetch(`http://127.0.0.1:${this.puerto}/health`, {
          signal: AbortSignal.timeout(2000)
        })
        if (res.ok) {
          log.info(`whisper-server listo en el puerto ${this.puerto}`)
          this.setEstado('listo')
          return
        }
      } catch {
        /* todavía no escucha */
      }
      await espera(250)
    }
    this.detener()
    this.setEstado('error', 'whisper-server tardó demasiado en cargar el modelo')
    throw new Error(this._error ?? 'whisper-server no respondió')
  }

  /**
   * Manda un WAV a transcribir. Devuelve el JSON crudo (`verbose_json`): la
   * lectura, con sus filtros, es pura y está en `shared/utils/whisper.ts`.
   */
  async transcribir(
    wav: Uint8Array,
    opciones: {
      prompt?: string | null
      idioma?: string
      timeoutMs?: number
      /** Ver `audioCtxPara`: acota el cómputo al largo real del fragmento. */
      audioCtx?: number
    } = {}
  ): Promise<RespuestaServidor> {
    if (this.arrancando) await this.arrancando
    if (!this.child || this._estado !== 'listo') throw new Error('whisper-server no está corriendo')

    const form = new FormData()
    // Copia a un ArrayBuffer propio: el Blob no acepta vistas sobre un buffer
    // compartido, y así el pedido no depende de quién más use esa memoria.
    const copia = new Uint8Array(wav.byteLength)
    copia.set(wav)
    form.append('file', new Blob([copia.buffer], { type: 'audio/wav' }), 'ventana.wav')
    form.append('response_format', 'verbose_json')
    form.append('language', opciones.idioma ?? 'es')
    form.append('temperature', '0.0')
    form.append('temperature_inc', '0.0')
    if (opciones.prompt) form.append('prompt', opciones.prompt)
    if (opciones.audioCtx) form.append('audio_ctx', String(opciones.audioCtx))

    const arranque = Date.now()
    const res = await fetch(`http://127.0.0.1:${this.puerto}/inference`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 30_000)
    })
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      throw new Error(`whisper-server respondió ${res.status}: ${cuerpo.slice(0, 200)}`)
    }
    const json: unknown = await res.json()
    return { json, ms: Date.now() - arranque }
  }

  /** Corta el proceso. Se puede volver a arrancar con `asegurar`. */
  detener(): void {
    const c = this.child
    this.child = null
    this.clave = null
    if (c) matarArbol(c)
    if (this._estado !== 'error') this.setEstado('apagado')
  }
}
