/**
 * Trocear audio en vivo para mandárselo a whisper.
 *
 * Whisper no es streaming: transcribe un archivo entero. Para escuchar en vivo
 * hay que cortar el flujo en ventanas y transcribir cada una por separado. Las
 * ventanas se **solapan** porque si no, una cita que cae justo en el corte
 * queda partida al medio ("...vamos a primera de" | "corintios trece...") y no
 * la detecta nadie. Con 1,5 s de solapamiento, cualquier frase de menos de ese
 * largo aparece entera en al menos una ventana.
 *
 * Que se repita no es problema: `fusionar()` de `escuchaBiblica.ts` deduplica.
 *
 * Todo esto es puro y sin dependencias del navegador: entra un `Int16Array` y
 * sale otro. La parte que toca el micrófono está en `control/audio/capturaVoz.ts`.
 */

/** Lo único que whisper acepta: 16 kHz, mono, 16 bits. */
export const TASA = 16000

/** Largo de cada ventana, en segundos. */
export const VENTANA_SEG = 6

/**
 * Cada cuánto se emite una ventana. La diferencia con `VENTANA_SEG` es el
 * solapamiento: 6 − 4,5 = 1,5 s.
 */
export const SALTO_SEG = 4.5

export interface Ventaneo {
  /** Muestras acumuladas que todavía no completaron una ventana. */
  pendiente: Int16Array
  largoVentana: number
  salto: number
}

export function crearVentaneo(
  ventanaSeg: number = VENTANA_SEG,
  saltoSeg: number = SALTO_SEG,
  tasa: number = TASA
): Ventaneo {
  const largoVentana = Math.round(ventanaSeg * tasa)
  const salto = Math.min(Math.round(saltoSeg * tasa), largoVentana)
  return { pendiente: new Int16Array(0), largoVentana, salto }
}

/**
 * Suma un trozo de audio y devuelve las ventanas que se completaron con él.
 *
 * Devuelve un ventaneo nuevo en vez de mutar el que recibe: así el estado se
 * puede guardar en un store y comparar, y los tests no dependen del orden.
 */
export function agregar(
  v: Ventaneo,
  chunk: Int16Array
): { ventaneo: Ventaneo; ventanas: Int16Array[] } {
  let buffer = concat(v.pendiente, chunk)
  const ventanas: Int16Array[] = []

  while (buffer.length >= v.largoVentana) {
    ventanas.push(buffer.slice(0, v.largoVentana))
    // Se avanza `salto`, no `largoVentana`: lo que queda atrás es el solape.
    buffer = buffer.slice(v.salto)
  }

  return { ventaneo: { ...v, pendiente: buffer }, ventanas }
}

/**
 * Al detener, lo que quedó sin completar una ventana. Si el pastor dijo la
 * cita en los últimos tres segundos, tirar la cola sería perderla.
 *
 * Se descarta lo muy corto: menos de un segundo no alcanza ni para una palabra
 * y whisper sobre eso inventa.
 */
export function vaciar(
  v: Ventaneo,
  minimoSeg = 1,
  tasa: number = TASA
): { ventaneo: Ventaneo; ventana: Int16Array | null } {
  const ventana = v.pendiente.length >= minimoSeg * tasa ? v.pendiente.slice() : null
  return { ventaneo: { ...v, pendiente: new Int16Array(0) }, ventana }
}

function concat(a: Int16Array, b: Int16Array): Int16Array {
  if (a.length === 0) return b.slice()
  if (b.length === 0) return a
  const out = new Int16Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

// ─── Nivel y puerta por energía ──────────────────────────────────────────────

/** Nivel de la señal, 0..1 (RMS). Es lo que muestra el medidor de la pantalla. */
export function rms(pcm: Int16Array): number {
  if (pcm.length === 0) return 0
  let suma = 0
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768
    suma += v * v
  }
  return Math.sqrt(suma / pcm.length)
}

/**
 * Por debajo de esto se considera que no hubo voz.
 *
 * Punto de partida, no un número sagrado: medido sobre voz sintetizada da
 * 0,098, sobre ruido bajo generado 0,0023 y sobre silencio digital 0. Falta
 * medirlo sobre la línea de la consola real y ajustarlo ahí.
 *
 * Queda deliberadamente cerca del piso: pasarse hacia arriba descarta una
 * ventana con voz floja y pierde una cita; pasarse hacia abajo sólo gasta un
 * segundo de CPU.
 */
export const UMBRAL_VOZ = 0.008

/**
 * Puerta por energía: ¿vale la pena mandar esta ventana a transcribir?
 *
 * No es un lujo de rendimiento. Whisper **nunca contesta vacío**: sobre
 * silencio devuelve `[MÚSICA]` y sobre ruido de fondo, `(Cantando)`. Sin esta
 * puerta, la app transcribiría silencio durante todo el sermón, ocupando la
 * CPU que necesita el video que está al aire.
 */
export function hayVoz(pcm: Int16Array, umbral: number = UMBRAL_VOZ): boolean {
  return rms(pcm) >= umbral
}

// ─── WAV ─────────────────────────────────────────────────────────────────────

/**
 * Envuelve las muestras en un WAV mínimo (cabecera de 44 bytes + datos).
 *
 * Es todo lo que whisper necesita y evita meter una dependencia para escribir
 * 44 bytes. El archivo se escribe en la carpeta temporal y se borra apenas se
 * transcribe: el audio del sermón no queda guardado en ningún lado.
 */
export function wavDesdePcm16(pcm: Int16Array, tasa: number = TASA): Uint8Array {
  const datos = pcm.length * 2
  const buffer = new ArrayBuffer(44 + datos)
  const vista = new DataView(buffer)

  const texto = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) vista.setUint8(offset + i, s.charCodeAt(i))
  }

  texto(0, 'RIFF')
  vista.setUint32(4, 36 + datos, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  vista.setUint32(16, 16, true) // largo del bloque fmt
  vista.setUint16(20, 1, true) // 1 = PCM sin comprimir
  vista.setUint16(22, 1, true) // mono
  vista.setUint32(24, tasa, true)
  vista.setUint32(28, tasa * 2, true) // bytes por segundo
  vista.setUint16(32, 2, true) // bytes por muestra
  vista.setUint16(34, 16, true) // bits por muestra
  texto(36, 'data')
  vista.setUint32(40, datos, true)

  new Int16Array(buffer, 44).set(pcm)
  return new Uint8Array(buffer)
}

/**
 * Convierte lo que entrega el AudioWorklet (float de -1 a 1) a PCM de 16 bits.
 *
 * El recorte es a propósito: una señal que se pasa de rango tiene que sonar
 * saturada, no darse vuelta al desbordar, que es lo que pasa si uno confía en
 * el truncamiento de `Int16Array`.
 */
export function floatAPcm16(muestras: Float32Array): Int16Array {
  const out = new Int16Array(muestras.length)
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}
