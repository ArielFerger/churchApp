import { describe, expect, it } from 'vitest'
import { margenDb, SegmentadorVoz, type Fragmento } from '@/shared/utils/segmentadorVoz'

/**
 * El segmentador se prueba con señales armadas a mano: ruido de fondo a un
 * nivel conocido, "frases" (tono con huecos cortos entre palabras, como el
 * habla real) y pausas. Todo determinístico: el ruido sale de un generador con
 * semilla fija.
 */

const TASA = 16000
const ms = (n: number): number => Math.round((n / 1000) * TASA)

/** Generador pseudoaleatorio con semilla, para que el ruido sea repetible. */
function azar(semilla = 1): () => number {
  let x = semilla
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    return x / 0x7fffffff
  }
}

/** Ruido blanco a `db` dBFS (RMS aproximado). */
function ruido(duracionMs: number, db: number, r = azar(7)): Int16Array {
  const n = ms(duracionMs)
  const amp = Math.pow(10, db / 20) * Math.sqrt(3) // RMS de uniforme = amp/√3
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.round((r() * 2 - 1) * amp * 32767)
  return out
}

/**
 * Una frase: "palabras" de 320 ms de tono a `db` dBFS separadas por huecos de
 * 80 ms, sobre el ruido de fondo. El habla real tiene esos huecos, y el
 * seguimiento del piso de ruido depende de ellos.
 */
function frase(duracionMs: number, db = -22, fondoDb = -60): Int16Array {
  const fondo = ruido(duracionMs, fondoDb, azar(3))
  const amp = Math.pow(10, db / 20) * Math.SQRT2
  const palabra = ms(320)
  const hueco = ms(80)
  for (let i = 0; i < fondo.length; i++) {
    if (i % (palabra + hueco) < palabra) {
      fondo[i] += Math.round(Math.sin((2 * Math.PI * 220 * i) / TASA) * amp * 32767)
    }
  }
  return fondo
}

