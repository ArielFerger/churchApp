import { create } from 'zustand'
import { detectarReferencias, fusionar, type ReferenciaDetectada } from '../utils/escuchaBiblica'

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
   * La cita nunca se oyó entera: en todas las ventanas donde apareció estaba
   * pegada a un borde, así que el número o el ordinal pueden estar cortados.
   * No es lo mismo que confianza baja —el reconocedor puede haber entendido
   * perfecto lo que le llegó— y por eso se avisa aparte.
   */
  cortada: boolean
}

/** Cuántas ventanas de transcripción se conservan para el panel de abajo. */
const MAX_VENTANAS = 40

interface EscuchaState {
  estado: EstadoEscucha
  /** Nivel de entrada 0..1, para el medidor. */
  nivel: number
  /** El texto de las últimas ventanas, la más nueva al final. */
  ventanas: string[]
  sugerencias: Sugerencia[]
  /** Cuánto tardó whisper con la última ventana. */
  ultimaLatenciaMs: number | null
  /** Ventanas que se perdieron porque whisper venía atrasado. */
  descartadas: number
  error: string | null

  setEstado: (estado: EstadoEscucha) => void
  setNivel: (nivel: number) => void
  setError: (error: string | null) => void
  /** Suma lo que devolvió una ventana y actualiza las sugerencias. */
  aplicarVentana: (texto: string, ms?: number) => void
  ventanaDescartada: () => void
  /** Saca una sugerencia de la lista (ya se proyectó, o no servía). */
  descartarSugerencia: (clave: string) => void
  limpiar: () => void
}

/** Identidad de una sugerencia, para poder sacarla de la lista. */
export function claveSugerencia(r: ReferenciaDetectada): string {
  return `${r.bookId}-${r.chapter}-${r.verse ?? ''}-${r.endVerse ?? ''}`
}

/**
 * Las posiciones que devuelve el detector son relativas a la ventana, y las
 * ventanas empiezan de cero cada vez. Se les suma cuántas palabras se
 * escucharon antes para que el orden de las sugerencias siga al sermón y no se
 * mezcle la primera cita con la última.
 */
let palabrasPrevias = 0

/**
 * Citas que en algún momento se oyeron enteras, o sea con palabras a los dos
 * lados. Se acumula entre ventanas: alcanza con haberla oído bien una vez.
 */
let vistasEnteras = new Set<string>()

/**
 * ¿La cita toca el principio o el final de la ventana?
 *
 * Las ventanas se cortan por reloj, no por frase, así que un número puede
 * quedar partido al medio. Pasó de verdad en la prueba en vivo: una ventana
 * terminó en "…primera de Corintios capítulo 3." cuando el audio decía
 * "capítulo 13" — se perdió el "1" en el corte, y la sugerencia salía
 * indistinguible de una bien oída. Del otro lado pasa lo mismo con el ordinal:
 * "segunda de Corintios" cortada arriba queda en "Corintios", que resuelve a
 * Primera. Un libro equivocado con cara de cita perfecta.
 *
 * Como las ventanas se solapan 1,5 s, una cita real suele volver a aparecer en
 * el medio de la siguiente, y ahí deja de estar cortada.
 */
function tocaElBorde(ventana: string, r: ReferenciaDetectada): boolean {
  const fragmento = r.fragmento.trim()
  return r.offset === 0 || (fragmento.length > 0 && ventana.endsWith(fragmento))
}

const inicial = {
  estado: 'apagada' as EstadoEscucha,
  nivel: 0,
  ventanas: [] as string[],
  sugerencias: [] as Sugerencia[],
  ultimaLatenciaMs: null as number | null,
  descartadas: 0,
  error: null as string | null
}

export const useEscuchaStore = create<EscuchaState>((set) => ({
  ...inicial,

  // Salir del error al volver a arrancar: si el mensaje quedara pegado, la
  // pantalla diría "escuchando" y "falló" al mismo tiempo.
  setEstado: (estado) => set(estado === 'error' ? { estado } : { estado, error: null }),
  setNivel: (nivel) => set({ nivel }),
  setError: (error) => set({ error, estado: error ? 'error' : 'apagada' }),

  aplicarVentana: (texto, ms) =>
    set((s) => {
      const limpio = texto.trim()
      if (!limpio) return { ultimaLatenciaMs: ms ?? s.ultimaLatenciaMs }

      const nuevas = detectarReferencias(limpio).map((r) => {
        if (!tocaElBorde(limpio, r)) vistasEnteras.add(claveSugerencia(r))
        return { ...r, offset: r.offset + palabrasPrevias }
      })
      palabrasPrevias += limpio.split(/\s+/).length

      return {
        ventanas: [...s.ventanas, limpio].slice(-MAX_VENTANAS),
        // `cortada` se recalcula sobre la lista entera, no se arrastra: una
        // cita que hoy llegó cortada puede oírse entera en la próxima ventana,
        // y entonces deja de estarlo. Bajarle la confianza en vez de marcarla
        // sería mentir sobre otra cosa: el reconocedor la entendió bien, lo que
        // falló fue dónde cayó el corte.
        sugerencias: fusionar(s.sugerencias, nuevas).map((r) => ({
          ...r,
          cortada: !vistasEnteras.has(claveSugerencia(r))
        })),
        ultimaLatenciaMs: ms ?? s.ultimaLatenciaMs
      }
    }),

  ventanaDescartada: () => set((s) => ({ descartadas: s.descartadas + 1 })),

  descartarSugerencia: (clave) =>
    set((s) => ({ sugerencias: s.sugerencias.filter((r) => claveSugerencia(r) !== clave) })),

  limpiar: () => {
    palabrasPrevias = 0
    vistasEnteras = new Set()
    set({ ...inicial })
  }
}))
