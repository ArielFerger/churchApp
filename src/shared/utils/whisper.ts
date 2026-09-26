/**
 * Lógica pura de la transcripción con whisper.cpp: qué modelos hay, de dónde
 * se bajan, cómo se arma la línea de comando y cómo se lee lo que devuelve.
 *
 * Vive acá y no en el servicio de Electron por la misma razón que
 * `downloads.ts`: se puede probar el armado de argumentos y el parseo de la
 * salida sin bajar 150 MB de modelo ni levantar un proceso.
 *
 * Hay dos formas de correr whisper, y el servicio usa la primera que encuentre:
 *
 *   - `whisper-server`: un proceso que carga el modelo UNA vez y atiende
 *     pedidos HTTP en 127.0.0.1. Es la forma buena para escuchar en vivo.
 *   - `whisper-cli`: un proceso por fragmento. Cada uno vuelve a leer el
 *     modelo del disco — medido con el modelo base: ~3,4 s por fragmento contra
 *     ~1,3 s del servidor sobre el mismo audio. Queda como respaldo.
 */

/** Modelos de whisper.cpp que la app ofrece. */
export type WhisperModelId =
  | 'tiny'
  | 'base'
  | 'small-q5_1'
  | 'small'
  | 'medium-q5_0'
  | 'large-v3-turbo-q5_0'

export interface WhisperModel {
  id: WhisperModelId
  label: string
  /** Nombre del archivo tal como se distribuye. */
  archivo: string
  /** Tamaño en MB (medido sobre el archivo publicado), para avisar antes de bajarlo. */
  mb: number
  /** Qué tan exigente es con la CPU, de 1 (liviano) a 4 (pesado). */
  peso: 1 | 2 | 3 | 4
  hint: string
}

/**
 * Sólo modelos multilenguaje: los `.en` no sirven para castellano.
 *
 * Los `-q5` son cuantizados: mismo modelo con los pesos comprimidos. Pierden
 * muy poca precisión y ocupan un tercio, así que `small-q5_1` da casi la
 * precisión de `small` pesando apenas más que `base`. Con el servidor —que
 * carga el modelo una sola vez— los modelos medianos pasan a ser viables en
 * una PC común, cosa que con un proceso por fragmento no pasaba.
 */
