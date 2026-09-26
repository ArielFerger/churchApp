import { describe, expect, it } from 'vitest'
import { floatAPcm16, normalizarVoz, rms, wavDesdePcm16 } from '@/shared/utils/audioVentanas'

describe('rms', () => {
  it('el silencio digital da cero', () => {
    expect(rms(new Int16Array(1000))).toBe(0)
    expect(rms(new Int16Array(0))).toBe(0)
  })

  it('una señal a media escala da ~0,49', () => {
    const fuerte = Int16Array.from({ length: 1000 }, (_, i) => (i % 2 ? 16000 : -16000))
    expect(rms(fuerte)).toBeCloseTo(0.488, 2)
  })
})

describe('wavDesdePcm16', () => {
  const pcm = Int16Array.from([0, 1, -1, 32767, -32768])
  const wav = wavDesdePcm16(pcm, 16000)
  const vista = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
  const txt = (o: number): string => String.fromCharCode(...wav.slice(o, o + 4))

  it('escribe una cabecera que whisper pueda leer', () => {
    expect(wav).toHaveLength(44 + pcm.length * 2)
    expect(txt(0)).toBe('RIFF')
    expect(txt(8)).toBe('WAVE')
    expect(txt(12)).toBe('fmt ')
    expect(txt(36)).toBe('data')
    expect(vista.getUint16(20, true)).toBe(1) // PCM sin comprimir
    expect(vista.getUint16(22, true)).toBe(1) // mono
    expect(vista.getUint32(24, true)).toBe(16000)
    expect(vista.getUint16(34, true)).toBe(16) // 16 bits
  })

  it('declara los dos tamaños que traen la cabecera', () => {
    // Si estos dos no coinciden con el archivo real, whisper lee de más o de
    // menos y devuelve basura sin quejarse.
    expect(vista.getUint32(4, true)).toBe(36 + pcm.length * 2)
    expect(vista.getUint32(40, true)).toBe(pcm.length * 2)
  })

  it('conserva las muestras tal cual', () => {
    expect(Array.from(new Int16Array(wav.buffer, wav.byteOffset + 44, pcm.length))).toEqual(
      Array.from(pcm)
    )
  })
})

describe('floatAPcm16', () => {
  it('convierte el rango normal', () => {
    const pcm = floatAPcm16(Float32Array.from([0, 0.5, -0.5]))
    expect(pcm[0]).toBe(0)
    expect(pcm[1]).toBe(16383)
    expect(pcm[2]).toBe(-16384)
  })

  it('recorta en vez de dar la vuelta', () => {
    // Sin el recorte, una señal saturada desborda el Int16 y un pico positivo
    // sale como uno negativo: un chasquido que whisper interpreta como voz.
    const pcm = floatAPcm16(Float32Array.from([1.5, -1.5]))
    expect(pcm[0]).toBe(32767)
    expect(pcm[1]).toBe(-32768)
  })
})

describe('normalizarVoz', () => {
  const tono = (amp: number, n = 16000): Int16Array =>
    Int16Array.from({ length: n }, (_, i) => Math.round(Math.sin(i / 5) * amp * 32767))

  it('sube una voz baja hasta un nivel cómodo para whisper', () => {
    const bajo = tono(0.01) // ~ -43 dBFS: notebook a dos metros
    const out = normalizarVoz(bajo)
    expect(rms(out)).toBeGreaterThan(rms(bajo) * 10)
    expect(rms(out)).toBeLessThan(0.15)
  })

  it('no amplifica más de lo permitido (el silencio no se vuelve ruido fuerte)', () => {
    const casiNada = tono(0.0005)
    const out = normalizarVoz(casiNada, -20, 24)
    // +24 dB = ×15,8 como máximo
    expect(rms(out) / rms(casiNada)).toBeLessThanOrEqual(15.9)
  })

  it('no satura: el pico queda por debajo del techo', () => {
    const conPico = tono(0.05)
    conPico[100] = 20000 // un golpe fuerte en medio de voz baja (0,61 de escala)
    const out = normalizarVoz(conPico)
    const pico = Math.max(...Array.from(out, Math.abs)) / 32768
    expect(pico).toBeGreaterThan(0.61) // sí subió
    expect(pico).toBeLessThanOrEqual(0.901) // pero no pasó del techo
  })

  it('nunca baja el volumen de una frase fuerte', () => {
    const fuerte = tono(0.5)
    expect(normalizarVoz(fuerte)).toBe(fuerte)
  })
})
