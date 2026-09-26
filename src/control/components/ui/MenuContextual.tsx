import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight } from 'lucide-react'
import { useLocation } from 'react-router-dom'

/**
 * Menú de clic derecho del sistema "cabina".
 *
 * Uno solo para toda la ventana: cada pantalla arma sus opciones con
 * `useMenuContextual()` y lo abre desde `onContextMenu`. Lo mismo que el resto
 * de la interfaz, el rojo marca lo que manda algo a la pantalla de la
 * congregación y el salmón lo que borra.
 *
 * Se maneja con teclado (flechas, Enter, → para abrir un submenú, ← para
 * volver, Tab para salir) y se abre también con la tecla de menú o Shift+F10.
 * A propósito NO se cierra con Esc: en esta app Esc es la parada de pánico,
 * siempre, y nadie puede depender de otra cosa en el medio.
 */

export interface ItemMenu {
  etiqueta: string
  icono?: ReactNode
  /** Texto a la derecha: un atajo, un contador. */
  detalle?: string
  onSelect?: () => void
  deshabilitado?: boolean
  /** `aire`: pone algo en la pantalla. `peligro`: borra o descarta. */
  variante?: 'normal' | 'aire' | 'peligro'
  /** Para opciones que se prenden y apagan, o para elegir una entre varias. */
  marcado?: boolean
  submenu?: EntradaMenu[]
}

export type EntradaMenu = ItemMenu | 'separador' | { titulo: string } | false | null | undefined

type Abrir = (evento: { clientX: number; clientY: number; currentTarget?: EventTarget | null; preventDefault: () => void }, entradas: EntradaMenu[]) => void

const Contexto = createContext<Abrir>(() => {})

/** Devuelve la función que abre el menú. Se usa en `onContextMenu`. */
export function useMenuContextual(): Abrir {
  return useContext(Contexto)
}

function esItem(e: EntradaMenu): e is ItemMenu {
  return Boolean(e) && typeof e === 'object' && 'etiqueta' in (e as object)
}

interface Estado {
  x: number
  y: number
  entradas: EntradaMenu[]
}

export function ProveedorMenuContextual({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const volverFoco = useRef<HTMLElement | null>(null)
  const { pathname } = useLocation()

  const abrir = useCallback<Abrir>((evento, entradas) => {
    evento.preventDefault()
    const utiles = entradas.filter(Boolean)
    if (utiles.length === 0) return
    let { clientX: x, clientY: y } = evento
    // Abierto con el teclado (tecla de menú, Shift+F10): no hay posición de
    // mouse, se abre sobre el elemento.
    const el = evento.currentTarget instanceof HTMLElement ? evento.currentTarget : null
    if (x === 0 && y === 0 && el) {
      const r = el.getBoundingClientRect()
      x = r.left + Math.min(24, r.width / 2)
      y = r.top + Math.min(24, r.height / 2)
    }
    volverFoco.current = el ?? (document.activeElement as HTMLElement | null)
    setEstado({ x, y, entradas: utiles })
  }, [])

  const cerrar = useCallback((devolverFoco = true) => {
    setEstado(null)
    if (devolverFoco) volverFoco.current?.focus?.()
  }, [])

  // Cambiar de sección cierra el menú.
  useEffect(() => {
    setEstado(null)
  }, [pathname])

  return (
    <Contexto.Provider value={abrir}>
      {children}
      {createPortal(
        <AnimatePresence>
          {estado && (
            <Capa key={`${estado.x}-${estado.y}`} estado={estado} onCerrar={cerrar} />
          )}
        </AnimatePresence>,
        document.body
      )}
    </Contexto.Provider>
  )
}

/** Fondo invisible que cierra al hacer clic afuera, más el menú en sí. */
function Capa({ estado, onCerrar }: { estado: Estado; onCerrar: (devolverFoco?: boolean) => void }) {
  useEffect(() => {
    const cerrarSinFoco = (): void => onCerrar(false)
    window.addEventListener('blur', cerrarSinFoco)
    window.addEventListener('resize', cerrarSinFoco)
    return () => {
      window.removeEventListener('blur', cerrarSinFoco)
      window.removeEventListener('resize', cerrarSinFoco)
    }
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-[90]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar(false)
      }}
      onContextMenu={(e) => {
        // Clic derecho afuera: cierra (y deja que el siguiente abra otro).
        e.preventDefault()
        if (e.target === e.currentTarget) onCerrar(false)
      }}
      onWheel={() => onCerrar(false)}
    >
      <Lista entradas={estado.entradas} x={estado.x} y={estado.y} onCerrar={onCerrar} raiz />
    </div>
  )
}

