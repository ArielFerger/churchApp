import { useEffect, useRef, useState } from 'react'
import { Film, Image as ImageIcon } from 'lucide-react'
import type { MediaItem } from '@/shared/types/media'
import { requestThumbnail } from '../media/thumbnailQueue'
import type { Thumbnail } from '../media/thumbnailCache'

const visibility = new Map<Element, (visible: boolean) => void>()
let observer: IntersectionObserver | undefined

export default function MediaThumbnail({
  item,
  durationLabel
}: {
  item: MediaItem
  durationLabel?: (seconds: number) => string
}) {
  const host = useRef<HTMLSpanElement>(null)
  const [preview, setPreview] = useState<Thumbnail | null>(null)
  const { id, type, addedAt, byteSize } = item
  useEffect(() => {
    const element = host.current!
    let cancel: (() => void) | undefined
    setPreview(null)
    visibility.set(element, (visible) => {
      if (visible && !cancel) {
        cancel = requestThumbnail(id, `${addedAt}-${byteSize ?? ''}`, type, setPreview)
      } else if (!visible) {
        cancel?.()
        cancel = undefined
        setPreview(null)
      }
    })
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) visibility.get(entry.target)?.(entry.isIntersecting)
    })
    observer.observe(element)
    return () => {
      observer?.unobserve(element)
      visibility.delete(element)
      cancel?.()
    }
  }, [id, type, addedAt, byteSize])

  const Icon = type === 'video' ? Film : ImageIcon
  return (
    <span ref={host} className="relative flex h-full w-full items-center justify-center">
      {preview ? (
        <img src={preview.src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon aria-hidden className="h-5 w-5 text-slate-600" />
      )}
      {durationLabel && preview?.duration !== undefined && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
          {durationLabel(preview.duration)}
        </span>
      )}
    </span>
  )
}
