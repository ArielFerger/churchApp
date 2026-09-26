import { describe, expect, it } from 'vitest'
import { formatReference, parseReference } from '@/shared/utils/bibleParser'

describe('parseReference', () => {
  it('parsea la forma canónica', () => {
    const ref = parseReference('Juan 3:16')
    expect(ref?.book.id).toBe('JHN')
    expect(ref?.chapter).toBe(3)
    expect(ref?.verse).toBe(16)
    expect(ref?.endVerse).toBeUndefined()
  })

  it('acepta abreviaturas, con y sin punto', () => {
    expect(parseReference('Jn 3:16')?.book.id).toBe('JHN')
    expect(parseReference('Jn. 3:16')?.book.id).toBe('JHN')
  })

  it('tolera acentos y mayúsculas', () => {
    expect(parseReference('génesis 1:1')?.book.id).toBe('GEN')
    expect(parseReference('GENESIS 1:1')?.book.id).toBe('GEN')
  })

  it('"Fil" es Filipenses, no Filemón (la abreviatura de Filemón es "Flm")', () => {
    // Las dos tenían "fil" y ganaba la última cargada: "Fil 4:13" abría Filemón,
    // que tiene un solo capítulo, y la búsqueda fallaba.
    expect(parseReference('Fil 4:13')?.book.id).toBe('PHP')
    expect(parseReference('Flm 1:6')?.book.id).toBe('PHM')
  })

  it('maneja libros con número al principio', () => {
    const ref = parseReference('1 Cor 13:4-7')
    expect(ref?.book.id).toBe('1CO')
    expect(ref?.verse).toBe(4)
    expect(ref?.endVerse).toBe(7)
  })

  it('acepta el número pegado al nombre', () => {
    expect(parseReference('1Co 13:4')?.book.id).toBe('1CO')
  })

  it('un capítulo entero arranca en el versículo 1', () => {
    const ref = parseReference('Salmos 23')
    expect(ref?.chapter).toBe(23)
    expect(ref?.verse).toBe(1)
  })

  it('tolera espacios de más', () => {
    expect(parseReference('  Juan   3:16  ')?.chapter).toBe(3)
  })

  it('rechaza libros inexistentes', () => {
    expect(parseReference('Melquisedec 1:1')).toBeNull()
  })

  it('rechaza capítulos fuera de rango', () => {
    expect(parseReference('Judas 2')).toBeNull()
  })

  it('rechaza un rango invertido', () => {
    expect(parseReference('Juan 3:16-2')).toBeNull()
  })

  it('rechaza entrada vacía o basura', () => {
    expect(parseReference('')).toBeNull()
    expect(parseReference('   ')).toBeNull()
    expect(parseReference('3:16')).toBeNull()
  })
})

describe('formatReference', () => {
  it('formatea un versículo suelto', () => {
    const ref = parseReference('Jn 3:16')!
    expect(formatReference(ref)).toBe('Juan 3:16')
  })

  it('formatea un rango', () => {
    const ref = parseReference('1 Cor 13:4-7')!
    expect(formatReference(ref)).toBe('1 Corintios 13:4-7')
  })
})
