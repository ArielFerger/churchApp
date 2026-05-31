import { CircleStop, EyeOff, Power } from 'lucide-react'
import { useLiveStore } from '@/shared/store/liveStore'
import type { ProjectionCommand } from '@/shared/types/ipc'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

/**
 * Always-visible projection controls, mounted in the app header so they're one
 * click away from any tab. "Detener todo" mirrors the Esc panic-stop.
 */
export default function QuickActions() {
  const { isLive, isBlackout } = useLiveStore()

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => send({ type: 'stopAll' })}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600/90 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
        title="Detener todo (Esc) — corta contenido, fondo y presentaciones"
      >
        <CircleStop className="h-3.5 w-3.5" />
        Detener
      </button>

      <button
        type="button"
        onClick={() => send({ type: 'blackout' })}
        disabled={isBlackout}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        title="Blackout — tapa la proyección con negro"
      >
        <EyeOff className="h-3.5 w-3.5" />
        Blackout
      </button>

      <button
        type="button"
        onClick={() => send({ type: 'clear' })}
        disabled={!isLive}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        title="Clear — saca el contenido actual"
      >
        <Power className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  )
}
