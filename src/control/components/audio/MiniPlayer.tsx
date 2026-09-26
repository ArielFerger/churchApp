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
    <footer
      className="flex h-16 shrink-0 items-center gap-3 border-t border-cabina-linea bg-cabina-panel px-3"
      aria-label="Reproductor de música"
    >
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
            <Music className="h-4 w-4 text-slate-600" aria-hidden />
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
            <p className="truncate text-xs text-slate-500">
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
          aria-label="Tema anterior"
        >
          <SkipBack className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!track}
          className="rounded-full bg-cabina-tinta p-2 text-cabina-negro transition-colors hover:bg-white disabled:bg-slate-700 disabled:text-slate-500"
          title={isPlaying ? 'Pausar' : 'Reproducir'}
          aria-label={isPlaying ? 'Pausar la música' : 'Reproducir la música'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4 pl-0.5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!isPlaying && !isFadingOut}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title="Stop con fade-out"
          aria-label="Detener la música con fundido"
        >
          <Square className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={library.length === 0}
          className="relative rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          title={queue.length > 0 ? `Siguiente (${queue.length} en cola)` : 'Siguiente'}
          aria-label={queue.length > 0 ? `Siguiente tema, ${queue.length} en cola` : 'Siguiente tema'}
        >
          <SkipForward className="h-4 w-4" aria-hidden />
          {queue.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-listo px-1 text-[9px] font-semibold text-cabina-negro">
              {queue.length}
            </span>
          )}
        </button>
      </div>

      {/* Progreso + volumen: ancho fijo para que el transporte quede centrado,
          más angosto en ventanas chicas. */}
      <div className="flex w-52 shrink-0 items-center gap-3 lg:w-80">
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
    <div className="flex min-w-0 flex-1 items-center gap-2 text-[10px] text-slate-500">
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
        // min-w-0: un range de Chromium mide ~130 px por defecto y, como ítem
        // flex, no se achica por debajo de eso. En ventanas angostas empujaba
        // el reproductor fuera de la pantalla (scroll horizontal en toda la app).
        className="seek-range h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full"
        aria-label="Posición del tema"
        aria-valuetext={`${formatTime(shown)} de ${formatTime(duration)}`}
        style={{
          // Ámbar (listo) sobre el gris de cabina: el azul no significa nada acá.
          background: `linear-gradient(to right, #f5b342 0%, #f5b342 ${pct}%, #332e29 ${pct}%, #332e29 100%)`
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
    <div className="flex shrink-0 items-center gap-1.5">
      <Volume2 className="h-3.5 w-3.5 text-slate-500" aria-hidden />
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-14 cursor-pointer rounded-full accent-listo lg:w-20"
        title={`Volumen: ${Math.round(value * 100)}%`}
        aria-label="Volumen de la música"
        aria-valuetext={`${Math.round(value * 100)} por ciento`}
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
