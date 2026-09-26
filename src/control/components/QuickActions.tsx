import { CircleStop, EyeOff, Power } from 'lucide-react'
import { useLiveStore } from '@/shared/store/liveStore'
import type { ProjectionCommand } from '@/shared/types/ipc'

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

/**
 * Controles de proyección siempre visibles, en la cabecera: a un clic desde
 * cualquier sección. "Detener" es la misma parada de pánico que Esc.
 *
 * En ventanas angostas quedan sólo los íconos (con su nombre accesible): son
 * los botones que no pueden desaparecer nunca.
 */
export default function QuickActions() {
  const { isLive, isBlackout } = useLiveStore()

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Controles de la proyección">
      <button
        type="button"
        onClick={() => send({ type: 'stopAll' })}
        className="inline-flex items-center gap-1.5 rounded-md bg-aire px-2.5 py-1.5 text-xs font-semibold text-white transition-[filter] hover:brightness-110"
        title="Detener todo (Esc) — corta contenido, fondo y presentaciones"
        aria-label="Detener todo"
        aria-keyshortcuts="Escape"
      >
        <CircleStop className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden md:inline">Detener</span>
      </button>

      <button
        type="button"
        onClick={() => send({ type: 'blackout' })}
        disabled={isBlackout}
        className="inline-flex items-center gap-1.5 rounded-md border border-cabina-linea bg-cabina-alto px-2.5 py-1.5 text-xs text-cabina-tinta transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        title="Blackout — tapa la proyección con negro"
        aria-label="Blackout"
      >
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden md:inline">Blackout</span>
      </button>

      <button
        type="button"
        onClick={() => send({ type: 'clear' })}
        disabled={!isLive}
        className="inline-flex items-center gap-1.5 rounded-md border border-cabina-linea bg-cabina-alto px-2.5 py-1.5 text-xs text-cabina-tinta transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        title="Limpiar — saca el contenido actual"
        aria-label="Limpiar la pantalla"
      >
        <Power className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden md:inline">Limpiar</span>
      </button>
    </div>
  )
}
