import { useEffect, useReducer } from 'react'
import BackgroundLayer from './components/BackgroundLayer'
import ContentLayer from './components/ContentLayer'
import OverlayLayer from './components/OverlayLayer'
import type { ProjectionCommand } from '@/shared/types/ipc'

/**
 * Local state of the projection renderer, derived from the stream of
 * ProjectionCommand messages coming from main.
 */
interface ProjectionState {
  backgroundMediaId: string | null
  content: ProjectionCommand | null
  isBlackout: boolean
  showLogo: boolean
}

const initialState: ProjectionState = {
  backgroundMediaId: null,
  content: null,
  isBlackout: false,
  showLogo: false
}

function reducer(state: ProjectionState, cmd: ProjectionCommand): ProjectionState {
  switch (cmd.type) {
    case 'setBackground':
      return { ...state, backgroundMediaId: cmd.mediaId }
    case 'blackout':
      return { ...state, isBlackout: true }
    case 'showLogo':
      return { ...state, showLogo: true, isBlackout: false }
    case 'clear':
      return { ...state, content: null, isBlackout: false, showLogo: false }
    case 'showSlide':
    case 'showBibleVerse':
    case 'showMedia':
      return { ...state, content: cmd, isBlackout: false, showLogo: false }
    case 'preloadMedia':
      // Fase 2: cargar oculto. Por ahora no afecta el estado visible.
      return state
    default:
      return state
  }
}

export default function ProjectionApp() {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const api = window.projectionAPI
    if (!api) return
    return api.onCommand(dispatch)
  }, [])

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      style={{ cursor: 'none' }}
    >
      {/* Layer 0: base black — handled by the bg-black class on the root */}
      <BackgroundLayer mediaId={state.backgroundMediaId} />
      <ContentLayer current={state.content} />
      <OverlayLayer isBlackout={state.isBlackout} showLogo={state.showLogo} />
    </div>
  )
}