export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'tiny',
    label: 'Tiny',
    archivo: 'ggml-tiny.bin',
    mb: 75,
    peso: 1,
    hint: 'El más rápido y el que más se equivoca. Sirve para probar que todo funciona.'
  },
  {
    id: 'base',
    label: 'Base',
    archivo: 'ggml-base.bin',
    mb: 148,
    peso: 1,
    hint: 'Rápido. Con audio limpio de consola alcanza; con nombres raros se equivoca más.'
  },
  {
    id: 'small-q5_1',
    label: 'Small comprimido',
    archivo: 'ggml-small-q5_1.bin',
    mb: 190,
    peso: 2,
    hint: 'Recomendado: casi la precisión de Small pesando poco más que Base.'
  },
  {
    id: 'small',
    label: 'Small',
    archivo: 'ggml-small.bin',
    mb: 488,
    peso: 2,
    hint: 'Más preciso con nombres propios. Unas tres veces más lento que Base.'
  },
  {
    id: 'medium-q5_0',
    label: 'Medium comprimido',
    archivo: 'ggml-medium-q5_0.bin',
    mb: 539,
    peso: 3,
    hint: 'Muy preciso. Necesita una PC con CPU moderna de 6 núcleos o más.'
  },
  {
    id: 'large-v3-turbo-q5_0',
    label: 'Large v3 Turbo',
    archivo: 'ggml-large-v3-turbo-q5_0.bin',
    mb: 574,
    peso: 4,
    hint: 'El más preciso. Sólo para PCs potentes: en una común se atrasa del predicador.'
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

export const WHISPER_REPO = 'ggml-org/whisper.cpp'

/**
 * Nombre del paquete de binarios oficial para cada plataforma. Se usa el build
 * simple de CPU: los de CUDA pesan cientos de MB y exigen una placa NVIDIA.
 *
 * OJO: NO se puede apuntar a `releases/latest/download/<asset>`. Desde la 1.9.4
 * la release "latest" de whisper.cpp sale sin binarios, y los paquetes se
 * publican en releases con tag `bNNNN`. Esa URL daba 404 y la instalación
 * desde la app estaba rota. El servicio busca en la API de GitHub la release
 * más nueva que traiga el asset (`elegirAssetDeRelease`).
 */
export const WHISPER_ASSETS: Record<string, string> = {
  'win32-x64': 'whisper-bin-x64.zip',
  'win32-arm64': 'whisper-bin-win-cpu-arm64.zip',
  'linux-x64': 'whisper-bin-ubuntu-x64.tar.gz',
  'linux-arm64': 'whisper-bin-ubuntu-arm64.tar.gz'
}

/**
 * A diferencia de yt-dlp, whisper NO es un ejecutable suelto: viene con sus
 * bibliotecas al lado (`whisper.dll`, `ggml*.dll`, o `libwhisper.so*` en Linux)
 * y sin ellas no arranca. Por eso el paquete se descomprime entero en su propia
 * carpeta y el binario se usa ahí adentro, en vez de moverlo junto a los demás.
 */
export const CARPETA_WHISPER = 'whisper'
export const CARPETA_MODELOS = 'modelos'

/** Nombres posibles del ejecutable: cambió de `main` a `whisper-cli` en 1.7. */
export const NOMBRES_BINARIO = ['whisper-cli', 'main']

/** Lo mismo para el servidor, que antes se llamaba `server`. */
export const NOMBRES_SERVIDOR = ['whisper-server', 'server']

/**
 * Pista inicial para el reconocedor. Whisper acepta un texto de contexto y lo
 * usa para elegir entre alternativas que suenan igual: sin esto escribe
 * "Abacuc", "corintos" o "primera de Corintios" de cinco formas distintas.
 *
 * Los ejemplos con dos puntos no son decoración: empujan a whisper a escribir
 * TODAS las citas igual ("Juan 3:16"), que es la forma que el detector lee con
 * más seguridad. Los libros listados son los que más se escriben mal.
 *
 * Es corto a propósito. Un prompt largo se come parte de la ventana de
 * contexto del modelo y, cuando el audio es corto o hay silencio, whisper
 * tiende a devolver el prompt mismo como si lo hubiera escuchado.
 */
export const PROMPT_BIBLICO =
  'Predicación cristiana. Citas: Juan 3:16, Romanos 8:28, 1 Corintios 13:4, Salmo 23, ' +
  'Hechos 2:38. Libros: Génesis, Éxodo, Deuteronomio, Isaías, Ezequiel, Habacuc, Sofonías, ' +
  'Hageo, Malaquías, Mateo, Efesios, Filipenses, Colosenses, Tesalonicenses, Hebreos, ' +
  'Santiago, Apocalipsis.'

/**
 * El prompt de cada fragmento: el vocabulario bíblico más el final de lo que
 * se venía diciendo. Con eso whisper sabe de qué se está hablando y mantiene la
 * forma de escribir los nombres entre un fragmento y el siguiente.
 *
 * Se toma poco (≈ 30 palabras) y cortado en una palabra entera: el contexto
 * largo es justo lo que hace que whisper entre en bucle repitiendo frases.
 */
export function promptConContexto(previo: string, base: string = PROMPT_BIBLICO): string {
  const limpio = previo.replace(/\s+/g, ' ').trim()
  if (!limpio) return base
  const palabras = limpio.split(' ')
  const cola = palabras.slice(-30).join(' ')
  return `${base} ${cola}`
}

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

export interface ServerArgs {
  modelPath: string
  puerto: number
  hilos?: number
  idioma?: string
}

/**
 * Argumentos para levantar `whisper-server`.
 *
 * - Escucha sólo en 127.0.0.1: el audio del sermón no tiene que poder pedirse
 *   desde otra máquina de la red.
 * - `-sns` suprime los tokens de "no-habla" ([MÚSICA], (aplausos)): es la
 *   primera barrera contra lo que whisper inventa sobre el ruido del salón.
 * - `-nf` por la misma razón que en el CLI: sin reintentos que multipliquen la
 *   latencia justo en los fragmentos difíciles.
 */
export function buildServerArgs(o: ServerArgs): string[] {
  const args = [
    '-m',
    o.modelPath,
    '-l',
    o.idioma ?? 'es',
    '--host',
    '127.0.0.1',
    '--port',
    String(o.puerto),
    '-nt',
    '-nf',
    '-sns'
  ]
  if (o.hilos && o.hilos > 0) args.push('-t', String(o.hilos))
  return args
}

/**
 * Contexto de audio a pedirle a whisper para un fragmento de `duracionMs`.
 *
 * Whisper procesa siempre una ventana de 30 s (contexto 1500) aunque la frase
 * dure 3: el resto es relleno que igual se computa. Achicar el contexto baja
 * mucho la latencia, pero por debajo de cierto punto el modelo empieza a
 * cortar frases ("Buenos,", "El,") y se pierden citas enteras.
 *
 * Medido con el modelo base sobre un sermón de 52 s cortado por frases:
 *
 *   contexto 1500 (sin tocar)   ~1430 ms por frase   5 de 5 citas
 *   mínimo 768                   ~780 ms por frase   5 de 5 citas
 *   mínimo 512                   ~580 ms por frase   5 de 5, texto algo peor
 *   duración × 50 + 256          ~500 ms por frase   1 de 5 (frases cortadas)
 *
 * 768 (≈ 15 s de audio) es el punto donde se gana casi el doble de velocidad
 * sin pagar nada en precisión. Un fragmento más largo pide lo que necesita.
 */
export function audioCtxPara(duracionMs: number): number {
  const necesario = Math.ceil((duracionMs / 1000) * 50) + 128
  return Math.min(1500, Math.max(768, necesario))
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
 * Frases que whisper "escucha" en el silencio y el ruido. Salen de los
 * subtítulos de YouTube con los que se entrenó: sobre audio vacío, el modelo
 * completa con lo que más veces vio al final de un video. En castellano son
 * siempre las mismas.
 */
const ALUCINACIONES: RegExp[] = [
  /subt[ií]tul(os|ado)s?\b.*\b(por|realizad|hech|comunidad|amara)/i,
  /amara\.org/i,
  /suscr[ií]b(e|ete|irte|anse)/i,
  /gracias por (ver|mirar|su atenci[oó]n)/i,
  /(dale|den) (like|me gusta)/i,
  /activa(r|d)? la campanita/i,
  /nos vemos en el pr[oó]ximo (video|v[ií]deo)/i,
  /www\.[a-z0-9-]+\.[a-z]{2,}/i
]

/** Si un pedazo de transcripción es una de las muletillas inventadas. */
export function esAlucinacion(texto: string): boolean {
  const t = texto.trim()
  if (!t) return false
  return ALUCINACIONES.some((re) => re.test(t))
}

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

/** Un segmento de la respuesta `verbose_json` de whisper-server. */
interface SegmentoServidor {
  text?: unknown
  no_speech_prob?: unknown
  avg_logprob?: unknown
}

/**
 * Umbrales para descartar un segmento que el modelo mismo cree que no es voz.
 * Son los que usa la implementación de referencia de OpenAI: un segmento se
 * tira si el modelo da alta probabilidad de "no hubo habla" Y además está
 * inseguro de lo que escribió. Cualquiera de las dos sola descarta de más.
 */
const NO_HABLA = 0.6
const LOGPROB_DUDOSO = -1

/**
 * Lee la respuesta de `whisper-server` (formato `verbose_json`) y devuelve el
 * texto limpio. Aprovecha lo que el CLI no da: la confianza del modelo por
 * segmento, para tirar lo que inventó sobre el silencio antes de que llegue al
 * detector.
 *
 * `promptUsado` sirve para otra alucinación clásica: sobre audio casi vacío,
 * whisper devuelve el prompt como si lo hubiera oído.
 */
export function parseRespuestaServidor(json: unknown, promptUsado?: string): string {
  if (!json || typeof json !== 'object') return ''
  const r = json as { text?: unknown; segments?: unknown }
  const segmentos: SegmentoServidor[] = Array.isArray(r.segments)
    ? (r.segments as SegmentoServidor[])
    : [{ text: r.text }]

  const prompt = (promptUsado ?? '').toLowerCase()
  const partes: string[] = []
  for (const s of segmentos) {
    if (typeof s.text !== 'string') continue
    const noHabla = typeof s.no_speech_prob === 'number' ? s.no_speech_prob : 0
    const logprob = typeof s.avg_logprob === 'number' ? s.avg_logprob : 0
    if (noHabla > NO_HABLA && logprob < LOGPROB_DUDOSO) continue

    const texto = parseTranscripcion(s.text)
    if (!texto || esAlucinacion(texto)) continue
    // Eco del prompt: el texto aparece entero adentro del prompt.
    if (prompt && texto.length > 12 && prompt.includes(texto.toLowerCase())) continue
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
  if (/error while loading shared libraries|cannot open shared object/.test(s))
    return 'Faltan bibliotecas de whisper. Reinstalalo desde la sección Escucha.'
  if (/address already in use|bind failed|couldn.t bind/.test(s))
    return 'El puerto que usa la transcripción está ocupado. Cerrá y volvé a abrir la app.'
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
