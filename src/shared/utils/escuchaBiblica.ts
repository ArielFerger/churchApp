import { BIBLE_BOOKS, normalizeBookName, type BookMeta } from './bibleBooks'

/**
 * Detectar citas bíblicas dentro de habla transcrita.
 *
 * Esto NO es `bibleParser.ts`, y no puede serlo. Aquel espera lo que alguien
 * tipea —"Juan 3:16"— con su regex anclada, dígitos obligatorios y espacio
 * entre libro y capítulo. El habla no se parece en nada: llega sin puntuación,
 * con los números escritos en palabras, con la cita metida en medio de una
 * frase, y con lo que el reconocedor haya entendido mal.
 *
 * Lo que hay que resolver acá:
 *   "abramos en juan capítulo tres versículo dieciséis"  → JHN 3:16
 *   "vamos a primera de corintios trece"                 → 1CO 13
 *   "salmo veintitrés"                                   → PSA 23
 *   "mateo cinco tres"                                   → MAT 5:3
 *   "Abramos en Juan 3:16."                              → JHN 3:16
 *   "Mateo 5:3-12"                                       → MAT 5:3-12
 *   "…Romanos 8:28… y leamos el versículo 31"            → ROM 8:28, ROM 8:31
 *
 * La forma con dos puntos no es un caso raro: es lo que whisper escribe casi
 * siempre que el predicador dice "Juan tres dieciséis" (y más todavía con el
 * prompt bíblico). La primera versión del detector partía el texto por
 * espacios y limpiaba todo lo que no fuera letra o dígito, así que "3:16"
 * llegaba como "316" — un capítulo que Juan no tiene — y la cita se perdía.
 * Medido sobre un sermón sintetizado con voz neural: de cinco citas, detectaba
 * una. Por eso el texto ahora pasa por `tokenizar`, que separa los números y
 * recuerda qué separador había entre ellos.
 *
 * Todo el módulo son funciones puras a propósito: es la parte con más riesgo
 * de equivocarse y así se puede probar entera sin micrófono ni modelo.
 */

export interface ReferenciaDetectada {
  bookId: string
  chapter: number
  /** `null` = se nombró el capítulo entero, sin versículo. */
  verse: number | null
  endVerse?: number
  /** 0..1. Por debajo de 0.6 conviene mostrarla en gris y pedir confirmación. */
  confianza: number
  /** El pedazo de habla que la originó, para que el operador entienda por qué. */
  fragmento: string
  /** Índice de la palabra donde arranca. Sirve para deduplicar y ordenar. */
  offset: number
  /**
   * El libro (y a veces el capítulo) no se dijo en esta frase: se tomó de la
   * cita anterior. Pasa con "y ahora el versículo 31", que el predicador dice
   * dando por sobreentendido el pasaje que ya está leyendo.
   */
  inferida?: boolean
  /** Posición en caracteres dentro del texto analizado: `[inicio, fin)`. */
  span?: [number, number]
}

/** El pasaje del que se viene hablando, para resolver "el versículo 31". */
export interface ContextoCita {
  bookId: string
  chapter: number
}

/**
 * Cantidad de versículos por capítulo de cada libro (`stats[bookId][cap-1]`).
 * Es lo que devuelve `getBibleBookStats`. Con esto se descarta "Juan 3:99".
 */
export type EstadisticasBiblia = Record<string, number[]>

// ─── Números en palabras ─────────────────────────────────────────────────────

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29
}

const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90
}

const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600,
  setecientos: 700, ochocientos: 800, novecientos: 900
}

/**
 * Lee un número desde `desde`, tomando todas las palabras que formen parte de
 * él. Acepta también dígitos sueltos, porque el reconocedor casi siempre
 * escribe "juan 3 16" en vez de deletrearlo.
 *
 * Cubre hasta 999 aunque con 176 alcanzaría (Salmo 119:176 es el versículo más
 * alto de la Biblia): el costo de cubrir de más es cero y evita sorpresas.
 */
