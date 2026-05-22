import { useEffect, useState } from 'react'
import type { ProjectionCommand } from '@/shared/types/ipc'

export default function ProjectionApp() {
  const [isBlackout, setIsBlackout] = useState(false)

  useEffect(() => {
    const api = (window as unknown as { projectionAPI?: { onCommand: (cb: (cmd: ProjectionCommand) => void) => () => void } }).projectionAPI
    if (!api) return

    const unsub = api.onCommand((cmd) => {
      if (cmd.type === 'blackout') setIsBlackout(true)
      if (cmd.type === 'clear') setIsBlackout(false)
    })

    return unsub
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" style={{ cursor: 'none' }}>
      {/* Layer 0: negro de base — siempre visible */}

      {/* Blackout overlay */}
      {isBlackout && (
        <div className="absolute inset-0 z-50 bg-black" />
      )}

      {/* Placeholder — Fase 1 implementa el sistema de capas completo */}
      <div className="flex h-full items-center justify-center">
        <p className="text-2xl text-slate-700">Proyección lista</p>
      </div>
    </div>
  )
}
