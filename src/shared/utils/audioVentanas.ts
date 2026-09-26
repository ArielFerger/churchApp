/**
 * Utilidades de audio para la Escucha: el formato que whisper acepta, el nivel
 * de una señal y el WAV mínimo que se le manda.
 *
 * Antes este archivo también cortaba el audio en ventanas fijas de 6 s con un
 * umbral de voz fijo. Eso lo reemplazó `segmentadorVoz.ts`, que corta por
 * frases y aprende solo el ruido de fondo.
 *
 * Todo esto es puro y sin dependencias del navegador: entra un `Int16Array` y
 * sale otro. La parte que toca el micrófono está en `control/audio/capturaVoz.ts`.
 */

/** Lo único que whisper acepta: 16 kHz, mono, 16 bits. */
export const TASA = 16000

// ─── Nivel ───────────────────────────────────────────────────────────────────

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

// ─── Nivel para whisper ──────────────────────────────────────────────────────

/**
 * Sube el volumen de una frase hasta un nivel cómodo para el reconocedor.
 *
 * Whisper reconoce bastante peor el audio bajo: con el micrófono de una
 * notebook a un par de metros, la voz llega a -40 dBFS y había que hablarle
 * encima para que entendiera. Esto lleva la frase a `objetivoDb` de RMS, sin
 * pasar de `maxGananciaDb` (subir 40 dB un silencio sólo amplifica ruido) y
 * sin que el pico pase de `techo` (una frase que satura se entiende peor que
 * una baja). Nunca baja el volumen: una frase fuerte queda como está.
 */
export function normalizarVoz(
  pcm: Int16Array,
  objetivoDb = -20,
  maxGananciaDb = 24,
  techo = 0.9
): Int16Array {
  if (pcm.length === 0) return pcm
  let suma = 0
  let pico = 0
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768
    suma += v * v
    const a = Math.abs(v)
    if (a > pico) pico = a
  }
  const nivel = Math.sqrt(suma / pcm.length)
  if (nivel === 0 || pico === 0) return pcm
  const objetivo = Math.pow(10, objetivoDb / 20)
  const ganancia = Math.min(objetivo / nivel, Math.pow(10, maxGananciaDb / 20), techo / pico)
  if (ganancia <= 1.05) return pcm
  const out = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * ganancia)))
  }
  return out
}

/** Decibeles → factor de ganancia (0 dB = 1×, +6 dB ≈ 2×, +20 dB = 10×). */
export function dbAGanancia(db: number): number {
  return Math.pow(10, db / 20)
}
