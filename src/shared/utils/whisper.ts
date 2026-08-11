/**
 * Lógica pura de la transcripción con whisper.cpp: qué modelos hay, de dónde
 * se bajan, cómo se arma la línea de comando y cómo se lee lo que devuelve.
 *
 * Vive acá y no en el servicio de Electron por la misma razón que
 * `downloads.ts`: se puede probar el armado de argumentos y el parseo de la
 * salida sin bajar 150 MB de modelo ni levantar un proceso.
 */

/** Modelos de whisper.cpp que la app ofrece. */
export type WhisperModelId = 'tiny' | 'base' | 'small'

export interface WhisperModel {
  id: WhisperModelId
  label: string
  /** Nombre del archivo tal como se distribuye. */
  archivo: string
  /** Tamaño aproximado en MB, para avisar antes de bajarlo. */
  mb: number
  hint: string
}

/**
 * Sólo los modelos `.bin` multilenguaje: los `.en` no sirven para castellano.
 * `medium` (1,5 GB) y `large` quedan afuera a propósito — no entran en el
 * presupuesto de CPU de una máquina que además está proyectando video.
 */
export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'tiny',
    label: 'Tiny',
    archivo: 'ggml-tiny.bin',
    mb: 75,
    hint: 'El más rápido y el que más se equivoca. Para probar que todo funciona.'
  },
  {
    id: 'base',
    label: 'Base',
    archivo: 'ggml-base.bin',
    mb: 148,
    hint: 'El recomendado: con audio limpio de consola alcanza y sobra.'
  },
  {
    id: 'small',
    label: 'Small',
    archivo: 'ggml-small.bin',
    mb: 466,
    hint: 'Más preciso con nombres raros, pero tarda unas tres veces más.'
  }
]

export const MODELO_POR_DEFECTO: WhisperModelId = 'base'

export function modeloPorId(id: string | null | undefined): WhisperModel {
  return (
    WHISPER_MODELS.find((m) => m.id === id) ??
    (WHISPER_MODELS.find((m) => m.id === MODELO_POR_DEFECTO) as WhisperModel)
  )
}

/**
 * Los modelos los publica el propio autor de whisper.cpp en Hugging Face.
 * `resolve/main` devuelve el archivo (con redirección al CDN); `blob/main`
 * devolvería la página HTML.
 */
