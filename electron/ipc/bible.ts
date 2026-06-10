import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../src/shared/constants'
import {
  bibleService,
  type VerseLookupRequest,
  type VerseLookupResult,
  type VersionSummary
} from '../services/bibleService'
import type { BibleBook } from '../../src/shared/types/bible'

export function registerBibleHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_BIBLE_VERSIONS, async (): Promise<VersionSummary[]> => {
    return bibleService.getVersions()
  })

  ipcMain.handle(IPC_CHANNELS.GET_BIBLE_BOOKS, async (_e, version: string): Promise<BibleBook[]> => {
    return bibleService.getBooks(version)
  })

  ipcMain.handle(
    IPC_CHANNELS.GET_BIBLE_BOOK_STATS,
    async (_e, version: string): Promise<Record<string, number[]>> => {
      return bibleService.getBookStats(version)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SEARCH_VERSE,
    async (_e, req: VerseLookupRequest): Promise<VerseLookupResult | null> => {
      return bibleService.lookup(req)
    }
  )
}
