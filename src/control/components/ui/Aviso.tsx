import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { fundido } from './movimiento'

/**
 * Un mensaje en línea (no un toast): algo que el operador tiene que ver y que
 * se queda hasta que la situación cambia.
 *
 * `falla` usa `role="alert"` para que un lector de pantalla lo anuncie en el
 * momento; los demás, `status` (se anuncian sin interrumpir).
 */
export type TipoAviso = 'info' | 'atencion' | 'ok' | 'falla'

const ESTILOS: Record<TipoAviso, { caja: string; icono: ReactNode }> = {
  info: {
    caja: 'border-cabina-linea-fuerte bg-cabina-alto text-cabina-tinta-dim',
    icono: <Info className="h-4 w-4 shrink-0 text-cabina-tinta-dim" aria-hidden />
  },
  atencion: {
    caja: 'border-listo-borde bg-listo-suave text-cabina-tinta',
    icono: <AlertTriangle className="h-4 w-4 shrink-0 text-listo" aria-hidden />
  },
  ok: {
    caja: 'border-ok-borde bg-ok-suave text-cabina-tinta',
    icono: <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-hidden />
  },
  falla: {
    caja: 'border-falla-borde bg-falla-suave text-cabina-tinta',
    icono: <XCircle className="h-4 w-4 shrink-0 text-falla" aria-hidden />
  }
}

export default function Aviso({
  tipo = 'info',
  titulo,
  children,
  acciones,
  className = ''
}: {
  tipo?: TipoAviso
  titulo?: ReactNode
  children?: ReactNode
  acciones?: ReactNode
  className?: string
}) {
  const e = ESTILOS[tipo]
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fundido}
      role={tipo === 'falla' ? 'alert' : 'status'}
      className={`rounded-lg border px-3.5 py-3 text-sm ${e.caja} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{e.icono}</span>
        <div className="min-w-0 flex-1">
          {titulo && <p className="font-semibold text-cabina-tinta">{titulo}</p>}
          {children && (
            <div className={`leading-relaxed ${titulo ? 'mt-1 text-cabina-tinta-dim' : ''}`}>
              {children}
            </div>
          )}
          {acciones && <div className="mt-2.5 flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
      </div>
    </motion.div>
  )
}
