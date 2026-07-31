/**
 * Lógica pura de las descargas de YouTube. Vive acá y no en el servicio de
 * Electron para poder testear el parseo de la salida de yt-dlp sin levantar
 * un proceso ni tocar la red.
 */

/** Qué se quiere bajar: el video, o sólo el audio pasado a MP3. */
export type DownloadKind = 'video' | 'audio'

/**
 * Altura máxima del video. Proyectar a 4K no aporta nada —el proyector rara vez
 * pasa de 1080p— y multiplica por diez lo que ocupa y lo que tarda.
 */
export type VideoQuality = 'best' | '1080' | '720' | '480'

/** Bitrate del MP3. */
export type AudioBitrate = '320' | '192' | '128'

export const VIDEO_QUALITIES: { id: VideoQuality; label: string; hint: string }[] = [
  { id: '1080', label: '1080p', hint: 'Full HD — lo que usa casi cualquier proyector' },
  { id: '720', label: '720p', hint: 'HD, archivos más livianos' },
  { id: '480', label: '480p', hint: 'Para pantallas chicas o conexiones lentas' },
  { id: 'best', label: 'Máxima', hint: 'Lo mejor que haya, aunque sea 4K' }
]

export const AUDIO_BITRATES: { id: AudioBitrate; label: string }[] = [
  { id: '320', label: '320 kbps' },
  { id: '192', label: '192 kbps' },
  { id: '128', label: '128 kbps' }
]

export type DownloadStage =
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'done'
  | 'error'
  | 'canceled'

export interface DownloadProgress {
  /** 0..1, o null cuando todavía no se sabe el tamaño total. */
  ratio: number | null
  downloadedBytes: number
  totalBytes: number | null
  /** Bytes por segundo. */
  speed: number | null
  /** Segundos restantes. */
  eta: number | null
}

export interface DownloadOptions {
  kind: DownloadKind
  quality: VideoQuality
  bitrate: AudioBitrate
}

export const DEFAULT_OPTIONS: DownloadOptions = {
  kind: 'video',
  quality: '1080',
  bitrate: '320'
}

export interface DownloadJob {
  id: string
  url: string
  kind: DownloadKind
  quality: VideoQuality
  bitrate: AudioBitrate
  stage: DownloadStage
  /** Título resuelto por yt-dlp; hasta que responde se muestra la URL. */
  title: string | null
  uploader: string | null
  durationSec: number | null
  thumbnail: string | null
  progress: DownloadProgress | null
  /** Ruta final del archivo, una vez que terminó. */
  filePath: string | null
  error: string | null
  createdAt: number
}

/**
 * Prefijos con los que se marcan las líneas de yt-dlp. El programa mezcla en
 * stdout el progreso, los mensajes normales y lo que pide `--print`, así que
 * cada cosa que nos importa se pide con una etiqueta propia y el resto se
 * ignora.
 */
export const PROGRESS_PREFIX = 'CPPROG'
export const FILE_PREFIX = 'CPFILE'

/** El template que se le pasa a `--progress-template`. */
export const PROGRESS_TEMPLATE =
  `${PROGRESS_PREFIX}|%(progress.status)s|%(progress.downloaded_bytes)s` +
  `|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s` +
  `|%(progress.speed)s|%(progress.eta)s`

/** El template de `--print` para saber dónde quedó el archivo. */
export const FILE_TEMPLATE = `after_move:${FILE_PREFIX}|%(filepath)s`

/** yt-dlp escribe "NA" (y a veces "None") cuando un valor todavía no existe. */
function num(raw: string | undefined): number | null {
  if (!raw || raw === 'NA' || raw === 'None' || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Interpreta una línea de progreso. Devuelve `null` si la línea es cualquier
 * otra cosa que yt-dlp haya escrito, que es la mayoría.
 */
export function parseProgressLine(
  line: string
): { stage: DownloadStage; progress: DownloadProgress } | null {
  if (!line.startsWith(PROGRESS_PREFIX + '|')) return null
  const [, status, downloaded, total, estimate, speed, eta] = line.trim().split('|')

  const downloadedBytes = num(downloaded) ?? 0
  // `total_bytes` sólo aparece cuando el servidor lo informa; si no, yt-dlp
  // estima. Se prefiere el real y se cae a la estimación.
  const totalBytes = num(total) ?? num(estimate)

  return {
    stage: status === 'finished' ? 'processing' : 'downloading',
    progress: {
      ratio:
        totalBytes && totalBytes > 0
          ? Math.min(1, downloadedBytes / totalBytes)
          : null,
      downloadedBytes,
      totalBytes,
      speed: num(speed),
      eta: num(eta)
    }
  }
}

/** Ruta final del archivo, si la línea la trae. */
export function parseFileLine(line: string): string | null {
  if (!line.startsWith(FILE_PREFIX + '|')) return null
  const path = line.slice(FILE_PREFIX.length + 1).trim()
  return path || null
}

/**
 * Normaliza lo que el usuario pega: acepta la URL con espacios de más y le
 * pone el https cuando falta.
 *
 * A propósito NO se acepta un id de video pelado: un id de YouTube es
 * cualquier cadena de 11 caracteres del alfabeto habitual, así que
 * "no-es-un-id" pasaría el filtro y el usuario recibiría un error de descarga
 * incomprensible en vez de "eso no es un enlace".
 */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\/\S+$/i.test(t)) return t
  if (/^(www\.|m\.)?(youtube\.com|youtu\.be)\/\S+$/i.test(t)) return `https://${t}`
  return null
}

