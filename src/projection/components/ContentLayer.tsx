import { AnimatePresence, motion } from 'framer-motion'
import type { ProjectionCommand, SlideContent } from '@/shared/types/ipc'

interface Props {
  current: ProjectionCommand | null
}

/**
 * Layer 2: actual visible content (slide, verse, media). Cross-fades on change
 * via Framer Motion's AnimatePresence — never unmounts the projection window.
 */
export default function ContentLayer({ current }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {renderContent(current)}
      </AnimatePresence>
    </div>
  )
}

function renderContent(cmd: ProjectionCommand | null) {
  if (!cmd) return null
  switch (cmd.type) {
    case 'showSlide':
      return (
        <FadeBlock key={`slide-${slideKey(cmd.content)}`}>
          <SlideBlock content={cmd.content} />
        </FadeBlock>
      )
    case 'showBibleVerse':
      return (
        <FadeBlock key={`verse-${cmd.reference}-${cmd.version}`}>
          <VerseBlock reference={cmd.reference} text={cmd.text} version={cmd.version} />
        </FadeBlock>
      )
    default:
      return null
  }
}

function slideKey(content: SlideContent): string {
  return content.lines.join('|')
}

function FadeBlock({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="px-16 text-center"
    >
      {children}
    </motion.div>
  )
}

function SlideBlock({ content }: { content: SlideContent }) {
  return (
    <div className="space-y-6">
      {content.lines.map((line, idx) => (
        <p
          key={idx}
          className="font-display text-6xl font-semibold leading-tight text-white"
          style={{ textShadow: '0 4px 16px rgba(0,0,0,0.85)' }}
        >
          {line}
        </p>
      ))}
    </div>
  )
}

function VerseBlock({
  reference,
  text,
  version
}: {
  reference: string
  text: string
  version: string
}) {
  return (
    <div className="space-y-8">
      <p
        className="font-display text-5xl leading-snug text-white"
        style={{ textShadow: '0 4px 16px rgba(0,0,0,0.85)' }}
      >
        {text}
      </p>
      <p className="text-2xl font-medium text-slate-300">
        {reference} <span className="text-slate-500">· {version}</span>
      </p>
    </div>
  )
}
