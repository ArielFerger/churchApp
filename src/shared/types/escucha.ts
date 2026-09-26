import type { WhisperModelId } from '../utils/whisper'

/**
 * Las formas que cruzan el puente entre el main y la pantalla en el módulo
 * Escucha.
 *
 * Viven en `shared/` y no en el servicio para que el renderer no tenga que
 * importar nada de `electron/` y, sobre todo, para que no haya dos copias que
 * se vayan separando con el tiempo — que es lo que ya pasó con las
 * herramientas de descargas.
 */

/**
 * Cómo se corre whisper: `servidor` carga el modelo una vez y atiende pedidos;
 * `cli` lanza un proceso por fragmento (más lento, queda de respaldo).
 */
export type MotorWhisper = 'servidor' | 'cli'

/** Estado del proceso `whisper-server`. */
export type EstadoServidorWhisper = 'apagado' | 'cargando' | 'listo' | 'error'

/** Dónde está (o no) whisper. */
export interface WhisperStatus {
  /** Ruta del ejecutable CLI, o `null` si todavía no está. */
  binPath: string | null
  /** Ruta de `whisper-server`, o `null` si no está (instalaciones viejas). */
  serverPath: string | null
  /** Modelo elegido en Ajustes. */
  modelo: WhisperModelId
  /** Ruta del `.bin` del modelo elegido, o `null` si falta bajarlo. */
  modelPath: string | null
  /** Modelos que ya están en disco, para no ofrecer bajarlos de nuevo. */
  instalados: WhisperModelId[]
  /** Dónde se buscó, para poder mostrarlo cuando falta algo. */
  searched: string[]
  /** Si hay paquete oficial para esta plataforma (se puede instalar desde la app). */
  instalable: boolean
}

/** Lo mismo, más lo que la pantalla necesita saber sin tener que deducirlo. */
export interface EscuchaStatus extends WhisperStatus {
  /** Qué falta instalar, ya redactado. `null` = está todo listo. */
  falta: string | null
  /** Ventanas descartadas por saturación desde que arrancó la app. */
  descartadas: number
  /** Con qué se va a transcribir. `null` = no hay nada instalado. */
  motor: MotorWhisper | null
  servidor: EstadoServidorWhisper
  errorServidor: string | null
}

export interface Transcripcion {
  texto: string
  /** Cuánto tardó whisper, en ms. Es el número que hay que vigilar en vivo. */
  ms: number
  modelo: WhisperModelId
  motor: MotorWhisper
}
