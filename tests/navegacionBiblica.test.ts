import { describe, expect, it } from 'vitest'
import { pasajeVecino, textoReferencia } from '@/shared/utils/navegacionBiblica'

// Juan: capítulo 3 con 36 versículos, 21 capítulos en total.
const stats = { JHN: [51, 25, 36, ...Array(17).fill(40), 25] }

describe('pasajeVecino', () => {
  it('avanza de a un versículo', () => {
    expect(pasajeVecino({ bookId: 'JHN', chapter: 3, verse: 16 }, 1, stats)).toEqual({
      bookId: 'JHN',
      chapter: 3,
      verse: 17
    })
  })

  it('desde un rango, sigue después del último', () => {
    expect(pasajeVecino({ bookId: 'JHN', chapter: 3, verse: 16, endVerse: 18 }, 1, stats)?.verse).toBe(19)
    expect(pasajeVecino({ bookId: 'JHN', chapter: 3, verse: 16, endVerse: 18 }, -1, stats)?.verse).toBe(15)
  })

  it('cruza al capítulo siguiente y al anterior', () => {
    expect(pasajeVecino({ bookId: 'JHN', chapter: 3, verse: 36 }, 1, stats)).toEqual({
      bookId: 'JHN',
      chapter: 4,
      verse: 1
    })
    expect(pasajeVecino({ bookId: 'JHN', chapter: 4, verse: 1 }, -1, stats)).toEqual({
      bookId: 'JHN',
      chapter: 3,
      verse: 36
    })
  })

  it('no cruza de libro', () => {
    expect(pasajeVecino({ bookId: 'JHN', chapter: 21, verse: 25 }, 1, stats)).toBeNull()
    expect(pasajeVecino({ bookId: 'JHN', chapter: 1, verse: 1 }, -1, stats)).toBeNull()
  })

  it('sin estadísticas avanza dentro del capítulo y no retrocede de capítulo', () => {
    expect(pasajeVecino({ bookId: 'JHN', chapter: 3, verse: 16 }, 1)?.verse).toBe(17)
    expect(pasajeVecino({ bookId: 'JHN', chapter: 3, verse: 1 }, -1)).toBeNull()
  })
})

describe('textoReferencia', () => {
  it('arma las tres formas', () => {
    expect(textoReferencia('JHN', 3, 16)).toBe('Juan 3:16')
    expect(textoReferencia('JHN', 3, 16, 18)).toBe('Juan 3:16-18')
    expect(textoReferencia('PSA', 23, null)).toBe('Salmos 23')
  })
})