export function modeloUrl(id: WhisperModelId): string {
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${modeloPorId(id).archivo}`
}

/**
 * Binarios oficiales de whisper.cpp. Se usa el build simple de CPU: los de
 * cuBLAS pesan entre 270 MB y 670 MB y exigen una placa NVIDIA que la máquina
 * de la iglesia no tiene.
 *
 * Igual que con yt-dlp, se apunta a `latest`: el nombre del asset es estable
 * entre releases y así no hay que tocar el código cuando sale una versión.
 */
export const WHISPER_BIN_URL: Record<string, string> = {
  win32: 'https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip',
  linux:
    'https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-ubuntu-x64.tar.gz'
}

/**
 * A diferencia de yt-dlp, whisper NO es un ejecutable suelto: viene con sus
 * DLL al lado (`whisper.dll`, `ggml*.dll`) y sin ellas no arranca. Por eso el
 * zip se descomprime entero en su propia carpeta y el binario se usa ahí
 * adentro, en vez de moverlo junto a los demás.
 */
export const CARPETA_WHISPER = 'whisper'
export const CARPETA_MODELOS = 'modelos'

/** Nombres posibles del ejecutable: cambió de `main` a `whisper-cli` en 1.7. */
export const NOMBRES_BINARIO = ['whisper-cli', 'main']

/**
 * Pista inicial para el reconocedor. Whisper acepta un texto de contexto y lo
 * usa para elegir entre alternativas que suenan igual: sin esto escribe
 * "Abacuc", "corintos" o "primera de Corintios" de cinco formas distintas.
 *
 * Es corto a propósito. Un prompt largo se come parte de la ventana de
 * contexto del modelo y, cuando el audio es corto o hay silencio, whisper
 * tiende a devolver el prompt mismo como si lo hubiera escuchado.
 */
export const PROMPT_BIBLICO =
  'Predicación. Se citan libros de la Biblia: Génesis, Éxodo, Salmos, Proverbios, Isaías, ' +
  'Mateo, Marcos, Lucas, Juan, Hechos, Romanos, Corintios, Gálatas, Efesios, Filipenses, ' +
  'Hebreos, Santiago, Apocalipsis, con capítulo y versículo.'

export interface WhisperArgs {
  /** Ruta del modelo `.bin`. */
  modelPath: string
  /** WAV a transcribir: 16 kHz, mono, PCM de 16 bits. */
  wavPath: string
  /** Código ISO del idioma. `auto` deja que lo detecte solo. */
  idioma?: string
  /** Hilos de CPU. El default de whisper es 4; conviene dejar aire para la proyección. */
  hilos?: number
  /** Texto de contexto (ver `PROMPT_BIBLICO`). `null` para no mandar ninguno. */
  prompt?: string | null
  /**
   * Desactiva el reintento con temperatura más alta. Whisper reintenta el
   * fragmento hasta cinco veces cuando no está conforme, y eso multiplica la
   * latencia justo en las ventanas difíciles. Con línea limpia no hace falta.
   */
  sinFallback?: boolean
}

/**
 * Arma la línea de comando de `whisper-cli`.
 *
 * `-nt` (sin marcas de tiempo) y `-np` (sin los carteles de sistema) dejan el
 * stdout con el texto y nada más. La transcripción sale por stdout; todo lo
 * demás que imprime whisper —modelo cargado, tiempos, versión— va por stderr,
 * así que no hay que filtrarlo.
 */
export function buildWhisperArgs(o: WhisperArgs): string[] {
  const args = ['-m', o.modelPath, '-f', o.wavPath, '-l', o.idioma ?? 'es', '-nt', '-np']
  if (o.hilos && o.hilos > 0) args.push('-t', String(o.hilos))
  if (o.sinFallback ?? true) args.push('-nf')
  if (o.prompt) args.push('--prompt', o.prompt)
  return args
}

/**
 * Cuántos hilos pedirle a whisper. Se le deja al menos un núcleo libre al
 * resto de la app: si whisper toma todos, la decodificación del video que está
 * al aire empieza a saltar, y eso lo ve la congregación.
 */
export function hilosSugeridos(nucleos: number): number {
  return Math.max(1, Math.min(8, nucleos - 2))
}

/** Marca de tiempo al principio de una línea: `[00:00:00.000 --> 00:00:06.000]`. */
const MARCA_TIEMPO = /^\s*\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/

/**
 * Anotaciones de ruido: `[BLANK_AUDIO]`, `(música)`, `[Aplausos]`, `*risas*`.
 * Whisper las emite en lugar de texto cuando no hay voz, y si se cuelan en el
 * flujo el detector las procesa como si fueran palabras del predicador.
 */
const ANOTACION = /[[(*][^\])*]*[\])*]/g

/**
 * Convierte el stdout de whisper en una sola línea de texto.
 *
 * Además de limpiar, colapsa repeticiones consecutivas idénticas: cuando el
 * audio es casi silencio, whisper entra en bucle y devuelve la misma frase
 * veinte veces. Sin esto, el detector la ve como veinte menciones distintas.
 */
export function parseTranscripcion(stdout: string): string {
  const partes: string[] = []
  for (const bruta of stdout.split(/\r?\n/)) {
    const sinTiempo = bruta.replace(MARCA_TIEMPO, '')
    // Si al sacarle las anotaciones no queda nada, la línea entera era ruido.
    if (!sinTiempo.replace(ANOTACION, '').trim()) continue
    const texto = sinTiempo.replace(ANOTACION, ' ').replace(/\s+/g, ' ').trim()
    if (!texto) continue
    if (partes[partes.length - 1] === texto) continue
    partes.push(texto)
  }
  return partes.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Traduce a castellano las fallas que se pueden explicar. El stderr de whisper
 * es inglés técnico; mostrárselo tal cual al operador un domingo a la mañana no
 * ayuda a nadie.
 */
export function explicarErrorWhisper(stderr: string): string | null {
  const s = stderr.toLowerCase()
  if (/failed to (load|initialize) model|invalid model file|no such file/.test(s))
    return 'No se pudo cargar el modelo. Puede haber quedado a medio bajar: borralo y volvé a instalarlo.'
  if (/failed to open|read_wav|not a wave file|must be 16-bit|mono/.test(s))
    return 'El audio no tiene el formato que whisper necesita (WAV de 16 kHz, mono, 16 bits).'
  if (/out of memory|bad_alloc/.test(s))
    return 'No alcanzó la memoria para el modelo. Probá con uno más chico.'
  return null
}

/** Última línea con contenido de un stderr, para cuando no se pudo explicar. */
export function ultimaLineaUtil(texto: string): string | null {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lineas.length ? lineas[lineas.length - 1] : null
}
