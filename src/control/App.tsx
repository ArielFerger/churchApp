import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import Live from './pages/Live'
import Songs from './pages/Songs'
import Bible from './pages/Bible'
import Media from './pages/Media'
import Audio from './pages/Audio'
import Settings from './pages/Settings'
import LiveIndicator from './components/LiveIndicator'
import { useProjectionBridge } from './hooks/useProjectionBridge'
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
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <HashRouter>
      <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
        <header className="flex items-center gap-4 border-b border-slate-700 px-4 py-2">
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
          <div className="ml-auto">
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
      </div>
    </HashRouter>
  )
}
