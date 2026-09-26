import { TASA } from '@/shared/utils/audioVentanas'
import { promptConContexto } from '@/shared/utils/whisper'
import { useEscuchaStore } from '@/shared/store/escuchaStore'
import { iniciarCaptura, type Captura } from './capturaVoz'

/**
 * Une las tres piezas de la Escucha: el micrófono (renderer), whisper (main) y
 * el estado que ve el operador.
 *
 * Vive del lado del control y no en el store porque el store tiene que poder
 * probarse sin navegador. Acá está todo lo que necesita un `AudioContext` o el
 * puente con el proceso principal.
 */

let captura: Captura | null = null

export function escuchando(): boolean {
  return captura !== null
}

export interface OpcionesEscucha {
  deviceId?: string | null
  sensibilidad?: number
  gananciaDb?: number
}

/** Pedidos a whisper que todavía no volvieron (completos y provisionales). */
let enVuelo = 0

export async function iniciarEscucha(opciones: OpcionesEscucha = {}): Promise<void> {
  if (captura) return
  const store = useEscuchaStore.getState()
  const api = window.electronAPI
  if (!api) return store.setError('La Escucha necesita la app de escritorio.')

  store.limpiar()
  store.setEstado('iniciando')

  try {
    // Antes de abrir el micrófono: cargar el modelo. Si falta algo, capturar
    // audio para tirarlo sería tomar el micrófono de la máquina para nada, y
    // encima dejaría el indicador de "escuchando" prendido sin ninguna razón.
    // Y cargarlo ahora (1-3 s) evita que la primera frase del pastor espere.
    const estado = await api.warmupEscucha()
    useEscuchaStore.getState().setMotor(estado.motor, estado.servidor)
    if (estado.falta) return store.setError(estado.falta)
    if (!estado.motor) {
      return store.setError(estado.errorServidor ?? 'No se pudo arrancar la transcripción.')
    }

    captura = await iniciarCaptura({
      deviceId: opciones.deviceId,
      sensibilidad: opciones.sensibilidad,
      gananciaDb: opciones.gananciaDb,
      onNivel: (nivel, umbral, hablando) =>
        useEscuchaStore.getState().setNivel(nivel, umbral, hablando),
      onError: (e) => {
        void detenerEscucha()
        useEscuchaStore.getState().setError(e.message)
      },
      onFragmento: enviar,
      onParcial: enviarParcial
    })

    useEscuchaStore.getState().setEstado('escuchando')
  } catch (e) {
    captura = null
    useEscuchaStore.getState().setError(explicarCaptura(e))
  }
}

/**
 * Manda una frase a transcribir. Sin `await`: el micrófono sigue juntando
 * audio mientras whisper trabaja. Si llega otra antes de que termine, el main
 * la descarta —eso es mejor que atrasarse cada vez más.
 */
function enviar(pcm: Int16Array, forzado: boolean, frase: number): void {
  const api = window.electronAPI
  if (!api) return
  const s = useEscuchaStore.getState()
  s.fragmentoEnviado()
  // El final de lo que se venía diciendo va como contexto: whisper mantiene
  // los nombres y la forma de escribir las citas entre una frase y la otra.
  const prompt = promptConContexto(s.textoReciente())
  enVuelo++
  void api
    .transcribirVentana(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), TASA, prompt)
    .then((r) => {
      const st = useEscuchaStore.getState()
      if (!r) return st.ventanaDescartada()
      st.aplicarVentana(r.texto, r.ms, { forzado, frase })
    })
    .catch((e: unknown) => {
      const st = useEscuchaStore.getState()
      st.ventanaDescartada()
      st.setError(mensaje(e))
    })
    .finally(() => {
      enVuelo--
    })
}

/**
 * Lo que va de una frase que todavía no terminó. Sólo si whisper está libre:
 * lo provisional nunca puede demorar una frase completa (el main además le da
 * prioridad a las completas). Si se pierde, en dos segundos llega otra.
 */
function enviarParcial(pcm: Int16Array, frase: number): void {
  const api = window.electronAPI
  if (!api || enVuelo > 0) return
  const prompt = promptConContexto(useEscuchaStore.getState().textoReciente())
  enVuelo++
  void api
    .transcribirVentana(
      new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength),
      TASA,
      prompt,
      true
    )
    .then((r) => {
      if (r) useEscuchaStore.getState().aplicarProvisional(r.texto, frase)
    })
    .catch(() => {
      /* lo provisional es un adelanto: si falla, llega la frase completa */
    })
    .finally(() => {
      enVuelo--
    })
}

export function cambiarGanancia(db: number): void {
  captura?.setGanancia(db)
}

export function cambiarSensibilidad(s: number): void {
  captura?.setSensibilidad(s)
}

export async function detenerEscucha(): Promise<void> {
  const actual = captura
  captura = null
  const store = useEscuchaStore.getState()
  try {
    await actual?.detener()
  } finally {
    store.setNivel(0, undefined, false)
    if (useEscuchaStore.getState().estado !== 'error') store.setEstado('apagada')
    // El modelo queda cargado un rato por si se vuelve a escuchar; después se
    // libera la memoria.
    void window.electronAPI?.idleEscucha()
  }
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Los errores de `getUserMedia` llegan con nombres que no dicen nada. */
function explicarCaptura(e: unknown): string {
  const nombre = e instanceof Error ? e.name : ''
  if (nombre === 'NotAllowedError')
    return 'El sistema no dejó usar la entrada de audio. Revisá los permisos de micrófono.'
  if (nombre === 'NotFoundError') return 'No hay ninguna entrada de audio conectada.'
  if (nombre === 'NotReadableError') return 'La entrada de audio está tomada por otro programa.'
  if (nombre === 'OverconstrainedError')
    return 'La entrada elegida ya no está. Elegí otra en la lista.'
  return mensaje(e)
}
