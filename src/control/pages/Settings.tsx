import { useEffect } from 'react'
import { Monitor, RefreshCw, Folder, FolderOpen, X } from 'lucide-react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import type { AppSettings } from '@/shared/types/ipc'

type FolderKey = Extract<keyof AppSettings, 'mediaFolder' | 'audioFolder' | 'songsFolder'>

const folderRows: { key: FolderKey; label: string; phase: string }[] = [
  { key: 'mediaFolder', label: 'Imágenes / videos / GIFs', phase: 'Fase 2' },
  { key: 'audioFolder', label: 'Música', phase: 'Fase 5' },
  { key: 'songsFolder', label: 'Canciones', phase: 'Fase 3' }
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{row.label}</span>
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {row.phase}
                      </span>
                    </div>
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
