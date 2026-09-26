import { create } from 'zustand'
import {
  detectarReferencias,
  fusionar,
  tokenizar,
  type ContextoCita,
  type EstadisticasBiblia,
  type ReferenciaDetectada
} from '../utils/escuchaBiblica'
import type { EstadoServidorWhisper, MotorWhisper } from '../types/escucha'

/**
 * El estado del módulo Escucha: qué se está oyendo y qué citas aparecieron.
 *
 * No toca el micrófono ni el IPC a propósito —de eso se encarga
 * `control/audio/escuchaEnVivo.ts`—, así que todo lo que hay acá se puede
 * probar mandándole texto, sin audio de por medio.
 *
 * Nada de esto se persiste. Al detener se descarta: la transcripción del
 * sermón no queda guardada en el disco.
 */

export type EstadoEscucha = 'apagada' | 'iniciando' | 'escuchando' | 'error'

export interface Sugerencia extends ReferenciaDetectada {
  /**
   * La cita cayó pegada a un corte FORZADO (el predicador habló de corrido
   * más de lo que entra en un fragmento), así que el número puede estar
   * cortado. No es lo mismo que confianza baja —el reconocedor puede haber
   * entendido perfecto lo que le llegó— y por eso se avisa aparte.
   */
  cortada: boolean
  /** Cuándo se oyó por primera vez (ms desde epoch). */
  t: number
  /** Cuántas veces se nombró. Un pasaje que vuelve es el del sermón. */
  veces: number
}

/** Un fragmento transcrito, para el panel "lo que se está oyendo". */
export interface FragmentoOido {
  id: number
  texto: string
  ms: number | null
  forzado: boolean
  t: number
}

/** Lo que está en pantalla ahora, si salió desde la Escucha. */
export interface PasajeEnPantalla {
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

/** Cuántos fragmentos se conservan para el panel de abajo. */
const MAX_FRAGMENTOS = 60

/**
 * Cuánto dura el contexto para resolver "el versículo 31" sin libro. Pasado
 * este tiempo, el predicador puede estar hablando de cualquier otra cosa.
 */
export const CONTEXTO_VIGENCIA_MS = 3 * 60_000

/**
 * Cuántas palabras del fragmento anterior se vuelven a analizar junto con el
 * nuevo. Una frase se puede cortar entre "vamos a segunda de" y "Corintios 13"
 * (una pausa para respirar): con la costura, la cita sale entera igual.
 */
const PALABRAS_COSTURA = 8

interface EscuchaState {
  estado: EstadoEscucha
  /** Nivel de entrada 0..1, para el medidor. */
  nivel: number
  /** Umbral de voz vigente 0..1 (se adapta al ruido de fondo). */
  umbral: number
  /** Si en este momento se detecta voz. */
  hablando: boolean
  /** Fragmentos mandados a transcribir que todavía no volvieron. */
  pendientes: number
  motor: MotorWhisper | null
  servidor: EstadoServidorWhisper
  /** Las últimas frases transcritas, la más nueva al final. */
  fragmentos: FragmentoOido[]
  sugerencias: Sugerencia[]
  /** Cuánto tardó whisper con el último fragmento. */
  ultimaLatenciaMs: number | null
  /** Fragmentos que se perdieron porque whisper venía atrasado. */
  descartadas: number
  error: string | null
  /** El pasaje del que se viene hablando, con cuándo se lo nombró. */
  contexto: (ContextoCita & { t: number }) | null
  /** Versículos por capítulo de la versión en uso, para descartar imposibles. */
  estadisticas: EstadisticasBiblia | null
  enPantalla: PasajeEnPantalla | null
  /** Claves de las sugerencias que ya salieron a la pantalla. */
  proyectadas: string[]

