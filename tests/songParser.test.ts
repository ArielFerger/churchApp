import { describe, it, expect } from 'vitest'
import {
  decodeSongFile,
  parseChordLine,
  parseSongContent,
  normalizeImportedText,
  stripChords,
  synthesizeContent,
  titleFromFileName,
  flattenSong,
  songMatches
} from '../src/shared/utils/songParser'
import type { Song } from '../src/shared/types/song'

const song = (over: Partial<Song> = {}): Song => ({
  id: 's1',
  title: 'Canción',
  tags: [],
  language: 'es',
  createdAt: '',
  updatedAt: '',
  ...over
})

describe('parseChordLine', () => {
  it('deja el acorde pegado a la sílaba donde cae', () => {
    const line = parseChordLine('que ge[Am]nial')
    expect(line.isBlank).toBe(false)
    expect(line.words.map((w) => w.text)).toEqual(['que', 'genial'])
    expect(line.words[1].parts).toEqual([
      { chord: null, text: 'ge' },
      { chord: 'Am', text: 'nial' }
    ])
  })

  it('un acorde al principio de la palabra no parte la palabra en dos', () => {
    const line = parseChordLine('[C]Santo')
    expect(line.words).toHaveLength(1)
    expect(line.words[0].parts).toEqual([{ chord: 'C', text: 'Santo' }])
  })

  it('un acorde suelto al final de la línea no pierde el acorde', () => {
    const line = parseChordLine('final [G]')
    const chords = line.words.flatMap((w) => w.parts.map((p) => p.chord)).filter(Boolean)
    expect(chords).toEqual(['G'])
  })

  it('marca las líneas vacías', () => {
    expect(parseChordLine('   ').isBlank).toBe(true)
  })
})

describe('stripChords', () => {
  it('deja sólo lo que se va a proyectar', () => {
    expect(stripChords('que ge[Am]nial, est[A]a canción')).toBe('que genial, esta canción')
  })
})

describe('parseSongContent', () => {
  it('corta un slide nuevo en cada línea en blanco', () => {
    const slides = parseSongContent('uno\ndos\n\ntres')
    expect(slides).toHaveLength(2)
    expect(slides[0].plainLines).toEqual(['uno', 'dos'])
    expect(slides[1].plainLines).toEqual(['tres'])
  })

  it('varias líneas en blanco seguidas no generan slides vacíos', () => {
    const slides = parseSongContent('uno\n\n\n\ndos')
    expect(slides).toHaveLength(2)
  })

  it('ignora el espacio en blanco del principio y del final', () => {
    expect(parseSongContent('\n\n  \n')).toHaveLength(0)
    expect(parseSongContent('')).toHaveLength(0)
  })

  // ── etiquetas de sección ────────────────────────────────────────────────
  it('toma "# Coro" como nombre del slide y lo saca de la letra', () => {
    const [slide] = parseSongContent('# Coro\nSanto eres tú')
    expect(slide.label).toBe('Coro')
    expect(slide.plainLines).toEqual(['Santo eres tú'])
  })

  it('la etiqueta NO se proyecta aunque esté en el medio de la estrofa', () => {
    const [slide] = parseSongContent('primera\n# Puente\nsegunda')
    expect(slide.label).toBe('Puente')
    expect(slide.plainLines).toEqual(['primera', 'segunda'])
  })

  it('un slide sin etiqueta la deja en null', () => {
    const [slide] = parseSongContent('sin etiqueta')
    expect(slide.label).toBeNull()
  })

  it('una estrofa que es sólo etiqueta no cuenta como slide proyectable', () => {
    const slides = parseSongContent('# Coro\n\nSanto eres tú')
    expect(slides).toHaveLength(1)
    expect(slides[0].plainLines).toEqual(['Santo eres tú'])
    // y el índice del que sí quedó arranca en 0, sin huecos
    expect(slides[0].index).toBe(0)
  })

  it('acepta "#Coro" sin espacio y tolera un "#" pelado', () => {
    expect(parseSongContent('#Coro\nletra')[0].label).toBe('Coro')
    expect(parseSongContent('#\nletra')[0].label).toBeNull()
  })

  it('los índices son consecutivos y las claves únicas', () => {
    const slides = parseSongContent('a\n\nb\n\nc')
    expect(slides.map((s) => s.index)).toEqual([0, 1, 2])
    expect(new Set(slides.map((s) => s.key)).size).toBe(3)
  })
})

