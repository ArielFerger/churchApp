import { Eye, EyeOff, Power } from 'lucide-react'
import { useLiveStore } from '@/shared/store/liveStore'
import type { ProjectionCommand } from '@/shared/types/ipc'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

export default function Live() {
  const { isLive, isBlackout, lastCommand } = useLiveStore()

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r border-slate-700 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
          Acciones rápidas
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => send({ type: 'blackout' })}
            disabled={isBlackout}
            className="flex w-full items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <EyeOff className="h-4 w-4" />
            Blackout
            <kbd className="ml-auto rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              Esc
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => send({ type: 'clear' })}
            disabled={!isLive}
            className="flex w-full items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Power className="h-4 w-4" />
            Clear
          </button>

          <button
            type="button"
            onClick={() =>
              send({
                type: 'showSlide',
                content: { lines: ['Bienvenidos', 'a la prueba de proyección'] }
              })
            }
            className="flex w-full items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Eye className="h-4 w-4" />
            Slide de prueba
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Atajos: <kbd className="rounded bg-slate-800 px-1">Esc</kbd> blackout ·{' '}
          <kbd className="rounded bg-slate-800 px-1">F11</kbd> toggle proyección
        </p>
      </aside>

      <section className="flex-1 p-6">
        <h1 className="text-xl font-semibold">En Vivo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Probá el sistema de capas. Las pantallas reales se conectan en las fases siguientes.
        </p>

        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Último comando enviado
          </h3>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-3 font-mono text-xs text-slate-300">
            {lastCommand ? JSON.stringify(lastCommand, null, 2) : 'ningún comando todavía'}
          </pre>
        </div>
      </section>
    </div>
  )
}
