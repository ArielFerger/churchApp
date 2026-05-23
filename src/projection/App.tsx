import { useEffect, useReducer, useState } from 'react'
import BackgroundLayer from './components/BackgroundLayer'
import ContentLayer from './components/ContentLayer'
import OverlayLayer from './components/OverlayLayer'
import type { ProjectionCommand } from '@/shared/types/ipc'
import type { MediaItem } from '@/shared/types/media'

interface ProjectionState {
  backgroundMediaId: string | null
  content: ProjectionCommand | null
  isBlackout: boolean
  showLogo: boolean
  /** Set of mediaIds to keep hot in the preload pool. */
  preloadIds: string[]
}

const initialState: ProjectionState = {
  backgroundMediaId: null,
  content: null,
  isBlackout: false,
  showLogo: false,
  preloadIds: []
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
      return { ...state, content: cmd, isBlackout: false, showLogo: false }
    case 'showMedia':
      return {
        ...state,
        content: cmd,
        isBlackout: false,
        showLogo: false,
        preloadIds: dedupe([...state.preloadIds, cmd.mediaId])
      }
    case 'preloadMedia':
      return { ...state, preloadIds: dedupe([...state.preloadIds, cmd.mediaId]) }
    default:
      return state
  }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr)).slice(-10) // cap at 10 to bound memory
}

export default function ProjectionApp() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [mediaById, setMediaById] = useState<Map<string, MediaItem>>(new Map())

  useEffect(() => {
    const api = window.projectionAPI
    if (!api) return

    // Hydrate the media index on startup + on every scanner change.
    void api.getMedia().then((items) => setMediaById(toMap(items)))
    const unsubMedia = api.onMediaUpdated((items) => setMediaById(toMap(items)))
    const unsubCmd = api.onCommand(dispatch)

    return () => {
      unsubMedia()
      unsubCmd()
    }
  }, [])

  const backgroundItem = state.backgroundMediaId
    ? mediaById.get(state.backgroundMediaId) ?? null
    : null

  const currentMediaItem =
    state.content?.type === 'showMedia' ? mediaById.get(state.content.mediaId) ?? null : null

  const preloads = state.preloadIds
    .map((id) => mediaById.get(id))
    .filter((m): m is MediaItem => Boolean(m))

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      style={{ cursor: 'none' }}
    >
      <BackgroundLayer item={backgroundItem} />
      <ContentLayer
        current={state.content}
        preloads={preloads}
        currentMediaItem={currentMediaItem}
      />
      <OverlayLayer isBlackout={state.isBlackout} showLogo={state.showLogo} />
    </div>
  )
}

function toMap(items: MediaItem[]): Map<string, MediaItem> {
  return new Map(items.map((m) => [m.id, m]))
}
