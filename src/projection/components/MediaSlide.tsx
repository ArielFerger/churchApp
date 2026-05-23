import { useEffect, useRef } from 'react'
import type { MediaItem } from '@/shared/types/media'

interface Props {
  item: MediaItem
  /** When true, the media plays / animates. When false, it's loaded but paused/hidden. */
  active: boolean
  /** Loop the playback. Used for the background layer. */
  loop?: boolean
  /** object-fit mode. */
  fit?: 'cover' | 'contain'
}

/**
 * Renders an image/video/gif from the media:// protocol. Designed so that
 * mounting the component with `active=false` already loads the media (preload),
 * so when `active` flips to true we can play immediately without a fetch round-trip.
 */
export default function MediaSlide({ item, active, loop = false, fit = 'contain' }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const src = `media://${item.id}`

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) {
      // currentTime reset so we don't jump in mid-clip from a previous run
      v.currentTime = 0
      const playPromise = v.play()
      if (playPromise) playPromise.catch(() => undefined)
    } else {
      v.pause()
    }
  }, [active, item.id])

  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain'

  if (item.type === 'video') {
    return (
      <video
        ref={videoRef}
        src={src}
        className={`h-full w-full ${objectFit}`}
        preload="auto"
        muted
        playsInline
        loop={loop}
        autoPlay={active}
      />
    )
  }

  // image / gif → same element. GIFs animate natively once attached.
  return (
    <img
      src={src}
      alt=""
      className={`h-full w-full ${objectFit}`}
      decoding="async"
      draggable={false}
    />
  )
}
