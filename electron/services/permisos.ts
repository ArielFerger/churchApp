import { session, type WebContents } from 'electron'
import log from 'electron-log'

/**
 * Qué puede pedir cada ventana.
 *
 * Electron concede TODO por defecto (micrófono, cámara, ubicación,
 * notificaciones…) si nadie instala un handler. Para una app que escucha el
 * audio de la reunión, eso no alcanza: el micrófono tiene que poder pedirlo
 * sólo la ventana de control, y sólo audio — la cámara no la usa nadie.
 *
 * La ventana de inicio de sesión de YouTube vive en su propia partición y
 * carga una página de un tercero: ahí no se concede nada.
 */

/** Lo que las ventanas propias de la app pueden pedir. */
const PERMITIDOS = new Set([
  'media', // sólo audio: se revisa abajo
  'clipboard-read', // botón "Pegar" de Descargar
  'clipboard-sanitized-write',
  'fullscreen'
])

function esPropia(wc: WebContents | null, url: string): boolean {
  // En producción las ventanas se cargan desde file://; en desarrollo, desde
  // el servidor de Vite en localhost.
  return url.startsWith('file://') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url) || !wc
}

export function instalarPermisos(youtubePartition: string): void {
  session.defaultSession.setPermissionRequestHandler((wc, permiso, responder, detalles) => {
    const url = detalles.requestingUrl ?? wc?.getURL() ?? ''
    if (!esPropia(wc, url) || !PERMITIDOS.has(permiso)) {
      log.warn(`permiso "${permiso}" denegado a ${url}`)
      return responder(false)
    }
    if (permiso === 'media') {
      const tipos = (detalles as { mediaTypes?: string[] }).mediaTypes ?? []
      // Sólo audio. Un pedido de video no tiene razón de existir en esta app.
      if (tipos.some((t) => t !== 'audio')) {
        log.warn('pedido de cámara denegado')
        return responder(false)
      }
    }
    responder(true)
  })

  session.fromPartition(youtubePartition).setPermissionRequestHandler((_wc, permiso, responder) => {
    log.info(`ventana de YouTube pidió "${permiso}": denegado`)
    responder(false)
  })
}
