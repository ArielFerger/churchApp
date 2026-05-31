import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MediaSlide from './MediaSlide'
import type { MediaItem } from '@/shared/types/media'

interface Props {
  /** One or more background items. With >1 and `intervalSec` > 0, cycles. */
  items: MediaItem[]
  /** Seconds each slideshow image stays before advancing (0 = no cycling). */
  intervalSec: number
}

/**
 * Layer 1: looping background. With a single item it behaves like before
 * (static, looping if video). With multiple items + an interval it runs a
 * cross-fading slideshow. Quietly transparent when there's nothing.
 */
export default function BackgroundLayer({ items, intervalSec }: Props) {
  const [index, setIndex] = useState(0)

  // Reset to the first item whenever the set of items changes.
  const itemsKey = items.map((i) => i.id).join(',')
  useEffect(() => {
    setIndex(0)
  }, [itemsKey])

  // Advance the slideshow on a timer (only when it makes sense to).
  useEffect(() => {
    if (items.length <= 1 || intervalSec <= 0) return
    const handle = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, intervalSec * 1000)
    return () => window.clearInterval(handle)
  }, [items.length, intervalSec, itemsKey])

  const current = items.length > 0 ? items[Math.min(index, items.length - 1)] : null
  // Single video backgrounds loop; slideshow advances on the timer instead.
  const loop = items.length === 1

  return (
    <div className="absolute inset-0 z-10">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <MediaSlide item={current} active loop={loop} fit="cover" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
