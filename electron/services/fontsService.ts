import { app } from 'electron'
import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import { basename, extname, join } from 'path'
import log from 'electron-log'
import type { BibleFont } from '../../src/shared/types/fonts'

/**
 * Fuentes subidas por el usuario (archivos descargados de Google Fonts).
 * Viven en userData/bible-fonts y se sirven vía el protocolo appfont://.
 */

const FONT_EXT = new Set(['.ttf', '.otf', '.woff', '.woff2'])

function fontsDir(): string {
  return join(app.getPath('userData'), 'bible-fonts')
}

function fontIdFor(fileName: string): string {
  return createHash('sha1').update(fileName.toLowerCase()).digest('hex').slice(0, 16)
}

/** "Lora-Bold.ttf" → "Lora Bold" (nombre de familia CSS legible). */
function familyFromFileName(fileName: string): string {
  return basename(fileName, extname(fileName)).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(fontsDir(), { recursive: true })
}

export async function listFonts(): Promise<BibleFont[]> {
  await ensureDir()
  let files: string[] = []
  try {
    files = await fs.readdir(fontsDir())
  } catch (err) {
    log.warn('fontsService: readdir failed', (err as Error).message)
    return []
  }
  return files
    .filter((f) => FONT_EXT.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map((fileName) => ({
      id: fontIdFor(fileName),
      family: familyFromFileName(fileName),
      fileName,
      filePath: join(fontsDir(), fileName)
    }))
}

export async function getFontById(id: string): Promise<BibleFont | null> {
  const fonts = await listFonts()
  return fonts.find((f) => f.id === id) ?? null
}

/** Copia los archivos elegidos a la carpeta de fuentes. Devuelve la lista actualizada. */
export async function addFonts(filePaths: string[]): Promise<BibleFont[]> {
  await ensureDir()
  for (const src of filePaths) {
    const ext = extname(src).toLowerCase()
    if (!FONT_EXT.has(ext)) continue
    try {
      await fs.copyFile(src, join(fontsDir(), basename(src)))
    } catch (err) {
      log.error('fontsService: copy failed', src, (err as Error).message)
    }
  }
  return listFonts()
}

/** Borra una fuente subida. Devuelve la lista actualizada. */
export async function deleteFont(id: string): Promise<BibleFont[]> {
  const font = await getFontById(id)
  if (font) {
    try {
      await fs.unlink(font.filePath)
    } catch (err) {
      log.warn('fontsService: delete failed', (err as Error).message)
    }
  }
  return listFonts()
}
