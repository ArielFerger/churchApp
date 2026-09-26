import { dbAGanancia, floatAPcm16, TASA } from '@/shared/utils/audioVentanas'
import { SegmentadorVoz } from '@/shared/utils/segmentadorVoz'

/**
 * Toma el audio del predicador y lo entrega en frases listas para whisper.
 *
 * El micrófono sólo existe acá, en el renderer: `getUserMedia` no está en el
 * proceso principal. Lo que se manda al main son bytes de PCM, nada más.
 *
 * La entrada esperada no es el micrófono de la notebook sino la **salida de la
 * consola de sonido** (el inalámbrico del pastor pasa por ahí). Por eso se
 * apagan los tres procesados que Chromium aplica por defecto: están pensados
 * para una videollamada con el micrófono al lado de los parlantes, y sobre una
 * línea limpia sólo bombean el ruido de fondo entre frase y frase, que es
 * justo lo que hace alucinar a whisper.
 */

export interface OpcionesCaptura {
  /** `deviceId` de `enumerateDevices`. Sin esto, la entrada por defecto. */
  deviceId?: string | null
  /** 0..1, ver `SegmentadorVoz`. */
  sensibilidad?: number
  /**
   * Volumen de entrada, en dB (0 = como llega). Para un micrófono lejano o una
   * placa con poca salida: sube la señal ANTES de medirla y de transcribirla.
   */
  gananciaDb?: number
  /** Una frase lista para transcribir (PCM 16 bits mono a 16 kHz). */
  onFragmento: (pcm: Int16Array, forzado: boolean, frase: number) => void
  /**
   * Lo que va de la frase en curso, cada ~2 s mientras se sigue hablando.
   * Para mostrar una cita antes de que el predicador termine la frase.
   */
  onParcial?: (pcm: Int16Array, frase: number) => void
  /** Nivel, umbral vigente y si hay voz, varias veces por segundo. */
  onNivel?: (nivel: number, umbral: number, hablando: boolean) => void
  /** Se llama si la captura se cae sola (se desenchufó la placa, por ejemplo). */
  onError?: (e: Error) => void
}

export interface Captura {
  detener: () => Promise<void>
  setSensibilidad: (s: number) => void
  setGanancia: (db: number) => void
  /** El dispositivo que efectivamente quedó tomando. */
  etiqueta: string
}

/**
 * El worklet vive en `public/escucha-worklet.js` y se carga por ruta relativa
 * al documento. No puede ir como blob ni como data URL: la política de
 * seguridad de la app es `script-src 'self'` y los bloquea a los dos —el
 * síntoma es un escueto "Unable to load a worklet's module", que no dice nada
 * de CSP.
 */
const WORKLET_URL = './escucha-worklet.js'

export async function iniciarCaptura(opciones: OpcionesCaptura): Promise<Captura> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: opciones.deviceId ? { exact: opciones.deviceId } : undefined,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })

  // Pedir el AudioContext directamente a 16 kHz deja que Chromium haga el
  // remuestreo, que es la parte que más fácil se hace mal a mano (sin filtro
  // previo, bajar de 48 kHz a 16 mete aliasing y whisper empeora bastante).
  const contexto = new AudioContext({ sampleRate: TASA })

  const segmentador = new SegmentadorVoz({ tasa: TASA, sensibilidad: opciones.sensibilidad })
  let vivo = true

  try {
    await contexto.audioWorklet.addModule(WORKLET_URL)
  } catch (e) {
    // Sin worklet no hay captura, y el AudioContext ya tomó el dispositivo.
    for (const t of stream.getTracks()) t.stop()
    await contexto.close()
    throw e
  }

  const fuente = contexto.createMediaStreamSource(stream)
  // Ganancia antes de todo: el medidor, el detector de voz y whisper ven la
  // señal ya amplificada. Un micrófono de notebook a dos metros llega tan bajo
  // que había que hablarle encima.
  const ganancia = contexto.createGain()
  ganancia.gain.value = dbAGanancia(opciones.gananciaDb ?? 0)
  const nodo = new AudioWorkletNode(contexto, 'recolector')

  let ultimoParcial = 0
  nodo.port.onmessage = (e: MessageEvent<Float32Array>): void => {
    if (!vivo) return
    const lectura = segmentador.alimentar(floatAPcm16(e.data))
    opciones.onNivel?.(lectura.nivel, lectura.umbral, lectura.hablando)
    // La decisión de qué es voz va acá y no en el main: mandar audio por IPC
    // para que del otro lado se decida tirarlo es trabajo al pedo, y el main
    // ya está ocupado con whisper.
    for (const f of lectura.fragmentos) opciones.onFragmento(f.pcm, f.forzado, f.frase)
    if (lectura.fragmentos.length > 0) ultimoParcial = performance.now()

    // Mientras se sigue hablando, cada 2 s, lo que va de la frase.
    if (opciones.onParcial && lectura.hablando) {
      const ahora = performance.now()
      if (ahora - ultimoParcial >= 2000) {
        const p = segmentador.parcial(1800)
        if (p) {
          ultimoParcial = ahora
          opciones.onParcial(p.pcm, p.frase)
        }
      }
    }
  }

  fuente.connect(ganancia).connect(nodo)
  // El worklet no produce salida, pero sin un destino Chromium puede dormir el
  // grafo. Un nodo de ganancia en cero lo mantiene despierto sin que se
  // escuche nada por los parlantes del salón.
  const mudo = contexto.createGain()
  mudo.gain.value = 0
  nodo.connect(mudo).connect(contexto.destination)

  const pista = stream.getAudioTracks()[0]
  pista?.addEventListener('ended', () => {
    opciones.onError?.(new Error('Se cortó la entrada de audio.'))
  })

  return {
    etiqueta: pista?.label ?? 'entrada de audio',
    setSensibilidad: (s) => segmentador.setSensibilidad(s),
    setGanancia: (db) => {
      // Rampa corta: un salto brusco de ganancia se oye como un chasquido y el
      // detector de voz lo toma como el comienzo de una frase.
      ganancia.gain.setTargetAtTime(dbAGanancia(db), contexto.currentTime, 0.05)
    },
    detener: async (): Promise<void> => {
      vivo = false
      nodo.port.onmessage = null
      // Lo que quedó a medio decir todavía puede tener una cita adentro.
      const cola = segmentador.cerrar()
      if (cola) opciones.onFragmento(cola.pcm, cola.forzado, cola.frase)

      nodo.disconnect()
      ganancia.disconnect()
      fuente.disconnect()
      for (const t of stream.getTracks()) t.stop()
      await contexto.close()
    }
  }
}

/** Entradas de audio disponibles, para el selector de la pantalla. */
export async function entradasDeAudio(): Promise<MediaDeviceInfo[]> {
  const todos = await navigator.mediaDevices.enumerateDevices()
  return todos.filter((d) => d.kind === 'audioinput')
}
