import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Copy,
  Film,
  FolderOpen,
  Loader2,
  Music,
  RotateCcw,
  Scissors,
  Trash2,
  X
} from 'lucide-react'
import {
  ACTIVOS,
  formatBytes,
  formatDuration,
  formatSpeed,
  type DownloadJob
} from '@/shared/utils/downloads'
import Boton from '../ui/Boton'
import BarraProgreso from '../ui/BarraProgreso'
import { filaLista } from '../ui/movimiento'
import { useMenuContextual } from '../ui/MenuContextual'
import { copiar } from '../../menus'
import { ExternalLink } from 'lucide-react'

/** Una descarga de la cola, con sus acciones según en qué etapa esté. */
const FilaDescarga = forwardRef<HTMLLIElement, { job: DownloadJob }>(function FilaDescarga(
  { job },
  ref
) {
  const api = window.electronAPI
  const abrirMenu = useMenuContextual()
  const p = job.progress
  const pct = p?.ratio != null ? Math.round(p.ratio * 100) : null
  const activo = ACTIVOS.includes(job.stage)
  const nombre = job.title ?? job.url
  const tipo =
    job.kind === 'audio'
      ? `MP3 ${job.bitrate}k`
      : job.quality === 'best'
        ? 'Video máx.'
        : `Video ${job.quality}p`

  return (
    <motion.li
      ref={ref}
      layout
      variants={filaLista}
      initial="inicial"
      animate="visible"
      exit="salida"
      className={`rounded-xl border bg-cabina-panel p-3 ${
        job.stage === 'error'
          ? 'border-falla-borde'
          : job.stage === 'done'
            ? 'border-ok-borde'
            : 'border-cabina-linea'
      }`}
      aria-label={nombre}
      onContextMenu={(e) =>
        abrirMenu(e, [
          { titulo: nombre },
          job.stage === 'done' && {
            etiqueta: 'Mostrar en la carpeta',
            icono: <FolderOpen className="h-4 w-4" />,
            onSelect: () => void api?.showDownloadInFolder(job.id)
          },
          (job.stage === 'error' || job.stage === 'canceled') && {
            etiqueta: 'Reintentar',
            icono: <RotateCcw className="h-4 w-4" />,
            onSelect: () => void api?.retryDownload(job.id)
          },
          {
            etiqueta: 'Abrir en el navegador',
            icono: <ExternalLink className="h-4 w-4" />,
            onSelect: () => window.open(job.url, '_blank')
          },
          {
            etiqueta: 'Copiar el enlace',
            icono: <Copy className="h-4 w-4" />,
            onSelect: () => copiar(job.url, 'Enlace copiado')
          },
          Boolean(job.errorDetail) && {
            etiqueta: 'Copiar el detalle del error',
            icono: <Copy className="h-4 w-4" />,
            onSelect: () => copiar(job.errorDetail ?? '', 'Detalle copiado')
          },
          'separador',
          activo
            ? {
                etiqueta: 'Cancelar',
                icono: <X className="h-4 w-4" />,
                variante: 'peligro',
                onSelect: () => void api?.cancelDownload(job.id)
              }
            : {
                etiqueta: 'Sacar de la lista',
                detalle: 'el archivo queda',
                icono: <Trash2 className="h-4 w-4" />,
                variante: 'peligro',
                onSelect: () => void api?.removeDownload(job.id)
              }
        ])
      }
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-cabina-negro">
          {job.thumbnail ? (
            <img src={job.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-cabina-tinta-tenue">
              {job.kind === 'audio' ? (
                <Music className="h-5 w-5" aria-hidden />
              ) : (
                <Film className="h-5 w-5" aria-hidden />
              )}
            </div>
          )}
          {job.durationSec != null && (
            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 font-mono text-[10px] text-white">
              {formatDuration(job.durationSec)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-cabina-tinta" title={nombre}>
            {nombre}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-cabina-tinta-tenue">
            <span className="font-mono uppercase">{tipo}</span>
            {job.seccion && (
              <span className="inline-flex items-center gap-1 text-listo">
                <Scissors className="h-3 w-3" aria-hidden />
                {formatDuration(job.seccion.desde)}–{formatDuration(job.seccion.hasta)}
              </span>
            )}
            {job.uploader && <span>· {job.uploader}</span>}
          </p>

          {job.stage === 'queued' && <p className="mt-1.5 text-xs text-cabina-tinta-tenue">En espera…</p>}
          {job.stage === 'preparing' && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-cabina-tinta-dim">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Consultando el video… (puede tardar hasta un minuto)
            </p>
          )}
          {(job.stage === 'downloading' || job.stage === 'processing') && (
            <div className="mt-2">
              <BarraProgreso
                valor={job.stage === 'processing' ? null : (p?.ratio ?? null)}
                etiqueta={`Descarga de ${nombre}`}
              />
              <p className="mt-1 font-mono text-[11px] text-cabina-tinta-tenue">
                {job.stage === 'processing' ? (
                  'Procesando con ffmpeg…'
                ) : (
                  <>
                    {pct !== null ? `${pct}% · ` : ''}
                    {formatBytes(p?.downloadedBytes ?? null)}
                    {p?.totalBytes ? ` de ${formatBytes(p.totalBytes)}` : ''} ·{' '}
                    {formatSpeed(p?.speed ?? null)}
                    {p?.eta != null && p.eta > 0 ? ` · faltan ${formatDuration(p.eta)}` : ''}
                  </>
                )}
              </p>
            </div>
          )}
          {job.stage === 'done' && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Listo{job.filePath ? ` · ${job.filePath.split(/[\\/]/).pop()}` : ''}
            </p>
          )}
          {job.stage === 'canceled' && <p className="mt-1.5 text-xs text-cabina-tinta-tenue">Cancelada</p>}
          {job.stage === 'error' && (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-falla">{job.error}</p>
              {job.errorDetail && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-cabina-tinta-tenue hover:text-cabina-tinta-dim">
                    Ver detalle técnico
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-cabina-negro p-2 font-mono text-[10px] leading-relaxed text-cabina-tinta-dim">
                    {job.errorDetail}
                  </pre>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    className="mt-1"
                    onClick={() => void navigator.clipboard.writeText(job.errorDetail ?? '')}
                    icono={<Copy className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Copiar
                  </Boton>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {job.stage === 'done' && (
            <Boton
              variante="fantasma"
              tamano="sm"
              soloIcono
              onClick={() => void api?.showDownloadInFolder(job.id)}
              aria-label={`Mostrar ${nombre} en su carpeta`}
              title="Mostrar en la carpeta"
              icono={<FolderOpen className="h-4 w-4" aria-hidden />}
            />
          )}
          {(job.stage === 'error' || job.stage === 'canceled') && (
            <Boton
              variante="fantasma"
              tamano="sm"
              soloIcono
              onClick={() => void api?.retryDownload(job.id)}
              aria-label={`Reintentar ${nombre}`}
              title="Reintentar"
              icono={<RotateCcw className="h-4 w-4" aria-hidden />}
            />
          )}
          {activo ? (
            <Boton
              variante="peligro"
              tamano="sm"
              soloIcono
              onClick={() => void api?.cancelDownload(job.id)}
              aria-label={`Cancelar ${nombre}`}
              title="Cancelar"
              icono={<X className="h-4 w-4" aria-hidden />}
            />
          ) : (
            <Boton
              variante="peligro"
              tamano="sm"
              soloIcono
              onClick={() => void api?.removeDownload(job.id)}
              aria-label={`Sacar ${nombre} de la lista`}
              title="Sacar de la lista (el archivo no se borra)"
              icono={<Trash2 className="h-4 w-4" aria-hidden />}
            />
          )}
        </div>
      </div>
    </motion.li>
  )
})

export default FilaDescarga
