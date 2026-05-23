import { AnimatePresence, motion } from 'framer-motion'
import MediaSlide from './MediaSlide'
import type { MediaItem } from '@/shared/types/media'

interface Props {
  item: MediaItem | null
}

/**
 * Layer 1: looping background. Cross-fades when the bg media changes; quietly
 * empty (transparent — falls through to the layer-0 black) when there's nothing.
 */
export default function BackgroundLayer({ item }: Props) {
  return (
    <div className="absolute inset-0 z-10">
      <AnimatePresence>
        {item && (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <MediaSlide item={item} active loop fit="cover" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
