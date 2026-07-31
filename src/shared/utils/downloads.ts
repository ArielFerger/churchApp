/**
 * Lógica pura de las descargas de YouTube. Vive acá y no en el servicio de
 * Electron para poder testear el parseo de la salida de yt-dlp sin levantar
 * un proceso ni tocar la red.
 */

/** Qué se quiere bajar: el video, o sólo el audio pasado a MP3. */
export type DownloadKind = 'video' | 'audio'

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

export interface DownloadJob {
  id: string
  url: string
  kind: DownloadKind
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

  if (opts.kind === 'audio') {
    args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0')
  } else {
    // Preferir mp4/m4a: es lo que el <video> de la proyección reproduce sin
    // sorpresas. Si no hay, que baje lo mejor que encuentre y lo convierta.
    args.push(
      '--format',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best',
      '--merge-output-format',
      'mp4'
    )
  }

  return args
}
