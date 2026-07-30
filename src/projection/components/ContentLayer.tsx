import { AnimatePresence, motion } from 'framer-motion'
import MediaSlide, { type PlaybackInfo } from './MediaSlide'
import type {
  ProjectionCommand,
  SlideContent,
  BibleDisplaySettings
} from '@/shared/types/ipc'
import type { MediaItem } from '@/shared/types/media'

interface Props {
  current: ProjectionCommand | null
  /** Preload queue: rendered hidden so showMedia is instant. */
  preloads: MediaItem[]
  /** Resolved media item for the currently-displayed showMedia, if any. */
  currentMediaItem: MediaItem | null
  /** Imperative seek signal for the active content video. */
  mediaSeek: { position: number; nonce: number } | null
  /** Imperative replay signal: restart the content video from 0. */
  mediaReplay: { nonce: number } | null
  /** Desired play state for the active content video. */
  mediaPlaying: boolean
  /** Sube con cada orden de play/pausa para poder re-aplicar el mismo valor. */
  mediaPlayNonce: number
  /** Volume (0..1) for the active content video. */
  mediaVolume: number
  /** Receives video timing to push up to control. */
  onMediaPlayback: (info: PlaybackInfo) => void
  /** Fired once when the active (non-loop) video ends — drives the queue. Passes its duration. */
  onMediaEnded: (durationSec: number) => void
  /** Apariencia de versículos (fuente, tamaño, color, sombra, dim). */
  bibleDisplay: BibleDisplaySettings | null
  /** Familia CSS de la fuente subida elegida (null = fuente por defecto). */
  bibleFontFamily: string | null
  /** Fondo elegido para los versículos, ya resuelto a un MediaItem. */
  bibleBackgroundItem: MediaItem | null
}

/**
 * Layer 2: text slides, bible verses, media items.
 *
 * Media (showMedia) lives in its own AnimatePresence WITHOUT `mode="wait"`, so
 * switching from one video to another cross-fades — the incoming clip is already
 * playing (audio fading in) while the outgoing one fades out. Text/verses use a
 * separate `mode="wait"` presence to avoid overlapping glyphs mid-transition.
 */
export default function ContentLayer({
  current,
  preloads,
  currentMediaItem,
  mediaSeek,
  mediaReplay,
  mediaPlaying,
  mediaPlayNonce,
  mediaVolume,
  onMediaPlayback,
  onMediaEnded,
  bibleDisplay,
  bibleFontFamily,
  bibleBackgroundItem
}: Props) {
  const mediaCmd = current?.type === 'showMedia' ? current : null
  const textCmd =
    current?.type === 'showSlide' || current?.type === 'showBibleVerse' ? current : null
  const isVerse = textCmd?.type === 'showBibleVerse'

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      {/* Hidden preload pool — keeps decoded frames warm */}
      <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden="true">
        {preloads.map((item) => (
          <MediaSlide key={`preload-${item.id}`} item={item} active={false} />
        ))}
      </div>

      {/* Fondo de versículos: se monta mientras haya un versículo en pantalla
          (clave fija para que cambiar de versículo no lo re-fadee). */}
      <AnimatePresence>
        {isVerse && bibleBackgroundItem && (
          <motion.div
            key="bible-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <MediaSlide item={bibleBackgroundItem} active loop muted fit="cover" />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${bibleDisplay?.backgroundDim ?? 0.35})` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media layer — crossfades between clips */}
      <AnimatePresence>
        {mediaCmd && currentMediaItem && (
          <motion.div
            key={`media-${currentMediaItem.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <MediaSlide
              item={currentMediaItem}
              active
              fit="contain"
              loop={mediaCmd.loop ?? false}
              muted={currentMediaItem.type !== 'video' ? true : false}
              fadeAudio={mediaCmd.fadeIn ?? true}
              fadeOut={mediaCmd.fadeOut ?? false}
              fadeInSec={mediaCmd.fadeInSec ?? 1}
              fadeOutSec={mediaCmd.fadeOutSec ?? 2.5}
              volume={mediaVolume}
              playing={mediaPlaying}
              playNonce={mediaPlayNonce}
              seekSignal={mediaSeek}
              replaySignal={mediaReplay}
              onPlayback={onMediaPlayback}
              onEnded={onMediaEnded}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text / verse layer */}
      <AnimatePresence mode="wait">
        {textCmd && (
          <FadeBlock key={textKey(textCmd)}>
            {textCmd.type === 'showSlide' ? (
              <SlideBlock content={textCmd.content} />
            ) : (
              <VerseBlock
                reference={textCmd.reference}
                text={textCmd.text}
                version={textCmd.version}
                display={bibleDisplay}
                fontFamily={bibleFontFamily}
              />
            )}
          </FadeBlock>
        )}
      </AnimatePresence>
    </div>
  )
}

function textKey(cmd: ProjectionCommand): string {
  if (cmd.type === 'showSlide') return `slide-${cmd.content.lines.join('|')}`
  if (cmd.type === 'showBibleVerse') return `verse-${cmd.reference}-${cmd.version}`
  return 'text'
}

function FadeBlock({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      // relative z-10: el texto debe pintarse SOBRE el fondo de versículos
      // (absoluto) — sin esto, el fondo lo tapa por orden de pintado CSS.
      className="relative z-10 px-16 text-center"
    >
      {children}
    </motion.div>
  )
}

function SlideBlock({ content }: { content: SlideContent }) {
  // Auto-shrink for crowded slides: 6 lines → 6xl, 8 → 5xl, more → 4xl.
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
            {line || ' '}
          </p>
        ))}
      </div>

      {(content.songTitle || content.sectionLabel) && (
        <div className="mt-12 flex items-center justify-center gap-3 text-xl font-medium text-slate-300/90">
          {content.songTitle && (
            <span style={{ textShadow: '0 2px 12px rgba(0,0,0,0.85)' }}>{content.songTitle}</span>
          )}
          {content.songTitle && content.sectionLabel && <span className="text-slate-500">·</span>}
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
  version,
  display,
  fontFamily
}: {
  reference: string
  text: string
  version: string
  display: BibleDisplaySettings | null
  fontFamily: string | null
}) {
  // Tamaños base (los actuales): texto 48px, referencia 24px — escalados por
  // el porcentaje configurado. La referencia hereda el color al 75%.
  const pct = (display?.fontSizePct ?? 100) / 100
  const color = display?.textColor ?? '#ffffff'
  const family = fontFamily ? `"${fontFamily}", Inter, system-ui, sans-serif` : undefined
  const shadow = (display?.textShadow ?? true) ? '0 4px 16px rgba(0,0,0,0.85)' : 'none'
  return (
    <div className="space-y-8">
      <p
        className="font-display leading-snug"
        style={{
          fontSize: `${48 * pct}px`,
          color,
          fontFamily: family,
          fontWeight: display?.bold ? 700 : undefined,
          textShadow: shadow
        }}
      >
        {text}
      </p>
      <p
        className="font-medium"
        style={{
          fontSize: `${Math.max(16, 24 * pct)}px`,
          color,
          opacity: 0.75,
          fontFamily: family,
          textShadow: shadow === 'none' ? undefined : '0 2px 8px rgba(0,0,0,0.7)'
        }}
      >
        {reference} <span style={{ opacity: 0.7 }}>· {version}</span>
      </p>
    </div>
  )
}
