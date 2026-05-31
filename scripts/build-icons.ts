/**
 * Generates platform icons from resources/icons/icon.svg:
 *   - icon.png  (1024×1024) — electron-builder uses this as the source for
 *     both the Windows .ico and the macOS .icns; Linux uses it directly.
 *   - icon.ico  (multi-size: 16/24/32/48/64/128/256) — bundled in the NSIS
 *     installer so the executable has a proper icon on Windows.
 *   - tray.png  (32×32) — for a future system-tray entry.
 */

import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { readFile, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(here, '..', 'resources', 'icons')
const svgPath = resolve(iconsDir, 'icon.svg')

async function renderPng(svg: Buffer, width: number): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent'
  })
  return resvg.render().asPng()
}

async function main(): Promise<void> {
  const svg = await readFile(svgPath)

  // 1024×1024 master PNG
  const main1024 = await renderPng(svg, 1024)
  await writeFile(resolve(iconsDir, 'icon.png'), main1024)
  console.log(`✓ icon.png (1024×1024, ${main1024.length} bytes)`)

  // 32×32 tray
  const tray = await renderPng(svg, 32)
  await writeFile(resolve(iconsDir, 'tray.png'), tray)
  console.log(`✓ tray.png (32×32, ${tray.length} bytes)`)

  // Multi-size ICO
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const buffers = await Promise.all(sizes.map((size) => renderPng(svg, size)))
  const ico = await pngToIco(buffers)
  await writeFile(resolve(iconsDir, 'icon.ico'), ico)
  console.log(`✓ icon.ico (${sizes.join('/')}, ${ico.length} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
