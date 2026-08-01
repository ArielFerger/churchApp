import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaMeta } from '@/shared/types/media'

/**
 * El servicio persiste en `app.getPath('userData')`. Acá lo apuntamos a una
 * carpeta temporal para ejercitar el ida y vuelta real contra el disco:
 * lectura, escritura, JSON corrupto y vencimiento de la selección diaria.
 */
const userData = mkdtempSync(join(tmpdir(), 'church-meta-'))
const metaFile = join(userData, 'media-meta.json')

vi.mock('electron', () => ({
  app: { getPath: () => userData }
}))
vi.mock('electron-log', () => ({
  default: { warn: () => {}, error: () => {}, info: () => {} }
}))

afterAll(() => {
  rmSync(userData, { recursive: true, force: true })
})

/** Reimporta el módulo con la caché limpia (el servicio cachea en memoria). */
async function freshService() {
  vi.resetModules()
  return import('@electron/services/mediaMetaService')
}

function onDisk(): MediaMeta {
  return JSON.parse(readFileSync(metaFile, 'utf-8'))
}

beforeEach(() => {
  rmSync(metaFile, { force: true })
  vi.useRealTimers()
})

describe('mediaMetaService', () => {
  it('sin archivo devuelve metadatos vacíos y no crashea', async () => {
    const svc = await freshService()
    const meta = await svc.getMeta()
    expect(meta.categories).toEqual({})
    expect(meta.today.ids).toEqual([])
  })

  it('guarda la categoría y la relee en un arranque nuevo', async () => {
    const svc = await freshService()
    await svc.setCategory('video-1', 'alabanza')
    expect(onDisk().categories).toEqual({ 'video-1': 'alabanza' })

    const reiniciado = await freshService()
    expect((await reiniciado.getMeta()).categories).toEqual({ 'video-1': 'alabanza' })
  })

  it('quitar la categoría borra la clave', async () => {
    const svc = await freshService()
    await svc.setCategory('video-1', 'adoracion')
    const meta = await svc.setCategory('video-1', null)
    expect(meta.categories).toEqual({})
    expect(onDisk().categories).toEqual({})
  })

  it('la selección de hoy conserva el orden de elección', async () => {
    const svc = await freshService()
    await svc.setTodaySelected('b', true)
    await svc.setTodaySelected('a', true)
    const meta = await svc.setTodaySelected('c', true)
    expect(meta.today.ids).toEqual(['b', 'a', 'c'])
  })

  it('desmarcar saca solo ese archivo', async () => {
    const svc = await freshService()
    await svc.setTodaySelected('a', true)
    await svc.setTodaySelected('b', true)
    const meta = await svc.setTodaySelected('a', false)
    expect(meta.today.ids).toEqual(['b'])
  })

  it('vaciar la lista de hoy no toca las categorías', async () => {
    const svc = await freshService()
    await svc.setCategory('a', 'proyeccion')
    await svc.setTodaySelected('a', true)
    const meta = await svc.clearTodaySelection()
    expect(meta.today.ids).toEqual([])
    expect(meta.categories).toEqual({ a: 'proyeccion' })
  })

  it('una selección de ayer aparece vacía al abrir hoy, pero las categorías quedan', async () => {
    writeFileSync(
      metaFile,
      JSON.stringify({
        categories: { a: 'alabanza' },
        today: { date: '2020-01-01', ids: ['a', 'b'] }
      }),
      'utf-8'
    )
    const svc = await freshService()
    const meta = await svc.getMeta()
    expect(meta.today.ids).toEqual([])
    expect(meta.categories).toEqual({ a: 'alabanza' })
  })

  it('un JSON corrupto no rompe la app: arranca vacío', async () => {
    writeFileSync(metaFile, '{ esto no es json', 'utf-8')
    const svc = await freshService()
    const meta = await svc.getMeta()
    expect(meta.categories).toEqual({})
    expect(meta.today.ids).toEqual([])
  })

  it('descarta categorías desconocidas guardadas a mano', async () => {
    writeFileSync(
      metaFile,
      JSON.stringify({ categories: { a: 'alabanza', b: 'inventada' } }),
      'utf-8'
    )
    const svc = await freshService()
    expect((await svc.getMeta()).categories).toEqual({ a: 'alabanza' })
  })

  it('al cruzar la medianoche con la app abierta, la lista de hoy se vacía sola', async () => {
    const svc = await freshService()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 30, 23, 59))
    await svc.setTodaySelected('a', true)
    expect((await svc.getMeta()).today.ids).toEqual(['a'])

    vi.setSystemTime(new Date(2026, 6, 31, 0, 1))
    const meta = await svc.getMeta()
    expect(meta.today).toEqual({ date: '2026-07-31', ids: [] })
  })
})
