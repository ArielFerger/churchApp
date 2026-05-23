interface Props {
  mediaId: string | null
}

/**
 * Layer 1: full-screen looping background (image/video).
 * Fase 2 implementa el resolver mediaId → ruta. Por ahora solo deja el slot listo.
 */
export default function BackgroundLayer({ mediaId }: Props) {
  if (!mediaId) return null
  return (
    <div className="absolute inset-0 z-10 bg-black">
      <div className="flex h-full items-center justify-center text-slate-700">
        bg: {mediaId}
      </div>
    </div>
  )
}
