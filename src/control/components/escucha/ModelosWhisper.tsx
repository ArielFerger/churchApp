import { CheckCircle2, Download, Trash2 } from 'lucide-react'
import { WHISPER_MODELS, type WhisperModelId } from '@/shared/utils/whisper'
import type { EscuchaStatus } from '@/shared/types/escucha'
import Boton from '../ui/Boton'
import BarraProgreso from '../ui/BarraProgreso'

/**
 * Elegir, bajar y borrar modelos de transcripción.
 *
 * Cambiar de modelo es una decisión y no un botón al pasar: cada uno pesa
 * cientos de MB y exige distinto de la CPU. Por eso cada tarjeta dice cuánto
 * pesa, cuánto exige y para qué sirve, y el que está en uso no se puede borrar.
 */
export default function ModelosWhisper({
  estado,
  instalando,
  bloqueado,
  onElegir,
  onInstalar,
  onBorrar
}: {
  estado: EscuchaStatus | null
  instalando: { step: string; ratio: number | null } | null
  /** Mientras se escucha no se cambia de modelo: reiniciaría el servidor. */
  bloqueado: boolean
  onElegir: (id: WhisperModelId) => void
  onInstalar: (id: WhisperModelId) => void
  onBorrar: (id: WhisperModelId) => void
}) {
  const instalados = new Set(estado?.instalados ?? [])
  const elegido = estado?.modelo ?? 'base'

  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modelo de transcripción">
        {WHISPER_MODELS.map((m) => {
          const esElegido = m.id === elegido
          const esta = instalados.has(m.id)
          return (
            <li
              key={m.id}
              className={`flex flex-col rounded-lg border p-3 transition-colors ${
                esElegido ? 'border-listo-borde bg-listo-suave' : 'border-cabina-linea bg-cabina-alto/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={esElegido}
                  disabled={!esta || bloqueado || esElegido}
                  onClick={() => onElegir(m.id)}
                  className="min-w-0 text-left disabled:cursor-default"
                  title={esta ? 'Usar este modelo' : 'Primero hay que bajarlo'}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-cabina-tinta">
                    {esElegido && <CheckCircle2 className="h-4 w-4 text-listo" aria-hidden />}
                    {m.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-cabina-tinta-tenue">
                    {m.mb} MB · CPU{' '}
                    <span aria-label={`exigencia ${m.peso} de 4`}>
                      {'▮'.repeat(m.peso)}
                      <span className="opacity-30">{'▮'.repeat(4 - m.peso)}</span>
                    </span>
                  </span>
                </button>
                {esta ? (
                  !esElegido && (
                    <Boton
                      variante="peligro"
                      tamano="sm"
                      soloIcono
                      disabled={bloqueado}
                      onClick={() => onBorrar(m.id)}
                      aria-label={`Borrar el modelo ${m.label}`}
                      title="Borrar para liberar espacio"
                      icono={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                    />
                  )
                ) : (
                  <Boton
                    variante="neutro"
                    tamano="sm"
                    disabled={Boolean(instalando) || estado?.instalable === false}
                    onClick={() => onInstalar(m.id)}
                    aria-label={`Bajar el modelo ${m.label} (${m.mb} MB)`}
                    icono={<Download className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Bajar
                  </Boton>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-snug text-cabina-tinta-dim">{m.hint}</p>
            </li>
          )
        })}
      </ul>
      {instalando && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-cabina-tinta-dim">
            {instalando.step}
            {instalando.ratio !== null && ` · ${Math.round(instalando.ratio * 100)} %`}
          </p>
          <BarraProgreso valor={instalando.ratio} etiqueta={instalando.step} />
        </div>
      )}
    </div>
  )
}
