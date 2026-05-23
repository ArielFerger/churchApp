import { useLiveStore } from '@/shared/store/liveStore'

export default function LiveIndicator() {
  const { isLive, isBlackout } = useLiveStore()

  if (!isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        OFF
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isBlackout ? 'bg-slate-700 text-slate-100' : 'bg-red-600 text-white'
      }`}
      title={isBlackout ? 'Pantalla en negro' : 'Proyectando en vivo'}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isBlackout ? 'bg-slate-300' : 'animate-pulse bg-white'
        }`}
      />
      {isBlackout ? 'BLACKOUT' : 'LIVE'}
    </span>
  )
}
