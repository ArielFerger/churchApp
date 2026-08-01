import { describe, it, expect } from 'vitest'
import {
  buildArgs,
  buildPlaylistArgs,
  buildProbeArgs,
  explainError,
  lastMeaningfulLine,
  parsePlaylistEntries,
  hasAuthCookies,
  toNetscapeCookies,
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

  it('el audio sale en mp3', () => {
    const args = buildArgs({ ...base, kind: 'audio' })
    expect(args).toContain('--extract-audio')
    expect(args[args.indexOf('--audio-format') + 1]).toBe('mp3')
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

describe('calidad', () => {
  const base = { url: 'u', destDir: 'D:/media', ffmpegDir: null }

  it('limita la altura del video a la resolución elegida', () => {
    const f = buildArgs({ ...base, kind: 'video', quality: '720' })[
      buildArgs({ ...base, kind: 'video', quality: '720' }).indexOf('--format') + 1
    ]
    expect(f).toContain('[height<=720]')
    expect(f).not.toContain('height<=1080')
  })

  it('"máxima" no pone tope de altura', () => {
    const args = buildArgs({ ...base, kind: 'video', quality: 'best' })
    expect(args[args.indexOf('--format') + 1]).not.toContain('height<=')
  })

  it('cada formato de reserva también respeta el tope', () => {
    // Si sólo el primero tuviera el límite, un video sin mp4 caería al
    // siguiente formato y bajaría en 4K igual.
    const args = buildArgs({ ...base, kind: 'video', quality: '480' })
    const alternativas = args[args.indexOf('--format') + 1].split('/')
    // La última es el comodín 'best' a secas, a propósito: mejor bajarlo en
    // otra resolución que fallar.
    for (const alt of alternativas.slice(0, -1)) {
      expect(alt).toContain('[height<=480]')
    }
  })

  it('el bitrate del MP3 se pasa en kbps', () => {
    const args = buildArgs({ ...base, kind: 'audio', bitrate: '192' })
    expect(args[args.indexOf('--audio-quality') + 1]).toBe('192K')
  })

  it('sin opciones usa 1080p y 320 kbps', () => {
    expect(buildArgs({ ...base, kind: 'video' })).toContain(
      'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
    )
    const audio = buildArgs({ ...base, kind: 'audio' })
    expect(audio[audio.indexOf('--audio-quality') + 1]).toBe('320K')
  })

  it('el MP3 se lleva la tapa y los datos adentro', () => {
    const args = buildArgs({ ...base, kind: 'audio' })
    expect(args).toContain('--embed-thumbnail')
    expect(args).toContain('--embed-metadata')
    // Las miniaturas vienen en webp y un MP3 no las puede guardar así.
    expect(args[args.indexOf('--convert-thumbnails') + 1]).toBe('jpg')
  })
})

describe('listas de reproducción', () => {
  it('las expande sin bajar nada', () => {
    const args = buildPlaylistArgs('https://x/list')
    expect(args).toContain('--flat-playlist')
    expect(args).toContain('--dump-json')
    expect(args).toContain('--yes-playlist')
  })

  it('lee un video por línea', () => {
    const salida = [
      '{"id":"aaa","title":"Uno","url":"https://www.youtube.com/watch?v=aaa"}',
      '{"id":"bbb","title":"Dos","url":"https://www.youtube.com/watch?v=bbb"}'
    ].join('\n')
    expect(parsePlaylistEntries(salida)).toEqual([
      { url: 'https://www.youtube.com/watch?v=aaa', title: 'Uno' },
      { url: 'https://www.youtube.com/watch?v=bbb', title: 'Dos' }
    ])
  })

  it('arma la url desde el id cuando la entrada no la trae', () => {
    expect(parsePlaylistEntries('{"id":"ccc","title":"Tres"}')).toEqual([
      { url: 'https://www.youtube.com/watch?v=ccc', title: 'Tres' }
    ])
  })

  it('saltea los videos privados o borrados en vez de cortar la lista', () => {
    const salida = [
      '{"id":"aaa","title":"Uno","url":"https://www.youtube.com/watch?v=aaa"}',
      '{"title":"[Private video]"}',
      'ERROR: Video unavailable',
      '{"id":"ccc","title":"Tres","url":"https://www.youtube.com/watch?v=ccc"}'
    ].join('\n')
    expect(parsePlaylistEntries(salida).map((e) => e.title)).toEqual(['Uno', 'Tres'])
  })

  it('una línea rota no tira abajo el resto', () => {
    const salida = '{"id":"aaa","url":"https://x/a"}\n{roto\n{"id":"bbb","url":"https://x/b"}'
    expect(parsePlaylistEntries(salida)).toHaveLength(2)
  })

  it('una salida vacía no devuelve nada', () => {
    expect(parsePlaylistEntries('')).toEqual([])
  })
})

describe('argumentos de red', () => {
  const base = { url: 'u', destDir: 'D:/media', ffmpegDir: null, kind: 'video' as const }

  it('fuerza IPv4 en TODA invocacion', () => {
    // Medido en la maquina del usuario: yt-dlp usa urllib, que no hace Happy
    // Eyeballs. Con IPv6 anunciado pero sin ruta real se cuelga para siempre,
    // sin timeout ni mensaje. Con -4 responde en segundos. Es LA diferencia
    // entre "no anda" y "anda", asi que no puede faltar en ninguna llamada.
    expect(buildArgs(base)).toContain('-4')
    expect(buildPlaylistArgs('u')).toContain('-4')
    expect(buildProbeArgs('u')).toContain('-4')
  })

  it('pone timeout de socket y reintentos en todas', () => {
    for (const args of [buildArgs(base), buildPlaylistArgs('u'), buildProbeArgs('u')]) {
      expect(args).toContain('--socket-timeout')
      expect(args).toContain('--retries')
    }
  })

  it('le nombra el runtime de JavaScript con su ruta', () => {
    // yt-dlp solo habilita deno por su cuenta: con node instalado igual hay que
    // pedirselo, si no YouTube no entrega los formatos.
    const args = buildArgs({ ...base, jsRuntime: { name: 'node', path: 'D:/Node/node.exe' } })
    expect(args[args.indexOf('--js-runtimes') + 1]).toBe('node:D:/Node/node.exe')
  })

  it('sin ruta, deja que lo busque en el PATH', () => {
    const args = buildProbeArgs('u', { name: 'deno', path: null })
    expect(args[args.indexOf('--js-runtimes') + 1]).toBe('deno')
  })

  it('sin runtime disponible, no inventa el flag', () => {
    expect(buildArgs({ ...base, jsRuntime: null })).not.toContain('--js-runtimes')
  })

  it('la sesión del navegador es opcional y por defecto no va', () => {
    expect(buildArgs(base)).not.toContain('--cookies-from-browser')
    expect(buildProbeArgs('u')).not.toContain('--cookies-from-browser')
    expect(buildPlaylistArgs('u')).not.toContain('--cookies-from-browser')
  })

  it('cuando se elige un navegador, se usa en las tres llamadas', () => {
    // Si sólo la descarga llevara la sesión, la consulta previa fallaría
    // igual y el trabajo quedaría en error antes de intentar bajar nada.
    const conCookies = buildArgs({ ...base, cookiesBrowser: 'firefox' })
    expect(conCookies[conCookies.indexOf('--cookies-from-browser') + 1]).toBe('firefox')
    expect(buildProbeArgs('u', null, 'firefox')).toContain('--cookies-from-browser')
    expect(buildPlaylistArgs('u', null, 'firefox')).toContain('--cookies-from-browser')
  })
})

describe('toNetscapeCookies', () => {
  const cookie = (over = {}) => ({
    name: 'SID',
    value: 'abc123',
    domain: '.youtube.com',
    path: '/',
    secure: true,
    expirationDate: 1800000000.5,
    ...over
  })

  it('escribe la cabecera que yt-dlp espera', () => {
    expect(toNetscapeCookies([])).toMatch(/^# Netscape HTTP Cookie File/)
  })

  it('arma los siete campos separados por TAB', () => {
    const linea = toNetscapeCookies([cookie()]).trim().split('\n').pop() ?? ''
    expect(linea.split('\t')).toEqual([
      '.youtube.com',
      'TRUE',
      '/',
      'TRUE',
      '1800000000',
      'SID',
      'abc123'
    ])
  })

  it('el punto adelante del dominio marca que vale para subdominios', () => {
    const conPunto = toNetscapeCookies([cookie({ domain: '.youtube.com' })])
    const sinPunto = toNetscapeCookies([cookie({ domain: 'www.youtube.com' })])
    expect(conPunto).toContain('\tTRUE\t/')
    expect(sinPunto).toContain('\tFALSE\t/')
  })

  it('una cookie de sesión (sin vencimiento) va con 0', () => {
    const linea = toNetscapeCookies([cookie({ expirationDate: undefined })])
    expect(linea.split('\t')[4]).toBe('0')
  })

  it('el vencimiento se trunca a segundos enteros', () => {
    // Electron lo da con decimales y yt-dlp espera un entero.
    expect(toNetscapeCookies([cookie({ expirationDate: 123.99 })])).toContain('\t123\t')
  })

  it('una ruta vacía se normaliza a /', () => {
    expect(toNetscapeCookies([cookie({ path: '' })])).toContain('\t/\t')
  })

  it('sin cookies devuelve un archivo válido pero vacío', () => {
    const out = toNetscapeCookies([])
    expect(out.split('\n').filter((l) => l && !l.startsWith('#'))).toEqual([])
  })
})

describe('hasAuthCookies', () => {
  it('las cookies que deja cargar la página NO cuentan como sesión', () => {
    // Sólo abrir youtube.com deja consentimiento y datos de visitante. Si eso
    // contara, la app diría "sesión guardada" sin que nadie haya entrado.
    const soloVisita = [
      { name: 'CONSENT' },
      { name: 'VISITOR_INFO1_LIVE' },
      { name: 'YSC' },
      { name: 'PREF' },
      { name: 'SOCS' }
    ]
    expect(hasAuthCookies(soloVisita)).toBe(false)
  })

  it('reconoce una sesión iniciada de verdad', () => {
    expect(hasAuthCookies([{ name: 'YSC' }, { name: 'LOGIN_INFO' }])).toBe(true)
    expect(hasAuthCookies([{ name: '__Secure-1PSID' }])).toBe(true)
    expect(hasAuthCookies([{ name: 'SAPISID' }])).toBe(true)
  })

  it('sin cookies no hay sesión', () => {
    expect(hasAuthCookies([])).toBe(false)
  })
})

describe('prioridad de la sesión', () => {
  const base = { url: 'u', destDir: 'D:/media', ffmpegDir: null, kind: 'video' as const }

  it('el archivo de sesión le gana a leer el navegador', () => {
    // El archivo lo generó un login hecho a mano dentro de la app; leer el
    // navegador exige que esté cerrado, así que es peor opción.
    const args = buildArgs({
      ...base,
      cookiesBrowser: 'chrome',
      cookiesFile: 'D:/data/cookies.txt'
    })
    expect(args[args.indexOf('--cookies') + 1]).toBe('D:/data/cookies.txt')
    expect(args).not.toContain('--cookies-from-browser')
  })

  it('sin archivo, cae al navegador', () => {
    const args = buildArgs({ ...base, cookiesBrowser: 'chrome', cookiesFile: null })
    expect(args).toContain('--cookies-from-browser')
    expect(args).not.toContain('--cookies')
  })

  it('sin nada, no manda ninguna credencial', () => {
    const args = buildArgs(base)
    expect(args).not.toContain('--cookies')
    expect(args).not.toContain('--cookies-from-browser')
  })

  it('la sesión también va en la consulta y en la lista', () => {
    // Si sólo la descarga la llevara, la consulta previa fallaría igual y el
    // trabajo quedaría en error antes de intentar bajar nada.
    expect(buildProbeArgs('u', null, null, 'c.txt')).toContain('--cookies')
    expect(buildPlaylistArgs('u', null, null, 'c.txt')).toContain('--cookies')
  })
})

describe('explainError', () => {
  it('traduce el bloqueo por reputacion de IP', () => {
    const real = "ERROR: [youtube] YE7VzlLtp-4: Sign in to confirm you're not a bot."
    const msg = explainError(real)
    expect(msg).toMatch(/robot/i)
    expect(msg).toMatch(/otra red|IP|conexión/i)
  })

  it('reconoce el 429', () => {
    expect(explainError('ERROR: HTTP Error 429: Too Many Requests')).toMatch(/pedidos/i)
  })

  it('reconoce video privado, borrado y solo-miembros', () => {
    expect(explainError('ERROR: Private video')).toMatch(/privado/i)
    expect(explainError('ERROR: Video unavailable')).toMatch(/no está disponible/i)
    expect(explainError('ERROR: Join this channel to get access')).toMatch(/miembros/i)
  })

  it('reconoce transmisiones que no empezaron', () => {
    expect(explainError('ERROR: This live event will begin in 3 hours')).toMatch(/no empezó/i)
  })

  it('reconoce problemas de disco y permisos', () => {
    expect(explainError('OSError: No space left on device')).toMatch(/espacio/i)
    expect(explainError('PermissionError: Access is denied')).toMatch(/permisos|no deja/i)
  })

  it('devuelve null cuando no reconoce nada, para no inventar', () => {
    expect(explainError('algo rarisimo que nadie vio nunca')).toBeNull()
    expect(explainError('')).toBeNull()
  })
})

describe('lastMeaningfulLine', () => {
  it('prefiere la ultima linea de ERROR', () => {
    const s = 'WARNING: algo\nERROR: primero\nalgo mas\nERROR: el que importa'
    expect(lastMeaningfulLine(s)).toBe('el que importa')
  })

  it('si no hay ERROR usa la ultima linea util en vez de rendirse', () => {
    // Antes, un traceback de Python sin la etiqueta ERROR terminaba mostrando
    // "yt-dlp terminó con código 1", que no le sirve a nadie.
    expect(lastMeaningfulLine('Traceback...\nValueError: algo roto\n\n')).toBe(
      'ValueError: algo roto'
    )
  })

  it('con stderr vacio devuelve null', () => {
    expect(lastMeaningfulLine('   \n\n')).toBeNull()
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
