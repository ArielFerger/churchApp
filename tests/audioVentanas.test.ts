import { describe, expect, it } from 'vitest'
import {
  agregar,
  crearVentaneo,
  floatAPcm16,
  hayVoz,
  rms,
  TASA,
  vaciar,
  wavDesdePcm16
} from '@/shared/utils/audioVentanas'

/**
 * El troceo es la parte de la fase 3 que se puede equivocar en silencio: si el
 * solapamiento sale mal, todo "funciona" —hay transcripción, hay sugerencias—
 * y sólo se pierden las citas que caen justo en el corte, que es exactamente
 * lo que nadie va a notar hasta un domingo.
 */

/** Ventaneo chico para no manejar cientos de miles de muestras en los tests. */
const chico = (): ReturnType<typeof crearVentaneo> => crearVentaneo(6, 4.5, 100) // 600 y 450

/** Muestras numeradas, para poder ver de dónde salió cada trozo. */
function rampa(desde: number, cantidad: number): Int16Array {
  return Int16Array.from({ length: cantidad }, (_, i) => desde + i)
}

describe('ventaneo', () => {
  it('no emite nada hasta completar la primera ventana', () => {
    const { ventaneo, ventanas } = agregar(chico(), rampa(0, 599))
    expect(ventanas).toHaveLength(0)
    expect(ventaneo.pendiente).toHaveLength(599)
  })

  it('emite la ventana completa apenas se llena', () => {
    const { ventanas } = agregar(chico(), rampa(0, 600))
    expect(ventanas).toHaveLength(1)
    expect(ventanas[0]).toHaveLength(600)
    expect(ventanas[0][0]).toBe(0)
    expect(ventanas[0][599]).toBe(599)
  })

  it('solapa: la ventana siguiente empieza antes de que termine la anterior', () => {
    // Con salto 450 y ventana 600, la segunda arranca en la muestra 450 y
    // repite las últimas 150 de la primera. Ahí está el 1,5 s de solape.
    const { ventanas } = agregar(chico(), rampa(0, 1050))
    expect(ventanas).toHaveLength(2)
    expect(ventanas[1][0]).toBe(450)
    expect(ventanas[1][149]).toBe(599) // el pedazo compartido
    expect(ventanas[1][150]).toBe(600) // y sigue con lo nuevo
  })

  it('da igual cómo venga partido el audio', () => {
    // El worklet entrega trozos de tamaño arbitrario; el resultado no puede
    // depender de eso.
    let v = chico()
    const salidas: Int16Array[] = []
    let n = 0
    for (const tam of [7, 300, 1, 500, 242]) {
      const r = agregar(v, rampa(n, tam))
      v = r.ventaneo
      salidas.push(...r.ventanas)
      n += tam
    }
    const deUnaVez = agregar(chico(), rampa(0, 1050)).ventanas
    expect(salidas.map((s) => Array.from(s))).toEqual(deUnaVez.map((s) => Array.from(s)))
  })

  it('no pierde la cola al detener, salvo que sea demasiado corta', () => {
    const parcial = agregar(chico(), rampa(0, 300)).ventaneo
    // Mínimo de 1 s = 100 muestras a esta tasa de prueba.
    expect(vaciar(parcial, 1, 100).ventana).toHaveLength(300)
    expect(vaciar(agregar(chico(), rampa(0, 99)).ventaneo, 1, 100).ventana).toBeNull()
  })

  it('deja el pendiente vacío después de vaciar', () => {
    const { ventaneo } = vaciar(agregar(chico(), rampa(0, 300)).ventaneo, 1, 100)
    expect(ventaneo.pendiente).toHaveLength(0)
  })

  it('usa 6 s de ventana y 1,5 s de solape con los valores reales', () => {
    const v = crearVentaneo()
    expect(v.largoVentana).toBe(6 * TASA)
    expect(v.largoVentana - v.salto).toBe(1.5 * TASA)
  })
})

describe('puerta por energía', () => {
  it('el silencio digital no pasa', () => {
    expect(rms(new Int16Array(1000))).toBe(0)
    expect(hayVoz(new Int16Array(1000))).toBe(false)
  })

  it('una señal a media escala pasa de sobra', () => {
    const fuerte = Int16Array.from({ length: 1000 }, (_, i) => (i % 2 ? 16000 : -16000))
    expect(rms(fuerte)).toBeCloseTo(0.488, 2)
    expect(hayVoz(fuerte)).toBe(true)
  })

  it('un piso de ruido bajo no dispara la transcripción', () => {
    // ±75 sobre 32768 ≈ 0,0023, que es lo que midió el ruido de prueba de la
    // fase 2. Tiene que quedar por debajo del umbral.
    const piso = Int16Array.from({ length: 1000 }, (_, i) => (i % 2 ? 75 : -75))
    expect(hayVoz(piso)).toBe(false)
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
