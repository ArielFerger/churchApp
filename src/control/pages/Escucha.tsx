import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Cpu, Ear, Settings2, Square, Trash2 } from 'lucide-react'
import { modeloPorId, type WhisperModelId } from '@/shared/utils/whisper'
import { pasajeVecino, textoReferencia, type Pasaje } from '@/shared/utils/navegacionBiblica'
import { claveSugerencia, useEscuchaStore, type Sugerencia } from '@/shared/store/escuchaStore'
import { useBibleHistoryStore } from '@/shared/store/bibleHistoryStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useLiveStore } from '@/shared/store/liveStore'
import { cambiarSensibilidad, detenerEscucha, iniciarEscucha } from '@/control/audio/escuchaEnVivo'
import { entradasDeAudio } from '@/control/audio/capturaVoz'
import type { EscuchaStatus } from '@/shared/types/escucha'
import type { BibleBookStats, BibleVersionSummary } from '@/shared/types/electronAPI'
import type { ProjectionCommand } from '@/shared/types/ipc'
import Boton from '../components/ui/Boton'
import Aviso from '../components/ui/Aviso'
import { EncabezadoPagina, Panel, Rotulo, Tecla } from '../components/ui/Panel'
import { desplegable } from '../components/ui/movimiento'
import MedidorEntrada from '../components/escucha/MedidorEntrada'
import TarjetaSugerencia, { type Correccion } from '../components/escucha/TarjetaSugerencia'
import PanelEnPantalla from '../components/escucha/PanelEnPantalla'
import TranscripcionEnVivo from '../components/escucha/TranscripcionEnVivo'
import ModelosWhisper from '../components/escucha/ModelosWhisper'
import { useVersiculos } from '../components/escucha/useVersiculos'

/**
 * Escuchar la predicación y ofrecer el pasaje que se nombró.
 *
 * La regla que manda sobre todo lo demás: **la app sugiere, el operador
 * proyecta**. Nunca sale nada solo. Un falso positivo en vivo es peor que no
 * tener la función, y el reconocedor se equivoca — por eso cada tarjeta
 * muestra el texto del versículo y el pedazo de audio que la originó, y deja
 * corregir el número antes de mandarla a la pantalla.
 */

function send(cmd: ProjectionCommand): void {
  window.electronAPI?.sendProjectionCommand(cmd)
}

/** ¿El foco está en un campo de texto? Ahí los atajos no se meten. */
function escribiendo(e: KeyboardEvent): boolean {
  const t = e.target
  return t instanceof Element && Boolean(t.closest('input, textarea, select, [contenteditable="true"]'))
}

