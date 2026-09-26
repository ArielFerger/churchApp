import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  Info,
  Keyboard,
  Monitor,
  RefreshCw,
  Settings as SettingsIcon,
  TrendingDown,
  TrendingUp,
  Volume2,
  X
} from 'lucide-react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import type { AppSettings, DisplayInfo } from '@/shared/types/ipc'
import type { AppInfo, CarpetaAbrible } from '@/shared/types/electronAPI'
import Boton from '../components/ui/Boton'
import Interruptor from '../components/ui/Interruptor'
import { EncabezadoPagina, Panel, Tecla } from '../components/ui/Panel'
import { desplegable, resorte } from '../components/ui/movimiento'

type FolderKey = Extract<
  keyof AppSettings,
  'mediaFolder' | 'audioFolder' | 'songsFolder' | 'liveLoopFolder' | 'bibleBackgroundsFolder' | 'toolsFolder'
>

const folderRows: { key: FolderKey; label: string; hint?: string }[] = [
  { key: 'mediaFolder', label: 'Imágenes / videos / GIFs', hint: 'Acá también caen los videos que se bajan de YouTube.' },
  {
    key: 'liveLoopFolder',
    label: 'Videos de loop (En Vivo)',
    hint: 'Carpeta aparte para los fondos en loop de "En Vivo". Admite subcarpetas. Si no se configura, se usa la carpeta de media.'
  },
  {
    key: 'bibleBackgroundsFolder',
    label: 'Fondos de Biblia',
    hint: 'Carpeta aparte para los fondos de los versículos proyectados. Admite subcarpetas. Si no se configura, se usa la carpeta de media.'
  },
  { key: 'audioFolder', label: 'Música', hint: 'Acá también caen los MP3 que se bajan de YouTube.' },
  { key: 'songsFolder', label: 'Canciones' },
  {
    key: 'toolsFolder',
    label: 'Herramientas (yt-dlp, ffmpeg, whisper)',
    hint: 'Si no se configura, se buscan en las ubicaciones habituales y en el PATH; desde Descargar y Escucha se pueden instalar solas.'
  }
]

/** Los atajos de la app, en un solo lugar para que se puedan descubrir. */
const ATAJOS: { teclas: string[]; que: string }[] = [
  { teclas: ['Esc'], que: 'Detener todo: corta contenido, fondo y presentaciones (desde cualquier ventana)' },
  { teclas: ['F11'], que: 'Mostrar u ocultar la ventana de proyección' },
  { teclas: ['Ctrl', '1…8'], que: 'Ir a cada sección, en el orden del menú' },
  { teclas: ['Ctrl', 'Enter'], que: 'Escucha: proyectar la cita más nueva' },
  { teclas: ['Ctrl', '← / →'], que: 'Escucha: versículo anterior / siguiente' },
  { teclas: ['Shift', 'F10'], que: 'Menú de opciones del elemento enfocado (lo mismo que el clic derecho)' },
  { teclas: ['Tab'], que: 'Moverse con el teclado; el primer Tab ofrece saltar al contenido' }
]

