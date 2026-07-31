import { describe, it, expect } from 'vitest'
import {
  buildArgs,
  formatBytes,
  formatDuration,
  formatSpeed,
  looksLikePlaylist,
  normalizeUrl,
  parseFileLine,
  parseProgressLine
} from '../src/shared/utils/downloads'

// Líneas reales capturadas de yt-dlp 2026.07.04 con nuestro --progress-template.
const REALES = [
  'CPPROG|downloading|1024|960235|NA|NA|NA',
  'CPPROG|downloading|523264|960235|NA|4740981.382066719|0',
  'CPPROG|finished|960235|960235|NA|3932742.343699193|NA'
]

describe('parseProgressLine', () => {
  it('lee una línea de progreso con todos los datos', () => {
    const r = parseProgressLine('CPPROG|downloading|500|1000|NA|250000|2')
    expect(r).toEqual({
      stage: 'downloading',
      progress: {
        ratio: 0.5,
        downloadedBytes: 500,
        totalBytes: 1000,
        speed: 250000,
        eta: 2
      }
    })
  })

  it('el primer tick, sin velocidad ni eta todavía, no rompe', () => {
    const r = parseProgressLine(REALES[0])
    expect(r?.progress.ratio).toBeCloseTo(1024 / 960235)
    expect(r?.progress.speed).toBeNull()
    expect(r?.progress.eta).toBeNull()
  })

  it('"finished" pasa a la etapa de procesado: ahí arranca ffmpeg', () => {
    const r = parseProgressLine(REALES[2])
    expect(r?.stage).toBe('processing')
    expect(r?.progress.ratio).toBe(1)
  })

  it('usa la estimación cuando no se conoce el tamaño real', () => {
    const r = parseProgressLine('CPPROG|downloading|300|NA|1200|1000|3')
    expect(r?.progress.totalBytes).toBe(1200)
    expect(r?.progress.ratio).toBe(0.25)
  })

  it('sin tamaño de ningún tipo, el avance queda en null (barra indeterminada)', () => {
    const r = parseProgressLine('CPPROG|downloading|300|NA|NA|1000|NA')
    expect(r?.progress.ratio).toBeNull()
    expect(r?.progress.downloadedBytes).toBe(300)
  })

  it('nunca pasa de 1 aunque lo descargado supere el total estimado', () => {
    const r = parseProgressLine('CPPROG|downloading|1500|NA|1000|1000|0')
    expect(r?.progress.ratio).toBe(1)
  })

  it('ignora todo lo demás que yt-dlp escriba', () => {
    expect(parseProgressLine('[download] Destination: video.mp4')).toBeNull()
    expect(parseProgressLine('[Merger] Merging formats into "video.mp4"')).toBeNull()
    expect(parseProgressLine('')).toBeNull()
    expect(parseProgressLine('ERROR: algo salió mal')).toBeNull()
  })
})

describe('parseFileLine', () => {
  it('saca la ruta final del archivo', () => {
    expect(parseFileLine('CPFILE|D:\\media\\Video de prueba.mp4')).toBe(
      'D:\\media\\Video de prueba.mp4'
    )
  })

  it('una ruta con espacios y acentos llega entera', () => {
    expect(parseFileLine('CPFILE|D:\\media\\Canción de alabanza.mp3')).toBe(
      'D:\\media\\Canción de alabanza.mp3'
    )
  })

  it('ignora las líneas que no son de archivo', () => {
    expect(parseFileLine(REALES[0])).toBeNull()
    expect(parseFileLine('CPFILE|')).toBeNull()
  })
})