export default function Escucha() {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)
  const registrarEnHistorial = useBibleHistoryStore((s) => s.add)
  const ultimoComando = useLiveStore((s) => s.lastCommand)

  const estado = useEscuchaStore((s) => s.estado)
  const nivel = useEscuchaStore((s) => s.nivel)
  const umbral = useEscuchaStore((s) => s.umbral)
  const hablando = useEscuchaStore((s) => s.hablando)
  const pendientes = useEscuchaStore((s) => s.pendientes)
  const sugerencias = useEscuchaStore((s) => s.sugerencias)
  const fragmentos = useEscuchaStore((s) => s.fragmentos)
  const latencia = useEscuchaStore((s) => s.ultimaLatenciaMs)
  const descartadas = useEscuchaStore((s) => s.descartadas)
  const errorEscucha = useEscuchaStore((s) => s.error)
  const enPantalla = useEscuchaStore((s) => s.enPantalla)
  const proyectadas = useEscuchaStore((s) => s.proyectadas)
  const estadisticas = useEscuchaStore((s) => s.estadisticas)
  const store = useEscuchaStore.getState

  const [whisper, setWhisper] = useState<EscuchaStatus | null>(null)
  const [instalando, setInstalando] = useState<{ step: string; ratio: number | null } | null>(null)
  const [entradas, setEntradas] = useState<MediaDeviceInfo[]>([])
  const [versiones, setVersiones] = useState<BibleVersionSummary[]>([])
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [correcciones, setCorrecciones] = useState<Record<string, Correccion>>({})
  const [verModelos, setVerModelos] = useState(false)
  /** La referencia exacta que salió desde acá, para saber si sigue al aire. */
  const [referenciaEnviada, setReferenciaEnviada] = useState<string | null>(null)
  const [textoEnPantalla, setTextoEnPantalla] = useState<string | null>(null)

  const escuchando = estado === 'escuchando' || estado === 'iniciando'
  const sensibilidad = settings?.escuchaSensibilidad ?? 0.5

  const refrescarWhisper = useCallback(async () => {
    setWhisper((await window.electronAPI?.getEscuchaStatus()) ?? null)
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    void refrescarWhisper()
    void entradasDeAudio().then(setEntradas)
    void api?.getBibleVersions().then(setVersiones)
    const quitarProgreso = api?.onEscuchaProgress(setInstalando)
    // El servidor avisa solo cuando terminó de cargar el modelo o si se cayó.
    const quitarEstado = api?.onEscuchaStatus?.((s) => {
      setWhisper(s)
      useEscuchaStore.getState().setMotor(s.motor, s.servidor)
    })
    // Enchufar la placa de sonido con la app abierta: que aparezca en la lista.
    const alCambiarDispositivos = (): void => void entradasDeAudio().then(setEntradas)
    navigator.mediaDevices?.addEventListener?.('devicechange', alCambiarDispositivos)
    return () => {
      quitarProgreso?.()
      quitarEstado?.()
      navigator.mediaDevices?.removeEventListener?.('devicechange', alCambiarDispositivos)
    }
  }, [refrescarWhisper])

  // Los nombres de los dispositivos sólo aparecen después de que el sistema
  // dio permiso para el audio; antes, la lista viene con las etiquetas vacías.
  useEffect(() => {
    if (estado === 'escuchando') void entradasDeAudio().then(setEntradas)
  }, [estado])

  const version = useMemo(
    () => settings?.defaultBibleVersion ?? versiones[0]?.version ?? null,
    [settings?.defaultBibleVersion, versiones]
  )

  // La cantidad de versículos por capítulo: para descartar "Juan 3:99" antes
  // de sugerirlo, y para saber dónde termina un capítulo al navegar.
  useEffect(() => {
    if (!version) return
    void window.electronAPI
      ?.getBibleBookStats?.(version)
      .then((s: BibleBookStats) => useEscuchaStore.getState().setEstadisticas(s))
      .catch(() => {
        /* sin estadísticas se valida menos, pero anda igual */
      })
  }, [version])

  const falta = whisper?.falta ?? null

  // Texto de cada sugerencia, para confirmarla antes de proyectar.
  const pedidos = useMemo(
    () =>
      sugerencias.map((r) => ({
        clave: claveSugerencia(r),
        bookId: r.bookId,
        chapter: r.chapter,
        verse: r.verse ?? 1,
        endVerse: r.endVerse
      })),
    [sugerencias]
  )
  const previas = useVersiculos(version, pedidos)

  async function instalar(modelo: WhisperModelId): Promise<void> {
    setErrorAccion(null)
    setInstalando({ step: 'Empezando', ratio: null })
    try {
      const s = await window.electronAPI?.installEscucha(modelo)
      if (s) setWhisper(s)
    } catch (e) {
      setErrorAccion(String(e instanceof Error ? e.message : e))
    } finally {
      setInstalando(null)
      void refrescarWhisper()
    }
  }

  async function elegirModelo(id: WhisperModelId): Promise<void> {
    await updateSettings({ escuchaModelo: id })
    void refrescarWhisper()
  }

  async function borrarModelo(id: WhisperModelId): Promise<void> {
    setErrorAccion(null)
    try {
      const s = await window.electronAPI?.deleteEscuchaModel(id)
      if (s) setWhisper(s)
    } catch (e) {
      setErrorAccion(String(e instanceof Error ? e.message : e))
    }
  }

  function alternar(): void {
    setErrorAccion(null)
    if (escuchando) void detenerEscucha()
    else
      void iniciarEscucha({
        deviceId: settings?.escuchaDispositivoId ?? null,
        sensibilidad
      })
  }

  /** Busca el texto, lo manda a la pantalla y lo deja listo para navegar. */
  const proyectarPasaje = useCallback(
    async (p: Pasaje): Promise<boolean> => {
      setErrorAccion(null)
      const api = window.electronAPI
      if (!api || !version) {
        setErrorAccion('No hay ninguna versión de la Biblia cargada.')
        return false
      }
      const res = await api.lookupVerse({
        version,
        bookId: p.bookId,
        chapter: p.chapter,
        verse: p.verse,
        endVerse: p.endVerse
      })
      if (!res) {
        setErrorAccion(
          `${textoReferencia(p.bookId, p.chapter, p.verse, p.endVerse)} no existe en ${version}. Corregí el número con el lápiz.`
        )
        return false
      }

      const rango = res.endVerse ? `${res.verse}-${res.endVerse}` : `${res.verse}`
      const reference = `${res.bookName} ${res.chapter}:${rango}`
      send({ type: 'showBibleVerse', reference, text: res.text, version: res.version.version })
      registrarEnHistorial({
        bookId: res.bookId,
        bookName: res.bookName,
        chapter: res.chapter,
        verse: res.verse,
        endVerse: res.endVerse,
        version: res.version.version,
        text: res.text
      })
      useEscuchaStore.getState().marcarEnPantalla({
        bookId: res.bookId,
        chapter: res.chapter,
        verse: res.verse,
        endVerse: res.endVerse
      })
      setReferenciaEnviada(reference)
      setTextoEnPantalla(res.text)
      return true
    },
    [version, registrarEnHistorial]
  )

  const proyectar = useCallback(
    async (r: Sugerencia): Promise<void> => {
      const clave = claveSugerencia(r)
      const arreglo = correcciones[clave]
      // Un capítulo sin versículo se proyecta desde el primero: es lo que hace
      // el operador a mano cuando el pastor dice "abramos en el salmo 23".
      const ok = await proyectarPasaje({
        bookId: r.bookId,
        chapter: arreglo?.cap ?? r.chapter,
        verse: arreglo?.vers ?? r.verse ?? 1,
        endVerse: arreglo ? undefined : r.endVerse
      })
      if (ok) useEscuchaStore.getState().marcarProyectada(clave)
    },
    [correcciones, proyectarPasaje]
  )

  const anterior = enPantalla ? pasajeVecino(enPantalla, -1, estadisticas) : null
  const siguiente = enPantalla ? pasajeVecino(enPantalla, 1, estadisticas) : null
  const sigueAlAire =
    ultimoComando?.type === 'showBibleVerse' && ultimoComando.reference === referenciaEnviada

  // La más nueva que todavía no salió: la que se proyecta con Ctrl+Enter.
  const ordenadas = useMemo(() => [...sugerencias].reverse(), [sugerencias])
  const masNueva = useMemo(
    () => ordenadas.find((r) => !proyectadas.includes(claveSugerencia(r))) ?? null,
    [ordenadas, proyectadas]
  )

  // Atajos de teclado de la sección. Escape NO: es la parada de pánico global.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.altKey || e.metaKey || escribiendo(e)) return
      if (e.key === 'Enter' && masNueva) {
        e.preventDefault()
        void proyectar(masNueva)
      } else if (e.key === 'ArrowRight' && siguiente) {
        e.preventDefault()
        void proyectarPasaje(siguiente)
      } else if (e.key === 'ArrowLeft' && anterior) {
        e.preventDefault()
        void proyectarPasaje(anterior)
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [masNueva, siguiente, anterior, proyectar, proyectarPasaje])

  const modelo = modeloPorId(whisper?.modelo)
  const motorTexto =
    whisper?.motor === 'servidor'
      ? whisper.servidor === 'cargando'
        ? 'cargando el modelo…'
        : whisper.servidor === 'listo'
          ? 'modelo en memoria'
          : 'listo para cargar'
      : whisper?.motor === 'cli'
        ? 'modo lento (sin servidor)'
        : 'sin instalar'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-5 sm:px-6">
        <EncabezadoPagina
          icono={<Ear className="h-6 w-6" />}
          titulo="Escucha"
          acciones={
            <span
              className="inline-flex items-center gap-2 rounded-lg border border-cabina-linea bg-cabina-panel px-3 py-1.5 text-xs text-cabina-tinta-dim"
              title={whisper?.errorServidor ?? undefined}
            >
              <Cpu className="h-3.5 w-3.5 text-cabina-tinta-tenue" aria-hidden />
              <span>
                <span className="text-cabina-tinta">{modelo.label}</span> · {motorTexto}
              </span>
            </span>
          }
        >
          Oye la predicación y te ofrece el pasaje que se nombró. Vos decidís si sale:{' '}
          <strong className="text-cabina-tinta">nunca proyecta sola</strong>. Todo se procesa en
          esta máquina: el audio no se guarda ni sale a internet.
        </EncabezadoPagina>

        {/* Falta whisper */}
        {falta && (
          <Panel className="mb-4 border-listo-borde">
            <Aviso tipo="atencion" titulo={falta}>
              La transcripción la hace un programa que corre en esta máquina, sin internet. Hay que
              bajarlo una sola vez. Elegí el modelo: si dudás, el recomendado.
            </Aviso>
            {whisper?.instalable === false && (
              <Aviso tipo="info" className="mt-3">
                No hay un paquete listo para esta plataforma. Ejecutá{' '}
                <code className="font-mono text-cabina-tinta">
                  python scripts/herramientas/instalar_herramientas.py --compilar-whisper
                </code>{' '}
                o dejá <code className="font-mono">whisper-cli</code> y{' '}
                <code className="font-mono">whisper-server</code> en la carpeta de herramientas.
              </Aviso>
            )}
            <div className="mt-4">
              <ModelosWhisper
                estado={whisper}
                instalando={instalando}
                bloqueado={escuchando}
                onElegir={(id) => void elegirModelo(id)}
                onInstalar={(id) => void instalar(id)}
                onBorrar={(id) => void borrarModelo(id)}
              />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-cabina-tinta-tenue">
                Dónde se buscó
              </summary>
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-cabina-tinta-tenue">
                {whisper?.searched.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </details>
          </Panel>
        )}

        {/* Controles */}
        <Panel aria-label="Controles de la Escucha" className="mb-4">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <Boton
              variante={escuchando ? 'primario' : 'neutro'}
              tamano="lg"
              onClick={alternar}
              disabled={Boolean(falta) || estado === 'iniciando'}
              cargando={estado === 'iniciando'}
              aria-pressed={escuchando}
              icono={
                escuchando ? (
                  <Square className="h-5 w-5" aria-hidden />
                ) : (
                  <Ear className="h-5 w-5" aria-hidden />
                )
              }
              className="min-w-[150px]"
            >
              {estado === 'iniciando' ? 'Preparando…' : escuchando ? 'Detener' : 'Escuchar'}
            </Boton>

            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-cabina-tinta-tenue sm:max-w-xs">
              Entrada de audio
              <select
                value={settings?.escuchaDispositivoId ?? ''}
                onChange={(e) => void updateSettings({ escuchaDispositivoId: e.target.value || null })}
                disabled={escuchando}
                className="rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1.5 text-sm text-cabina-tinta disabled:opacity-50"
              >
                <option value="">La del sistema</option>
                {entradas.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Entrada ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-cabina-tinta-tenue sm:max-w-[240px]">
              <span className="flex justify-between">
                Sensibilidad
                <span className="font-mono text-cabina-tinta-dim">{Math.round(sensibilidad * 100)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sensibilidad}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  cambiarSensibilidad(v)
                  void updateSettings({ escuchaSensibilidad: v })
                }}
                aria-valuetext={`${Math.round(sensibilidad * 100)} por ciento`}
                className="seek-range h-1.5 cursor-pointer appearance-none rounded-full bg-cabina-alto"
              />
              <span className="flex justify-between text-[10px]">
                <span>toma sólo voz fuerte</span>
                <span>toma voz floja</span>
              </span>
            </label>

            <dl className="flex gap-4 text-xs text-cabina-tinta-tenue">
              <div>
                <dt>Demora</dt>
                <dd className="font-mono text-sm text-cabina-tinta-dim">
                  {latencia !== null ? `${(latencia / 1000).toFixed(1)} s` : '—'}
                </dd>
              </div>
              {descartadas > 0 && (
                <div title="Frases que se perdieron porque la transcripción venía atrasada">
                  <dt>Perdidas</dt>
                  <dd className="font-mono text-sm text-listo">{descartadas}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-4">
            <MedidorEntrada nivel={nivel} umbral={umbral} hablando={hablando} activo={escuchando} />
          </div>

          <AnimatePresence>
            {(errorEscucha || errorAccion) && (
              <Aviso tipo="falla" className="mt-3">
                {errorEscucha ?? errorAccion}
              </Aviso>
            )}
          </AnimatePresence>
        </Panel>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          {/* Sugerencias */}
          <section aria-labelledby="escucha-sugerencias" className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Rotulo id="escucha-sugerencias">Se nombró</Rotulo>
              <div className="flex items-center gap-3">
                {masNueva && (
                  <span className="hidden text-[11px] text-cabina-tinta-tenue md:inline">
                    <Tecla>Ctrl</Tecla> + <Tecla>Enter</Tecla> proyecta la más nueva
                  </span>
                )}
                {sugerencias.length > 0 && (
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => {
                      store().limpiar()
                      setCorrecciones({})
                    }}
                    icono={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Limpiar
                  </Boton>
                )}
              </div>
            </div>

            {/* Anuncio para lectores de pantalla: sólo la cita nueva. */}
            <p className="sr-only" aria-live="polite">
              {masNueva
                ? `Se nombró ${textoReferencia(masNueva.bookId, masNueva.chapter, masNueva.verse, masNueva.endVerse)}`
                : ''}
            </p>

            <ul className="space-y-2">
              {sugerencias.length === 0 && (
                <li className="rounded-xl border border-dashed border-cabina-linea-fuerte px-4 py-10 text-center text-sm text-cabina-tinta-tenue">
                  {escuchando
                    ? 'Escuchando. Las citas aparecen acá un par de segundos después de que se nombran.'
                    : 'Todavía no hay nada. Apretá Escuchar cuando empiece la predicación.'}
                </li>
              )}
              <AnimatePresence initial={false}>
                {ordenadas.map((r) => {
                  const clave = claveSugerencia(r)
                  return (
                    <TarjetaSugerencia
                      key={clave}
                      sugerencia={r}
                      correccion={correcciones[clave]}
                      editando={editando === clave}
                      yaSalio={proyectadas.includes(clave)}
                      esLaMasNueva={masNueva !== null && claveSugerencia(masNueva) === clave}
                      version={version}
                      previa={previas[clave]}
                      onProyectar={() => void proyectar(r)}
                      onDescartar={() => store().descartarSugerencia(clave)}
                      onEditar={() => setEditando(editando === clave ? null : clave)}
                      onCorregir={(c) => setCorrecciones((prev) => ({ ...prev, [clave]: c }))}
                    />
                  )
                })}
              </AnimatePresence>
            </ul>
          </section>

          {/* Columna lateral: lo que está al aire, la transcripción y el modelo */}
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
            <PanelEnPantalla
              pasaje={enPantalla}
              texto={textoEnPantalla}
              sigueAlAire={sigueAlAire}
              puedeAnterior={anterior !== null}
              puedeSiguiente={siguiente !== null}
              onAnterior={() => anterior && void proyectarPasaje(anterior)}
              onSiguiente={() => siguiente && void proyectarPasaje(siguiente)}
            />

            <TranscripcionEnVivo
              fragmentos={fragmentos}
              pendientes={pendientes}
              hablando={hablando}
              activa={escuchando}
            />

            {!falta && (
              <Panel>
                <button
                  type="button"
                  onClick={() => setVerModelos((v) => !v)}
                  aria-expanded={verModelos}
                  aria-controls="escucha-modelos"
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <Rotulo>Modelo de transcripción</Rotulo>
                  <Settings2
                    className={`h-4 w-4 text-cabina-tinta-tenue transition-transform ${verModelos ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {verModelos && (
                    <motion.div
                      id="escucha-modelos"
                      variants={desplegable}
                      initial="cerrado"
                      animate="abierto"
                      exit="cerrado"
                      className="overflow-hidden"
                    >
                      <p className="mb-3 mt-2 text-xs leading-relaxed text-cabina-tinta-dim">
                        Los más grandes entienden mejor los nombres raros, pero tardan más. Si la
                        demora pasa de 3 s, conviene uno más chico.
                        {escuchando && ' Detené la Escucha para cambiarlo.'}
                      </p>
                      <ModelosWhisper
                        estado={whisper}
                        instalando={instalando}
                        bloqueado={escuchando}
                        onElegir={(id) => void elegirModelo(id)}
                        onInstalar={(id) => void instalar(id)}
                        onBorrar={(id) => void borrarModelo(id)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
