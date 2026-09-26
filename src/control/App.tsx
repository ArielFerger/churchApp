import { useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import { Toaster } from 'sonner'
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
import RielNavegacion, { SECCIONES } from './components/RielNavegacion'
import MiniPlayer from './components/audio/MiniPlayer'
import { ProveedorMenuContextual } from './components/ui/MenuContextual'
import { pagina } from './components/ui/movimiento'
import { useProjectionBridge } from './hooks/useProjectionBridge'
import { useAvisosGlobales } from './hooks/useAvisosGlobales'
import { useAudioPlayer } from './audio/useAudioPlayer'
import { detenerEscucha, iniciarEscucha } from './audio/escuchaEnVivo'
import { entradasDeAudio } from './audio/capturaVoz'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useEscuchaStore } from '@/shared/store/escuchaStore'
import { APP_NAME } from '@/shared/constants'

// Gancho para manejar la Escucha desde el depurador (CDP), que es como se
// verifica todo en este proyecto sin depender de los textos de los botones.
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

/**
 * Las secciones van envueltas en una red de contención atada a la ruta: si una
 * revienta, el resto de la app sigue usable y cambiar de sección la recupera
 * sola. El boundary va acá adentro y no alrededor de todo para que la barra de
 * navegación y el reproductor sobrevivan al error.
 */
function SeccionesConRed() {
  const { pathname } = useLocation()
  const nombre = SECCIONES.find((i) => i.to === pathname)?.label

  return (
    <ErrorBoundary resetKey={pathname} scope={nombre ? `la sección ${nombre}` : undefined}>
      {/* Un fundido corto al cambiar de sección: ayuda a notar que cambió sin
          hacer esperar. Sin animación de salida a propósito — la sección nueva
          aparece ya, no después de que se vaya la anterior. */}
      <motion.div
        key={pathname}
        variants={pagina}
        initial="inicial"
        animate="visible"
        className="h-full"
      >
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
      </motion.div>
    </ErrorBoundary>
  )
}

/** Todo lo que necesita estar dentro del router (navegar desde un aviso). */
function Cabina() {
  useAvisosGlobales()

  return (
    <ProveedorMenuContextual>
    <div className="flex h-screen flex-col bg-cabina-negro font-sans text-cabina-tinta">
      <a href="#contenido" className="saltar-al-contenido rounded-md bg-listo px-3 py-2 text-sm font-semibold text-cabina-negro">
        Saltar al contenido
      </a>

      <header className="flex shrink-0 items-center gap-3 border-b border-cabina-linea bg-cabina-panel px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-rotulo text-cabina-tinta-tenue">
          <img src="./icon.svg" alt="" className="h-5 w-5" />
          <span className="hidden sm:inline">{APP_NAME}</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Que la app esté tomando audio tiene que verse desde cualquier
              sección, no sólo desde la de Escucha. */}
          <IndicadorEscucha />
          <QuickActions />
          <span className="h-5 w-px bg-cabina-linea" aria-hidden />
          <button
            type="button"
            onClick={() => void window.electronAPI?.showProjection()}
            onDoubleClick={() => void window.electronAPI?.showProjection({ reload: true })}
            className="inline-flex items-center gap-1.5 rounded-md border border-cabina-linea bg-cabina-alto px-2.5 py-1.5 text-xs text-cabina-tinta transition-colors hover:bg-slate-700"
            title="Mostrar / recuperar la ventana de proyección (doble clic: recargar)"
            aria-label="Mostrar la ventana de proyección"
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">Proyección</span>
          </button>
        </div>
      </header>

      <BarraAlAire />

      <div className="flex min-h-0 flex-1">
        <RielNavegacion />
        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 overflow-hidden outline-none">
          <SeccionesConRed />
        </main>
      </div>

      <MiniPlayer />

      <Toaster
        theme="dark"
        position="bottom-right"
        // Arriba del reproductor de música, que ocupa el borde de abajo.
        offset={{ bottom: 84, right: 16 }}
        closeButton
        toastOptions={{
          classNames: {
            toast:
              '!bg-cabina-alto !border !border-cabina-linea-fuerte !text-cabina-tinta !font-sans !shadow-2xl',
            description: '!text-cabina-tinta-dim',
            actionButton: '!bg-listo !text-cabina-negro !font-semibold',
            closeButton: '!bg-cabina-alto !border-cabina-linea-fuerte !text-cabina-tinta-dim'
          }
        }}
      />
    </div>
    </ProveedorMenuContextual>
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
    // `reducedMotion="user"`: si el sistema pide reducir movimiento, framer
    // deja sólo los fundidos de opacidad. Vale sólo para esta ventana; la
    // proyección tiene sus propias transiciones.
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <Cabina />
      </HashRouter>
    </MotionConfig>
  )
}
