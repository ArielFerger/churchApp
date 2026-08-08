import { useMemo } from 'react'
import { useLiveStore } from '@/shared/store/liveStore'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { describirEnElAire, recortar } from '@/shared/utils/enElAire'

/**
 * La franja AL AIRE: lo único que siempre es cierto y siempre está a la vista.
 *
 * Es el elemento firma de la interfaz. Ocupa espacio vertical en todas las
 * secciones, a propósito: la pregunta que más se hace quien opera es "¿qué
 * estoy mostrando ahora?", y antes la app sólo respondía que había *algo* al
 * aire, con una pastilla en un rincón. Para saber qué, había que darse vuelta
 * y mirar el proyector.
 *
 * El rojo `aire` está reservado para esta barra y para lo que esté saliendo:
 * si algo se ve rojo, la congregación lo está viendo.
 */
export default function BarraAlAire() {
  const lastCommand = useLiveStore((s) => s.lastCommand)
  const isBlackout = useLiveStore((s) => s.isBlackout)
  const media = useLibraryStore((s) => s.media)

  const { clase, detalle } = useMemo(() => {
    const base = describirEnElAire(lastCommand, isBlackout)
    // El comando de media trae un id: el nombre del archivo lo sabe la
    // biblioteca, no el comando.
    if (base.clase === 'IMAGEN' && lastCommand?.type === 'showMedia') {
      const item = media.find((m) => m.id === lastCommand.mediaId)
      return {
        clase: item?.type === 'video' ? ('VIDEO' as const) : base.clase,
        detalle: item?.fileName ?? 'Archivo de media'
      }
    }
    return base
  }, [lastCommand, isBlackout, media])

  const alAire = clase !== null

  return (
    <div
      className={`flex shrink-0 items-center gap-3 border-b px-4 py-2 transition-colors ${
        alAire
          ? 'border-aire-borde bg-aire-suave'
          : 'border-cabina-linea bg-cabina-panel'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Qué se está proyectando"
    >
      <span
        className={`inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-rotulo ${
          alAire ? 'text-aire' : 'text-cabina-tinta-tenue'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            alAire ? 'animate-pulse bg-aire' : 'bg-cabina-tinta-tenue'
          }`}
        />
        {alAire ? 'AL AIRE' : 'SIN SEÑAL'}
      </span>

      {alAire && (
        <>
          <span className="h-4 w-px shrink-0 bg-aire-borde" />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-rotulo text-aire/70">
            {clase}
          </span>
        </>
      )}

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          alAire ? 'text-cabina-tinta' : 'text-cabina-tinta-tenue'
        }`}
      >
        {alAire
          ? detalle
            ? recortar(detalle)
            : '—'
          : 'La pantalla de proyección está vacía'}
      </span>
    </div>
  )
}
