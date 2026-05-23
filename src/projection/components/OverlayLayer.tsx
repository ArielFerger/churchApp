import { AnimatePresence } from 'framer-motion'
import BlackScreen from './BlackScreen'

interface Props {
  isBlackout: boolean
  showLogo?: boolean
}

/**
 * Layer 3: overlays drawn on top of everything else.
 * - Blackout: full opaque black, hides all underlying layers.
 * - Logo (placeholder): hookable in later phases.
 *
 * AnimatePresence ensures the overlay fades in/out instead of popping.
 */
export default function OverlayLayer({ isBlackout, showLogo: _showLogo }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <AnimatePresence>{isBlackout && <BlackScreen key="blackout" />}</AnimatePresence>
    </div>
  )
}
