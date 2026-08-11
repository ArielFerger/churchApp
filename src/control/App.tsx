import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import { MonitorPlay } from 'lucide-react'
import Live from './pages/Live'
import Songs from './pages/Songs'
import Bible from './pages/Bible'
import Media from './pages/Media'
import Audio from './pages/Audio'
import Escucha from './pages/Escucha'
import Downloads from './pages/Downloads'
import Settings from './pages/Settings'
import BarraAlAire from './components/BarraAlAire'
import IndicadorEscucha from './components/IndicadorEscucha'
import QuickActions from './components/QuickActions'
import MiniPlayer from './components/audio/MiniPlayer'
import { useProjectionBridge } from './hooks/useProjectionBridge'
import { useAudioPlayer } from './audio/useAudioPlayer'
import { detenerEscucha, iniciarEscucha } from './audio/escuchaEnVivo'
import { entradasDeAudio } from './audio/capturaVoz'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useEscuchaStore } from '@/shared/store/escuchaStore'
import { APP_NAME } from '@/shared/constants'

// La Escucha todavía no tiene sección propia (fase 4). Hasta entonces, la única
// forma de ejercitarla sobre la app corriendo es desde el depurador, que es
// como se verifica todo en este proyecto.
//
// Se mira MODE y no DEV a propósito: `electron-vite build` deja DEV en false
// aunque se le pase `--mode development`, así que con DEV este bloque no
// existía en el único build que se puede manejar por CDP. En el build de
// verdad —modo production— sigue sin existir, que es lo que importa.
if (import.meta.env.MODE !== 'production') {
  Object.assign(window, {
    __escucha: {
      iniciar: iniciarEscucha,
      detener: detenerEscucha,
      entradasDeAudio,
      store: useEscuchaStore
    }
  })
}

const navItems = [
  { to: '/', label: 'En Vivo' },
  { to: '/songs', label: 'Canciones' },
  { to: '/bible', label: 'Biblia' },
  { to: '/media', label: 'Media' },
  { to: '/audio', label: 'Audio' },
  { to: '/escucha', label: 'Escucha' },
  { to: '/downloads', label: 'Descargar' },
  { to: '/settings', label: 'Ajustes' }
]

/**
 * Las secciones van envueltas en una red de contención atada a la ruta: si una
 * revienta, el resto de la app sigue usable y cambiar de sección la recupera
 * sola. El boundary va acá adentro y no alrededor de todo para que la barra de
 * navegación y el reproductor sobrevivan al error.
 */
function SeccionesConRed() {
  const { pathname } = useLocation()
  const nombre = navItems.find((i) => i.to === pathname)?.label

  return (
    <ErrorBoundary resetKey={pathname} scope={nombre ? `la sección ${nombre}` : undefined}>
      <Routes>
        <Route path="/" element={<Live />} />
        <Route path="/songs" element={<Songs />} />
        <Route path="/bible" element={<Bible />} />
        <Route path="/media" element={<Media />} />
        <Route path="/audio" element={<Audio />} />
        <Route path="/escucha" element={<Escucha />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default function App() {
  useProjectionBridge()
  useAudioPlayer()
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <HashRouter>
      <div className="flex h-screen flex-col bg-cabina-negro font-sans text-cabina-tinta">
        <header className="flex shrink-0 items-center gap-4 border-b border-cabina-linea bg-cabina-panel px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-rotulo text-cabina-tinta-tenue">
            {APP_NAME}
          </span>
          <nav className="flex gap-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  // La sección activa se marca con una línea abajo, no con un
                  // bloque de color: el relleno fuerte queda reservado para
                  // los estados (al aire / preparado).
                  `rounded-t border-b-2 px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'border-listo bg-listo-suave font-semibold text-listo'
                      : 'border-transparent text-cabina-tinta-dim hover:bg-cabina-alto hover:text-cabina-tinta'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* Que la app esté tomando audio tiene que verse desde cualquier
                sección, no sólo desde la de Escucha. */}
            <IndicadorEscucha />
            <QuickActions />
            <span className="h-5 w-px bg-cabina-linea" />
            <button
              type="button"
              onClick={() => void window.electronAPI?.showProjection()}
              onDoubleClick={() => void window.electronAPI?.showProjection({ reload: true })}
              className="inline-flex items-center gap-1.5 rounded-md bg-cabina-alto px-2.5 py-1.5 text-xs text-cabina-tinta transition-colors hover:bg-cabina-linea-fuerte"
              title="Mostrar / recuperar la ventana de proyección (doble clic: recargar)"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              Proyección
            </button>
            {/* La pastilla LIVE que iba acá quedó de más: la barra de abajo
                dice lo mismo y además dice QUÉ está al aire. */}
          </div>
        </header>

        <BarraAlAire />

        <main className="flex-1 overflow-hidden">
          <SeccionesConRed />
        </main>

        <MiniPlayer />
      </div>
    </HashRouter>
  )
}