export function leerNumero(
  palabras: string[],
  desde: number
): { valor: number; consumidas: number } | null {
  let i = desde
  let total = 0
  let consumidas = 0

  // Dígitos tal cual: "3", "16"
  if (i < palabras.length && /^\d{1,3}$/.test(palabras[i])) {
    return { valor: Number(palabras[i]), consumidas: 1 }
  }

  // Centenas
  if (i < palabras.length && CENTENAS[palabras[i]] !== undefined) {
    total += CENTENAS[palabras[i]]
    i++
    consumidas++
  }

  // Decenas compuestas ("cuarenta y siete") o unidades sueltas
  if (i < palabras.length && DECENAS[palabras[i]] !== undefined) {
    total += DECENAS[palabras[i]]
    i++
    consumidas++
    if (i + 1 < palabras.length && palabras[i] === 'y' && UNIDADES[palabras[i + 1]] !== undefined) {
      total += UNIDADES[palabras[i + 1]]
      i += 2
      consumidas += 2
    }
  } else if (i < palabras.length && UNIDADES[palabras[i]] !== undefined) {
    total += UNIDADES[palabras[i]]
    i++
    consumidas++
  }

  return consumidas > 0 ? { valor: total, consumidas } : null
}

// ─── Ordinales de libro ──────────────────────────────────────────────────────

/**
 * Todas las formas en que llega el número de un libro numerado. Además de las
 * habladas ("primera"), las que escribe el reconocedor: "1", "1ª" (que al
 * normalizar queda "1"), "1ra", "1er", y los romanos "I", "II", "III" que
 * aparecen cuando whisper imita la ortografía de algunas Biblias.
 */
const ORDINALES: Record<string, 1 | 2 | 3> = {
  primera: 1, primero: 1, primer: 1, uno: 1, '1': 1, '1a': 1, '1o': 1,
  '1ra': 1, '1era': 1, '1er': 1, '1ro': 1, i: 1,
  segunda: 2, segundo: 2, dos: 2, '2': 2, '2a': 2, '2o': 2, '2da': 2, '2do': 2, ii: 2,
  tercera: 3, tercero: 3, tercer: 3, tres: 3, '3': 3, '3a': 3, '3o': 3,
  '3ra': 3, '3era': 3, '3er': 3, '3ro': 3, iii: 3
}

/**
 * Lee el ordinal que antecede a un libro numerado: "primera de corintios",
 * "segunda de juan", "1ª de Corintios", "primer libro de Reyes". El "de" y el
 * "libro"/"carta"/"epístola" del medio son opcionales.
 *
 * `bibleBooks.ts` sólo conoce las formas con dígito ("1co", "1corintios"), así
 * que sin esto ninguna cita hablada de un libro numerado se detecta jamás.
 */
export function leerOrdinal(
  palabras: string[],
  desde: number
): { orden: 1 | 2 | 3; consumidas: number } | null {
  const orden = ORDINALES[palabras[desde]]
  if (orden === undefined) return null
  let i = desde + 1
  if (LIBRO_GENERICO.has(palabras[i])) i++
  // "primera de corintios" y "primera corintios" son las dos formas usadas.
  if (palabras[i] === 'de' || palabras[i] === 'a') i++
  if (palabras[i] === 'los' || palabras[i] === 'las') i++
  return { orden, consumidas: i - desde }
}

/** "primer LIBRO de Reyes", "primera CARTA a los Corintios". */
const LIBRO_GENERICO = new Set(['libro', 'carta', 'epistola'])

// ─── Matching difuso de libros ───────────────────────────────────────────────

/**
 * Vocabulario: cada clave normalizada apunta a su libro. Se arma una vez.
 * Se excluyen las abreviaturas de 1-2 letras ("is", "am", "ab", "ex", "ap"…)
 * porque en habla corrida colisionan con palabras comunes y generan basura.
 */
const VOCABULARIO = (() => {
  const map = new Map<string, BookMeta>()
  for (const libro of BIBLE_BOOKS) {
    map.set(normalizeBookName(libro.name), libro)
    for (const abbr of libro.abbreviations) {
      if (abbr.length >= 3) map.set(normalizeBookName(abbr), libro)
    }
  }
  // "Salmo" en singular es la forma más dicha ("el salmo veintitrés").
  map.set('salmo', map.get('salmos') as BookMeta)
  return map
})()

/**
 * Clave fonética castellana: cómo SUENA una palabra, para comparar lo que
 * escribió el reconocedor con los nombres de los libros.
 *
 * Whisper es multilenguaje y a veces escribe el sonido con ortografía de otro
 * idioma: la jota castellana de "Job" le suena a la hache inglesa y escribe
 * "hop"; la hache muda de "Hageo" o "Hebreos" se le pierde ("Ageo", "Ebreos");
 * con seseo, "Zacarías" sale "Sacarías". El difuso por distancia de edición no
 * sirve para nombres cortos (daría falsos positivos con cualquier palabra de
 * tres letras); esto compara sonidos en vez de letras.
 */
