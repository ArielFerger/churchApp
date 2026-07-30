import { describe, expect, it } from 'vitest'
import {
  breadcrumbSegments,
  childFolders,
  countInFolder,
  itemsInFolder,
  normalizeText,
  parentFolder,
  searchMedia
} from '@/shared/utils/mediaFolders'
import type { MediaItem, MediaType } from '@/shared/types/media'

function item(fileName: string, folder: string, type: MediaType = 'video'): MediaItem {
  return {
    id: `${folder}/${fileName}`,
    filePath: `C:/media/${folder}/${fileName}`,
    fileName,
    type,
    folder,
    addedAt: '2026-01-01T00:00:00.000Z'
  }
}

const library: MediaItem[] = [
  item('intro.mp4', ''),
  item('logo.png', '', 'image'),
  item('cristo-vive.mp4', 'Alabanza'),
  item('sublime-gracia.mp4', 'Alabanza'),
  item('fondo-azul.mp4', 'Alabanza/Fondos'),
  item('santo.mp4', 'Adoración'),
  item('niños.mp4', 'Anuncios')
]

describe('itemsInFolder', () => {
  it('solo devuelve los items de esa carpeta exacta', () => {
    expect(itemsInFolder(library, 'Alabanza').map((m) => m.fileName)).toEqual([
      'cristo-vive.mp4',
      'sublime-gracia.mp4'
    ])
  })

  it('la raíz es la cadena vacía', () => {
    expect(itemsInFolder(library, '').map((m) => m.fileName)).toEqual(['intro.mp4', 'logo.png'])
  })

  it('devuelve vacío para una carpeta inexistente', () => {
    expect(itemsInFolder(library, 'No existe')).toEqual([])
  })
})

describe('childFolders', () => {
  it('lista las subcarpetas inmediatas de la raíz, ordenadas', () => {
    expect(childFolders(library, '')).toEqual(['Adoración', 'Alabanza', 'Anuncios'])
  })

  it('lista las subcarpetas inmediatas de una subcarpeta', () => {
    expect(childFolders(library, 'Alabanza')).toEqual(['Fondos'])
  })

  it('no confunde carpetas con prefijo parecido', () => {
    // "Alabanza" no debe capturar a "AlabanzaVieja".
    const items = [...library, item('otro.mp4', 'AlabanzaVieja')]
    expect(childFolders(items, 'Alabanza')).toEqual(['Fondos'])
  })

  it('devuelve vacío en una hoja', () => {
    expect(childFolders(library, 'Adoración')).toEqual([])
  })
})

describe('countInFolder', () => {
  it('cuenta recursivamente', () => {
    expect(countInFolder(library, 'Alabanza')).toBe(3)
  })

  it('cuenta una carpeta sin hijas', () => {
    expect(countInFolder(library, 'Adoración')).toBe(1)
  })
})

describe('breadcrumbSegments / parentFolder', () => {
  it('arma los segmentos acumulando la ruta', () => {
    expect(breadcrumbSegments('Alabanza/Fondos')).toEqual([
      { name: 'Alabanza', path: 'Alabanza' },
      { name: 'Fondos', path: 'Alabanza/Fondos' }
    ])
  })

  it('la raíz no tiene segmentos', () => {
    expect(breadcrumbSegments('')).toEqual([])
  })

  it('parentFolder sube un nivel y se queda en la raíz', () => {
    expect(parentFolder('Alabanza/Fondos')).toBe('Alabanza')
    expect(parentFolder('Alabanza')).toBe('')
    expect(parentFolder('')).toBe('')
  })
})

describe('normalizeText', () => {
  it('saca acentos y pasa a minúsculas', () => {
    expect(normalizeText('Adoración')).toBe('adoracion')
    expect(normalizeText('NIÑOS')).toBe('ninos')
  })
})

describe('searchMedia', () => {
  it('sin consulta no devuelve nada (la vista muestra la carpeta)', () => {
    expect(searchMedia(library, '')).toEqual([])
    expect(searchMedia(library, '   ')).toEqual([])
  })

  it('busca en todas las subcarpetas, no solo en la abierta', () => {
    expect(searchMedia(library, 'fondo').map((m) => m.fileName)).toEqual(['fondo-azul.mp4'])
  })

  it('encuentra sin importar acentos ni mayúsculas', () => {
    expect(searchMedia(library, 'ADORACION').map((m) => m.fileName)).toEqual(['santo.mp4'])
    expect(searchMedia(library, 'niños').map((m) => m.fileName)).toEqual(['niños.mp4'])
    expect(searchMedia(library, 'ninos').map((m) => m.fileName)).toEqual(['niños.mp4'])
  })

  it('también matchea por nombre de carpeta', () => {
    expect(searchMedia(library, 'alabanza').map((m) => m.fileName)).toEqual([
      'cristo-vive.mp4',
      'sublime-gracia.mp4',
      'fondo-azul.mp4'
    ])
  })

  it('varios términos se combinan con AND, en cualquier orden', () => {
    expect(searchMedia(library, 'alabanza azul').map((m) => m.fileName)).toEqual(['fondo-azul.mp4'])
    expect(searchMedia(library, 'azul alabanza').map((m) => m.fileName)).toEqual(['fondo-azul.mp4'])
    expect(searchMedia(library, 'alabanza santo')).toEqual([])
  })
})