function unir(...partes: Int16Array[]): Int16Array {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const out = new Int16Array(total)
  let o = 0
  for (const p of partes) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Alimenta en trozos de 2048 muestras, como el worklet, y junta lo que sale. */
function correr(seg: SegmentadorVoz, audio: Int16Array, cerrar = true): Fragmento[] {
  const out: Fragmento[] = []
  for (let i = 0; i < audio.length; i += 2048) {
    out.push(...seg.alimentar(audio.slice(i, i + 2048)).fragmentos)
  }
  if (cerrar) {
    const f = seg.cerrar()
    if (f) out.push(f)
  }
  return out
}

describe('SegmentadorVoz', () => {
  it('corta una frase por cada pausa', () => {
    const audio = unir(
      ruido(1000, -60),
      frase(2400),
      ruido(1000, -60),
      frase(3200),
      ruido(1500, -60)
    )
    const fs = correr(new SegmentadorVoz(), audio)
    expect(fs).toHaveLength(2)
    expect(fs.every((f) => !f.forzado)).toBe(true)
    // Cada fragmento dura aprox. lo que la frase (+ pre-roll y cola), no más.
    expect(fs[0].duracionMs).toBeGreaterThan(2200)
    expect(fs[0].duracionMs).toBeLessThan(3200)
    expect(fs[1].duracionMs).toBeGreaterThan(3000)
    expect(fs[1].duracionMs).toBeLessThan(4000)
  })

  it('no corta en los huecos cortos entre palabras', () => {
    const fs = correr(new SegmentadorVoz(), unir(ruido(800, -60), frase(5000), ruido(1200, -60)))
    expect(fs).toHaveLength(1)
  })

  it('el silencio solo no produce nada', () => {
    expect(correr(new SegmentadorVoz(), ruido(10_000, -60))).toEqual([])
  })

  it('una tos o un golpe corto no vale como frase', () => {
    const golpe = frase(150)
    expect(correr(new SegmentadorVoz(), unir(ruido(1000, -60), golpe, ruido(1500, -60)))).toEqual([])
  })

  it('un soplido constante y fuerte queda como piso, no como voz', () => {
    // Una consola con ganancia alta mete un ruido de -38 dBFS todo el tiempo.
    // Con el umbral fijo de antes, eso se transcribía entero.
    expect(correr(new SegmentadorVoz(), ruido(15_000, -38))).toEqual([])
  })

  it('encuentra la voz aunque el ruido de fondo sea alto', () => {
    const audio = unir(ruido(2000, -42), frase(3000, -18, -42), ruido(1500, -42))
    const fs = correr(new SegmentadorVoz(), audio)
    expect(fs).toHaveLength(1)
  })

  it('habla de corrido: corta en una micro-pausa pasado el largo blando', () => {
    // 9 s de habla con una pausa de 300 ms a los 7,5 s: no alcanza para cerrar
    // una frase normal (650 ms), pero con el fragmento ya largo sí.
    const audio = unir(ruido(800, -60), frase(7500), ruido(300, -60), frase(1500), ruido(1500, -60))
    const fs = correr(new SegmentadorVoz(), audio)
    expect(fs).toHaveLength(2)
    expect(fs[0].forzado).toBe(false)
  })

  it('habla de corrido sin ninguna pausa: fuerza el corte y arrastra el final', () => {
    const seg = new SegmentadorVoz({ maxSegMs: 6000, blandoMs: 99_000, solapeMs: 1500 })
    const fs = correr(seg, unir(ruido(800, -60), frase(14_000), ruido(1500, -60)))
    expect(fs.length).toBeGreaterThanOrEqual(2)
    expect(fs[0].forzado).toBe(true)
    // El siguiente arranca con 1,5 s repetidos: suma más que el audio real.
    const total = fs.reduce((s, f) => s + f.duracionMs, 0)
    expect(total).toBeGreaterThan(14_000)
  })

  it('al cerrar entrega lo que estaba en curso', () => {
    const seg = new SegmentadorVoz()
    const fs = correr(seg, unir(ruido(800, -60), frase(2000)), false)
    expect(fs).toEqual([])
    expect(seg.cerrar()).not.toBeNull()
  })

  it('informa nivel y umbral para el medidor', () => {
    const seg = new SegmentadorVoz()
    correr(seg, ruido(2000, -60), false)
    const l = seg.alimentar(frase(300).slice(0, 2048))
    expect(l.nivel).toBeGreaterThan(l.umbral)
    expect(l.umbral).toBeGreaterThan(0)
  })
})

describe('SegmentadorVoz — frases y parciales', () => {
  it('numera las frases, y el corte forzado sigue en la misma', () => {
    const seg = new SegmentadorVoz({ maxSegMs: 4000, blandoMs: 99_000 })
    const fs = correr(seg, unir(ruido(800, -60), frase(6000), ruido(1000, -60), frase(2000), ruido(1200, -60)))
    expect(fs.map((f) => f.frase)).toEqual([1, 1, 2])
    expect(fs[0].forzado).toBe(true)
  })

  it('da lo que va de la frase mientras se sigue hablando', () => {
    const seg = new SegmentadorVoz()
    correr(seg, unir(ruido(800, -60), frase(1000)), false)
    expect(seg.parcial(1800)).toBeNull() // todavía muy corta
    correr(seg, frase(2000), false)
    const p = seg.parcial(1800)
    expect(p?.frase).toBe(1)
    expect((p!.pcm.length / 16000) * 1000).toBeGreaterThan(2500)
  })

  it('en silencio no hay parcial', () => {
    const seg = new SegmentadorVoz()
    correr(seg, ruido(3000, -60), false)
    expect(seg.parcial()).toBeNull()
  })
})

describe('margenDb', () => {
  it('más sensibilidad = menos margen sobre el ruido', () => {
    expect(margenDb(0)).toBe(16)
    expect(margenDb(1)).toBe(6)
    expect(margenDb(0.5)).toBe(11)
    expect(margenDb(7)).toBe(6)
  })
})