export function fonetica(palabra: string): string {
  let t = palabra
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '')
  t = t
    .replace(/ch/g, '§') // la "ch" es un sonido propio: que no la toque la regla de la h
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/c(?=[ei])/g, 's')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/w/g, 'u')
    .replace(/g(?=[ei])/g, 'j')
    // La h es muda, y la j suena como la h de otros idiomas: el reconocedor
    // las confunde entre sí. Se tiran las dos.
    .replace(/[jh]/g, '')
    // Final ensordecido: "Job" se oye "Jop".
    .replace(/p$/, 'b')
    .replace(/d$/, 't')
    .replace(/§/g, 'ch')
    .replace(/(.)\1+/g, '$1')
  return t
}

/**
 * Formas en que el reconocedor escribe un libro y que ni la clave fonética
 * alcanza. Salen de pruebas reales: "Job" llegó como "hop" (la fonética lo
 * deja en dos letras, "ob", demasiado corto para compararlo con seguridad).
 */
const ALIAS: Record<string, string> = {
  hop: 'JOB',
  hob: 'JOB',
  jop: 'JOB',
  jov: 'JOB',
  yob: 'JOB',
  joob: 'JOB',
  ruth: 'RUT',
  yoel: 'JOL',
  yonas: 'JON',
  jonah: 'JON',
  naum: 'NAM',
  salmos: 'PSA'
}

/**
 * Índice fonético: clave fonética → libro. Sólo claves de 3 letras o más:
 * más cortas ("os" de Josué, "ua" de "jua") coinciden con palabras corrientes.
 */
const VOCABULARIO_FONETICO = (() => {
  const map = new Map<string, BookMeta>()
  for (const [clave, libro] of VOCABULARIO) {
    const f = fonetica(clave)
    if (f.length >= 3 && !map.has(f)) map.set(f, libro)
  }
  return map
})()

/** Busca por alias y por sonido. Puntaje menor que el exacto: se corrigió. */
function buscarPorSonido(clave: string): BookMeta | null {
  const alias = ALIAS[clave]
  if (alias) return BIBLE_BOOKS.find((b) => b.id === alias) ?? null
  const f = fonetica(clave)
  if (f.length < 3) return null
  return VOCABULARIO_FONETICO.get(f) ?? null
}

/** Nombres largos, para el matching difuso. Los cortos dan falsos positivos. */
const NOMBRES_LARGOS = BIBLE_BOOKS.map((b) => ({
  clave: normalizeBookName(b.name),
  libro: b
})).filter((x) => x.clave.length >= 5)

/**
 * Libros cuyo nombre es además una palabra corriente del castellano. "los
 * hechos de ese hombre", "los números no mienten", "los reyes de la tierra":
 * sin un trato aparte, estos disparan sugerencias falsas durante todo el
 * sermón. Se les exige contexto explícito (ver `detectarReferencias`).
 */
const LIBROS_AMBIGUOS = new Set(['ACT', 'NUM', 'JDG', '1KI', '2KI', 'SNG', 'PRO', 'JOB', 'LAM'])

/** Distancia de edición acotada: si supera `max`, corta y devuelve max+1. */
function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const fila = [i]
    let mejor = i
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      fila[j] = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + costo)
      if (fila[j] < mejor) mejor = fila[j]
    }
    if (mejor > max) return max + 1
    prev = fila
  }
  return prev[b.length]
}

/**
 * Busca un nombre de libro a partir de `desde`, probando ventanas de 1 a 4
 * palabras (hay nombres largos: "cantar de los cantares", "san juan").
 *
 * Devuelve el puntaje: 1 si el nombre llegó tal cual, menos si hubo que
 * corregir. Que el reconocedor escriba "corintos" o "apocalipsi" es lo normal,
 * no la excepción.
 */
