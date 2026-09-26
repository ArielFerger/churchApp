/**
 * Cortar el audio en vivo por FRASES, no por reloj.
 *
 * La primera versión de la Escucha cortaba ventanas fijas de 6 s cada 4,5 s.
 * Tres problemas que salieron de usarla:
 *
 *   1. Una cita cae partida por el corte con muchísima frecuencia. Decir
 *      "Juan capítulo tres versículo dieciséis" lleva ~2,5 s, más que el
 *      solape, así que siempre había una ventana que terminaba en "Juan
 *      capítulo tres" (y una sugerencia rara, `Juan 3`, que hubo que absorber).
 *   2. Latencia fija: aunque el pastor terminara la cita, había que esperar a
 *      que se completara la ventana.
 *   3. La puerta por energía era un umbral fijo (0,008) elegido sobre voz
 *      sintética. Con otra consola, otra ganancia u otro ruido de fondo, o
 *      transcribía el ruido o se perdía la voz floja.
 *
 * Esto detecta voz cuadro a cuadro (30 ms) contra un piso de ruido que se va
 * aprendiendo solo, y corta cuando hay una pausa. La gente respira entre
 * frases: un fragmento suele ser una frase entera, con la cita adentro, y sale
 * a transcribir apenas termina.
 *
 * Si alguien habla de corrido sin pausas, a partir de `blandoMs` se corta en la
 * primera micro-pausa, y a `maxSegMs` se corta sí o sí — pero arrastrando el
 * final (`solapeMs`) al fragmento siguiente, para no partir una palabra.
 *
 * Todo es puro y sin navegador: entra un `Int16Array`, salen fragmentos.
 */

export interface OpcionesSegmentador {
  tasa: number
  /** Largo de cada cuadro de análisis. 30 ms es lo habitual para voz. */
  cuadroMs: number
  /**
   * 0..1. Qué tan por encima del ruido de fondo tiene que estar la señal para
   * contar como voz. Más alto = más sensible (toma voz más floja, y también
   * más ruido).
   */
  sensibilidad: number
  /** Silencio que cierra una frase. */
  pausaMs: number
  /** Con el fragmento ya largo, alcanza una pausa más corta para cortar. */
  pausaCortaMs: number
  /** A partir de este largo, se usa `pausaCortaMs`. */
  blandoMs: number
  /** Largo máximo: acá se corta sí o sí. */
  maxSegMs: number
  /** Voz necesaria (sumada) para que un fragmento valga: descarta toses y golpes. */
  minVozMs: number
  /** Cuadros seguidos sobre el umbral para decir "empezó a hablar". */
  cuadrosInicio: number
  /** Audio de antes del inicio que se incluye: la primera sílaba es suave. */
  prerollMs: number
  /** En un corte forzado, cuánto del final se repite en el siguiente. */
  solapeMs: number
  /** Por debajo de esto (dBFS) nunca es voz, aunque el piso de ruido sea menor. */
  pisoAbsolutoDb: number
}

export const OPCIONES_POR_DEFECTO: OpcionesSegmentador = {
  tasa: 16000,
  cuadroMs: 30,
  sensibilidad: 0.5,
  // Afinados después de la primera prueba con gente: con 650/7000/12000 una
  // cita dicha en medio de una frase larga tardaba ~12 s en aparecer. La
  // transcripción provisional (ver `parcial`) resuelve la mayor parte; esto
  // acorta además el peor caso.
  pausaMs: 550,
  pausaCortaMs: 240,
  blandoMs: 5000,
  maxSegMs: 10000,
  minVozMs: 350,
  cuadrosInicio: 3,
  prerollMs: 300,
  solapeMs: 1500,
  pisoAbsolutoDb: -52
}

/** 300 ms de calibración al arrancar (con cuadros de 30 ms). */
const CUADROS_CALIBRACION = 10

export interface Fragmento {
  /** Número de la frase a la que pertenece (crece con cada frase nueva). */
  frase: number
  pcm: Int16Array
  /** Se cortó por largo y no por una pausa: puede terminar a mitad de palabra. */
  forzado: boolean
  duracionMs: number
}

export interface Lectura {
  /** Fragmentos que se cerraron con este trozo de audio. */
  fragmentos: Fragmento[]
  /** Nivel del trozo, 0..1 (RMS). Para el medidor. */
  nivel: number
  /** Umbral de voz vigente, 0..1 (RMS). El medidor lo dibuja como marca. */
  umbral: number
  /** Si en este momento se considera que alguien está hablando. */
  hablando: boolean
}

/** Margen sobre el ruido, en dB, según la sensibilidad (0 → 16 dB, 1 → 6 dB). */
export function margenDb(sensibilidad: number): number {
  const s = Math.max(0, Math.min(1, sensibilidad))
  return 16 - s * 10
}

