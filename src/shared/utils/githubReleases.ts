/**
 * Elegir de qué release de GitHub bajar una herramienta.
 *
 * `releases/latest/download/<asset>` es cómodo, pero sólo funciona si la
 * release marcada como "latest" trae ese archivo. whisper.cpp dejó de hacerlo
 * (la 1.9.4 salió sin binarios y los paquetes van en releases `bNNNN`), y la
 * instalación desde la app quedó dando 404 sin que nada en el código cambiara.
 * Por eso se consulta la lista de releases y se toma la más nueva que tenga el
 * archivo pedido.
 *
 * Es puro: recibe el JSON de la API y devuelve la URL. El servicio hace el
 * pedido; esto se prueba con JSON armado a mano.
 */

interface AssetApi {
  name?: unknown
  browser_download_url?: unknown
}
interface ReleaseApi {
  draft?: unknown
  assets?: unknown
}

/**
 * La URL de descarga del asset `nombre` en la release más nueva que lo tenga.
 * La API ya devuelve las releases de la más nueva a la más vieja. Los
 * borradores se saltean: no son públicos y la URL no sirve.
 */
export function elegirAssetDeRelease(releases: unknown, nombre: string): string | null {
  if (!Array.isArray(releases)) return null
  for (const r of releases as ReleaseApi[]) {
    if (!r || r.draft === true || !Array.isArray(r.assets)) continue
    for (const a of r.assets as AssetApi[]) {
      if (a?.name === nombre && typeof a.browser_download_url === 'string') {
        return a.browser_download_url
      }
    }
  }
  return null
}

/** Endpoint de la API con las últimas releases de un repo. */
export function urlListaReleases(repo: string, cantidad = 15): string {
  return `https://api.github.com/repos/${repo}/releases?per_page=${cantidad}`
}

/** El atajo clásico, para cuando la API no contesta (límite de pedidos, red). */
export function urlUltimaRelease(repo: string, nombre: string): string {
  return `https://github.com/${repo}/releases/latest/download/${nombre}`
}

/** Clave de plataforma que usan las tablas de assets: `win32-x64`, `linux-arm64`. */
export function clavePlataforma(platform: string, arch: string): string {
  return `${platform}-${arch}`
}
