import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, CircleAlert, RefreshCw, Wrench } from 'lucide-react'
import type { DownloadTools } from '@/shared/types/electronAPI'
import { diasDeAntiguedad, YTDLP_VIEJO_DIAS } from '@/shared/utils/downloads'
import Boton from '../ui/Boton'
import BarraProgreso from '../ui/BarraProgreso'
import { Panel } from '../ui/Panel'
import { desplegable } from '../ui/movimiento'

/**
 * Las tres herramientas externas de las descargas y su estado.
 *
 * Cuando está todo, se achica a una línea: no hay nada que hacer. Cuando falta
 * algo —o yt-dlp está viejo, que es la causa número uno de "no anda"—, se
 * despliega con el botón para resolverlo.
 */
export default function PanelHerramientas({
  tools,
  instalando,
  actualizando,
  onInstalar,
  onActualizar
}: {
  tools: DownloadTools | null
  instalando: { step: string; ratio: number | null } | null
  actualizando: boolean
  onInstalar: () => void
  onActualizar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  if (!tools) return null

  const dias = diasDeAntiguedad(tools.ytDlpVersion)
  const viejo = dias !== null && dias >= YTDLP_VIEJO_DIAS
  const falta = !tools.ytDlp || !tools.ffmpegDir || !tools.jsRuntime
  const desplegado = abierto || falta
  const ocupado = Boolean(instalando) || actualizando

  const filas = [
    {
      nombre: 'yt-dlp',
      para: 'baja el video',
      ok: Boolean(tools.ytDlp),
      detalle: tools.ytDlp
        ? `${tools.ytDlpVersion ?? 'versión desconocida'}${dias !== null ? ` · hace ${dias} días` : ''}`
        : 'no encontrado'
    },
    {
      nombre: 'ffmpeg',
      para: 'junta video y audio, arma el MP3',
      ok: Boolean(tools.ffmpegDir),
      detalle: tools.ffmpegDir ?? 'no encontrado'
    },
    {
      nombre: tools.jsRuntime?.name ?? 'deno',
      para: 'resuelve el desafío de YouTube',
      ok: Boolean(tools.jsRuntime),
      detalle: tools.jsRuntime?.path ?? 'no encontrado (sin esto YouTube no entrega los videos)'
    }
  ]

  return (
    <Panel className={`mb-4 ${falta ? 'border-listo-borde' : ''}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Wrench className={`h-4 w-4 ${falta ? 'text-listo' : 'text-cabina-tinta-tenue'}`} aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          {falta ? (
            <span className="font-semibold text-cabina-tinta">Faltan herramientas para descargar</span>
          ) : (
            <span className="text-cabina-tinta-dim">
              Herramientas listas
              {tools.ytDlpVersion && (
                <span className="font-mono text-cabina-tinta-tenue"> · yt-dlp {tools.ytDlpVersion}</span>
              )}
              {viejo && <span className="text-listo"> · tiene {dias} días, conviene actualizarlo</span>}
            </span>
          )}
        </p>
        {tools.ytDlp && (
          <Boton
            variante={viejo ? 'primario' : 'neutro'}
            tamano="sm"
            onClick={onActualizar}
            cargando={actualizando}
            disabled={ocupado}
            icono={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          >
            Actualizar yt-dlp
          </Boton>
        )}
        {falta && tools.instalable && (
          <Boton variante="primario" tamano="sm" onClick={onInstalar} cargando={Boolean(instalando)} disabled={ocupado}>
            Instalar lo que falta
          </Boton>
        )}
        {!falta && (
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Ocultar detalle de herramientas' : 'Ver detalle de herramientas'}
            icono={
              <ChevronDown
                className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
                aria-hidden
              />
            }
          />
        )}
      </div>

      {instalando && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-cabina-tinta-dim">
            {instalando.step}
            {instalando.ratio !== null && ` · ${Math.round(instalando.ratio * 100)} %`}
          </p>
          <BarraProgreso valor={instalando.ratio} etiqueta={instalando.step} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {desplegado && (
          <motion.div
            variants={desplegable}
            initial="cerrado"
            animate="abierto"
            exit="cerrado"
            className="overflow-hidden"
          >
            <ul className="mt-3 grid gap-2 md:grid-cols-3">
              {filas.map((f) => (
                <li key={f.nombre} className="rounded-lg border border-cabina-linea bg-cabina-alto/60 p-2.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-cabina-tinta">
                    {f.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-ok" aria-label="instalado" />
                    ) : (
                      <CircleAlert className="h-4 w-4 text-listo" aria-label="falta" />
                    )}
                    {f.nombre}
                  </p>
                  <p className="mt-0.5 text-[11px] text-cabina-tinta-tenue">{f.para}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-cabina-tinta-dim" title={f.detalle}>
                    {f.detalle}
                  </p>
                </li>
              ))}
            </ul>
            {falta && (
              <p className="mt-2 text-xs leading-relaxed text-cabina-tinta-tenue">
                No vienen con la app porque yt-dlp se desactualiza cada pocas semanas. También podés
                instalarlas con <code className="font-mono">scripts/herramientas</code> o poner la carpeta
                donde ya las tenés en Ajustes.
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-cabina-tinta-tenue">Dónde se buscó</summary>
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-cabina-tinta-tenue">
                {tools.searched.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}