export const dbARms = (db: number): number => Math.pow(10, db / 20)
export const rmsADb = (rms: number): number => 20 * Math.log10(Math.max(rms, 1e-6))

function rmsDe(pcm: Int16Array, desde = 0, hasta = pcm.length): number {
  const n = hasta - desde
  if (n <= 0) return 0
  let suma = 0
  for (let i = desde; i < hasta; i++) {
    const v = pcm[i] / 32768
    suma += v * v
  }
  return Math.sqrt(suma / n)
}

/** Buffer que crece de a trozos sin copiar todo en cada cuadro. */
class Acumulador {
  private partes: Int16Array[] = []
  largo = 0

  push(p: Int16Array): void {
    this.partes.push(p)
    this.largo += p.length
  }

  unir(): Int16Array {
    const out = new Int16Array(this.largo)
    let o = 0
    for (const p of this.partes) {
      out.set(p, o)
      o += p.length
    }
    return out
  }

  limpiar(): void {
    this.partes = []
    this.largo = 0
  }
}

export class SegmentadorVoz {
  private op: OpcionesSegmentador
  private muestrasCuadro: number
  /** Muestras que todavía no completaron un cuadro. */
  private resto: Int16Array = new Int16Array(0)
  /** Últimos cuadros en silencio, para el pre-roll. */
  private previos: Int16Array[] = []
  private actual = new Acumulador()
  private enVoz = false
  /** Número de la frase en curso. Una frase forzada sigue con el mismo número. */
  private frase = 0
  private seguidosSobre = 0
  private silencioMs = 0
  private vozMs = 0
  /** Piso de ruido estimado, en dBFS. */
  private ruidoDb = -60
  /** Nivel de los últimos cuadros (≈ 3 s), para seguir el piso de ruido. */
  private historial: number[] = []
  /** Cuadros analizados; los primeros sólo calibran. */
  private cuadros = 0

  constructor(opciones: Partial<OpcionesSegmentador> = {}) {
    this.op = { ...OPCIONES_POR_DEFECTO, ...opciones }
    this.muestrasCuadro = Math.round((this.op.tasa * this.op.cuadroMs) / 1000)
  }

  setSensibilidad(s: number): void {
    this.op = { ...this.op, sensibilidad: s }
  }

  /** Umbral de voz vigente, en dBFS. */
  umbralDb(): number {
    const u = Math.max(this.ruidoDb + margenDb(this.op.sensibilidad), this.op.pisoAbsolutoDb)
    // Nunca más arriba de -20 dBFS: si el piso se fue muy arriba (música
    // sonando fuerte un rato largo), igual tiene que poder entrar la voz.
    return Math.min(u, -20)
  }

  /** Suma audio y devuelve lo que se cerró. */
  alimentar(chunk: Int16Array): Lectura {
    const fragmentos: Fragmento[] = []
    const nivel = rmsDe(chunk)

    let buffer = chunk
    if (this.resto.length) {
      buffer = new Int16Array(this.resto.length + chunk.length)
      buffer.set(this.resto, 0)
      buffer.set(chunk, this.resto.length)
    }

    let i = 0
    for (; i + this.muestrasCuadro <= buffer.length; i += this.muestrasCuadro) {
      const cuadro = buffer.slice(i, i + this.muestrasCuadro)
      const f = this.procesarCuadro(cuadro)
      if (f) fragmentos.push(f)
    }
    this.resto = buffer.slice(i)

    return { fragmentos, nivel, umbral: dbARms(this.umbralDb()), hablando: this.enVoz }
  }

  /**
   * Lo que va de la frase en curso, sin cerrarla. Sirve para la transcripción
   * provisional: si el predicador nombra una cita al principio de una frase
   * larga, no hay por qué esperar a que termine de hablar para mostrarla.
   *
   * `null` si no hay voz en curso o si todavía es muy corta para transcribir.
   */
  parcial(minMs = 1800): { frase: number; pcm: Int16Array } | null {
    if (!this.enVoz || this.vozMs < this.op.minVozMs) return null
    if ((this.actual.largo / this.op.tasa) * 1000 < minMs) return null
    return { frase: this.frase, pcm: this.actual.unir() }
  }

  /** Al detener: lo que estaba en curso, si tiene voz suficiente. */
  cerrar(): Fragmento | null {
    const f = this.enVoz ? this.emitir(false) : null
    this.enVoz = false
    this.actual.limpiar()
    this.previos = []
    this.resto = new Int16Array(0)
    return f
  }

