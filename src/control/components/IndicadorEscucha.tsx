import { Ear } from 'lucide-react'
import { useEscuchaStore } from '@/shared/store/escuchaStore'

/**
 * Avisa en la cabecera que el micrófono está tomando, se esté en la sección
 * que se esté. Que la app escuche la reunión sin que se vea por ningún lado
 * sería lo peor que podría hacer este módulo.
 *
 * Es ámbar y no rojo: el rojo está reservado para lo que la congregación está
 * viendo. Escuchar no es estar al aire.
 */
export default function IndicadorEscucha() {
  const estado = useEscuchaStore((s) => s.estado)
  const nivel = useEscuchaStore((s) => s.nivel)
  if (estado !== 'escuchando' && estado !== 'iniciando') return null

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-listo-borde bg-listo-suave px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-rotulo text-listo"
      role="status"
      aria-live="polite"
      title="La app está tomando audio de la entrada elegida"
    >
      <Ear className="h-3.5 w-3.5" />
      {estado === 'iniciando' ? 'Abriendo…' : 'Escuchando'}
      {/* Tres puntitos que siguen el nivel: sin esto, "Escuchando" también se
          ve cuando entra silencio y no hay forma de notar que se cayó la
          señal de la consola. */}
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0.02, 0.06, 0.12].map((umbral) => (
          <span
            key={umbral}
            className={`h-1.5 w-1.5 rounded-full ${
              nivel >= umbral ? 'bg-listo' : 'bg-cabina-linea-fuerte'
            }`}
          />
        ))}
      </span>
    </span>
  )
}
