import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log'
import type { AudioPlaylist } from '../../src/shared/types/audio'

/**
 * Persistencia de playlists de música: un único JSON bajo userData.
 * Cada mutación devuelve la lista completa actualizada para que el renderer
 * reemplace su estado sin lógica de merge.
 */

function playlistsPath(): string {
  return join(app.getPath('userData'), 'audio-playlists.json')
}

async function readAll(): Promise<AudioPlaylist[]> {
  try {
    const raw = await fs.readFile(playlistsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as AudioPlaylist[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.trackIds)
    )
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('audioPlaylistsService: read failed', (err as Error).message)
    }
    return []
  }
}

async function writeAll(playlists: AudioPlaylist[]): Promise<void> {
  try {
    await fs.writeFile(playlistsPath(), JSON.stringify(playlists, null, 2), 'utf-8')
  } catch (err) {
    log.error('audioPlaylistsService: write failed', (err as Error).message)
  }
}

export async function getPlaylists(): Promise<AudioPlaylist[]> {
  return readAll()
}

export interface SavePlaylistInput {
  id?: string
  name: string
  trackIds?: string[]
}

/** Crea (sin id) o actualiza (con id) una playlist. Devuelve la lista completa. */
export async function savePlaylist(input: SavePlaylistInput): Promise<AudioPlaylist[]> {
  const playlists = await readAll()
  const now = new Date().toISOString()
  const name = input.name.trim()

  if (input.id) {
    const existing = playlists.find((p) => p.id === input.id)
    if (existing) {
      existing.name = name || existing.name
      if (input.trackIds) existing.trackIds = input.trackIds
      existing.updatedAt = now
    }
  } else {
    playlists.push({
      id: randomUUID(),
      name: name || 'Playlist sin nombre',
      trackIds: input.trackIds ?? [],
      createdAt: now,
      updatedAt: now
    })
  }

  await writeAll(playlists)
  return playlists
}

/** Elimina una playlist. Devuelve la lista completa actualizada. */
export async function deletePlaylist(id: string): Promise<AudioPlaylist[]> {
  const playlists = (await readAll()).filter((p) => p.id !== id)
  await writeAll(playlists)
  return playlists
}
