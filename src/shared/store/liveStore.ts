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
    set(() => {
      switch (cmd.type) {
        case 'blackout':
          return { lastCommand: cmd, isBlackout: true, isLive: true }
        case 'clear':
          return { lastCommand: cmd, isBlackout: false, isLive: false }
        default:
          return { lastCommand: cmd, isBlackout: false, isLive: true }
      }
    })
}))