export default function Settings() {
  const { settings, displays, loaded, load, update, refreshDisplays } = useSettingsStore()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    if (!loaded) void load()
    void window.electronAPI?.getAppInfo?.().then(setInfo)
  }, [loaded, load])

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cabina-tinta-tenue">Cargando…</p>
      </div>
    )
  }

  const selectedId = settings?.projectionDisplayId ?? null

  async function pickFolder(key: FolderKey, title: string) {
    const api = window.electronAPI
    if (!api) return
    const result = await api.showOpenDialog({ title, properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return
    await update({ [key]: result.filePaths[0] } as Partial<AppSettings>)
  }

  async function abrir(cual: CarpetaAbrible) {
    const ok = await window.electronAPI?.openFolder?.(cual)
    if (!ok) toast.error('No se pudo abrir la carpeta', { description: 'Puede que ya no exista.' })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-5 sm:px-6">
        <EncabezadoPagina icono={<SettingsIcon className="h-6 w-6" />} titulo="Ajustes">
          La pantalla donde se proyecta, las carpetas de contenido y cómo suenan los videos.
        </EncabezadoPagina>

        <div className="space-y-4">
          {/* Pantalla de proyección */}
          <Panel aria-labelledby="ajustes-pantalla">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="ajustes-pantalla" className="flex items-center gap-2 text-sm font-semibold text-cabina-tinta">
                <Monitor className="h-4 w-4 text-cabina-tinta-tenue" aria-hidden />
                Pantalla de proyección
              </h2>
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => void refreshDisplays()}
                icono={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              >
                Buscar pantallas
              </Boton>
            </div>

            {displays.length === 0 ? (
              <p className="text-sm text-cabina-tinta-tenue">No se detectaron pantallas.</p>
            ) : (
              <MapaDePantallas
                displays={displays}
                seleccionada={selectedId}
                onElegir={(id) => void update({ projectionDisplayId: id })}
              />
            )}

            <p className="mt-3 text-xs text-cabina-tinta-tenue">
              La ventana de proyección se mueve en caliente — nunca se cierra ni se recrea. Si se
              conecta el proyector con la app abierta, tocá «Buscar pantallas».
            </p>
          </Panel>

          {/* Carpetas */}
          <Panel aria-labelledby="ajustes-carpetas">
            <h2 id="ajustes-carpetas" className="mb-3 flex items-center gap-2 text-sm font-semibold text-cabina-tinta">
              <Folder className="h-4 w-4 text-cabina-tinta-tenue" aria-hidden />
              Carpetas de contenido
            </h2>
            {/* `grid-cols-1` + `min-w-0`: sin esto, una ruta larga estira la
                fila más allá de la pantalla (los ítems de grilla no se achican
                por debajo de su contenido). */}
            <ul className="grid grid-cols-1 gap-2">
              {folderRows.map((row) => {
                const value = settings?.[row.key] ?? null
                return (
                  <li
                    key={row.key}
                    className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-cabina-linea bg-cabina-alto/50 px-3 py-2.5 sm:flex-nowrap"
                  >
                    <FolderOpen
                      className={`h-4 w-4 shrink-0 ${value ? 'text-listo' : 'text-cabina-tinta-tenue'}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-cabina-tinta">{row.label}</p>
                      {row.hint && (
                        <p className="mt-0.5 text-xs leading-snug text-cabina-tinta-tenue">{row.hint}</p>
                      )}
                      <p
                        className={`mt-1 truncate font-mono text-xs ${value ? 'text-cabina-tinta-dim' : 'text-cabina-tinta-tenue'}`}
                        title={value ?? undefined}
                      >
                        {value ?? 'no configurada'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {value && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          soloIcono
                          onClick={() => void abrir(row.key)}
                          aria-label={`Abrir la carpeta de ${row.label}`}
                          title="Abrir en el explorador"
                          icono={<ExternalLink className="h-4 w-4" aria-hidden />}
                        />
                      )}
                      <Boton
                        variante="neutro"
                        tamano="sm"
                        onClick={() => void pickFolder(row.key, `Carpeta de ${row.label.toLowerCase()}`)}
                      >
                        {value ? 'Cambiar' : 'Elegir'}
                      </Boton>
                      {value && (
                        <Boton
                          variante="peligro"
                          tamano="sm"
                          soloIcono
                          onClick={() => void update({ [row.key]: null } as Partial<AppSettings>)}
                          aria-label={`Quitar la carpeta de ${row.label}`}
                          title="Quitar (los archivos no se tocan)"
                          icono={<X className="h-4 w-4" aria-hidden />}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {/* Audio de los videos */}
          <Panel aria-labelledby="ajustes-audio">
            <h2 id="ajustes-audio" className="mb-1 flex items-center gap-2 text-sm font-semibold text-cabina-tinta">
              <Volume2 className="h-4 w-4 text-cabina-tinta-tenue" aria-hidden />
              Audio de los videos
            </h2>
            <p className="mb-3 text-xs text-cabina-tinta-tenue">
              Suavizá el sonido de los videos al proyectarlos. Las dos opciones son independientes.
            </p>
            <div className="grid gap-2">
              <ToggleRow
                icon={<TrendingUp className="h-4 w-4 shrink-0 text-ok" aria-hidden />}
                label="Entrada — audio de bajito a alto"
                description="Al empezar el video, el audio sube gradualmente."
                checked={settings?.videoFadeIn ?? true}
                onChange={(v) => void update({ videoFadeIn: v })}
                durationSec={settings?.videoFadeInSec ?? 1}
                onDurationChange={(s) => void update({ videoFadeInSec: s })}
              />
              <ToggleRow
                icon={<TrendingDown className="h-4 w-4 shrink-0 text-listo" aria-hidden />}
                label="Salida — audio de alto a bajito"
                description="Al terminar el video, el audio baja gradualmente."
                checked={settings?.videoFadeOut ?? false}
                onChange={(v) => void update({ videoFadeOut: v })}
                durationSec={settings?.videoFadeOutSec ?? 2.5}
                onDurationChange={(s) => void update({ videoFadeOutSec: s })}
              />
            </div>
          </Panel>

          {/* Atajos */}
          <Panel aria-labelledby="ajustes-atajos">
            <h2 id="ajustes-atajos" className="mb-3 flex items-center gap-2 text-sm font-semibold text-cabina-tinta">
              <Keyboard className="h-4 w-4 text-cabina-tinta-tenue" aria-hidden />
              Atajos de teclado
            </h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              {ATAJOS.map((a) => (
                <div key={a.que} className="contents">
                  <dt className="flex items-center gap-1">
                    {a.teclas.map((t, i) => (
                      <span key={t} className="flex items-center gap-1">
                        {i > 0 && <span className="text-cabina-tinta-tenue">+</span>}
                        <Tecla>{t}</Tecla>
                      </span>
                    ))}
                  </dt>
                  <dd className="text-sm text-cabina-tinta-dim">{a.que}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Acerca de */}
          {info && <AcercaDe info={info} onAbrir={(c) => void abrir(c)} />}
        </div>
      </div>
    </div>
  )
}

/**
 * Las pantallas dibujadas como están ubicadas en el escritorio, a escala. Es
 * mucho más fácil reconocer "la de la derecha, 1920×1080" que "Display
 * 2688491625".
 */
function MapaDePantallas({
  displays,
  seleccionada,
  onElegir
}: {
  displays: DisplayInfo[]
  seleccionada: number | null
  onElegir: (id: number) => void
}) {
  const caja = useMemo(() => {
    const minX = Math.min(...displays.map((d) => d.bounds.x))
    const minY = Math.min(...displays.map((d) => d.bounds.y))
    const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width))
    const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height))
    return { minX, minY, ancho: maxX - minX, alto: maxY - minY }
  }, [displays])

  // El proyector suele ser la que no es la principal: si no se eligió
  // ninguna, se marca la que la app va a usar por defecto.
  const efectiva =
    seleccionada ?? displays.find((d) => !d.isPrimary)?.id ?? displays.find((d) => d.isPrimary)?.id

  return (
    <div>
      <div
        className={`relative mx-auto w-full ${displays.length === 1 ? 'max-w-xs' : 'max-w-xl'}`}
        style={{ aspectRatio: `${caja.ancho} / ${Math.max(caja.alto, caja.ancho * 0.28)}` }}
        role="radiogroup"
        aria-label="Pantalla donde se proyecta"
      >
        {displays.map((d, i) => {
          const activa = d.id === efectiva
          return (
            <motion.button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={activa}
              aria-label={`Pantalla ${i + 1}${d.isPrimary ? ', principal' : ''}, ${d.bounds.width} por ${d.bounds.height}`}
              onClick={() => onElegir(d.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={resorte}
              className={`absolute flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 p-1 text-center transition-colors ${
                activa
                  ? 'border-listo bg-listo-suave text-listo'
                  : 'border-cabina-linea-fuerte bg-cabina-alto text-cabina-tinta-dim hover:border-cabina-tinta-tenue'
              }`}
              style={{
                left: `${((d.bounds.x - caja.minX) / caja.ancho) * 100}%`,
                top: `${((d.bounds.y - caja.minY) / caja.alto) * 100}%`,
                width: `calc(${(d.bounds.width / caja.ancho) * 100}% - 6px)`,
                height: `calc(${(d.bounds.height / caja.alto) * 100}% - 6px)`
              }}
            >
              <span className="font-display text-lg font-bold">{i + 1}</span>
              <span className="font-mono text-[10px]">
                {d.bounds.width}×{d.bounds.height}
              </span>
              {d.isPrimary && <span className="text-[10px] uppercase tracking-rotulo">principal</span>}
              {activa && (
                <span className="text-[10px] font-semibold uppercase tracking-rotulo">proyección</span>
              )}
            </motion.button>
          )
        })}
      </div>
      {displays.length === 1 && (
        <p className="mt-3 text-xs text-listo">
          Hay una sola pantalla: la proyección se abre encima de esta ventana. Conectá el proyector
          y tocá «Buscar pantallas».
        </p>
      )}
    </div>
  )
}

function AcercaDe({ info, onAbrir }: { info: AppInfo; onAbrir: (c: CarpetaAbrible) => void }) {
  const [ver, setVer] = useState(false)
  const texto = [
    `Church Projector ${info.version}`,
    `Sistema: ${info.sistema} (${info.plataforma})`,
    `Electron ${info.electron} · Chrome ${info.chrome} · Node ${info.node}`,
    `Datos: ${info.datos}`,
    `Registro: ${info.registro ?? '—'}`
  ].join('\n')

  return (
    <Panel aria-labelledby="ajustes-acerca">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ajustes-acerca" className="flex items-center gap-2 text-sm font-semibold text-cabina-tinta">
          <Info className="h-4 w-4 text-cabina-tinta-tenue" aria-hidden />
          Acerca de
          <span className="font-mono text-xs font-normal text-cabina-tinta-tenue">v{info.version}</span>
        </h2>
        <div className="flex flex-wrap gap-1">
          <Boton variante="fantasma" tamano="sm" onClick={() => onAbrir('registro')}>
            Registro de errores
          </Boton>
          <Boton variante="fantasma" tamano="sm" onClick={() => onAbrir('datos')}>
            Carpeta de datos
          </Boton>
          <Boton variante="fantasma" tamano="sm" onClick={() => setVer((v) => !v)} aria-expanded={ver}>
            {ver ? 'Ocultar detalle' : 'Detalle técnico'}
          </Boton>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {ver && (
          <motion.div variants={desplegable} initial="cerrado" animate="abierto" exit="cerrado" className="overflow-hidden">
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-cabina-negro p-3 font-mono text-[11px] leading-relaxed text-cabina-tinta-dim">
              {texto}
            </pre>
            <Boton
              variante="neutro"
              tamano="sm"
              className="mt-2"
              onClick={() => {
                void navigator.clipboard.writeText(texto)
                toast.success('Copiado: pegalo en el mensaje de ayuda')
              }}
              icono={<Copy className="h-3.5 w-3.5" aria-hidden />}
            >
              Copiar para pedir ayuda
            </Boton>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}

interface ToggleRowProps {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  durationSec: number
  onDurationChange: (s: number) => void
}

function ToggleRow({ icon, label, description, checked, onChange, durationSec, onDurationChange }: ToggleRowProps) {
  return (
    <div className="rounded-lg border border-cabina-linea bg-cabina-alto/50 px-3 py-2.5">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-cabina-tinta">{label}</p>
          <p className="text-xs text-cabina-tinta-tenue">{description}</p>
        </div>
        <Interruptor activo={checked} onCambio={onChange} etiqueta={label} />
      </div>

      <AnimatePresence initial={false}>
        {checked && (
          <motion.div variants={desplegable} initial="cerrado" animate="abierto" exit="cerrado" className="overflow-hidden">
            <div className="mt-2 flex items-center gap-2 border-t border-cabina-linea pl-7 pt-2">
              <label className="flex items-center gap-2 text-xs text-cabina-tinta-dim">
                Duración
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={durationSec}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) onDurationChange(Math.max(0.5, Math.min(10, n)))
                  }}
                  className="w-16 rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1 text-sm text-cabina-tinta"
                />
              </label>
              <span className="text-xs text-cabina-tinta-tenue">seg (máx 10)</span>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={durationSec}
                onChange={(e) => onDurationChange(Number(e.target.value))}
                aria-label={`Duración: ${label}`}
                aria-valuetext={`${durationSec} segundos`}
                className="seek-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-cabina-alto"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
