import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Type,
  Plus,
  Trash2,
  Eye,
  Palette,
  Wallpaper,
  Check,
  Film,
  Folder,
  ChevronRight,
  Home,
  RotateCcw
} from 'lucide-react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useLibraryStore } from '@/shared/store/libraryStore'
import { syncFontFaces } from '@/shared/utils/fontLoader'
import {
  itemsInFolder,
  childFolders,
  countInFolder,
  breadcrumbSegments
} from '@/shared/utils/mediaFolders'
import { DEFAULT_BIBLE_DISPLAY, type BibleDisplaySettings } from '@/shared/types/ipc'
import type { BibleFont } from '@/shared/types/fonts'
import type { ProjectionCommand } from '@/shared/types/ipc'

const SAMPLE = {
  text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
  reference: 'Juan 3:16'
}

/** Colores rápidos para el texto del versículo. */
const TEXT_COLORS = ['#ffffff', '#f8f5e9', '#fde68a', '#fbbf24', '#93c5fd', '#86efac']

function send(cmd: ProjectionCommand) {
  window.electronAPI?.sendProjectionCommand(cmd)
}

interface AppearancePanelProps {
  /** Versión activa, usada al probar en proyección. */
  versionLabel: string
  onClose: () => void
}

/**
 * Zona de configuración de la proyección de versículos: fuente (archivos de
 * Google Fonts subidos por el usuario), tamaño, color, negrita, sombra y un
 * fondo (imagen/video de la librería) con oscurecido regulable.
 * Los cambios se guardan al instante y la proyección los refleja en vivo.
 */