describe('importar .txt', () => {
  it('un txt cualquiera ya se parte en slides por sus líneas en blanco', () => {
    const txt = 'Primera estrofa\nsegunda linea\n\nCoro de la cancion'
    const slides = parseSongContent(normalizeImportedText(txt))
    expect(slides).toHaveLength(2)
    expect(slides[1].plainLines).toEqual(['Coro de la cancion'])
  })

  it('normaliza los saltos de línea de Windows', () => {
    expect(normalizeImportedText('uno\r\ndos\r\n\r\ntres')).toBe('uno\ndos\n\ntres')
    expect(parseSongContent(normalizeImportedText('uno\r\n\r\ndos'))).toHaveLength(2)
  })

  it('varias líneas en blanco seguidas no inventan slides de más', () => {
    const slides = parseSongContent(normalizeImportedText('uno\n\n\n\n\ndos'))
    expect(slides).toHaveLength(2)
  })

  it('saca el BOM, los espacios al final de línea y los bordes', () => {
    expect(normalizeImportedText('﻿uno   \ndos\t\n\n\n')).toBe('uno\ndos')
  })

  it('un archivo vacío o sólo espacios queda en string vacío', () => {
    expect(normalizeImportedText('   \n\n \r\n')).toBe('')
  })

  describe('titleFromFileName', () => {
    it('usa el nombre del archivo sin extensión', () => {
      expect(titleFromFileName('Sublime gracia.txt')).toBe('Sublime gracia')
    })

    it('los guiones bajos pasan a espacios', () => {
      expect(titleFromFileName('sublime_gracia.txt')).toBe('sublime gracia')
    })

    it('saca el número de pista cuando viene con separador', () => {
      expect(titleFromFileName('01 - Sublime gracia.txt')).toBe('Sublime gracia')
      expect(titleFromFileName('7. Cristo vive.txt')).toBe('Cristo vive')
    })

    it('NO saca un número que es parte del nombre', () => {
      expect(titleFromFileName('40 dias.txt')).toBe('40 dias')
      expect(titleFromFileName('10000 razones.txt')).toBe('10000 razones')
    })

    it('un nombre sin extensión también sirve', () => {
      expect(titleFromFileName('Cristo vive')).toBe('Cristo vive')
    })

    it('nunca devuelve vacío', () => {
      expect(titleFromFileName('.txt')).toBe('Sin título')
    })
  })

  describe('decodeSongFile', () => {
    const bytes = (...n: number[]) => new Uint8Array(n)

    it('lee UTF-8', () => {
      expect(decodeSongFile(new TextEncoder().encode('corazón'))).toBe('corazón')
    })

    it('cae a windows-1252 cuando el archivo no es UTF-8 válido', () => {
      // "corazón" tal como lo guarda el Bloc de notas viejo: ó = 0xF3
      expect(decodeSongFile(bytes(0x63, 0x6f, 0x72, 0x61, 0x7a, 0xf3, 0x6e))).toBe('corazón')
    })

    it('un archivo vacío no explota', () => {
      expect(decodeSongFile(bytes())).toBe('')
    })
  })
})

describe('synthesizeContent', () => {
  it('devuelve el content moderno tal cual si ya existe', () => {
    expect(synthesizeContent(song({ content: '# Coro\nletra' }))).toBe('# Coro\nletra')
  })

  it('a una canción vieja le devuelve las etiquetas de sus secciones', () => {
    const legacy = song({
      sections: [
        { id: 'v1', type: 'verse', label: 'Verso 1', slides: [{ id: 'a', lines: ['uno'] }] },
        { id: 'c', type: 'chorus', label: 'Coro', slides: [{ id: 'b', lines: ['dos'] }] }
      ],
      order: ['v1', 'c']
    })
    const content = synthesizeContent(legacy)
    expect(content).toBe('# Verso 1\nuno\n\n# Coro\ndos')
    // y ese texto vuelve a parsearse con las etiquetas puestas
    expect(parseSongContent(content).map((s) => s.label)).toEqual(['Verso 1', 'Coro'])
  })

  it('respeta el orden guardado, no el orden de definición', () => {
    const legacy = song({
      sections: [
        { id: 'v1', type: 'verse', label: 'Verso', slides: [{ id: 'a', lines: ['uno'] }] },
        { id: 'c', type: 'chorus', label: 'Coro', slides: [{ id: 'b', lines: ['dos'] }] }
      ],
      order: ['c', 'v1']
    })
    expect(parseSongContent(synthesizeContent(legacy)).map((s) => s.label)).toEqual([
      'Coro',
      'Verso'
    ])
  })

  it('una canción sin nada devuelve string vacío', () => {
    expect(synthesizeContent(song())).toBe('')
  })
})

describe('flattenSong', () => {
  it('usa la etiqueta como nombre de sección cuando la hay', () => {
    const deck = flattenSong(song({ content: '# Coro\nletra\n\notra' }))
    expect(deck.map((d) => d.sectionLabel)).toEqual(['Coro', 'Slide 2'])
    expect(deck[0].slide.lines).toEqual(['letra'])
  })
})

describe('songMatches', () => {
  it('busca en título, autor y tags, sin distinguir mayúsculas', () => {
    const s = song({ title: 'Sublime Gracia', author: 'Newton', tags: ['himno'] })
    expect(songMatches(s, 'sublime')).toBe(true)
    expect(songMatches(s, 'NEWTON')).toBe(true)
    expect(songMatches(s, 'himno')).toBe(true)
    expect(songMatches(s, 'nada')).toBe(false)
  })

  it('una búsqueda vacía deja pasar todo', () => {
    expect(songMatches(song(), '   ')).toBe(true)
  })
})
