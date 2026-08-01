import { useEffect } from 'react'
import { Monitor, RefreshCw, Folder, FolderOpen, X, Volume2, TrendingUp, TrendingDown } from 'lucide-react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import type { AppSettings } from '@/shared/types/ipc'

type FolderKey = Extract<
  keyof AppSettings,
  | 'mediaFolder'
  | 'audioFolder'
  | 'songsFolder'
  | 'liveLoopFolder'
  | 'bibleBackgroundsFolder'
  | 'toolsFolder'
>

const folderRows: { key: FolderKey; label: string; hint?: string }[] = [
  { key: 'mediaFolder', label: 'Imágenes / videos / GIFs' },
  {
    key: 'liveLoopFolder',
    label: 'Videos de loop (En Vivo)',
    hint: 'Carpeta aparte para los fondos en loop de "En Vivo". Admite subcarpetas. Si no se configura, se usa la carpeta de media.'
  },
  {
    key: 'bibleBackgroundsFolder',
    label: 'Fondos de Biblia',
    hint: 'Carpeta aparte para los fondos de los versículos proyectados. Admite subcarpetas. Si no se configura, se usa la carpeta de media.'
  },
  { key: 'audioFolder', label: 'Música' },
  { key: 'songsFolder', label: 'Canciones' },
  {
    key: 'toolsFolder',
    label: 'Herramientas de descarga',
    hint: 'Carpeta con yt-dlp y ffmpeg, para bajar de YouTube. Si no se configura, se buscan en las ubicaciones habituales y en el PATH; desde la pestaña Descargar se pueden instalar solas.'
  }
]

export default function Settings() {
  const { settings, displays, loaded, load, update, refreshDisplays } = useSettingsStore()

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500">Cargando…</p>
      </div>
    )
  }

  const selectedId = settings?.projectionDisplayId ?? null

  async function pickFolder(key: FolderKey, title: string) {
    const api = window.electronAPI
    if (!api) return
    const result = await api.showOpenDialog({
      title,
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return
    await update({ [key]: result.filePaths[0] } as Partial<AppSettings>)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Ajustes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configurá la pantalla donde se proyecta y las carpetas de contenido.
          </p>
        </header>

        <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Monitor className="h-4 w-4" />
              Pantalla de proyección
            </h2>
            <button
              type="button"
              onClick={() => void refreshDisplays()}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
              title="Refrescar lista de monitores"
            >
              <RefreshCw className="h-3 w-3" />
              Refrescar
            </button>
          </div>

          {displays.length === 0 ? (
            <p className="text-sm text-slate-500">No se detectaron pantallas.</p>
          ) : (
            <ul className="grid gap-2">
              {displays.map((d) => {
                const isSelected = d.id === selectedId
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => void update({ projectionDisplayId: d.id })}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {d.label}
                          {d.isPrimary && (
                            <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-normal text-slate-300">
                              PRIMARIO
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {d.bounds.width}×{d.bounds.height} @ ({d.bounds.x}, {d.bounds.y})
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-3 text-xs text-slate-500">
            La ventana de proyección se reposiciona en caliente — nunca se cierra ni se recrea.
          </p>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Volume2 className="h-4 w-4" />
            Audio de los videos
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Suavizá el sonido de los videos al proyectarlos. Las dos opciones son independientes.
          </p>
          <div className="grid gap-2">
            <ToggleRow
              icon={<TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />}
              label="Entrada — audio de bajito a alto"
              description="Al empezar el video, el audio sube gradualmente."
              checked={settings?.videoFadeIn ?? true}
              onChange={(v) => void update({ videoFadeIn: v })}
              durationSec={settings?.videoFadeInSec ?? 1}
              onDurationChange={(s) => void update({ videoFadeInSec: s })}
            />
            <ToggleRow
              icon={<TrendingDown className="h-4 w-4 shrink-0 text-amber-400" />}
              label="Salida — audio de alto a bajito"
              description="Al terminar el video, el audio baja gradualmente."
              checked={settings?.videoFadeOut ?? false}
              onChange={(v) => void update({ videoFadeOut: v })}
              durationSec={settings?.videoFadeOutSec ?? 2.5}
              onDurationChange={(s) => void update({ videoFadeOutSec: s })}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Folder className="h-4 w-4" />
            Carpetas de contenido
          </h2>
          <ul className="grid gap-2">
            {folderRows.map((row) => {
              const value = settings?.[row.key] ?? null
              return (
                <li
                  key={row.key}
                  className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-slate-200">{row.label}</span>
                    {row.hint && (
                      <p className="mt-0.5 text-xs leading-snug text-slate-500">{row.hint}</p>
                    )}
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                      {value ?? 'no configurada'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void pickFolder(row.key, `Carpeta de ${row.label.toLowerCase()}`)}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
                  >
                    {value ? 'Cambiar' : 'Seleccionar'}
                  </button>
                  {value && (
                    <button
                      type="button"
                      onClick={() => void update({ [row.key]: null } as Partial<AppSettings>)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                      title="Limpiar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

interface ToggleRowProps {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  durationSec: number
  onDurationChange: (s: number) => void
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  durationSec,
  onDurationChange
}: ToggleRowProps) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            checked ? 'bg-blue-600' : 'bg-slate-600'
          }`}
        >
          {/* left-0.5 ancla el knob: sin left explícito hereda la posición
              centrada del botón y queda descolocado / se sale del riel. */}
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {checked && (
        <div className="mt-2 flex items-center gap-2 border-t border-slate-700/60 pt-2 pl-7">
          <span className="text-xs text-slate-400">Duración</span>
          <input
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            value={durationSec}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) onDurationChange(Math.max(0.5, Math.min(10, n)))
            }}
            className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">seg (máx 10)</span>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={durationSec}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="seek-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700"
          />
        </div>
      )}
    </div>
  )
}
