import { describe, expect, it } from 'vitest'
import {
  clearToday,
  emptyMeta,
  normalizeMeta,
  todayItems,
  todayKey,
  withCategory,
  withToday
} from '@/shared/utils/mediaMeta'
import type { MediaItem, MediaMeta } from '@/shared/types/media'

const HOY = '2026-07-30'
const AYER = '2026-07-29'

function item(id: string): MediaItem {
  return {
    id,
    filePath: `C:/media/${id}.mp4`,
    fileName: `${id}.mp4`,
    type: 'video',
    folder: '',
    addedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('todayKey', () => {
  it('usa la fecha local, no UTC', () => {
    // 30/07 a las 22:00 hora local sigue siendo el 30 aunque en UTC ya sea 31.
    expect(todayKey(new Date(2026, 6, 30, 22, 0, 0))).toBe('2026-07-30')
  })

  it('rellena mes y día con cero', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('normalizeMeta', () => {
  it('devuelve metadatos vacíos ante basura', () => {
    expect(normalizeMeta(null, HOY)).toEqual(emptyMeta(HOY))
    expect(normalizeMeta('nope', HOY)).toEqual(emptyMeta(HOY))
    expect(normalizeMeta(42, HOY)).toEqual(emptyMeta(HOY))
  })

  it('descarta categorías que no existen', () => {
    const meta = normalizeMeta({ categories: { a: 'alabanza', b: 'karaoke' } }, HOY)
    expect(meta.categories).toEqual({ a: 'alabanza' })
  })

  it('mantiene la selección si es del mismo día', () => {
    const meta = normalizeMeta({ today: { date: HOY, ids: ['a', 'b'] } }, HOY)
    expect(meta.today).toEqual({ date: HOY, ids: ['a', 'b'] })
  })

  it('vacía la selección si quedó de otro día', () => {
    const meta = normalizeMeta({ today: { date: AYER, ids: ['a', 'b'] } }, HOY)
    expect(meta.today).toEqual({ date: HOY, ids: [] })
  })

  it('deduplica y filtra ids inválidos', () => {
    const meta = normalizeMeta({ today: { date: HOY, ids: ['a', 'a', '', 7, null, 'b'] } }, HOY)
    expect(meta.today.ids).toEqual(['a', 'b'])
  })

  it('no arrastra las categorías al vencer el día', () => {
    const meta = normalizeMeta(
      { categories: { a: 'adoracion' }, today: { date: AYER, ids: ['a'] } },
      HOY
    )
    expect(meta.categories).toEqual({ a: 'adoracion' })
    expect(meta.today.ids).toEqual([])
  })
})

describe('withCategory', () => {
  it('asigna una categoría sin tocar el objeto original', () => {
    const base = emptyMeta(HOY)
    const next = withCategory(base, 'a', 'proyeccion')
    expect(next.categories).toEqual({ a: 'proyeccion' })
    expect(base.categories).toEqual({})
  })

  it('reemplaza la categoría existente', () => {
    const meta = withCategory(withCategory(emptyMeta(HOY), 'a', 'alabanza'), 'a', 'adoracion')
    expect(meta.categories).toEqual({ a: 'adoracion' })
  })

  it('con null saca la categoría', () => {
    const meta = withCategory(withCategory(emptyMeta(HOY), 'a', 'alabanza'), 'a', null)
    expect(meta.categories).toEqual({})
  })
})

describe('withToday', () => {
  it('agrega al final, respetando el orden de elección', () => {
    let meta = emptyMeta(HOY)
    meta = withToday(meta, 'b', true, HOY)
    meta = withToday(meta, 'a', true, HOY)
    expect(meta.today.ids).toEqual(['b', 'a'])
  })

  it('no duplica si ya estaba marcado', () => {
    let meta = withToday(emptyMeta(HOY), 'a', true, HOY)
    meta = withToday(meta, 'a', true, HOY)
    expect(meta.today.ids).toEqual(['a'])
  })

  it('desmarcar lo saca de la lista', () => {
    let meta = withToday(withToday(emptyMeta(HOY), 'a', true, HOY), 'b', true, HOY)
    meta = withToday(meta, 'a', false, HOY)
    expect(meta.today.ids).toEqual(['b'])
  })

  it('marcar en un día nuevo descarta la lista vieja', () => {
    const viejo: MediaMeta = { categories: {}, today: { date: AYER, ids: ['a', 'b'] } }
    const meta = withToday(viejo, 'c', true, HOY)
    expect(meta.today).toEqual({ date: HOY, ids: ['c'] })
  })
})

describe('clearToday', () => {
  it('vacía la lista y sella la fecha de hoy', () => {
    const viejo: MediaMeta = { categories: { a: 'alabanza' }, today: { date: AYER, ids: ['a'] } }
    const meta = clearToday(viejo, HOY)
    expect(meta.today).toEqual({ date: HOY, ids: [] })
    expect(meta.categories).toEqual({ a: 'alabanza' })
  })
})

describe('todayItems', () => {
  const library = [item('a'), item('b'), item('c')]

  it('resuelve los ids en el orden en que se eligieron, no el de la librería', () => {
    const meta: MediaMeta = { categories: {}, today: { date: HOY, ids: ['c', 'a'] } }
    expect(todayItems(library, meta).map((m) => m.id)).toEqual(['c', 'a'])
  })

  it('ignora ids de archivos que ya no están', () => {
    const meta: MediaMeta = { categories: {}, today: { date: HOY, ids: ['a', 'borrado'] } }
    expect(todayItems(library, meta).map((m) => m.id)).toEqual(['a'])
  })

  it('sin selección devuelve vacío', () => {
    expect(todayItems(library, emptyMeta(HOY))).toEqual([])
  })
})
