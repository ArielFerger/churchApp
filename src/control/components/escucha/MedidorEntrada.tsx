import { rmsADb } from '@/shared/utils/segmentadorVoz'

/**
 * El medidor de la entrada: la única forma de saber que la consola está
 * entrando, y de ver por qué algo se transcribe o no.
 *
 * Escala en decibeles (de -60 a 0 dBFS), como el vúmetro de una consola: en
 * escala lineal la voz normal ocupaba un cuarto de la barra y el ruido de
 * fondo no se veía. La marca vertical es el umbral de voz, que se mueve solo
 * porque se adapta al ruido de fondo.
 */

const PISO_DB = -60

function aPorcentaje(rms: number): number {
  const db = rmsADb(rms)
  return Math.max(0, Math.min(100, ((db - PISO_DB) / -PISO_DB) * 100))
}

export default function MedidorEntrada({
  nivel,
  umbral,
  hablando,
  activo
}: {
  nivel: number
  umbral: number
  hablando: boolean
  activo: boolean
}) {
  const pct = activo ? aPorcentaje(nivel) : 0
  const marca = aPorcentaje(umbral)
  const db = Math.round(rmsADb(nivel))

  return (
    <div>
      <div
        role="meter"
        aria-label="Nivel de la entrada de audio"
        aria-valuemin={PISO_DB}
        aria-valuemax={0}
        aria-valuenow={activo ? Math.max(PISO_DB, db) : PISO_DB}
        aria-valuetext={activo ? `${Math.max(PISO_DB, db)} dB${hablando ? ', hay voz' : ''}` : 'Apagado'}
        className="relative h-3 overflow-hidden rounded-full bg-cabina-negro ring-1 ring-inset ring-cabina-linea"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-75 ease-out ${
            hablando ? 'bg-listo' : 'bg-cabina-tinta-tenue'
          }`}
          style={{ width: `${pct}%` }}
        />
        {activo && umbral > 0 && (
          <span
            aria-hidden
            className="absolute top-0 h-full w-0.5 bg-cabina-tinta transition-[left] duration-500"
            style={{ left: `${marca}%` }}
            title="Umbral de voz: por debajo se considera silencio. Se ajusta solo al ruido de fondo."
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-cabina-tinta-tenue">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              !activo ? 'bg-cabina-linea-fuerte' : hablando ? 'animate-latido bg-listo' : 'bg-cabina-tinta-tenue'
            }`}
          />
          {!activo
            ? 'Detenida.'
            : hablando
              ? 'Hay voz: se está juntando la frase.'
              : 'Silencio: no se transcribe nada hasta que entre voz.'}
        </span>
        {activo && (
          <span className="font-mono tabular-nums" aria-hidden>
            {Math.max(PISO_DB, db)} dB
          </span>
        )}
      </div>
    </div>
  )
}