  private procesarCuadro(cuadro: Int16Array): Fragmento | null {
    const { cuadroMs } = this.op
    const db = rmsADb(rmsDe(cuadro))
    this.aprenderRuido(db)
    // Los primeros 300 ms sólo calibran el piso: si la entrada arranca con un
    // soplido fuerte, sin esto se lo tomaría como voz desde el primer cuadro.
    if (this.cuadros < CUADROS_CALIBRACION) {
      this.previos.push(cuadro)
      return null
    }
    const umbral = this.umbralDb()
    // Histéresis: para seguir en voz alcanza con estar 3 dB por debajo del
    // umbral de entrada. Sin esto, una voz que oscila justo en el borde corta
    // la frase en pedacitos.
    const sobre = db >= (this.enVoz ? umbral - 3 : umbral)

    if (!this.enVoz) {
      this.previos.push(cuadro)
      const maxPrevios = Math.ceil(this.op.prerollMs / cuadroMs) + this.op.cuadrosInicio
      while (this.previos.length > maxPrevios) this.previos.shift()

      this.seguidosSobre = sobre ? this.seguidosSobre + 1 : 0
      if (this.seguidosSobre >= this.op.cuadrosInicio) {
        // Empezó a hablar: el fragmento arranca con el pre-roll (que ya
        // incluye los cuadros que dispararon el inicio).
        this.enVoz = true
        this.frase++
        this.actual.limpiar()
        for (const p of this.previos) this.actual.push(p)
        this.previos = []
        this.vozMs = this.op.cuadrosInicio * cuadroMs
        this.silencioMs = 0
      }
      return null
    }

    this.actual.push(cuadro)
    if (sobre) {
      this.vozMs += cuadroMs
      this.silencioMs = 0
    } else {
      this.silencioMs += cuadroMs
    }

    const largoMs = (this.actual.largo / this.op.tasa) * 1000
    const pausaNecesaria = largoMs >= this.op.blandoMs ? this.op.pausaCortaMs : this.op.pausaMs

    if (this.silencioMs >= pausaNecesaria) {
      const f = this.emitir(false)
      this.enVoz = false
      this.seguidosSobre = 0
      this.actual.limpiar()
      this.previos = []
      return f
    }

    if (largoMs >= this.op.maxSegMs) {
      const f = this.emitir(true)
      // Se sigue en voz, arrancando con el final del anterior: si el corte cayó
      // en medio de "Juan tres dieciséis", el siguiente lo tiene entero.
      const todo = this.actual.unir()
      const solape = Math.round((this.op.solapeMs / 1000) * this.op.tasa)
      this.actual.limpiar()
      this.actual.push(todo.slice(Math.max(0, todo.length - solape)))
      this.vozMs = 0
      this.silencioMs = 0
      return f
    }
    return null
  }

  /**
   * Piso de ruido por seguimiento del mínimo: el nivel más bajo de los últimos
   * ~3 s, suavizado. Funciona aunque el predicador hable de corrido, porque
   * entre palabra y palabra siempre hay huecos que caen al nivel del ruido; y
   * un ruido constante (un soplido de la consola, el aire acondicionado) queda
   * como piso en vez de pasar por voz. Así no hay que calibrar nada a mano con
   * cada consola.
   */
  private aprenderRuido(db: number): void {
    this.cuadros++
    this.historial.push(db)
    const max = Math.round(3000 / this.op.cuadroMs)
    if (this.historial.length > max) this.historial.shift()
    let minimo = Infinity
    for (const v of this.historial) if (v < minimo) minimo = v
    // +2 dB: el mínimo de un ruido queda algo por debajo de su promedio.
    const objetivo = Math.max(-80, Math.min(-25, minimo + 2))
    if (this.cuadros <= CUADROS_CALIBRACION) {
      this.ruidoDb = objetivo
      return
    }
    // Baja rápido (apareció un silencio más profundo), sube más lento.
    const alfa = objetivo < this.ruidoDb ? 0.3 : 0.05
    this.ruidoDb = this.ruidoDb * (1 - alfa) + objetivo * alfa
  }

  private emitir(forzado: boolean): Fragmento | null {
    if (this.vozMs < this.op.minVozMs) return null
    let pcm = this.actual.unir()
    if (!forzado) {
      // La pausa que cerró la frase no aporta nada: se deja un poco de cola
      // (las consonantes finales son suaves) y se tira el resto.
      const cola = Math.round((200 / 1000) * this.op.tasa)
      const sobrante = Math.round((this.silencioMs / 1000) * this.op.tasa) - cola
      if (sobrante > 0) pcm = pcm.slice(0, Math.max(0, pcm.length - sobrante))
    }
    return {
      frase: this.frase,
      pcm,
      forzado,
      duracionMs: Math.round((pcm.length / this.op.tasa) * 1000)
    }
  }
}
