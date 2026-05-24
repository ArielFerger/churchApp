import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import log from 'electron-log'

/**
 * Lightweight persistence for the audio player session.
 * Stored as a single JSON file under userData so the renderer can resume
 * exactly where the operator left off on next launch.
 */
export interface AudioPersistedState {
  lastTrackId: string | null
  position: number
  volume: number
}

const DEFAULTS: AudioPersistedState = {
  lastTrackId: null,
  position: 0,
  volume: 0.8
}

function statePath(): string {
  return join(app.getPath('userData'), 'audio-state.json')
}

export async function getAudioState(): Promise<AudioPersistedState> {
  try {
    const raw = await fs.readFile(statePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AudioPersistedState>
    return { ...DEFAULTS, ...parsed }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('audioStateService: read failed', (err as Error).message)
    }
    return { ...DEFAULTS }
  }
}

export async function setAudioState(partial: Partial<AudioPersistedState>): Promise<AudioPersistedState> {
  const current = await getAudioState()
  const next = { ...current, ...partial }
  try {
    await fs.writeFile(statePath(), JSON.stringify(next, null, 2), 'utf-8')
  } catch (err) {
    log.warn('audioStateService: write failed', (err as Error).message)
  }
  return next
}