/** Si la URL apunta a una lista y no a un video suelto. */
export function looksLikePlaylist(url: string): boolean {
  return /[?&]list=/.test(url) || /\/playlist\?/.test(url)
}

// ─── Formateo para la UI ─────────────────────────────────────────────────────

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function formatSpeed(bytesPerSec: number | null): string {
  if (bytesPerSec === null) return '—'
  return `${formatBytes(bytesPerSec)}/s`
}

/** Segundos → `m:ss` (o `h:mm:ss` si pasa de la hora). */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/**
 * Los argumentos con los que se invoca yt-dlp. Se arma acá, como función pura,
 * para poder fijarlos en un test: un cambio de flags silencioso es la clase de
 * cosa que se descubre en vivo un domingo.
 */
export function buildArgs(opts: {
  url: string
  kind: DownloadKind
  destDir: string
  ffmpegDir: string | null
  quality?: VideoQuality
  bitrate?: AudioBitrate
}): string[] {
  const args = [
    opts.url,
    '--no-playlist',
    '--newline',
    '--no-mtime',
    // NO se usa `--no-part`: con esa opción yt-dlp escribe directo sobre el
    // nombre final, así que cancelar a la mitad deja un video cortado dentro de
    // la carpeta de media y el scanner lo levanta como si estuviera entero.
    // Con el `.part` de siempre, lo incompleto tiene una extensión que la app
    // ignora y no ensucia la biblioteca.
    //
    // Sin `--progress` yt-dlp calla el avance cuando su salida no es una
    // terminal, que es exactamente nuestro caso al lanzarlo desde Electron.
    '--progress',
    '--progress-template',
    PROGRESS_TEMPLATE,
    '--print',
    FILE_TEMPLATE,
    '--output',
    `${opts.destDir.replace(/[\\/]+$/, '')}/%(title)s.%(ext)s`
  ]

  if (opts.ffmpegDir) args.push('--ffmpeg-location', opts.ffmpegDir)

  // Los valores por defecto son los mismos que DEFAULT_OPTIONS: omitir la
  // calidad no puede terminar bajando un 4K de tres gigas por descuido.
  const quality = opts.quality ?? DEFAULT_OPTIONS.quality
  const bitrate = opts.bitrate ?? DEFAULT_OPTIONS.bitrate

  if (opts.kind === 'audio') {
    args.push(
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      `${bitrate}K`,
      // Portada y datos dentro del MP3: la sección Audio ya lee esas etiquetas,
      // así que el tema entra a la biblioteca con su tapa y su título en vez de
      // aparecer como un archivo pelado.
      '--embed-thumbnail',
      '--embed-metadata',
      // Las miniaturas de YouTube vienen en webp y un MP3 no las puede guardar.
      '--convert-thumbnails',
      'jpg'
    )
  } else {
    // Preferir mp4/m4a: es lo que el <video> de la proyección reproduce sin
    // sorpresas. Si no hay, que baje lo mejor que encuentre y lo convierta.
    const cap = quality === 'best' ? '' : `[height<=${quality}]`
    args.push(
      '--format',
      `bestvideo${cap}[ext=mp4]+bestaudio[ext=m4a]/best${cap}[ext=mp4]/bestvideo${cap}+bestaudio/best${cap}/best`,
      '--merge-output-format',
      'mp4',
      // Los capítulos del video quedan como marcadores dentro del mp4.
      '--embed-chapters',
      '--embed-metadata'
    )
  }

  return args
}

/**
 * Argumentos para expandir una lista de reproducción sin bajar nada: devuelve
 * un JSON por video. `--flat-playlist` evita resolver cada video por separado,
 * que en una lista larga es la diferencia entre un segundo y varios minutos.
 */
export function buildPlaylistArgs(url: string): string[] {
  return [
    url,
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
    '--ignore-errors',
    '--yes-playlist'
  ]
}

/**
 * Lee la salida de `buildPlaylistArgs`: un objeto JSON por línea. Los videos
 * privados o borrados aparecen sin url y se descartan.
 */
export function parsePlaylistEntries(
  stdout: string
): { url: string; title: string | null }[] {
  const out: { url: string; title: string | null }[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      const j = JSON.parse(t)
      const url =
        typeof j.url === 'string' && /^https?:/.test(j.url)
          ? j.url
          : typeof j.id === 'string'
            ? `https://www.youtube.com/watch?v=${j.id}`
            : null
      if (!url) continue
      out.push({ url, title: typeof j.title === 'string' ? j.title : null })
    } catch {
      /* línea que no era JSON */
    }
  }
  return out
}
