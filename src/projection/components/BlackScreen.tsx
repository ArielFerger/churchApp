import { motion } from 'framer-motion'

/**
 * Pure black fullscreen overlay with a fast fade. Used by OverlayLayer for blackout.
 */
export default function BlackScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="absolute inset-0 bg-black"
    />
  )
}
