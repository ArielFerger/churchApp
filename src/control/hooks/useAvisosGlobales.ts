import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useDownloadsStore } from '@/shared/store/downloadsStore'
import { claveSugerencia, useEscuchaStore } from '@/shared/store/escuchaStore'
import { textoReferencia } from '@/shared/utils/navegacionBiblica'
import type { DownloadJob } from '@/shared/utils/downloads'

/**
 * Avisos que tienen que llegar estés en la sección que estés:
 *
 * - Una descarga terminó o falló (la cola se procesa sola, en segundo plano).
 * - La Escucha oyó una cita nueva y el operador está en otra sección.
 *
 * Son toasts: no bloquean, se van solos, y el lector de pantalla los anuncia.
 * La cita NO se proyecta desde el aviso — sólo lleva a la sección Escucha,
 * donde se ve el texto y se confirma. La regla de la Escucha (nunca proyectar
 * sin que el operador vea qué sale) no tiene excepciones.
 */
export function useAvisosGlobales(): void {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const rutaActual = useRef(pathname)
  rutaActual.current = pathname

  // ── Descargas: suscripción única al proceso principal ──
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const { setJobs, setInstall } = useDownloadsStore.getState()
    void api.getDownloads().then((j) => setJobs(j ?? []))
    return api.onDownloadsUpdated((payload) => {
      if (payload.jobs) avisarCambiosDeDescargas(useDownloadsStore.getState().jobs, payload.jobs)
      if (payload.jobs) setJobs(payload.jobs)
      if (payload.install) setInstall(payload.install)
    })

    function avisarCambiosDeDescargas(antes: DownloadJob[], despues: DownloadJob[]): void {
      const previo = new Map(antes.map((j) => [j.id, j.stage]))
      for (const j of despues) {
        const era = previo.get(j.id)
        if (!era || era === j.stage) continue
        const nombre = j.title ?? j.url
        if (j.stage === 'done') {
          toast.success('Descarga terminada', {
            description: nombre,
            action:
              rutaActual.current === '/downloads'
                ? undefined
                : { label: 'Ver', onClick: () => navigate('/downloads') }
          })
        } else if (j.stage === 'error') {
          toast.error('Una descarga falló', {
            description: j.error ?? nombre,
            action: { label: 'Ver', onClick: () => navigate('/downloads') }
          })
        }
      }
    }
  }, [navigate])

  // ── Escucha: citas nuevas mientras se está en otra sección ──
  useEffect(() => {
    let conocidas = new Set(useEscuchaStore.getState().sugerencias.map(claveSugerencia))
    return useEscuchaStore.subscribe((s) => {
      const actuales = new Set(s.sugerencias.map(claveSugerencia))
      const nuevas = s.sugerencias.filter((r) => !conocidas.has(claveSugerencia(r)))
      conocidas = actuales
      if (rutaActual.current === '/escucha' || nuevas.length === 0) return
      const r = nuevas[nuevas.length - 1]
      toast('Se nombró ' + textoReferencia(r.bookId, r.chapter, r.verse, r.endVerse), {
        description: 'La Escucha la dejó lista para proyectar.',
        action: { label: 'Ir a Escucha', onClick: () => navigate('/escucha') }
      })
    })
  }, [navigate])
}
