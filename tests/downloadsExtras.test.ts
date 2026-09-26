import { describe, expect, it } from 'vitest'
import {
  buildArgs,
  DENO_ASSETS,
  diasDeAntiguedad,
  extraerUrls,
  FFMPEG_ASSETS,
  parseTiempo,
  sufijoSeccion,
  YTDLP_ASSETS
} from '@/shared/utils/downloads'

/**
 * Lo que se sumó a las descargas: varias URLs pegadas de una, bajar sólo un
 * tramo, avisar cuando yt-dlp está viejo, y los binarios por plataforma.
 */

const base = { url: 'https://x/y', destDir: 'D:/media', ffmpegDir: 'D:/tools', kind: 'video' as const }

describe('extraerUrls', () => {
  it('saca varios enlaces pegados juntos, uno por línea o separados por espacios', () => {
    const texto = `https://youtu.be/aaa
      https://www.youtube.com/watch?v=bbb  youtube.com/watch?v=ccc`
    expect(extraerUrls(texto)).toEqual([
      'https://youtu.be/aaa',
      'https://www.youtube.com/watch?v=bbb',
      'https://youtube.com/watch?v=ccc'
    ])
  })

  it('no repite y tolera los signos que trae un chat alrededor', () => {
    expect(extraerUrls('(https://youtu.be/aaa), https://youtu.be/aaa.')).toEqual(['https://youtu.be/aaa'])
  })

  it('ignora el texto que no es enlace', () => {
    expect(extraerUrls('miren este video: https://youtu.be/aaa gracias!')).toEqual([
      'https://youtu.be/aaa'
    ])
    expect(extraerUrls('')).toEqual([])
  })
})

describe('parseTiempo', () => {
  it('entiende segundos, m:ss y h:mm:ss', () => {
    expect(parseTiempo('45')).toBe(45)
    expect(parseTiempo('1:30')).toBe(90)
    expect(parseTiempo('1:02:03')).toBe(3723)
    expect(parseTiempo(' 12:05 ')).toBe(725)
  })

  it('rechaza lo que no es un tiempo', () => {
    expect(parseTiempo('')).toBeNull()
    expect(parseTiempo('1:75')).toBeNull()
    expect(parseTiempo('uno')).toBeNull()
    expect(parseTiempo('1:2:3:4')).toBeNull()
  })
})

describe('buildArgs — tramo', () => {
  it('pide sólo el tramo y corta en el segundo exacto', () => {
    const args = buildArgs({ ...base, seccion: { desde: 90, hasta: 245 } })
    expect(args[args.indexOf('--download-sections') + 1]).toBe('*90-245')
    expect(args).toContain('--force-keyframes-at-cuts')
  })

  it('el archivo del tramo no pisa al video entero: lleva el tramo en el nombre', () => {
    const args = buildArgs({ ...base, seccion: { desde: 90, hasta: 245 } })
    const salida = args[args.indexOf('--output') + 1]
    expect(salida).toBe('D:/media/%(title)s [1m30-4m05].%(ext)s')
  })

  it('el sufijo no lleva ":" (Windows) ni "." (yt-dlp lo toma como extensión)', () => {
    const sufijo = sufijoSeccion({ desde: 2, hasta: 3723 })
    expect(sufijo).toBe(' [0m02-1h02m03]')
    expect(sufijo).not.toMatch(/[:.]/)
  })

  it('un tramo inválido se ignora: mejor el video entero que un error', () => {
    expect(buildArgs({ ...base, seccion: { desde: 50, hasta: 10 } })).not.toContain('--download-sections')
    expect(buildArgs({ ...base, seccion: null })).not.toContain('--download-sections')
  })
})

describe('buildArgs — robustez', () => {
  const args = buildArgs(base)

  it('baja los fragmentos de a cuatro', () => {
    expect(args[args.indexOf('--concurrent-fragments') + 1]).toBe('4')
  })

  it('nombres cortos y válidos en Windows aunque se baje desde Linux', () => {
    // yt-dlp recorta la ruta ENTERA a este largo, no sólo el nombre: con 150
    // y una carpeta profunda, el título quedaba mutilado.
    expect(args[args.indexOf('--trim-filenames') + 1]).toBe('230')
    expect(args).toContain('--windows-filenames')
  })
})

describe('diasDeAntiguedad', () => {
  const hoy = new Date(Date.UTC(2026, 8, 26))

  it('cuenta los días desde la versión', () => {
    expect(diasDeAntiguedad('2026.08.19', hoy)).toBe(38)
    expect(diasDeAntiguedad('2026.09.26', hoy)).toBe(0)
  })

  it('acepta las versiones nocturnas con sufijo', () => {
    expect(diasDeAntiguedad('2026.07.04.232810', hoy)).toBe(84)
  })

  it('sin versión legible no inventa', () => {
    expect(diasDeAntiguedad(null, hoy)).toBeNull()
    expect(diasDeAntiguedad('desconocida', hoy)).toBeNull()
  })
})

describe('binarios por plataforma', () => {
  it('Linux usa el yt-dlp autónomo, no el que necesita Python', () => {
    expect(YTDLP_ASSETS['linux-x64']).toBe('yt-dlp_linux')
    expect(YTDLP_ASSETS['linux-arm64']).toBe('yt-dlp_linux_aarch64')
  })

  it('hay ffmpeg y deno para Windows y Linux, en x64 y arm64', () => {
    for (const p of ['win32-x64', 'win32-arm64', 'linux-x64', 'linux-arm64']) {
      expect(FFMPEG_ASSETS[p]).toBeTruthy()
      expect(DENO_ASSETS[p]).toBeTruthy()
    }
    expect(FFMPEG_ASSETS['linux-x64']).toMatch(/\.tar\.xz$/)
  })
})