function Lista({
  entradas,
  x,
  y,
  onCerrar,
  raiz = false,
  xIzquierda,
  onVolver
}: {
  entradas: EntradaMenu[]
  x: number
  y: number
  onCerrar: (devolverFoco?: boolean) => void
  raiz?: boolean
  /** Submenú: dónde termina a la izquierda de su opción, si no entra a la derecha. */
  xIzquierda?: number
  /** Submenú: ← vuelve al menú de arriba. */
  onVolver?: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x, y })
  const [abierto, setAbierto] = useState<number | null>(null)

  // No salirse de la ventana: si no entra a la derecha o abajo, se abre para
  // el otro lado.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margen = 8
    let nx = x
    let ny = y
    if (nx + r.width > window.innerWidth - margen) {
      nx = raiz ? x - r.width : (xIzquierda ?? x) - r.width
    }
    if (nx < margen) nx = margen
    if (ny + r.height > window.innerHeight - margen) ny = Math.max(margen, window.innerHeight - r.height - margen)
    setPos({ x: nx, y: ny })
  }, [x, y, raiz, xIzquierda])

  // Foco en la primera opción habilitada: así el teclado funciona de una.
  useEffect(() => {
    const primero = ref.current?.querySelector<HTMLButtonElement>('button[role^="menuitem"]:not([disabled])')
    primero?.focus()
  }, [])

  const botones = (): HTMLButtonElement[] =>
    Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button[role^="menuitem"]:not([disabled])') ?? [])

  const alTeclear = (e: React.KeyboardEvent): void => {
    const lista = botones()
    const i = lista.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      lista[(i + 1) % lista.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      lista[(i - 1 + lista.length) % lista.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      lista[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      lista[lista.length - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && onVolver) {
      e.preventDefault()
      e.stopPropagation()
      onVolver()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onCerrar()
    }
  }

  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-orientation="vertical"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.08 } }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      style={{ left: pos.x, top: pos.y, transformOrigin: 'top left' }}
      onKeyDown={alTeclear}
      className="fixed z-[91] min-w-[220px] max-w-[320px] rounded-xl border border-cabina-linea-fuerte bg-cabina-alto p-1 shadow-2xl shadow-black/60"
    >
      {entradas.map((e, i) => {
        if (!e) return null
        if (e === 'separador') return <div key={i} role="separator" className="my-1 h-px bg-cabina-linea" />
        if (!esItem(e)) {
          return (
            <div
              key={i}
              role="presentation"
              className="truncate px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-rotulo text-cabina-tinta-tenue"
            >
              {e.titulo}
            </div>
          )
        }
        const tieneSub = Boolean(e.submenu?.length)
        const color =
          e.variante === 'aire'
            ? 'text-cabina-tinta hover:bg-aire hover:text-white focus:bg-aire focus:text-white'
            : e.variante === 'peligro'
              ? 'text-falla hover:bg-falla-suave focus:bg-falla-suave'
              : 'text-cabina-tinta hover:bg-slate-700 focus:bg-slate-700'
        return (
          <button
            key={i}
            type="button"
            role={e.marcado === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={e.marcado === undefined ? undefined : e.marcado}
            aria-haspopup={tieneSub ? 'menu' : undefined}
            aria-expanded={tieneSub ? abierto === i : undefined}
            disabled={e.deshabilitado}
            onMouseEnter={(ev) => {
              if (tieneSub) setAbierto(i)
              else setAbierto(null)
              ;(ev.currentTarget as HTMLButtonElement).focus()
            }}
            onKeyDown={(ev) => {
              if (tieneSub && (ev.key === 'ArrowRight' || ev.key === 'Enter' || ev.key === ' ')) {
                ev.preventDefault()
                ev.stopPropagation()
                setAbierto(i)
              }
            }}
            onClick={() => {
              if (tieneSub) return setAbierto(i)
              onCerrar()
              e.onSelect?.()
            }}
            className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${color}`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              {e.marcado ? <Check className="h-4 w-4 text-listo" /> : e.icono}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.etiqueta}</span>
            {e.detalle && <span className="shrink-0 font-mono text-[10px] opacity-60">{e.detalle}</span>}
            {tieneSub && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />}
            {tieneSub && abierto === i && (
              <Submenu entradas={e.submenu ?? []} onCerrar={onCerrar} onVolver={() => setAbierto(null)} />
            )}
          </button>
        )
      })}
    </motion.div>
  )
}

/** Un submenú, pegado a la derecha de su opción. */
function Submenu({
  entradas,
  onCerrar,
  onVolver
}: {
  entradas: EntradaMenu[]
  onCerrar: (devolverFoco?: boolean) => void
  onVolver: () => void
}) {
  const ancla = useRef<HTMLSpanElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number; izq: number } | null>(null)
  useLayoutEffect(() => {
    const opcion = ancla.current?.parentElement
    if (!opcion) return
    const r = opcion.getBoundingClientRect()
    setPos({ x: r.right + 4, y: r.top - 4, izq: r.left - 4 })
  }, [])
  // El submenú vive en un portal, pero en el árbol de React sigue adentro de
  // su opción: sin cortar la propagación, un Enter en el submenú llegaba a la
  // opción de arriba y cancelaba el clic.
  return (
    <span ref={ancla} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {pos &&
        createPortal(
          <div className="fixed inset-0 z-[92] pointer-events-none">
            <div className="pointer-events-auto">
              <Lista
                entradas={entradas}
                x={pos.x}
                y={pos.y}
                xIzquierda={pos.izq}
                onCerrar={onCerrar}
                onVolver={() => {
                  onVolver()
                  ;(ancla.current?.parentElement as HTMLButtonElement | null)?.focus()
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </span>
  )
}