export function buscarLibro(
  palabras: string[],
  desde: number
): { libro: BookMeta; consumidas: number; puntaje: number } | null {
  // Un separador de cita (":" o "-") nunca es parte de un nombre.
  const cruzaSeparador = (largo: number): boolean =>
    palabras.slice(desde, desde + largo).some((p) => p.startsWith('§'))

  // De más larga a más corta: "cantar de los cantares" gana sobre "cantar".
  for (let largo = 4; largo >= 1; largo--) {
    if (desde + largo > palabras.length || cruzaSeparador(largo)) continue
    const clave = normalizeBookName(palabras.slice(desde, desde + largo).join(''))
    const exacto = VOCABULARIO.get(clave)
    if (exacto) return { libro: exacto, consumidas: largo, puntaje: 1 }
  }

  // Por sonido, de a una o dos palabras ("hop", "Ageo", "san Mateo").
  for (let largo = 2; largo >= 1; largo--) {
    if (desde + largo > palabras.length || cruzaSeparador(largo)) continue
    if (/^\d/.test(palabras[desde])) continue
    const clave = normalizeBookName(palabras.slice(desde, desde + largo).join(''))
    const porSonido = buscarPorSonido(clave)
    if (porSonido) return { libro: porSonido, consumidas: largo, puntaje: 0.85 }
  }

  // Sin coincidencia exacta: se tolera que el reconocedor haya errado letras.
  for (let largo = 3; largo >= 1; largo--) {
    if (desde + largo > palabras.length || cruzaSeparador(largo)) continue
    const clave = normalizeBookName(palabras.slice(desde, desde + largo).join(''))
    if (clave.length < 5) continue

    let mejor: { libro: BookMeta; dist: number } | null = null
    for (const cand of NOMBRES_LARGOS) {
      const max = clave.length >= 8 ? 2 : 1
      const d = distancia(clave, cand.clave, max)
      if (d <= max && (!mejor || d < mejor.dist)) mejor = { libro: cand.libro, dist: d }
    }
    if (mejor) {
      return {
        libro: mejor.libro,
        consumidas: largo,
        puntaje: mejor.dist === 1 ? 0.8 : 0.65
      }
    }
  }

  return null
}

// ─── Tokenizador ─────────────────────────────────────────────────────────────

/**
 * Separadores que el reconocedor escribe ENTRE dos números. No son palabras:
 * se representan con marcas que no pueden coincidir con nada del idioma.
 *
 * - `§v`  "3:16", "8.28" → lo que sigue es el versículo. Cuenta como haber
 *         dicho "versículo" (es igual de explícito), pero NO habilita resolver
 *         una cita por contexto: "a las 10:30" no es un versículo de nada.
 * - `§r`  "3-12", "16–18" → rango.
 */
const SEP_VERSICULO = '§v'
const SEP_RANGO = '§r'

export interface Token {
  /** Forma normalizada: minúsculas, sin tildes ni puntuación. */
  norm: string
  /** Posición en el texto original: `[inicio, fin)`. */
  inicio: number
  fin: number
}

