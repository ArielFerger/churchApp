import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { MonitorPlay } from 'lucide-react'
import Live from './pages/Live'
import Songs from './pages/Songs'
import Bible from './pages/Bible'
import Media from './pages/Media'
import Audio from './pages/Audio'
import Settings from './pages/Settings'
import LiveIndicator from './components/LiveIndicator'
import QuickActions from './components/QuickActions'
import MiniPlayer from './components/audio/MiniPlayer'
import { useProjectionBridge } from './hooks/useProjectionBridge'
import { useAudioPlayer } from './audio/useAudioPlayer'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { APP_NAME } from '@/shared/constants'

const navItems = [
  { to: '/', label: 'En Vivo' },
  { to: '/songs', label: 'Canciones' },
  { to: '/bible', label: 'Biblia' },
  { to: '/media', label: 'Media' },
  { to: '/audio', label: 'Audio' },
  { to: '/settings', label: 'Ajustes' }
]

export default function App() {
  useProjectionBridge()
  useAudioPlayer()
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <HashRouter>
      <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
        <header className="flex shrink-0 items-center gap-4 border-b border-slate-700 px-4 py-2">
          <span className="text-sm font-semibold text-slate-400">{APP_NAME}</span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <QuickActions />
            <span className="h-5 w-px bg-slate-700" />
            <button
              type="button"
              onClick={() => void window.electronAPI?.showProjection()}
              onDoubleClick={() => void window.electronAPI?.showProjection({ reload: true })}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700"
              title="Mostrar / recuperar la ventana de proyección (doble clic: recargar)"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              Proyección
            </button>
            <LiveIndicator />
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Live />} />
            <Route path="/songs" element={<Songs />} />
            <Route path="/bible" element={<Bible />} />
            <Route path="/media" element={<Media />} />
            <Route path="/audio" element={<Audio />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <MiniPlayer />
      </div>
    </HashRouter>
  )
}
