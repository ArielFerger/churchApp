import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { pagina } from './movimiento'

/**
 * Piezas de estructura del sistema "cabina": el encabezado de cada sección,
 * los paneles y las micro-etiquetas en mayúscula.
 */

export function EncabezadoPagina({
  icono,
  titulo,
  children,
  acciones
}: {
  icono: ReactNode
  titulo: string
  /** Una o dos líneas que dicen para qué sirve la sección. */
  children?: ReactNode
  /** Controles a la derecha del título (se van abajo en pantallas angostas). */
  acciones?: ReactNode
}) {
  return (
    <motion.header
      variants={pagina}
      initial="inicial"
      animate="visible"
      className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-cabina-linea pb-4"
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight text-cabina-tinta">
          <span className="text-listo" aria-hidden>
            {icono}
          </span>
          {titulo}
        </h1>
        {children && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-cabina-tinta-dim">{children}</p>
        )}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </motion.header>
  )
}

export function Panel({
  children,
  className = '',
  as: Etiqueta = 'section',
  ...resto
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'aside'
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <Etiqueta
      className={`rounded-xl border border-cabina-linea bg-cabina-panel p-4 ${className}`}
      {...resto}
    >
      {children}
    </Etiqueta>
  )
}

/** Micro-etiqueta en mayúscula, como las de una consola física. */
export function Rotulo({
  children,
  id,
  className = ''
}: {
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <h2
      id={id}
      className={`font-mono text-[11px] font-medium uppercase tracking-rotulo text-cabina-tinta-tenue ${className}`}
    >
      {children}
    </h2>
  )
}

/** Tecla, para los atajos que se muestran en pantalla. */
export function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-cabina-linea-fuerte bg-cabina-alto px-1.5 py-0.5 font-mono text-[10px] text-cabina-tinta-dim">
      {children}
    </kbd>
  )
}
