import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Loader2 } from 'lucide-react'
import type { FragmentoOido } from '@/shared/store/escuchaStore'
import { detectarReferencias } from '@/shared/utils/escuchaBiblica'
import { Panel, Rotulo } from '../ui/Panel'
import { fundido } from '../ui/movimiento'

/**
 * "Lo que se está oyendo": la transcripción en vivo, frase por frase, con las
 * citas resaltadas. Es lo que deja al operador entender por qué apareció (o
 * por qué NO apareció) una sugerencia: si whisper escribió "Juan Trece" en vez
 * de "Juan 3", acá se ve.
 *
 * Sigue solo al final, como un chat, salvo que el operador haya subido a leer
 * algo: ahí se queda quieto y ofrece volver abajo.
 */
export default function TranscripcionEnVivo({
  fragmentos,
  pendientes,
  hablando,
  activa
}: {
  fragmentos: FragmentoOido[]
  pendientes: number
  hablando: boolean
  activa: boolean
}) {
  const caja = useRef<HTMLDivElement | null>(null)
  const [pegadoAbajo, setPegadoAbajo] = useState(true)

  useEffect(() => {
    const el = caja.current
    if (el && pegadoAbajo) el.scrollTop = el.scrollHeight
  }, [fragmentos.length, pendientes, pegadoAbajo])

  return (
    <Panel aria-labelledby="escucha-transcripcion" className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Rotulo id="escucha-transcripcion">Lo que se está oyendo</Rotulo>
        <span className="font-mono text-[11px] text-cabina-tinta-tenue">
          {fragmentos.length} {fragmentos.length === 1 ? 'frase' : 'frases'}
        </span>
      </div>
      <div className="relative min-h-0">
        <div
          ref={caja}
          onScroll={(e) => {
            const el = e.currentTarget
            setPegadoAbajo(el.scrollHeight - el.scrollTop - el.clientHeight < 24)
          }}
          className="max-h-72 min-h-[120px] space-y-2 overflow-y-auto rounded-lg bg-cabina-negro/60 p-3 text-sm leading-relaxed lg:max-h-[42vh]"
          // No se anuncia: sería una radio de fondo encima del predicador. Lo
          // que se anuncia son las sugerencias.
          aria-live="off"
        >
          {fragmentos.length === 0 && (
            <p className="text-cabina-tinta-tenue">
              {activa ? 'Esperando la primera frase…' : 'Todavía no se transcribió nada.'}
            </p>
          )}
          <AnimatePresence initial={false}>
            {fragmentos.map((f) => (
              <motion.p
                key={f.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fundido}
                className="text-cabina-tinta-dim"
              >
                <ConCitas texto={f.texto} />
                {f.ms !== null && (
                  <span className="ml-2 font-mono text-[10px] text-cabina-tinta-tenue">
                    {(f.ms / 1000).toFixed(1)} s
                  </span>
                )}
              </motion.p>
            ))}
          </AnimatePresence>
          {activa && (pendientes > 0 || hablando) && (
            <p className="inline-flex items-center gap-2 text-xs text-cabina-tinta-tenue">
              {pendientes > 0 ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> transcribiendo…
                </>
              ) : (
                <span className="animate-latido">escuchando una frase…</span>
              )}
            </p>
          )}
        </div>
        {!pegadoAbajo && (
          <button
            type="button"
            onClick={() => setPegadoAbajo(true)}
            className="absolute bottom-2 right-3 inline-flex items-center gap-1 rounded-full border border-cabina-linea-fuerte bg-cabina-alto px-2.5 py-1 text-xs text-cabina-tinta shadow-lg"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden /> Ir a lo último
          </button>
        )}
      </div>
    </Panel>
  )
}

/** El texto con las citas explícitas resaltadas. */
function ConCitas({ texto }: { texto: string }) {
  const partes = useMemo(() => {
    const refs = detectarReferencias(texto).filter((r) => r.span)
    const out: { t: string; cita: boolean }[] = []
    let desde = 0
    for (const r of refs) {
      const [a, b] = r.span as [number, number]
      if (a < desde) continue
      if (a > desde) out.push({ t: texto.slice(desde, a), cita: false })
      out.push({ t: texto.slice(a, b), cita: true })
      desde = b
    }
    if (desde < texto.length) out.push({ t: texto.slice(desde), cita: false })
    return out
  }, [texto])

  return (
    <>
      {partes.map((p, i) =>
        p.cita ? (
          <mark key={i} className="rounded bg-listo-suave px-0.5 font-medium text-listo">
            {p.t}
          </mark>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </>
  )
}
