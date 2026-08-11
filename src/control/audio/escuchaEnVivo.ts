import { TASA } from '@/shared/utils/audioVentanas'
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

export async function iniciarEscucha(deviceId?: string | null): Promise<void> {
  if (captura) return
  const store = useEscuchaStore.getState()
  const api = window.electronAPI
  if (!api) return store.setError('La Escucha necesita la app de escritorio.')

  store.limpiar()
  store.setEstado('iniciando')

  try {
    // Antes de abrir el micrófono: si falta el modelo, capturar audio para
    // tirarlo sería tomar el micrófono de la máquina para nada, y encima
    // dejaría el indicador de "grabando" prendido sin ninguna razón.
    const estado = await api.getEscuchaStatus()
    if (estado.falta) return store.setError(estado.falta)

    captura = await iniciarCaptura({
      deviceId,
      onNivel: (nivel) => useEscuchaStore.getState().setNivel(nivel),
      onError: (e) => {
        void detenerEscucha()
        useEscuchaStore.getState().setError(e.message)
      },
      onVentana: (pcm) => {
        // Sin `await`: el worklet sigue juntando audio mientras whisper
        // trabaja. Si llega otra ventana antes de que termine, el main la
        // descarta —eso es mejor que atrasarse cada vez más.
        void api
          .transcribirVentana(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), TASA)
          .then((r) => {
            const s = useEscuchaStore.getState()
            if (!r) return s.ventanaDescartada()
            s.aplicarVentana(r.texto, r.ms)
          })
          .catch((e: unknown) => {
            useEscuchaStore.getState().setError(mensaje(e))
          })
      }
    })

    useEscuchaStore.getState().setEstado('escuchando')
  } catch (e) {
    captura = null
    useEscuchaStore.getState().setError(explicarCaptura(e))
  }
}

export async function detenerEscucha(): Promise<void> {
  const actual = captura
  captura = null
  const store = useEscuchaStore.getState()
  try {
    await actual?.detener()
  } finally {
    store.setNivel(0)
    if (store.estado !== 'error') store.setEstado('apagada')
  }
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Los errores de `getUserMedia` llegan con nombres que no dicen nada. */
function explicarCaptura(e: unknown): string {
  const nombre = e instanceof Error ? e.name : ''
  if (nombre === 'NotAllowedError') return 'Windows no dejó usar la entrada de audio.'
  if (nombre === 'NotFoundError') return 'No hay ninguna entrada de audio conectada.'
  if (nombre === 'NotReadableError') return 'La entrada de audio está tomada por otro programa.'
  if (nombre === 'OverconstrainedError')
    return 'La entrada elegida ya no está. Elegí otra en la lista.'
  return mensaje(e)
}