export default function AppearancePanel({ versionLabel, onClose }: AppearancePanelProps) {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const {
    media,
    mediaLoaded,
    loadMedia,
    subscribeMedia,
    bibleMedia,
    bibleMediaLoaded,
    loadBibleMedia,
    subscribeBibleMedia
  } = useLibraryStore()
  const [fonts, setFonts] = useState<BibleFont[]>([])
  // Carpeta actual dentro del picker de fondos ('' = raíz).
  const [bgPath, setBgPath] = useState('')

  const display: BibleDisplaySettings = settings?.bibleDisplay ?? DEFAULT_BIBLE_DISPLAY

  // Fuente de los fondos: la carpeta dedicada (si está configurada en Ajustes)
  // o, como antes, la carpeta general de media.
  const hasBibleFolder = Boolean(settings?.bibleBackgroundsFolder)
  const bgSource = hasBibleFolder ? bibleMedia : media
  const bgSourceLoaded = hasBibleFolder ? bibleMediaLoaded : mediaLoaded

  // Fuentes subidas: cargar + escuchar cambios + registrarlas para la preview.
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.getBibleFonts().then(setFonts)
    return api.onBibleFontsUpdated(setFonts)
  }, [])

  useEffect(() => {
    syncFontFaces(fonts)
  }, [fonts])

  useEffect(() => {
    void loadMedia()
    void loadBibleMedia()
    const unsubMedia = subscribeMedia()
    const unsubBible = subscribeBibleMedia()
    return () => {
      unsubMedia()
      unsubBible()
    }
  }, [loadMedia, subscribeMedia, loadBibleMedia, subscribeBibleMedia])

  // Si cambia la fuente de fondos o la carpeta actual ya no existe, ir a la raíz.
  useEffect(() => {
    setBgPath('')
  }, [hasBibleFolder])
  useEffect(() => {
    if (
      bgPath &&
      itemsInFolder(bgSource, bgPath).length === 0 &&
      childFolders(bgSource, bgPath).length === 0
    ) {
      setBgPath('')
    }
  }, [bgSource, bgPath])

  // Cerrar con Escape (sin robar las teclas de los inputs).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function patch(partial: Partial<BibleDisplaySettings>): void {
    void update({ bibleDisplay: { ...display, ...partial } })
  }

  async function pickFonts(): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    const result = await api.showOpenDialog({
      title: 'Elegí los archivos de fuente (.ttf, .otf, .woff, .woff2)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Fuentes', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return
    const updated = await api.addBibleFonts(result.filePaths)
    setFonts(updated)
  }

  async function removeFont(font: BibleFont): Promise<void> {
    const api = window.electronAPI
    if (!api) return
    const updated = await api.deleteBibleFont(font.id)
    setFonts(updated)
    if (display.fontId === font.id) patch({ fontId: null })
  }

  function testOnProjection(): void {
    send({
      type: 'showBibleVerse',
      reference: SAMPLE.reference,
      text: SAMPLE.text,
      version: versionLabel
    })
  }

  const selectedFont = display.fontId ? (fonts.find((f) => f.id === display.fontId) ?? null) : null
  const previewFamily = selectedFont
    ? `"${selectedFont.family}", Inter, system-ui, sans-serif`
    : undefined
  // Para la preview, el fondo elegido puede venir de cualquiera de las dos
  // fuentes (p. ej. se eligió antes de configurar la carpeta dedicada).
  const bgItem = display.backgroundId
    ? (bibleMedia.find((m) => m.id === display.backgroundId) ??
      media.find((m) => m.id === display.backgroundId) ??
      null)
    : null
  // Candidatos a fondo: los de la carpeta actual (imágenes primero).
  const bgCandidates = useMemo(
    () =>
      itemsInFolder(bgSource, bgPath).sort((a, b) => {
        const rank = (m: (typeof bgSource)[number]) => (m.type === 'video' ? 1 : 0)
        return rank(a) - rank(b)
      }),
    [bgSource, bgPath]
  )
  const bgFolders = useMemo(() => childFolders(bgSource, bgPath), [bgSource, bgPath])

  // La proyección real muestra 48px sobre 1920 de ancho; la preview (~660px)
  // escala proporcionalmente para que "lo que ves sea lo que se proyecta".
  const previewScale = 0.35
  const pct = display.fontSizePct / 100
  const previewShadow = display.textShadow ? '0 2px 6px rgba(0,0,0,0.85)' : 'none'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-3">
          <Palette className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            Apariencia de los versículos
          </h2>
          <span className="text-xs text-slate-500">— se guarda solo y se aplica en vivo</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            title="Cerrar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          {/* Vista previa */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-600 bg-black">
            {bgItem &&
              (bgItem.type === 'video' ? (
                <video
                  src={`media://${bgItem.id}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={`media://${bgItem.id}`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ))}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${bgItem ? display.backgroundDim : 0})` }}
            />
            <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
              <div>
                <p
                  className="leading-snug"
                  style={{
                    fontSize: `${48 * pct * previewScale}px`,
                    color: display.textColor,
                    fontFamily: previewFamily,
                    fontWeight: display.bold ? 700 : 400,
                    textShadow: previewShadow
                  }}
                >
                  {SAMPLE.text}
                </p>
                <p
                  className="mt-3 font-medium"
                  style={{
                    fontSize: `${Math.max(10, 24 * pct * previewScale)}px`,
                    color: display.textColor,
                    opacity: 0.75,
                    fontFamily: previewFamily,
                    textShadow: previewShadow
                  }}
                >
                  {SAMPLE.reference} · {versionLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-slate-500">
              Vista previa a escala — en el proyector se ve igual pero a pantalla completa.
            </p>
            <button
              type="button"
              onClick={testOnProjection}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <Eye className="h-3.5 w-3.5" />
              Probar en proyección
            </button>
          </div>

          {/* Fuente */}
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Type className="h-3.5 w-3.5" />
              Fuente
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Descargá la fuente desde{' '}
              <span className="font-mono text-slate-400">fonts.google.com</span> (botón
              &ldquo;Download family&rdquo;), descomprimí el ZIP y subí acá el archivo{' '}
              <span className="font-mono text-slate-400">.ttf</span>.
            </p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <li>
                <FontRow
                  label="Predeterminada (Inter)"
                  family={undefined}
                  selected={display.fontId === null}
                  onSelect={() => patch({ fontId: null })}
                />
              </li>
              {fonts.map((font) => (
                <li key={font.id}>
                  <FontRow
                    label={font.family}
                    family={`"${font.family}", Inter, sans-serif`}
                    selected={display.fontId === font.id}
                    onSelect={() => patch({ fontId: font.id })}
                    onDelete={() => void removeFont(font)}
                  />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => void pickFonts()}
                  className="flex w-full items-center gap-2 rounded-md border border-dashed border-slate-600 px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-400 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  Agregar fuentes…
                </button>
              </li>
            </ul>
          </section>

          {/* Tamaño */}
          <section className="mt-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Tamaño del texto
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={200}
                step={5}
                value={display.fontSizePct}
                onChange={(e) => patch({ fontSizePct: Number(e.target.value) })}
                className="seek-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700"
              />
              <input
                type="number"
                min={50}
                max={200}
                step={5}
                value={display.fontSizePct}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) patch({ fontSizePct: Math.max(50, Math.min(200, n)) })
                }}
                className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">%</span>
              <button
                type="button"
                onClick={() => patch({ fontSizePct: 100 })}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
                title="Volver al 100%"
              >
                <RotateCcw className="h-3 w-3" />
                Restablecer
              </button>
            </div>
          </section>

          {/* Color + estilo */}
          <section className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Color del texto
              </h3>
              <div className="mt-2 flex items-center gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ textColor: c })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      display.textColor.toLowerCase() === c ? 'border-blue-500' : 'border-slate-600'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <label
                  className="ml-1 flex cursor-pointer items-center gap-1.5 rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-500"
                  title="Color personalizado"
                >
                  <input
                    type="color"
                    value={display.textColor}
                    onChange={(e) => patch({ textColor: e.target.value })}
                    className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0"
                  />
                  Otro
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Estilo
              </h3>
              <div className="mt-2 flex items-center gap-4">
                <ToggleChip
                  label="Negrita"
                  checked={display.bold}
                  onChange={(v) => patch({ bold: v })}
                />
                <ToggleChip
                  label="Sombra"
                  checked={display.textShadow}
                  onChange={(v) => patch({ textShadow: v })}
                  hint="Mejora la lectura sobre fondos claros"
                />
              </div>
            </div>
          </section>

          {/* Fondo */}
          <section className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Wallpaper className="h-3.5 w-3.5" />
              Fondo de los versículos
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Imagen o video que se muestra detrás del texto.{' '}
              {hasBibleFolder ? (
                <>
                  Fuente:{' '}
                  <span className="font-mono text-slate-400">
                    {settings?.bibleBackgroundsFolder}
                  </span>
                </>
              ) : (
                <>
                  Fuente: carpeta de media (podés asignar una carpeta aparte en{' '}
                  <span className="text-slate-400">Ajustes → Fondos de Biblia</span>).
                </>
              )}
            </p>

            {/* Breadcrumb de subcarpetas */}
            {(bgPath || bgFolders.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBgPath('')}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                    bgPath
                      ? 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      : 'font-medium text-slate-200'
                  }`}
                  title="Raíz"
                >
                  <Home className="h-3 w-3" />
                  Raíz
                </button>
                {breadcrumbSegments(bgPath).map((seg, i, arr) => (
                  <span key={seg.path} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-slate-600" />
                    {i === arr.length - 1 ? (
                      <span className="px-1 font-medium text-slate-200">{seg.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBgPath(seg.path)}
                        className="rounded px-1 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                      >
                        {seg.name}
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {!bgSourceLoaded ? (
              <p className="mt-2 text-xs text-slate-500">Cargando media…</p>
            ) : (
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                <li>
                  <button
                    type="button"
                    onClick={() => patch({ backgroundId: null })}
                    className={`flex aspect-video w-full items-center justify-center rounded-md border text-xs transition-colors ${
                      display.backgroundId === null
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300 ring-2 ring-blue-500/40'
                        : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500'
                    }`}
                  >
                    Sin fondo
                  </button>
                </li>
                {bgFolders.map((name) => {
                  const folderPath = bgPath ? `${bgPath}/${name}` : name
                  return (
                    <li key={`folder-${name}`}>
                      <button
                        type="button"
                        onClick={() => setBgPath(folderPath)}
                        className="group relative block w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800/60 transition-colors hover:border-amber-500/60"
                        title={`Abrir carpeta "${name}"`}
                      >
                        <div className="flex aspect-video flex-col items-center justify-center gap-0.5">
                          <Folder className="h-6 w-6 text-amber-400/80 transition-transform group-hover:scale-110" />
                          <span className="max-w-full truncate px-1 text-[10px] text-slate-300">
                            {name}
                          </span>
                        </div>
                        <span className="absolute right-1 top-1 rounded bg-amber-500/20 px-1 text-[9px] font-medium text-amber-300">
                          {countInFolder(bgSource, folderPath)}
                        </span>
                      </button>
                    </li>
                  )
                })}
                {bgCandidates.map((item) => {
                  const isSelected = display.backgroundId === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => patch({ backgroundId: item.id })}
                        className={`group relative block w-full overflow-hidden rounded-md border bg-black transition-colors ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/40'
                            : 'border-slate-700 hover:border-slate-500'
                        }`}
                        title={item.fileName}
                      >
                        <div className="aspect-video">
                          {item.type === 'video' ? (
                            <video
                              src={`media://${item.id}`}
                              className="h-full w-full object-cover"
                              preload="metadata"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={`media://${item.id}`}
                              alt={item.fileName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        {item.type === 'video' && (
                          <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-slate-200">
                            <Film className="h-3 w-3" />
                          </span>
                        )}
                        {isSelected && (
                          <span className="absolute right-1 top-1 rounded-full bg-blue-600 p-0.5 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {display.backgroundId && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-slate-400">Oscurecer fondo</span>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={display.backgroundDim}
                  onChange={(e) => patch({ backgroundDim: Number(e.target.value) })}
                  className="seek-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700"
                />
                <span className="w-10 text-right font-mono text-xs text-slate-500">
                  {Math.round(display.backgroundDim * 100)}%
                </span>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function FontRow({
  label,
  family,
  selected,
  onSelect,
  onDelete
}: {
  label: string
  family?: string
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600 text-transparent'
          }`}
        >
          <Check className="h-3 w-3" />
        </span>
        <span
          className="truncate text-sm text-slate-200"
          style={{ fontFamily: family }}
          title={label}
        >
          {label}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition-opacity hover:bg-slate-700 hover:text-red-400 group-hover:opacity-100"
          title="Borrar fuente"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function ToggleChip({
  label,
  checked,
  onChange,
  hint
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300" title={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      {label}
    </label>
  )
}
