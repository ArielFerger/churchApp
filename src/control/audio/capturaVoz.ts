import {
  agregar,
  crearVentaneo,
  floatAPcm16,
  hayVoz,
  rms,
  TASA,
  vaciar,
  type Ventaneo
} from '@/shared/utils/audioVentanas'

/**
 * Toma el audio del predicador y lo entrega en ventanas listas para whisper.
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
  /** Una ventana lista para transcribir (PCM 16 bits mono a 16 kHz). */
  onVentana: (pcm: Int16Array) => void
  /** Nivel de la señal, 0..1, varias veces por segundo. Para el medidor. */
  onNivel?: (nivel: number) => void
  /** Se llama si la captura se cae sola (se desenchufó la placa, por ejemplo). */
  onError?: (e: Error) => void
}

export interface Captura {
  detener: () => Promise<void>
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

  let ventaneo: Ventaneo = crearVentaneo()
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
  const nodo = new AudioWorkletNode(contexto, 'recolector')

  nodo.port.onmessage = (e: MessageEvent<Float32Array>): void => {
    if (!vivo) return
    const pcm = floatAPcm16(e.data)
    opciones.onNivel?.(rms(pcm))

    const r = agregar(ventaneo, pcm)
    ventaneo = r.ventaneo
    for (const ventana of r.ventanas) {
      // La puerta por energía va acá y no en el main: mandar 192 KB por IPC
      // para que del otro lado se decida tirarlos es trabajo al pedo, y el
      // main ya está ocupado con whisper.
      if (hayVoz(ventana)) opciones.onVentana(ventana)
    }
  }

  fuente.connect(nodo)
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
    detener: async (): Promise<void> => {
      vivo = false
      nodo.port.onmessage = null
      // Lo que quedó a medio juntar todavía puede tener una cita adentro.
      const cola = vaciar(ventaneo)
      ventaneo = cola.ventaneo
      if (cola.ventana && hayVoz(cola.ventana)) opciones.onVentana(cola.ventana)

      nodo.disconnect()
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
