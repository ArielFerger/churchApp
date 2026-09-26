import { motion } from 'framer-motion'
import { resorte } from './movimiento'

/**
 * Interruptor on/off con `role="switch"`. El nombre accesible sale de
 * `etiqueta` (o de un `<label>` que lo apunte con `aria-labelledby`).
 */
export default function Interruptor({
  activo,
  onCambio,
  etiqueta,
  disabled
}: {
  activo: boolean
  onCambio: (v: boolean) => void
  etiqueta: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:opacity-45 ${
        activo ? 'border-listo bg-listo' : 'border-cabina-linea-fuerte bg-cabina-alto'
      }`}
    >
      <motion.span
        aria-hidden
        className={`absolute left-0.5 h-[18px] w-[18px] rounded-full shadow ${
          activo ? 'bg-cabina-negro' : 'bg-cabina-tinta-dim'
        }`}
        initial={false}
        animate={{ x: activo ? 20 : 0 }}
        transition={resorte}
      />
    </button>
  )
}