describe('normalizeUrl', () => {
  it('acepta una URL completa', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc12345678')).toBe(
      'https://www.youtube.com/watch?v=abc12345678'
    )
  })

  it('le saca los espacios de los costados', () => {
    expect(normalizeUrl('  https://youtu.be/abc12345678  ')).toBe(
      'https://youtu.be/abc12345678'
    )
  })

  it('completa el https cuando falta', () => {
    expect(normalizeUrl('youtube.com/watch?v=abc12345678')).toBe(
      'https://youtube.com/watch?v=abc12345678'
    )
    expect(normalizeUrl('www.youtube.com/watch?v=x')).toBe(
      'https://www.youtube.com/watch?v=x'
    )
  })

  it('rechaza lo que no es un enlace', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
    expect(normalizeUrl('buscar esto en youtube')).toBeNull()
  })

  it('un texto suelto con forma de id no se toma como enlace', () => {
    // Un id de YouTube son 11 caracteres cualquiera del alfabeto habitual, así
    // que aceptarlos sueltos convierte cualquier palabra en una descarga que
    // falla sin explicación.
    expect(normalizeUrl('no-es-un-id')).toBeNull()
    expect(normalizeUrl('dQw4w9WgXcQ')).toBeNull()
  })
})

describe('looksLikePlaylist', () => {
  it('reconoce los enlaces de lista', () => {
    expect(looksLikePlaylist('https://www.youtube.com/watch?v=x&list=PL123')).toBe(true)
    expect(looksLikePlaylist('https://www.youtube.com/playlist?list=PL123')).toBe(true)
  })

  it('un video suelto no es una lista', () => {
    expect(looksLikePlaylist('https://www.youtube.com/watch?v=x')).toBe(false)
  })
})

describe('buildArgs', () => {
  const base = { url: 'https://x/y', destDir: 'D:/media', ffmpegDir: 'D:/tools' }

  it('siempre pide progreso: sin --progress yt-dlp calla si no hay terminal', () => {
    expect(buildArgs({ ...base, kind: 'video' })).toContain('--progress')
  })

  it('nunca se lleva la lista entera por bajar un video de una lista', () => {
    expect(buildArgs({ ...base, kind: 'video' })).toContain('--no-playlist')
  })

  it('lo incompleto queda como .part y no como un video roto en la biblioteca', () => {
    // Con --no-part, cancelar a la mitad deja el archivo cortado con su nombre
    // final y el scanner de media lo toma como un video entero.
    expect(buildArgs({ ...base, kind: 'video' })).not.toContain('--no-part')
    expect(buildArgs({ ...base, kind: 'audio' })).not.toContain('--no-part')
  })

  it('el video sale en mp4', () => {
    const args = buildArgs({ ...base, kind: 'video' })
    expect(args).toContain('--merge-output-format')
    expect(args[args.indexOf('--merge-output-format') + 1]).toBe('mp4')
    expect(args).not.toContain('--extract-audio')
  })

  it('el audio sale en mp3 a máxima calidad', () => {
    const args = buildArgs({ ...base, kind: 'audio' })
    expect(args).toContain('--extract-audio')
    expect(args[args.indexOf('--audio-format') + 1]).toBe('mp3')
    expect(args[args.indexOf('--audio-quality') + 1]).toBe('0')
    expect(args).not.toContain('--merge-output-format')
  })

  it('el archivo se nombra con el título y va a la carpeta pedida', () => {
    const args = buildArgs({ ...base, kind: 'video' })
    expect(args[args.indexOf('--output') + 1]).toBe('D:/media/%(title)s.%(ext)s')
  })

  it('no duplica la barra si la carpeta ya venía con una', () => {
    const args = buildArgs({ ...base, destDir: 'D:/media/', kind: 'video' })
    expect(args[args.indexOf('--output') + 1]).toBe('D:/media/%(title)s.%(ext)s')
  })

  it('pasa la ubicación de ffmpeg, y la omite si no se sabe', () => {
    expect(buildArgs({ ...base, kind: 'video' })).toContain('--ffmpeg-location')
    expect(buildArgs({ ...base, ffmpegDir: null, kind: 'video' })).not.toContain(
      '--ffmpeg-location'
    )
  })

  it('la URL va primera, para que no la coma un flag anterior', () => {
    expect(buildArgs({ ...base, kind: 'video' })[0]).toBe('https://x/y')
  })
})

describe('formateo', () => {
  it('bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(1610612736)).toBe('1.5 GB')
    expect(formatBytes(null)).toBe('—')
  })

  it('velocidad', () => {
    expect(formatSpeed(1024)).toBe('1.0 KB/s')
    expect(formatSpeed(null)).toBe('—')
  })

  it('duración', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(-1)).toBe('—')
  })
})
