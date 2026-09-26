import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ear } from 'lucide-react'
import { pendientesDeProyectar, useEscuchaStore } from '@/shared/store/escuchaStore'
import { fundido } from './ui/movimiento'

/**
 * Avisa en la cabecera que el micrófono está tomando, se esté en la sección
 * que se esté. Que la app escuche la reunión sin que se vea por ningún lado
 * sería lo peor que podría hacer este módulo.
 *
 * Es ámbar y no rojo: el rojo está reservado para lo que la congregación está
 * viendo. Escuchar no es estar al aire. Es un enlace: un clic lleva a la
 * sección, y dice cuántas citas esperan.
 */
export default function IndicadorEscucha() {
  const estado = useEscuchaStore((s) => s.estado)
  const hablando = useEscuchaStore((s) => s.hablando)
  const nuevas = useEscuchaStore((s) => pendientesDeProyectar(s))
  const activa = estado === 'escuchando' || estado === 'iniciando'

  return (
    <AnimatePresence>
      {activa && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={fundido}
        >
          <Link
            to="/escucha"
            className="inline-flex items-center gap-1.5 rounded-md border border-listo-borde bg-listo-suave px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-rotulo text-listo transition-colors hover:bg-listo/20"
            role="status"
            aria-live="polite"
            title="La app está tomando audio de la entrada elegida. Clic para ir a la Escucha."
          >
            <Ear className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{estado === 'iniciando' ? 'Abriendo…' : 'Escuchando'}</span>
            {/* Un punto que late cuando entra voz: sin esto, "Escuchando" también
                se ve cuando entra silencio y no hay forma de notar que se cayó
                la señal de la consola. */}
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${hablando ? 'bg-listo' : 'bg-cabina-linea-fuerte'}`}
            />
            {nuevas > 0 && (
              <span className="rounded bg-listo px-1 text-cabina-negro">
                {nuevas}
                <span className="sr-only"> {nuevas === 1 ? 'cita nueva' : 'citas nuevas'}</span>
              </span>
            )}
          </Link>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
