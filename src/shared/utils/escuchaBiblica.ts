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
}

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
 * él. Acepta también dígitos sueltos, porque el reconocedor a veces escribe
 * "juan 3 16" en vez de deletrearlo.
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

const ORDINALES: Record<string, 1 | 2 | 3> = {
  primera: 1, primero: 1, primer: 1, uno: 1,
  segunda: 2, segundo: 2, dos: 2,
  tercera: 3, tercero: 3, tercer: 3, tres: 3
}

/**
 * Lee el ordinal que antecede a un libro numerado: "primera de corintios",
 * "segunda de juan", "tercera de juan". El "de" es opcional.
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
  // "primera de corintios" y "primera corintios" son las dos formas usadas.
  const consumidas = palabras[desde + 1] === 'de' ? 2 : 1
  return { orden, consumidas }
}

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
  return map
})()

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
  // De más larga a más corta: "cantar de los cantares" gana sobre "cantar".
  for (let largo = 4; largo >= 1; largo--) {
    if (desde + largo > palabras.length) continue
    const clave = normalizeBookName(palabras.slice(desde, desde + largo).join(''))
    const exacto = VOCABULARIO.get(clave)
    if (exacto) return { libro: exacto, consumidas: largo, puntaje: 1 }
  }

  // Sin coincidencia exacta: se tolera que el reconocedor haya errado letras.
  for (let largo = 3; largo >= 1; largo--) {
    if (desde + largo > palabras.length) continue
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

// ─── El escáner ──────────────────────────────────────────────────────────────

/** Palabras que separan las partes de una cita sin aportar significado. */
const RELLENO = new Set(['capitulo', 'capitulos', 'versiculo', 'versiculos', 'verso', 'versos', 'el', 'la', 'los', 'las', 'y', 'de', 'del'])
/** Palabras que abren una cita: suben la confianza. */
const APERTURA = new Set(['en', 'a', 'al', 'con', 'desde', 'leemos', 'dice', 'abramos', 'vayamos', 'vamos', 'busquemos', 'lean', 'leamos'])
/** Marcan que lo que sigue es un rango: "del 16 al 18". */
const HASTA = new Set(['al', 'hasta', 'a'])

function normalizarPalabra(p: string): string {
  return p
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Salta relleno desde `i` y devuelve la nueva posición. */
function saltarRelleno(palabras: string[], i: number, max: number): { i: number; vioMarcador: boolean } {
  let vioMarcador = false
  let saltadas = 0
  while (i < palabras.length && RELLENO.has(palabras[i]) && saltadas < max) {
    if (palabras[i].startsWith('versiculo') || palabras[i].startsWith('verso')) vioMarcador = true
    if (palabras[i].startsWith('capitulo')) vioMarcador = true
    i++
    saltadas++
  }
  return { i, vioMarcador }
}

/**
 * Escanea habla transcrita y devuelve todo lo que parezca una cita.
 *
 * No está anclado: la cita puede venir en cualquier parte de la frase, que es
 * como habla la gente. Se avanza palabra por palabra intentando armar
 * [ordinal] libro [capítulo] N [versículo] M [al K].
 */
export function detectarReferencias(texto: string): ReferenciaDetectada[] {
  const crudas = texto.split(/\s+/).filter(Boolean)
  const palabras = crudas.map(normalizarPalabra)
  const salida: ReferenciaDetectada[] = []

  let i = 0
  while (i < palabras.length) {
    // Ningún libro empieza con una preposición ni con relleno. Sin esta guarda
    // el matcher difuso se traga la palabra de al lado: "en corintios" queda a
    // distancia 2 de "1corintios" y matchea, absorbiendo el "en" dentro del
    // nombre del libro y dejando mal el fragmento, el offset y la confianza.
    if (APERTURA.has(palabras[i]) || RELLENO.has(palabras[i])) {
      i++
      continue
    }

    const inicio = i
    let confianza = 0.5

    // Contexto previo: "abramos en...", "vamos a..." suben la confianza.
    const previa = inicio > 0 ? palabras[inicio - 1] : ''
    const huboApertura = APERTURA.has(previa)

    // 1. Ordinal opcional
    const ord = leerOrdinal(palabras, i)
    let prefijo = ''
    if (ord) {
      prefijo = String(ord.orden)
      i += ord.consumidas
    }

    // 2. El libro. Con ordinal delante hay que armar la clave numerada a
    //    partir de las palabras crudas: el vocabulario tiene "1corintios" pero
    //    NO "corintios" suelto, así que resolver primero el libro y numerarlo
    //    después no funciona — habría que buscar "11 Corintios".
    let encontrado = prefijo ? null : buscarLibro(palabras, i)
    if (prefijo) {
      for (let largo = 3; largo >= 1 && !encontrado; largo--) {
        if (i + largo > palabras.length) continue
        const clave = normalizeBookName(prefijo + palabras.slice(i, i + largo).join(''))
        const hit = VOCABULARIO.get(clave)
        if (hit) encontrado = { libro: hit, consumidas: largo, puntaje: 1 }
      }
    }
    if (!encontrado) {
      i = inicio + 1
      continue
    }

    const libro = encontrado.libro
    confianza = encontrado.puntaje * (prefijo ? 1 : 0.95)
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

    // Un libro cuyo nombre es palabra común necesita señales explícitas: o
    // bien alguien dijo "capítulo"/"versículo", o la frase abrió con "en"/"a".
    // Sin eso, "los hechos de ese hombre" se convertiría en una sugerencia.
    if (LIBROS_AMBIGUOS.has(libro.id) && !tras.vioMarcador && !huboApertura) {
      i = inicio + 1
      continue
    }

    // 4. Versículo opcional
    let verse: number | null = null
    let endVerse: number | undefined
    const trasCap = saltarRelleno(palabras, i, 2)
    const ver = leerNumero(palabras, trasCap.i)
    if (ver) {
      verse = ver.valor
      if (trasCap.vioMarcador) confianza += 0.1
      i = trasCap.i + ver.consumidas

      // 5. Rango opcional: "del dieciséis al dieciocho"
      if (i < palabras.length && HASTA.has(palabras[i])) {
        const fin = leerNumero(palabras, i + 1)
        if (fin && fin.valor > verse) {
          endVerse = fin.valor
          i = i + 1 + fin.consumidas
        }
      }
    }

    // 6. Validación contra la metadata canónica
    if (cap.valor < 1 || cap.valor > libro.chapters) {
      i = inicio + 1
      continue
    }
    if (huboApertura) confianza += 0.1

    salida.push({
      bookId: libro.id,
      chapter: cap.valor,
      verse,
      endVerse,
      confianza: Math.min(1, Number(confianza.toFixed(2))),
      fragmento: crudas.slice(Math.max(0, inicio - 1), i).join(' '),
      offset: inicio
    })
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
    if (!actual || r.confianza > actual.confianza) porClave.set(k, r)
  }
  return [...porClave.values()].sort((a, b) => a.offset - b.offset)
}
