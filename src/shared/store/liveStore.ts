import { create } from 'zustand'
import type { ProjectionCommand } from '../types/ipc'

interface LiveState {
  lastCommand: ProjectionCommand | null
  isBlackout: boolean
  isLive: boolean
  apply: (cmd: ProjectionCommand) => void
}

export const useLiveStore = create<LiveState>((set) => ({
  lastCommand: null,
  isBlackout: false,
  isLive: false,
  apply: (cmd) =>
    set((s) => {
      switch (cmd.type) {
        case 'blackout':
        case 'stopAll':
          return { lastCommand: cmd, isBlackout: true, isLive: true }
        case 'clear':
          return { lastCommand: cmd, isBlackout: false, isLive: false }
        // Control-only signals that don't change what's "live" on screen.
        case 'preloadMedia':
        case 'seekMedia':
        case 'setMediaPlaying':
        case 'setMediaVolume':
        case 'setBackground':
        case 'setBackgroundSlideshow':
          return s
        default:
          return { lastCommand: cmd, isBlackout: false, isLive: true }
      }
    })
}))