function normalizarPalabra(p: string): string {
  return p
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Parte el texto en palabras recordando dónde estaba cada una, y separa los
 * números pegados por ":", "." o "-". Guardar la posición permite mostrarle al
 * operador el pedazo exacto de la transcripción, y resaltarlo en pantalla.
 */
export function tokenizar(texto: string): Token[] {
  const tokens: Token[] = []
  // Una "unidad" es todo lo que no sea espacio ni puntuación de frase. La coma
  // corta: "3,16" (forma española) queda como "3" y "16", que ya es una cita.
  const unidad = /[^\s,;¿?¡!()"«»“”…]+/gu
  for (const m of texto.matchAll(unidad)) {
    const bruto = m[0]
    const base = m.index ?? 0
    // Dentro de la unidad, cortar en los separadores que están entre dígitos.
    const partes = /(\d+)|([:.])(?=\d)|([-–—])(?=\d)|[^\d:.\-–—]+|[:.\-–—]+/gu
    for (const p of bruto.matchAll(partes)) {
      const inicio = base + (p.index ?? 0)
      const fin = inicio + p[0].length
      let norm: string
      if (p[2]) {
        // ":" o "." sólo cuenta si también hay un dígito ANTES.
        const antes = tokens[tokens.length - 1]
        norm = antes && /^\d+$/.test(antes.norm) && antes.fin === inicio ? SEP_VERSICULO : ''
      } else if (p[3]) {
        const antes = tokens[tokens.length - 1]
        norm = antes && /^\d+$/.test(antes.norm) && antes.fin === inicio ? SEP_RANGO : ''
      } else {
        norm = normalizarPalabra(p[0])
      }
      if (!norm) continue
      // "1ª" y "1ro" se pegan al número: si la parte anterior era el dígito,
      // se funden ("1" + "ra" → "1ra") para que el ordinal se reconozca.
      const antes = tokens[tokens.length - 1]
      if (
        antes &&
        antes.fin === inicio &&
        /^\d$/.test(antes.norm) &&
        /^(a|o|ra|ro|er|era|da|do)$/.test(norm)
      ) {
        antes.norm += norm
        antes.fin = fin
        continue
      }
      tokens.push({ norm, inicio, fin })
    }
  }
  return tokens
}

// ─── El escáner ──────────────────────────────────────────────────────────────

const MARCA_CAPITULO = new Set(['capitulo', 'capitulos'])
const MARCA_VERSICULO = new Set(['versiculo', 'versiculos', 'verso', 'versos', 'vers'])

/** Palabras que separan las partes de una cita sin aportar significado. */
const RELLENO = new Set([
  ...MARCA_CAPITULO,
  ...MARCA_VERSICULO,
  SEP_VERSICULO,
  'el', 'la', 'los', 'las', 'y', 'de', 'del'
])
/** Palabras que abren una cita: suben la confianza. */
const APERTURA = new Set([
  'en', 'a', 'al', 'con', 'desde', 'leemos', 'dice', 'abramos', 'abran', 'vayamos',
  'vamos', 'busquemos', 'busquen', 'lean', 'leamos', 'leer', 'segun', 'evangelio',
  'carta', 'epistola', 'libro', 'profeta', 'apostol',
  // Verbos con los que un predicador presenta el pasaje: "escuchen Job 1:21".
  'escucha', 'escuchen', 'escuchemos', 'veamos', 'miren', 'mira', 'tomemos',
  'recordemos', 'leo', 'leyendo', 'cita', 'pasaje'
])
/** Marcan que lo que sigue es un rango: "del 16 al 18". */
const HASTA = new Set(['al', 'hasta', 'a', SEP_RANGO])

/** Salta relleno desde `i` y devuelve la nueva posición. */
function saltarRelleno(
  palabras: string[],
  i: number,
  max: number
): { i: number; vioMarcador: boolean } {
  let vioMarcador = false
  let saltadas = 0
  while (i < palabras.length && RELLENO.has(palabras[i]) && saltadas < max) {
    if (MARCA_VERSICULO.has(palabras[i]) || MARCA_CAPITULO.has(palabras[i])) vioMarcador = true
    if (palabras[i] === SEP_VERSICULO) vioMarcador = true
    i++
    saltadas++
  }
  return { i, vioMarcador }
}

/**
 * ¿Hubo una palabra de apertura poco antes? Salta artículos y preposiciones:
 * "abramos en el evangelio de Juan" tiene la apertura a cuatro palabras del
 * libro, y es tan clara como "en Juan". `alcance` es cuántas palabras con
 * contenido se permiten en el medio.
 */
function huboAperturaAntes(palabras: string[], inicio: number, alcance: number): boolean {
  let vistas = 0
  for (let k = inicio - 1; k >= 0 && vistas <= alcance; k--) {
    if (APERTURA.has(palabras[k])) return true
    if (!RELLENO.has(palabras[k])) vistas++
  }
  return false
}

/** Rango opcional tras un versículo: "al 18", "-18", "y 17". */
function leerFinDeRango(
  palabras: string[],
  i: number,
  verso: number
): { fin: number; consumidas: number } | null {
  if (i >= palabras.length) return null
  if (HASTA.has(palabras[i])) {
    const fin = leerNumero(palabras, i + 1)
    if (fin && fin.valor > verso) return { fin: fin.valor, consumidas: 1 + fin.consumidas }
  }
  // "versículos dieciséis y diecisiete": sólo si es el siguiente, porque
  // "Juan 3:16 y 5 hermanos más" no es un rango.
  if (palabras[i] === 'y') {
    const fin = leerNumero(palabras, i + 1)
    if (fin && fin.valor === verso + 1) return { fin: fin.valor, consumidas: 1 + fin.consumidas }
  }
  return null
}

/** Lee el libro en `i`, con su ordinal delante si lo tiene. */
function leerLibro(
  palabras: string[],
  i: number
): { libro: BookMeta; consumidas: number; puntaje: number; numerado: boolean } | null {
  // 1. Ordinal opcional. Con ordinal delante hay que armar la clave numerada
  //    a partir de las palabras crudas: el vocabulario tiene "1corintios" pero
  //    NO "corintios" suelto, así que resolver primero el libro y numerarlo
  //    después no funciona — habría que buscar "11 Corintios".
  const ord = leerOrdinal(palabras, i)
  if (ord) {
    const j = i + ord.consumidas
    for (let largo = 3; largo >= 1; largo--) {
      if (j + largo > palabras.length) continue
      const clave = normalizeBookName(String(ord.orden) + palabras.slice(j, j + largo).join(''))
      const hit = VOCABULARIO.get(clave)
      if (hit) return { libro: hit, consumidas: ord.consumidas + largo, puntaje: 1, numerado: true }
    }
    // "primera de corintos": el ordinal está bien y el nombre llegó con un
    // error. Se corrige sólo contra los libros numerados de ese mismo número.
    if (j < palabras.length) {
      const clave = normalizeBookName(String(ord.orden) + palabras[j])
      let mejor: { libro: BookMeta; dist: number } | null = null
      for (const cand of NOMBRES_LARGOS) {
        if (!cand.clave.startsWith(String(ord.orden))) continue
        const max = clave.length >= 8 ? 2 : 1
        const d = distancia(clave, cand.clave, max)
        if (d <= max && (!mejor || d < mejor.dist)) mejor = { libro: cand.libro, dist: d }
      }
      if (mejor) {
        return {
          libro: mejor.libro,
          consumidas: ord.consumidas + 1,
          puntaje: mejor.dist === 1 ? 0.8 : 0.65,
          numerado: true
        }
      }
    }
    // Ordinal pero sin libro numerado ("la primera de génesis"): se cae al
    // libro suelto, porque el ordinal no era tal.
  }
  const r = buscarLibro(palabras, i)
  return r ? { ...r, numerado: false } : null
}

function versiculosDe(
  stats: EstadisticasBiblia | undefined,
  bookId: string,
  capitulo: number
): number | null {
  const caps = stats?.[bookId]
  if (!caps) return null
  return caps[capitulo - 1] ?? 0
}

export interface OpcionesDeteccion {
  /** El pasaje del que se venía hablando, para "el versículo 31". */
  contexto?: ContextoCita | null
  /** Versículos por capítulo; si está, se descartan los números imposibles. */
  estadisticas?: EstadisticasBiblia
}

/**
 * Escanea habla transcrita y devuelve todo lo que parezca una cita.
 *
 * No está anclado: la cita puede venir en cualquier parte de la frase, que es
 * como habla la gente. Se avanza palabra por palabra intentando armar
 * [ordinal] libro [capítulo] N [versículo|:] M [al|-] K.
 *
 * Además resuelve por contexto dos formas que no nombran el libro:
 *   "…y ahora el versículo 31"            → mismo libro y capítulo
 *   "…en el capítulo 5, versículo 1"      → mismo libro
 *   "el capítulo 13 de primera de Corintios" → libro nombrado DESPUÉS
 */
export function detectarReferencias(
  texto: string,
  opciones: OpcionesDeteccion = {}
): ReferenciaDetectada[] {
  const tokens = tokenizar(texto)
  const palabras = tokens.map((t) => t.norm)
  const salida: ReferenciaDetectada[] = []
  let contexto = opciones.contexto ?? null
  const stats = opciones.estadisticas

  const fragmento = (desde: number, hasta: number): string => {
    const a = tokens[Math.max(0, desde)]
    const b = tokens[Math.min(tokens.length, hasta) - 1]
    return a && b ? texto.slice(a.inicio, b.fin) : ''
  }

  /** Valida y agrega. Devuelve false si el número no existe. */
  const emitir = (r: Omit<ReferenciaDetectada, 'fragmento' | 'span'>, hasta: number): boolean => {
    const libro = BIBLE_BOOKS.find((b) => b.id === r.bookId)
    if (!libro || r.chapter < 1 || r.chapter > libro.chapters) return false
    const tope = versiculosDe(stats, r.bookId, r.chapter)
    if (tope !== null && r.verse !== null) {
      if (r.verse < 1 || r.verse > tope) return false
      if (r.endVerse !== undefined && r.endVerse > tope) r = { ...r, endVerse: tope }
    }
    // El fragmento incluye la palabra de antes ("en", "abramos") para que se
    // entienda de dónde salió.
    const desde = Math.max(0, r.offset - 1)
    const a = tokens[r.offset]
    const b = tokens[hasta - 1]
    salida.push({
      ...r,
      confianza: Math.min(1, Number(r.confianza.toFixed(2))),
      fragmento: fragmento(desde, hasta),
      span: a && b ? [a.inicio, b.fin] : undefined
    })
    contexto = { bookId: r.bookId, chapter: r.chapter }
    return true
  }

  let i = 0
  while (i < palabras.length) {
    const inicio = i

    // ── Por contexto: "capítulo N [de LIBRO] [versículo M]" ────────────────
    if (MARCA_CAPITULO.has(palabras[i])) {
      const cap = leerNumero(palabras, i + 1)
      if (cap) {
        let j = i + 1 + cap.consumidas
        // "el capítulo 13 de primera de Corintios": el libro viene después.
        let libroDespues: ReturnType<typeof leerLibro> = null
        if (palabras[j] === 'de' || palabras[j] === 'del') {
          libroDespues = leerLibro(palabras, j + 1)
          if (libroDespues) j = j + 1 + libroDespues.consumidas
        }
        const bookId = libroDespues?.libro.id ?? contexto?.bookId
        if (bookId) {
          const tras = saltarRelleno(palabras, j, 2)
          const ver = tras.vioMarcador ? leerNumero(palabras, tras.i) : null
          let verse: number | null = null
          let endVerse: number | undefined
          if (ver) {
            verse = ver.valor
            j = tras.i + ver.consumidas
            const rango = leerFinDeRango(palabras, j, verse)
            if (rango) {
              endVerse = rango.fin
              j += rango.consumidas
            }
          }
          const ok = emitir(
            {
              bookId,
              chapter: cap.valor,
              verse,
              endVerse,
              confianza: libroDespues ? 0.95 * libroDespues.puntaje : 0.65,
              offset: inicio,
              inferida: libroDespues ? undefined : true
            },
            j
          )
          if (ok) {
            i = j
            continue
          }
        }
      }
    }

    // ── Por contexto: "versículo N [al M]" sin libro ───────────────────────
    // Sólo con la palabra dicha: un ":" suelto no alcanza (ver SEP_VERSICULO).
    if (MARCA_VERSICULO.has(palabras[i]) && contexto) {
      let j = i + 1
      if (palabras[j] === 'del') j++
      const ver = leerNumero(palabras, j)
      if (ver) {
        j += ver.consumidas
        let endVerse: number | undefined
        const rango = leerFinDeRango(palabras, j, ver.valor)
        if (rango) {
          endVerse = rango.fin
          j += rango.consumidas
        }
        const ok = emitir(
          {
            bookId: contexto.bookId,
            chapter: contexto.chapter,
            verse: ver.valor,
            endVerse,
            confianza: 0.7,
            offset: inicio,
            inferida: true
          },
          j
        )
        if (ok) {
          i = j
          continue
        }
      }
    }

    // Ningún libro empieza con una preposición ni con relleno. Sin esta guarda
    // el matcher difuso se traga la palabra de al lado: "en corintios" queda a
    // distancia 2 de "1corintios" y matchea, absorbiendo el "en" dentro del
    // nombre del libro y dejando mal el fragmento, el offset y la confianza.
    if (APERTURA.has(palabras[i]) || RELLENO.has(palabras[i]) || palabras[i] === SEP_RANGO) {
      i++
      continue
    }

    // Contexto previo: "abramos en...", "vamos a..." suben la confianza. Para
    // destrabar un libro ambiguo tiene que estar pegada: "vamos a ver los
    // hechos 3 veces" tiene apertura, pero lejos, y no es una cita.
    const huboApertura = huboAperturaAntes(palabras, inicio, 2)
    const aperturaPegada = huboAperturaAntes(palabras, inicio, 0)

    // 1-2. Ordinal opcional + libro.
    const encontrado = leerLibro(palabras, i)
    if (!encontrado) {
      i = inicio + 1
      continue
    }

    const libro = encontrado.libro
    let confianza = encontrado.puntaje * (encontrado.numerado ? 1 : 0.95)
    i += encontrado.consumidas

    // 3. Capítulo (puede venir precedido de "capítulo")
    const tras = saltarRelleno(palabras, i, 2)
    const cap = leerNumero(palabras, tras.i)
    if (!cap) {
      i = inicio + 1
      continue
    }
    if (tras.vioMarcador) confianza += 0.15
    i = tras.i + cap.consumidas

    // 4. Versículo opcional
    let verse: number | null = null
    let endVerse: number | undefined
    const trasCap = saltarRelleno(palabras, i, 2)
    const ver = leerNumero(palabras, trasCap.i)
    // "Juan 3 y 5 hermanos" no es Juan 3:5: el "y" solo, sin marcador, no
    // separa capítulo de versículo.
    const soloY = !trasCap.vioMarcador && palabras.slice(i, trasCap.i).includes('y')
    if (ver && !soloY) {
      verse = ver.valor
      if (trasCap.vioMarcador) confianza += 0.1
      i = trasCap.i + ver.consumidas

      // 5. Rango opcional: "del dieciséis al dieciocho", "16-18", "16 y 17"
      const rango = leerFinDeRango(palabras, i, verse)
      if (rango) {
        endVerse = rango.fin
        i += rango.consumidas
      }
    }

    // Un libro cuyo nombre es palabra común necesita señales explícitas: que
    // alguien haya dicho "capítulo"/"versículo" (o el reconocedor haya escrito
    // "2:38", que es lo mismo), o que la frase abra con "en"/"vamos a". Sin
    // eso, "los hechos de ese hombre" se convertiría en una sugerencia.
    const explicito = tras.vioMarcador || trasCap.vioMarcador || aperturaPegada
    if (LIBROS_AMBIGUOS.has(libro.id) && !explicito) {
      i = inicio + 1
      continue
    }

    // 6. Validación contra la metadata canónica
    if (huboApertura) confianza += 0.1
    const ok = emitir(
      { bookId: libro.id, chapter: cap.valor, verse, endVerse, confianza, offset: inicio },
      i
    )
    if (!ok) {
      i = inicio + 1
      continue
    }
  }

  return salida
}

/**
 * Suma lo recién detectado a lo que ya había, sin repetir.
 *
 * Un predicador nombra el mismo pasaje varias veces ("volvamos a Juan tres…"),
 * y las ventanas de audio se solapan a propósito para no cortar palabras, así
 * que la misma cita va a llegar más de una vez. Si cada aparición sumara una
 * fila, la lista sería inusable a los cinco minutos.
 *
 * Cuando algo se repite se conserva la versión de mayor confianza: la segunda
 * vez suele oírse mejor.
 *
 * También se absorbe el capítulo suelto cuando ya hay una cita con versículo
 * del mismo capítulo. Esto no es teórico: en la prueba en vivo, una ventana
 * cortó justo después de "Juan capítulo tres" y la lista mostró `Juan 3` y
 * `Juan 3:16` como si fueran dos pasajes distintos. Es la misma cita partida
 * por el borde de la ventana.
 */
export function fusionar(
  previas: ReferenciaDetectada[],
  nuevas: ReferenciaDetectada[]
): ReferenciaDetectada[] {
  const clave = (r: ReferenciaDetectada): string =>
    `${r.bookId}-${r.chapter}-${r.verse ?? ''}-${r.endVerse ?? ''}`

  const porClave = new Map<string, ReferenciaDetectada>()
  for (const r of [...previas, ...nuevas]) {
    const k = clave(r)
    const actual = porClave.get(k)
    if (!actual) {
      porClave.set(k, r)
      continue
    }
    // Si alguna vez se oyó con el libro nombrado, deja de ser "inferida".
    const mejor = r.confianza > actual.confianza ? r : actual
    const inferida = Boolean(actual.inferida) && Boolean(r.inferida)
    porClave.set(k, {
      ...mejor,
      // El orden sigue a la primera vez que se nombró, no a la última.
      offset: Math.min(actual.offset, r.offset),
      inferida: inferida || undefined
    })
  }

  const todas = [...porClave.values()]
  const conVersiculo = new Set(
    todas.filter((r) => r.verse !== null).map((r) => `${r.bookId}-${r.chapter}`)
  )

  return todas
    .filter((r) => r.verse !== null || !conVersiculo.has(`${r.bookId}-${r.chapter}`))
    .sort((a, b) => a.offset - b.offset)
}
