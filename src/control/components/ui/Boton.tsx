import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * El botón del sistema "cabina". Las variantes no son gustos: cada una dice
 * algo sobre lo que hace el botón.
 *
 * - `primario`  ámbar (`listo`): la acción principal de la pantalla.
 * - `neutro`    gris: acciones comunes.
 * - `fantasma`  sin fondo: acciones secundarias, discretas.
 * - `aire`      rojo: manda algo A LA PANTALLA de la congregación. Es el único
 *               botón que puede ser rojo, porque es el único que pone algo al
 *               aire.
 * - `peligro`   salmón (`falla`): borra o descarta algo que no vuelve.
 */
export type VarianteBoton = 'primario' | 'neutro' | 'fantasma' | 'aire' | 'peligro'
export type TamanoBoton = 'sm' | 'md' | 'lg'

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-listo text-cabina-negro hover:brightness-110 font-semibold',
  neutro: 'bg-cabina-alto text-cabina-tinta hover:bg-slate-700 border border-cabina-linea',
  fantasma: 'text-cabina-tinta-dim hover:bg-cabina-alto hover:text-cabina-tinta',
  aire: 'bg-cabina-alto text-cabina-tinta border border-aire-borde hover:bg-aire hover:text-white',
  peligro: 'text-cabina-tinta-dim hover:bg-falla-suave hover:text-falla'
}

const TAMANOS: Record<TamanoBoton, string> = {
  sm: 'gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
  md: 'gap-2 rounded-md px-3.5 py-2 text-sm',
  lg: 'gap-2.5 rounded-lg px-5 py-2.5 text-base'
}

/** Botones de sólo ícono: cuadrados, con el área cliqueable mínima de 32 px. */
const TAMANOS_ICONO: Record<TamanoBoton, string> = {
  sm: 'rounded-md p-1.5',
  md: 'rounded-md p-2',
  lg: 'rounded-lg p-2.5'
}

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamano?: TamanoBoton
  icono?: ReactNode
  /** Muestra un indicador de carga y deshabilita el botón. */
  cargando?: boolean
  /**
   * Botón de sólo ícono. Exige `aria-label`: un botón sin texto es invisible
   * para un lector de pantalla (antes había decenas así, con sólo `title`).
   */
  soloIcono?: boolean
}

const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  {
    variante = 'neutro',
    tamano = 'md',
    icono,
    cargando = false,
    soloIcono = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...resto
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background-color,color,filter,border-color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
        VARIANTES[variante]
      } ${soloIcono ? TAMANOS_ICONO[tamano] : TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icono}
      {children}
    </button>
  )
})

export default Boton
