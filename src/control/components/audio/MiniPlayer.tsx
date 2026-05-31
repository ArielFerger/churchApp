import { useMemo, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Square, Volume2, Music } from 'lucide-react'
import { useAudioStore } from '@/shared/store/audioStore'
import { audioEngine } from '@/control/audio/audioEngine'
import type { AudioTrack } from '@/shared/types/audio'

export default function MiniPlayer() {
  const {
    library,
    currentTrackId,
    isPlaying,
    position,
    duration,
    volume,
    isFadingOut,
    queue,
    nextTrack,
    prevTrack
  } = useAudioStore()

  const track = useMemo<AudioTrack | null>(
    () => library.find((t) => t.id === currentTrackId) ?? null,
    [library, currentTrackId]
  )

  const onPlayPause = () => {
    if (!track) return
    if (isPlaying) {
      audioEngine.pause()
    } else {
      void audioEngine.play(track, position)
    }
  }

  const onStop = () => {
    audioEngine.stopWithFade()
  }

  const onPrev = () => {
    const prev = prevTrack()
    if (prev) void audioEngine.play(prev, 0)
  }

  const onNext = () => {
    const next = nextTrack()
    if (next) void audioEngine.play(next, 0)
  }

  return (
    <footer className="flex h-16 shrink-0 items-center gap-3 border-t border-slate-700 bg-slate-900/80 px-3 backdrop-blur">
      {/* Track info */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-800">
          {track?.artworkPath ? (
            <img
              src={`audio://${track.id}/artwork`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Music className="h-4 w-4 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {track ? (
            <>
              <p className="truncate text-sm font-medium text-slate-100" title={track.title}>
                {track.title}
              </p>
              <p className="truncate text-xs text-slate-500">
                {track.artist || 'Sin artista'} {track.album ? `· ${track.album}` : ''}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              {library.length === 0
                ? 'No hay tracks cargados — configurá la carpeta de audio en Ajustes'
                : 'Ningún track seleccionado'}
            </p>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={library.length === 0}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title="Anterior"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!track}
          className="rounded-full bg-white p-2 text-slate-900 transition-colors hover:bg-slate-200 disabled:bg-slate-700 disabled:text-slate-500"
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!isPlaying && !isFadingOut}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title="Stop con fade-out"
        >
          <Square className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={library.length === 0}
          className="relative rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title={queue.length > 0 ? `Siguiente (${queue.length} en cola)` : 'Siguiente'}
        >
          <SkipForward className="h-4 w-4" />
          {queue.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-semibold text-white">
              {queue.length}
            </span>
          )}
        </button>
      </div>

      {/* Progress + volume — fixed width so transport stays centered */}
      <div className="flex w-80 shrink-0 items-center gap-3">
        <ProgressBar position={position} duration={duration} onSeek={(p) => audioEngine.seek(p)} />
        <VolumeControl value={volume} onChange={(v) => audioEngine.setVolume(v)} />
      </div>

      {isFadingOut && (
        <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
          fade-out
        </span>
      )}
    </footer>
  )
}

interface ProgressBarProps {
  position: number
  duration: number
  onSeek: (pos: number) => void
}

function ProgressBar({ position, duration, onSeek }: ProgressBarProps) {
  // Local scrub state so dragging isn't fought by the 4×/sec playback tick.
  const [scrub, setScrub] = useState<number | null>(null)
  const shown = scrub ?? position
  const pct = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0
  return (
    <div className="flex flex-1 items-center gap-2 text-[10px] text-slate-500">
      <span className="w-9 text-right font-mono">{formatTime(shown)}</span>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step="0.5"
        value={shown}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          setScrub(v)
          onSeek(v) // seek live so you hear/see the new position immediately
        }}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
        className="seek-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${pct}%, rgb(51 65 85) ${pct}%, rgb(51 65 85) 100%)`
        }}
      />
      <span className="w-9 font-mono">{formatTime(duration)}</span>
    </div>
  )
}

interface VolumeControlProps {
  value: number
  onChange: (v: number) => void
}

function VolumeControl({ value, onChange }: VolumeControlProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Volume2 className="h-3.5 w-3.5 text-slate-500" />
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500"
        title={`Volumen: ${Math.round(value * 100)}%`}
      />
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
