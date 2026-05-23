import { AnimatePresence, motion } from 'framer-motion'
import MediaSlide from './MediaSlide'
import type { ProjectionCommand, SlideContent } from '@/shared/types/ipc'
import type { MediaItem } from '@/shared/types/media'

interface Props {
  current: ProjectionCommand | null
  /** Preload queue: rendered hidden so showMedia is instant. */
  preloads: MediaItem[]
  /** Resolved media item for the currently-displayed showMedia, if any. */
  currentMediaItem: MediaItem | null
}

/**
 * Layer 2: text slides, bible verses, media items. Uses AnimatePresence for
 * cross-fades between content kinds. Preloaded media stays mounted (hidden)
 * underneath so the next showMedia avoids any fetch delay.
 */
export default function ContentLayer({ current, preloads, currentMediaItem }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      {/* Hidden preload pool — keeps decoded frames warm */}
      <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden="true">
        {preloads.map((item) => (
          <MediaSlide key={`preload-${item.id}`} item={item} active={false} />
        ))}
      </div>

      <AnimatePresence mode="wait">{renderContent(current, currentMediaItem)}</AnimatePresence>
    </div>
  )
}

function renderContent(cmd: ProjectionCommand | null, mediaItem: MediaItem | null) {
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
    case 'showMedia':
      if (!mediaItem) return null
      return (
        <FadeBlock key={`media-${mediaItem.id}`} pad={false}>
          <div className="h-screen w-screen">
            <MediaSlide item={mediaItem} active fit="contain" />
          </div>
        </FadeBlock>
      )
    default:
      return null
  }
}

function slideKey(content: SlideContent): string {
  return content.lines.join('|')
}

function FadeBlock({ children, pad = true }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={pad ? 'px-16 text-center' : 'absolute inset-0'}
    >
      {children}
    </motion.div>
  )
}

function SlideBlock({ content }: { content: SlideContent }) {
  // Auto-shrink for crowded slides: 6 lines → 6xl, 8 → 5xl, more → 4xl.
  // Long single lines still wrap (break-words) so nothing overflows.
  const visibleLines = content.lines.filter((l) => l !== undefined)
  const sizeClass =
    visibleLines.length <= 4
      ? 'text-7xl leading-[1.05]'
      : visibleLines.length <= 6
        ? 'text-6xl leading-[1.1]'
        : visibleLines.length <= 8
          ? 'text-5xl leading-tight'
          : 'text-4xl leading-snug'

  return (
    <div className="mx-auto max-w-[90vw]">
      <div className="space-y-4">
        {visibleLines.map((line, idx) => (
          <p
            key={idx}
            className={`font-display ${sizeClass} break-words font-semibold text-white`}
            style={{ textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.6)' }}
          >
            {line || ' '}
          </p>
        ))}
      </div>

      {(content.songTitle || content.sectionLabel) && (
        <div className="mt-12 flex items-center justify-center gap-3 text-xl font-medium text-slate-300/90">
          {content.songTitle && (
            <span style={{ textShadow: '0 2px 12px rgba(0,0,0,0.85)' }}>{content.songTitle}</span>
          )}
          {content.songTitle && content.sectionLabel && (
            <span className="text-slate-500">·</span>
          )}
          {content.sectionLabel && (
            <span
              className="rounded-full bg-black/30 px-3 py-0.5 text-base text-slate-200 backdrop-blur-sm"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
            >
              {content.sectionLabel}
            </span>
          )}
        </div>
      )}
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
