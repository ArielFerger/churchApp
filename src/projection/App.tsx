import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import BackgroundLayer from './components/BackgroundLayer'
import ContentLayer from './components/ContentLayer'
import OverlayLayer from './components/OverlayLayer'
import type { PlaybackInfo } from './components/MediaSlide'
import type { ProjectionCommand } from '@/shared/types/ipc'
import type { MediaItem } from '@/shared/types/media'

interface ProjectionState {
  backgroundMediaId: string | null
  /** Slideshow background: cycles through these ids every `intervalSec`. */
  backgroundSlideshow: { mediaIds: string[]; intervalSec: number } | null
  content: ProjectionCommand | null
  isBlackout: boolean
  showLogo: boolean
  /** Set of mediaIds to keep hot in the preload pool. */
  preloadIds: string[]
  /** Imperative seek signal for the active content video. */
  mediaSeek: { position: number; nonce: number } | null
  /** Imperative replay signal: bump to restart the content video from 0. */
  mediaReplay: { nonce: number } | null
  /** Desired play state for the active content video. */
  mediaPlaying: boolean
  /** Volume (0..1) for the active content video. */
  mediaVolume: number
}

const initialState: ProjectionState = {
  backgroundMediaId: null,
  backgroundSlideshow: null,
  content: null,
  isBlackout: false,
  showLogo: false,
  preloadIds: [],
  mediaSeek: null,
  mediaReplay: null,
  mediaPlaying: true,
  mediaVolume: 1
}

function reducer(state: ProjectionState, cmd: ProjectionCommand): ProjectionState {
  switch (cmd.type) {
    case 'setBackground':
      // Single background clears any active slideshow.
      return { ...state, backgroundMediaId: cmd.mediaId, backgroundSlideshow: null }
    case 'setBackgroundSlideshow':
      return {
        ...state,
        backgroundMediaId: null,
        backgroundSlideshow:
          cmd.mediaIds.length > 0
            ? { mediaIds: cmd.mediaIds, intervalSec: Math.max(1, cmd.intervalSec) }
            : null
      }
    case 'blackout':
      return { ...state, isBlackout: true }
    case 'showLogo':
      return { ...state, showLogo: true, isBlackout: false }
    case 'clear':
      return { ...state, content: null, isBlackout: false, showLogo: false }
    case 'stopAll':
      // Panic stop: kill every source and go black.
      return {
        ...state,
        content: null,
        backgroundMediaId: null,
        backgroundSlideshow: null,
        isBlackout: true,
        showLogo: false,
        mediaPlaying: false,
        mediaSeek: null
      }
    case 'showSlide':
    case 'showBibleVerse':
      return { ...state, content: cmd, isBlackout: false, showLogo: false }
    case 'showMedia':
      return {
        ...state,
        content: cmd,
        isBlackout: false,
        showLogo: false,
        mediaSeek: null,
        mediaReplay: null,
        mediaPlaying: true,
        preloadIds: dedupe([...state.preloadIds, cmd.mediaId])
      }
    case 'preloadMedia':
      return { ...state, preloadIds: dedupe([...state.preloadIds, cmd.mediaId]) }
    case 'replayMedia':
      return {
        ...state,
        mediaReplay: { nonce: (state.mediaReplay?.nonce ?? 0) + 1 },
        mediaPlaying: true
      }
    case 'seekMedia':
      return {
        ...state,
        mediaSeek: { position: cmd.position, nonce: (state.mediaSeek?.nonce ?? 0) + 1 }
      }
    case 'setMediaPlaying':
      return { ...state, mediaPlaying: cmd.playing }
    case 'setMediaVolume':
      return { ...state, mediaVolume: Math.max(0, Math.min(1, cmd.volume)) }
    default:
      return state
  }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr)).slice(-10) // cap at 10 to bound memory
}

export default function ProjectionApp() {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Two indexes: general media folder + dedicated "En Vivo" loop folder.
  const [generalMedia, setGeneralMedia] = useState<Map<string, MediaItem>>(new Map())
  const [liveMedia, setLiveMedia] = useState<Map<string, MediaItem>>(new Map())
  const lastEmit = useRef(0)

  useEffect(() => {
    const api = window.projectionAPI
    if (!api) return

    // Hydrate the media indexes on startup + on every scanner change.
    void api.getMedia().then((items) => setGeneralMedia(toMap(items)))
    void api.getLiveMedia?.().then((items) => setLiveMedia(toMap(items)))
    const unsubMedia = api.onMediaUpdated((items) => setGeneralMedia(toMap(items)))
    const unsubLive = api.onLiveMediaUpdated?.((items) => setLiveMedia(toMap(items)))
    const unsubCmd = api.onCommand(dispatch)

    return () => {
      unsubMedia()
      unsubLive?.()
      unsubCmd()
    }
  }, [])

  const mediaById = useMemo(
    () => new Map([...generalMedia, ...liveMedia]),
    [generalMedia, liveMedia]
  )

  const backgroundItems: MediaItem[] = state.backgroundSlideshow
    ? state.backgroundSlideshow.mediaIds
        .map((id) => mediaById.get(id))
        .filter((m): m is MediaItem => Boolean(m))
    : state.backgroundMediaId
      ? [mediaById.get(state.backgroundMediaId)].filter((m): m is MediaItem => Boolean(m))
      : []

  const backgroundIntervalSec = state.backgroundSlideshow?.intervalSec ?? 0

  const currentMediaItem =
    state.content?.type === 'showMedia' ? (mediaById.get(state.content.mediaId) ?? null) : null

  // When there's no live video, tell control to hide the scrubber.
  const liveVideoId = currentMediaItem?.type === 'video' ? currentMediaItem.id : null
  useEffect(() => {
    if (!liveVideoId) {
      window.projectionAPI?.emitPlaybackState({
        mediaId: null,
        position: 0,
        duration: 0,
        playing: false
      })
    }
  }, [liveVideoId])

  const preloads = state.preloadIds
    .map((id) => mediaById.get(id))
    .filter((m): m is MediaItem => Boolean(m))

  const handlePlayback = (info: PlaybackInfo): void => {
    const now = Date.now()
    if (now - lastEmit.current < 240) return // throttle to ~4/sec
    lastEmit.current = now
    window.projectionAPI?.emitPlaybackState({
      mediaId: currentMediaItem?.id ?? null,
      position: info.position,
      duration: info.duration,
      playing: info.playing
    })
  }

  // End-of-video: emit immediately (bypasses the throttle) so the control
  // window can advance its play queue / show the replay button. Keep the real
  // duration so the transport bar doesn't collapse to 0:00.
  const handleEnded = (durationSec: number): void => {
    window.projectionAPI?.emitPlaybackState({
      mediaId: currentMediaItem?.id ?? null,
      position: durationSec,
      duration: durationSec,
      playing: false,
      ended: true
    })
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" style={{ cursor: 'none' }}>
      <BackgroundLayer items={backgroundItems} intervalSec={backgroundIntervalSec} />
      <ContentLayer
        current={state.content}
        preloads={preloads}
        currentMediaItem={currentMediaItem}
        mediaSeek={state.mediaSeek}
        mediaReplay={state.mediaReplay}
        mediaPlaying={state.mediaPlaying}
        mediaVolume={state.mediaVolume}
        onMediaPlayback={handlePlayback}
        onMediaEnded={handleEnded}
      />
      <OverlayLayer isBlackout={state.isBlackout} showLogo={state.showLogo} />
    </div>
  )
}

function toMap(items: MediaItem[]): Map<string, MediaItem> {
  return new Map(items.map((m) => [m.id, m]))
}
