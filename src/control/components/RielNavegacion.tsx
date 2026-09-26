import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Download,
  Ear,
  Headphones,
  Images,
  Music2,
  Radio,
  Settings,
  type LucideIcon
} from 'lucide-react'
import { useEscuchaStore, pendientesDeProyectar } from '@/shared/store/escuchaStore'
import { descargasActivas, useDownloadsStore } from '@/shared/store/downloadsStore'
import { resorte } from './ui/movimiento'

export interface Seccion {
  to: string
  label: string
  icono: LucideIcon
}

/** Las secciones, en el orden de los atajos Ctrl+1 … Ctrl+8. */
export const SECCIONES: Seccion[] = [
  { to: '/', label: 'En Vivo', icono: Radio },
  { to: '/songs', label: 'Canciones', icono: Music2 },
  { to: '/bible', label: 'Biblia', icono: BookOpen },
  { to: '/media', label: 'Media', icono: Images },
  { to: '/audio', label: 'Audio', icono: Headphones },
  { to: '/escucha', label: 'Escucha', icono: Ear },
  { to: '/downloads', label: 'Descargar', icono: Download },
  { to: '/settings', label: 'Ajustes', icono: Settings }
]

/**
 * La navegación, como riel vertical a la izquierda.
 *
 * Antes eran ocho pestañas en la cabecera, al lado de las acciones rápidas: por
 * debajo de ~1500 px de ancho no entraban y se pisaban (la ventana mínima era
 * de 1024). En vertical entran a cualquier ancho, y la cabecera queda para lo
 * que importa en vivo: qué está al aire y cómo cortarlo.
 *
 * La sección activa se marca con una pastilla ámbar que se desliza (ámbar =
 * "seleccionado" en todo el sistema; el rojo queda para lo que está al aire).
 */
export default function RielNavegacion() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const citasNuevas = useEscuchaStore((s) => pendientesDeProyectar(s))
  const escuchando = useEscuchaStore((s) => s.estado === 'escuchando')
  const bajando = useDownloadsStore((s) => descargasActivas(s.jobs))

  // Ctrl+1 … Ctrl+8 cambia de sección desde cualquier lado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > SECCIONES.length) return
      e.preventDefault()
      navigate(SECCIONES[n - 1].to)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [navigate])

  const activa = (to: string): boolean => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  return (
    <nav
      aria-label="Secciones"
      className="flex w-[76px] shrink-0 flex-col items-stretch gap-0.5 overflow-y-auto border-r border-cabina-linea bg-cabina-panel px-1.5 py-2"
    >
      {SECCIONES.map((s, i) => {
        const Icono = s.icono
        const esActiva = activa(s.to)
        const contador =
          s.to === '/escucha' ? citasNuevas : s.to === '/downloads' ? bajando : 0
        return (
          <NavLink
            key={s.to}
            to={s.to}
            end={s.to === '/'}
            title={`${s.label} (Ctrl+${i + 1})`}
            aria-keyshortcuts={`Control+${i + 1}`}
            className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors ${
              esActiva ? 'text-listo' : 'text-cabina-tinta-dim hover:bg-cabina-alto hover:text-cabina-tinta'
            } ${s.to === '/settings' ? 'mt-auto' : ''}`}
          >
            {esActiva && (
              <motion.span
                layoutId="riel-activo"
                transition={resorte}
                className="absolute inset-0 rounded-lg border border-listo-borde bg-listo-suave"
                aria-hidden
              />
            )}
            <span className="relative">
              <Icono className="h-5 w-5" aria-hidden strokeWidth={esActiva ? 2.2 : 1.8} />
              {s.to === '/escucha' && escuchando && (
                <span
                  className="absolute -left-1 -top-1 h-2 w-2 animate-latido rounded-full bg-listo"
                  aria-hidden
                />
              )}
              {contador > 0 && (
                <motion.span
                  key={contador}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={resorte}
                  className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-listo px-1 font-mono text-[10px] font-bold text-cabina-negro"
                  aria-label={
                    s.to === '/escucha'
                      ? `${contador} ${contador === 1 ? 'cita nueva' : 'citas nuevas'}`
                      : `${contador} ${contador === 1 ? 'descarga en curso' : 'descargas en curso'}`
                  }
                >
                  {contador > 9 ? '9+' : contador}
                </motion.span>
              )}
            </span>
            <span className="relative text-[10.5px] font-medium leading-tight">{s.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
