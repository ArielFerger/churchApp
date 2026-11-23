import { describe, expect, it } from 'vitest'
import { IndiceLecturas } from '@electron/services/indiceLecturas'

const comun = 'y todos los que habían oído esto se maravillaron'
const versos = [
  'E iban todos para ser empadronados, cada uno a su ciudad.',
  'Y José subió de Galilea, de la ciudad de Nazaret, a Judea.',
  comun,
  comun
]
const indice = new IndiceLecturas()
indice.agregarLibro({
  id: 'LUK',
  name: 'Lucas',
  chapters: [{ number: 2, verses: versos.map((text, i) => ({ number: i + 3, text })) }]
})

describe('reconocimiento por lectura', () => {
  it('recupera dos versículos en orden aun con un error fuera del fragmento coincidente', () => {
    const texto =
      'Ahí van todos para ser empadronados cada uno a su ciudad. Y José subió de Galilea de la Ciudad de Nazaret.'
    const refs = indice.buscar(texto)
    expect(refs.map((r) => r.verse)).toEqual([3, 4])
    for (const r of refs) expect(texto.slice(...r.span!)).toBe(r.fragmento)
  })
  it('une una lectura partida por una pausa y exige palabras del fragmento nuevo', () => {
    const anterior = 'iban todos para ser empadronados'
    expect(indice.buscar('cada uno a su ciudad', anterior)[0]).toMatchObject({ verse: 3 })
    expect(indice.buscar('buenos días', versos[0])).toEqual([])
  })
  it('descarta paralelos idénticos, frases cortas y comentarios', () => {
    for (const frase of [
      comun,
      'cada uno a su ciudad',
      'necesitamos creer y confiar en la palabra del Señor'
    ]) {
      expect(indice.buscar(frase)).toEqual([])
    }
  })
})