  setEstado: (estado: EstadoEscucha) => void
  setNivel: (nivel: number, umbral?: number, hablando?: boolean) => void
  setError: (error: string | null) => void
  setMotor: (motor: MotorWhisper | null, servidor: EstadoServidorWhisper) => void
  setEstadisticas: (e: EstadisticasBiblia | null) => void
  fragmentoEnviado: () => void
  /** Suma lo que devolvió un fragmento y actualiza las sugerencias. */
  aplicarVentana: (texto: string, ms?: number, opciones?: { forzado?: boolean }) => void
  ventanaDescartada: () => void
  /** Saca una sugerencia de la lista (ya se proyectó, o no servía). */
  descartarSugerencia: (clave: string) => void
  /** Lo que el operador proyectó: pasa a ser el contexto y lo que se navega. */
  marcarEnPantalla: (p: PasajeEnPantalla | null) => void
  marcarProyectada: (clave: string) => void
  /** El final de lo transcrito, para darle contexto al reconocedor. */
  textoReciente: () => string
  limpiar: () => void
}

/** Sugerencias que todavía no salieron: lo que el indicador de la cabecera cuenta. */
export function pendientesDeProyectar(s: Pick<EscuchaState, 'sugerencias' | 'proyectadas'>): number {
  return s.sugerencias.filter((r) => !s.proyectadas.includes(claveSugerencia(r))).length
}

/** Identidad de una sugerencia, para poder sacarla de la lista. */
export function claveSugerencia(r: Pick<ReferenciaDetectada, 'bookId' | 'chapter' | 'verse' | 'endVerse'>): string {
  return `${r.bookId}-${r.chapter}-${r.verse ?? ''}-${r.endVerse ?? ''}`
}

/**
 * Las posiciones que devuelve el detector son relativas al texto analizado, y
 * cada fragmento empieza de cero. Se les suma cuántas palabras se escucharon
 * antes para que el orden de las sugerencias siga al sermón.
 */
let palabrasPrevias = 0

/** Citas que en algún momento se oyeron enteras (lejos de un corte forzado). */
let vistasEnteras = new Set<string>()

let siguienteId = 1

/** ¿La cita toca el final del texto? Lo que sigue es sólo puntuación. */
function tocaElFinal(texto: string, r: ReferenciaDetectada): boolean {
  if (!r.span) return false
  return /^[\s.,;:!?¡¿…"'»”)]*$/.test(texto.slice(r.span[1]))
}

const inicial = {
  estado: 'apagada' as EstadoEscucha,
  nivel: 0,
  umbral: 0,
  hablando: false,
  pendientes: 0,
  motor: null as MotorWhisper | null,
  servidor: 'apagado' as EstadoServidorWhisper,
  fragmentos: [] as FragmentoOido[],
  sugerencias: [] as Sugerencia[],
  ultimaLatenciaMs: null as number | null,
  descartadas: 0,
  error: null as string | null,
  contexto: null as (ContextoCita & { t: number }) | null,
  enPantalla: null as PasajeEnPantalla | null,
  proyectadas: [] as string[]
}

export const useEscuchaStore = create<EscuchaState>((set, get) => ({
  ...inicial,
  estadisticas: null,

  // Salir del error al volver a arrancar: si el mensaje quedara pegado, la
  // pantalla diría "escuchando" y "falló" al mismo tiempo.
  setEstado: (estado) => set(estado === 'error' ? { estado } : { estado, error: null }),
  setNivel: (nivel, umbral, hablando) =>
    set((s) => ({
      nivel,
      umbral: umbral ?? s.umbral,
      hablando: hablando ?? s.hablando
    })),
  setError: (error) => set({ error, estado: error ? 'error' : 'apagada' }),
  setMotor: (motor, servidor) => set({ motor, servidor }),
  setEstadisticas: (estadisticas) => set({ estadisticas }),
  fragmentoEnviado: () => set((s) => ({ pendientes: s.pendientes + 1 })),

  aplicarVentana: (texto, ms, opciones = {}) =>
    set((s) => {
      const pendientes = Math.max(0, s.pendientes - 1)
      const limpio = texto.trim()
      if (!limpio) return { ultimaLatenciaMs: ms ?? s.ultimaLatenciaMs, pendientes }
      const ahora = Date.now()
      const forzado = Boolean(opciones.forzado)

      // Costura: el final del fragmento anterior se vuelve a analizar pegado
      // al nuevo. Lo que ya estaba entero allá no se repite (queda antes del
      // borde); lo que se partió entre los dos, sale acá.
      const anterior = s.fragmentos[s.fragmentos.length - 1]?.texto ?? ''
      const tokensAnt = tokenizar(anterior)
      const colaTokens = tokensAnt.slice(-PALABRAS_COSTURA)
      const cola = colaTokens.length ? anterior.slice(colaTokens[0].inicio) : ''
      const analizado = cola ? `${cola} ${limpio}` : limpio
      const borde = cola ? cola.length + 1 : 0

      const vigente =
        s.contexto && ahora - s.contexto.t < CONTEXTO_VIGENCIA_MS ? s.contexto : null

      const detectadas = detectarReferencias(analizado, {
        contexto: vigente,
        estadisticas: s.estadisticas ?? undefined
      }).filter((r) => !r.span || r.span[1] > borde)

      const nuevas = detectadas.map((r) => {
        const cortada = forzado && tocaElFinal(analizado, r)
        if (!cortada) vistasEnteras.add(claveSugerencia(r))
        return { ...r, offset: r.offset - colaTokens.length + palabrasPrevias }
      })
      palabrasPrevias += tokenizar(limpio).length

      // Metadatos que el detector no conoce: cuándo se oyó y cuántas veces.
      const previas = new Map(s.sugerencias.map((r) => [claveSugerencia(r), r]))
      const nuevasClaves = new Set(nuevas.map(claveSugerencia))
      const sugerencias: Sugerencia[] = fusionar(s.sugerencias, nuevas).map((r) => {
        const k = claveSugerencia(r)
        const antes = previas.get(k)
        return {
          ...r,
          t: antes?.t ?? ahora,
          veces: (antes?.veces ?? 0) + (nuevasClaves.has(k) ? 1 : 0),
          // `cortada` se recalcula sobre la lista entera, no se arrastra: una
          // cita que llegó cortada puede oírse entera en el fragmento
          // siguiente, y entonces deja de estarlo.
          cortada: !vistasEnteras.has(k)
        }
      })

      const ultima = nuevas[nuevas.length - 1]
      const contexto = ultima
        ? { bookId: ultima.bookId, chapter: ultima.chapter, t: ahora }
        : s.contexto

      return {
        pendientes,
        fragmentos: [
          ...s.fragmentos,
          { id: siguienteId++, texto: limpio, ms: ms ?? null, forzado, t: ahora }
        ].slice(-MAX_FRAGMENTOS),
        sugerencias,
        contexto,
        ultimaLatenciaMs: ms ?? s.ultimaLatenciaMs
      }
    }),

  ventanaDescartada: () =>
    set((s) => ({ descartadas: s.descartadas + 1, pendientes: Math.max(0, s.pendientes - 1) })),

  descartarSugerencia: (clave) =>
    set((s) => ({ sugerencias: s.sugerencias.filter((r) => claveSugerencia(r) !== clave) })),

  marcarEnPantalla: (p) =>
    set((s) => ({
      enPantalla: p,
      // Lo proyectado es el mejor contexto posible: el operador confirmó que
      // de eso se está hablando.
      contexto: p ? { bookId: p.bookId, chapter: p.chapter, t: Date.now() } : s.contexto
    })),

  marcarProyectada: (clave) =>
    set((s) => (s.proyectadas.includes(clave) ? s : { proyectadas: [...s.proyectadas, clave] })),

  textoReciente: () =>
    get()
      .fragmentos.slice(-3)
      .map((f) => f.texto)
      .join(' '),

  limpiar: () => {
    palabrasPrevias = 0
    vistasEnteras = new Set()
    // Las estadísticas son de la Biblia, no del culto: se conservan.
    set({ ...inicial })
  }
}))
