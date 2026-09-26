import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLiveStore } from '@/shared/store/liveStore'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { useLiveControlsStore } from '@/shared/store/liveControlsStore'
import { describirEnElAire, recortar } from '@/shared/utils/enElAire'
import { fundido } from './ui/movimiento'

/**
 * La franja AL AIRE: lo único que siempre es cierto y siempre está a la vista.
 *
 * Es el elemento firma de la interfaz. Ocupa espacio vertical en todas las
 * secciones, a propósito: la pregunta que más se hace quien opera es "¿qué
 * estoy mostrando ahora?", y antes la app sólo respondía que había *algo* al
 * aire, con una pastilla en un rincón. Para saber qué, había que darse vuelta
 * y mirar el proyector.
 *
 * El fondo también cuenta: un video en loop o una presentación de imágenes es
 * lo que la congregación ve aunque no haya letra encima. Antes, con un fondo
 * puesto y nada más, la barra decía "SIN SEÑAL — la pantalla está vacía".
 *
 * El rojo `aire` está reservado para esta barra y para lo que esté saliendo:
 * si algo se ve rojo, la congregación lo está viendo.
 */
export default function BarraAlAire() {
  const lastCommand = useLiveStore((s) => s.lastCommand)
  const isBlackout = useLiveStore((s) => s.isBlackout)
  const media = useLibraryStore((s) => s.media)
  const liveMedia = useLibraryStore((s) => s.liveMedia)
  const backgroundId = useLiveControlsStore((s) => s.backgroundId)
  const slideshowActive = useLiveControlsStore((s) => s.slideshowActive)
  const slideshowCount = useLiveControlsStore((s) => s.slideshowIds.length)

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

  /** El fondo que está puesto, si hay uno (y no está tapado por un blackout). */
  const fondo = useMemo(() => {
    if (isBlackout) return null
    if (slideshowActive && slideshowCount > 0) {
      return `Presentación de ${slideshowCount} ${slideshowCount === 1 ? 'imagen' : 'imágenes'}`
    }
    if (!backgroundId) return null
    return [...media, ...liveMedia].find((m) => m.id === backgroundId)?.fileName ?? 'Fondo'
  }, [isBlackout, slideshowActive, slideshowCount, backgroundId, media, liveMedia])

  const alAire = clase !== null || fondo !== null
  const soloFondo = clase === null && fondo !== null

  return (
    <div
      className={`flex shrink-0 items-center gap-3 border-b px-4 py-2 transition-colors duration-300 ${
        alAire ? 'border-aire-borde bg-aire-suave' : 'border-cabina-linea bg-cabina-panel'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Qué se está proyectando"
    >
      <span
        className={`inline-flex shrink-0 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-rotulo ${
          alAire ? 'text-aire' : 'text-cabina-tinta-tenue'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${alAire ? 'animate-pulse bg-aire' : 'bg-cabina-tinta-tenue'}`}
          aria-hidden
        />
        {alAire ? 'AL AIRE' : 'SIN SEÑAL'}
      </span>

      {alAire && (
        <>
          <span className="h-4 w-px shrink-0 bg-aire-borde" aria-hidden />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-rotulo text-aire/70">
            {soloFondo ? 'FONDO' : clase}
          </span>
        </>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${clase}-${detalle}-${soloFondo ? fondo : ''}`}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={fundido}
          className={`min-w-0 flex-1 truncate text-sm ${alAire ? 'text-cabina-tinta' : 'text-cabina-tinta-tenue'}`}
        >
          {soloFondo
            ? recortar(fondo ?? '')
            : alAire
              ? detalle
                ? recortar(detalle)
                : '—'
              : 'La pantalla de proyección está vacía'}
        </motion.span>
      </AnimatePresence>

      {/* Con contenido encima, el fondo se menciona aparte, más chico. */}
      {!soloFondo && fondo && (
        <span
          className="hidden max-w-[35%] shrink-0 truncate rounded border border-aire-borde px-1.5 py-0.5 font-mono text-[10px] text-aire/80 md:inline"
          title={fondo}
        >
          + fondo: {fondo}
        </span>
      )}
    </div>
  )
}
