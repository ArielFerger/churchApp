import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import log from 'electron-log'
import type { MediaCategory, MediaMeta } from '../../src/shared/types/media'
import {
  clearToday,
  emptyMeta,
  normalizeMeta,
  todayKey,
  withCategory,
  withToday
} from '../../src/shared/utils/mediaMeta'

/**
 * Persistencia de los metadatos que el operador le pone a la media:
 * la categoría de cada archivo (alabanza / adoración / proyección) y la
 * selección "para hoy". Un único JSON bajo userData, con la misma forma que
 * el renderer consume — cada mutación devuelve el objeto completo para que el
 * store lo reemplace sin lógica de merge.
 *
 * Las claves son mediaIds, que derivan de la ruta absoluta del archivo: si un
 * archivo se mueve o se renombra pierde su categoría, y queda un id huérfano
 * en el JSON. No se limpian: la UI los ignora y borrarlos automáticamente
 * arrasaría con todo al cambiar de carpeta de media en Ajustes.
 */

function metaPath(): string {
  return join(app.getPath('userData'), 'media-meta.json')
}

let cache: MediaMeta | null = null
/** Día con el que se cargó `cache`; si cambia, hay que revalidar. */
let cacheDate = ''

async function read(): Promise<MediaMeta> {
  const date = todayKey()
  if (cache && cacheDate === date) return cache

  let raw: unknown = null
  try {
    raw = JSON.parse(await fs.readFile(metaPath(), 'utf-8'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('mediaMetaService: read failed', (err as Error).message)
    }
  }

  cache = raw === null ? emptyMeta(date) : normalizeMeta(raw, date)
  cacheDate = date
  return cache
}

async function write(meta: MediaMeta): Promise<MediaMeta> {
  cache = meta
  cacheDate = meta.today.date
  try {
    await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2), 'utf-8')
  } catch (err) {
    log.error('mediaMetaService: write failed', (err as Error).message)
  }
  return meta
}

export async function getMeta(): Promise<MediaMeta> {
  return read()
}

export async function setCategory(
  mediaId: string,
  category: MediaCategory | null
): Promise<MediaMeta> {
  return write(withCategory(await read(), mediaId, category))
}

export async function setTodaySelected(mediaId: string, selected: boolean): Promise<MediaMeta> {
  return write(withToday(await read(), mediaId, selected, todayKey()))
}

export async function clearTodaySelection(): Promise<MediaMeta> {
  return write(clearToday(await read(), todayKey()))
}
