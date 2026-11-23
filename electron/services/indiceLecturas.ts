import type { BibleBook } from '../../src/shared/types/bible'
import { tokenizar, type ReferenciaDetectada } from '../../src/shared/utils/escuchaBiblica'

const MIN_PALABRAS = 7

/** La palabra menos frecuente limita los versículos a comparar en cada frase. */
export class IndiceLecturas {
  private versos: { bookId: string; chapter: number; verse: number; texto: string }[] = []
  private porPalabra = new Map<string, number[]>()

  agregarLibro(libro: BibleBook): void {
    for (const cap of libro.chapters) {
      for (const v of cap.verses) {
        const palabras =
          v.text
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .match(/[a-z0-9]+/g) ?? []
        const id = this.versos.length
        this.versos.push({
          bookId: libro.id,
          chapter: cap.number,
          verse: v.number,
          texto: ' ' + palabras.join(' ') + ' '
        })
        for (const p of new Set(palabras)) {
          if (p.length < 4) continue
          const lista = this.porPalabra.get(p)
          if (lista) lista.push(id)
          else this.porPalabra.set(p, [id])
        }
      }
    }
  }

  buscar(texto: string, anterior = ''): ReferenciaDetectada[] {
    // Con sólo seis tokens previos, toda coincidencia de siete incluye voz nueva.
    const previos = tokenizar(anterior).slice(-(MIN_PALABRAS - 1))
    const cola = previos.length ? anterior.slice(previos[0].inicio) + ' ' : ''
    const unido = cola + texto
    const tokens = tokenizar(unido)
    const encontradas = new Map<number, ReferenciaDetectada>()
    for (let i = 0; i + MIN_PALABRAS <= tokens.length; i++) {
      const grupo = tokens.slice(i, i + MIN_PALABRAS)
      let candidatos: number[] | undefined
      for (const { norm } of grupo) {
        if (norm.length < 4) continue
        const lista = this.porPalabra.get(norm) ?? []
        if (!candidatos || lista.length < candidatos.length) candidatos = lista
      }
      if (!candidatos?.length) continue
      const frase = ' ' + grupo.map((p) => p.norm).join(' ') + ' '
      let unico: number | undefined
      for (const id of candidatos) {
        if (!this.versos[id].texto.includes(frase)) continue
        if (unico !== undefined) {
          unico = undefined
          break
        }
        unico = id
      }
      if (unico === undefined || encontradas.has(unico)) continue
      const { bookId, chapter, verse } = this.versos[unico]
      const inicio = grupo[0].inicio
      const fin = grupo[grupo.length - 1].fin
      encontradas.set(unico, {
        bookId,
        chapter,
        verse,
        confianza: 0.85,
        porTexto: true,
        fragmento: unido.slice(inicio, fin),
        offset: i - previos.length,
        span: [Math.max(0, inicio - cola.length), fin - cola.length]
      })
    }
    return [...encontradas.values()]
  }
}
