import { motion } from 'framer-motion'

/**
 * Barra de progreso accesible. Con `valor` null es indeterminada (se sabe que
 * avanza, no cuánto): una franja que barre, en vez de un 30 % fijo que parece
 * trabado.
 */
export default function BarraProgreso({
  valor,
  etiqueta,
  tono = 'listo',
  className = ''
}: {
  /** 0..1, o null si no se sabe. */
  valor: number | null
  /** Qué se está midiendo, para el lector de pantalla. */
  etiqueta: string
  tono?: 'listo' | 'ok' | 'neutro'
  className?: string
}) {
  const color = tono === 'ok' ? 'bg-ok' : tono === 'neutro' ? 'bg-cabina-tinta-dim' : 'bg-listo'
  const pct = valor === null ? null : Math.round(Math.max(0, Math.min(1, valor)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      aria-valuetext={pct === null ? 'En curso' : `${pct} %`}
      className={`relative h-1.5 overflow-hidden rounded-full bg-cabina-alto ${className}`}
    >
      {pct === null ? (
        <div className={`absolute inset-y-0 w-2/5 rounded-full ${color} animate-indeterminado`} />
      ) : (
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      )}
    </div>
  )
}
