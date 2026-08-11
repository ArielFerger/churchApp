import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Ear, Eye, Loader2, Pencil, Square, Trash2, X } from 'lucide-react'
import { bookById } from '@/shared/utils/bibleBooks'
import { UMBRAL_VOZ } from '@/shared/utils/audioVentanas'
import { modeloPorId, WHISPER_MODELS, type WhisperModelId } from '@/shared/utils/whisper'
import { claveSugerencia, useEscuchaStore } from '@/shared/store/escuchaStore'
import { useBibleHistoryStore } from '@/shared/store/bibleHistoryStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { detenerEscucha, iniciarEscucha } from '@/control/audio/escuchaEnVivo'
import { entradasDeAudio } from '@/control/audio/capturaVoz'
import type { ReferenciaDetectada } from '@/shared/utils/escuchaBiblica'
import type { EscuchaStatus } from '@/shared/types/escucha'
import type { BibleVersionSummary } from '@/shared/types/electronAPI'
import type { ProjectionCommand } from '@/shared/types/ipc'

/**
 * Escuchar la predicación y ofrecer el pasaje que se nombró.
 *
 * La regla que manda sobre todo lo demás: **la app sugiere, el operador
 * proyecta**. Nunca sale nada solo. Un falso positivo en vivo es peor que no
 * tener la función, y el reconocedor se equivoca — por eso cada fila muestra
 * el pedazo de audio que la originó y deja corregir el número antes de
 * mandarla a la pantalla.
 */

function send(cmd: ProjectionCommand): void {
  window.electronAPI?.sendProjectionCommand(cmd)
}

/** Por debajo de esto la sugerencia se muestra apagada y pidiendo revisión. */
const CONFIANZA_DUDOSA = 0.6

function nombreLibro(bookId: string): string {
  return bookById(bookId)?.name ?? bookId
}

function referenciaTexto(bookId: string, capitulo: number, versiculo: number | null): string {
  return `${nombreLibro(bookId)} ${capitulo}${versiculo === null ? '' : `:${versiculo}`}`
}

export default function Escucha() {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)
  const registrarEnHistorial = useBibleHistoryStore((s) => s.add)

  const estado = useEscuchaStore((s) => s.estado)
  const nivel = useEscuchaStore((s) => s.nivel)
  const sugerencias = useEscuchaStore((s) => s.sugerencias)
  const ventanas = useEscuchaStore((s) => s.ventanas)
  const latencia = useEscuchaStore((s) => s.ultimaLatenciaMs)
  const descartadas = useEscuchaStore((s) => s.descartadas)
  const errorEscucha = useEscuchaStore((s) => s.error)
  const descartarSugerencia = useEscuchaStore((s) => s.descartarSugerencia)
  const limpiar = useEscuchaStore((s) => s.limpiar)

  const [whisper, setWhisper] = useState<EscuchaStatus | null>(null)
  const [instalando, setInstalando] = useState<{ step: string; ratio: number | null } | null>(null)
  const [entradas, setEntradas] = useState<MediaDeviceInfo[]>([])
  const [versiones, setVersiones] = useState<BibleVersionSummary[]>([])
  const [errorProyeccion, setErrorProyeccion] = useState<string | null>(null)
  const [proyectadas, setProyectadas] = useState<string[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [correcciones, setCorrecciones] = useState<Record<string, { cap: number; vers: number }>>(
    {}
  )
  const [verTranscripcion, setVerTranscripcion] = useState(false)

  const escuchando = estado === 'escuchando' || estado === 'iniciando'

  const refrescarWhisper = useCallback(async () => {
    setWhisper((await window.electronAPI?.getEscuchaStatus()) ?? null)
  }, [])

  useEffect(() => {
    void refrescarWhisper()
    void entradasDeAudio().then(setEntradas)
    void window.electronAPI?.getBibleVersions().then(setVersiones)
    return window.electronAPI?.onEscuchaProgress(setInstalando)
  }, [refrescarWhisper])

  // Los nombres de los dispositivos sólo aparecen después de que el sistema
  // dio permiso para el audio; antes, la lista viene con las etiquetas vacías.
  // Al empezar a escuchar se vuelve a pedir, y ahí sí se ven.
  useEffect(() => {
    if (estado === 'escuchando') void entradasDeAudio().then(setEntradas)
  }, [estado])

  const version = useMemo(
    () => settings?.defaultBibleVersion ?? versiones[0]?.version ?? null,
    [settings?.defaultBibleVersion, versiones]
  )

  const falta = whisper?.falta ?? null

  async function instalar(modelo: WhisperModelId): Promise<void> {
    setErrorProyeccion(null)
    setInstalando({ step: 'Empezando', ratio: null })
    try {
      setWhisper((await window.electronAPI?.installEscucha(modelo)) ?? null)
    } catch (e) {
      setErrorProyeccion(String(e instanceof Error ? e.message : e))
    } finally {
      setInstalando(null)
      void refrescarWhisper()
    }
  }

  function alternar(): void {
    if (escuchando) void detenerEscucha()
    else void iniciarEscucha(settings?.escuchaDispositivoId ?? null)
  }

  async function proyectar(r: ReferenciaDetectada): Promise<void> {
    setErrorProyeccion(null)
    const api = window.electronAPI
    if (!api || !version) return setErrorProyeccion('No hay ninguna versión de la Biblia cargada.')

    const clave = claveSugerencia(r)
    const arreglo = correcciones[clave]
    const capitulo = arreglo?.cap ?? r.chapter
    // Un capítulo sin versículo se proyecta desde el primero: es lo que hace
    // el operador a mano cuando el pastor dice "abramos en el salmo veintitrés".
    const versiculo = arreglo?.vers ?? r.verse ?? 1

    const res = await api.lookupVerse({
      version,
      bookId: r.bookId,
      chapter: capitulo,
      verse: versiculo,
      endVerse: arreglo ? undefined : r.endVerse
    })
    if (!res) {
      return setErrorProyeccion(
        `${referenciaTexto(r.bookId, capitulo, versiculo)} no existe en ${version}. Corregí el número con el lápiz.`
      )
    }

    const rango = res.endVerse ? `${res.verse}-${res.endVerse}` : `${res.verse}`
    send({
      type: 'showBibleVerse',
      reference: `${res.bookName} ${res.chapter}:${rango}`,
      text: res.text,
      version: res.version.version
    })
    registrarEnHistorial({
      bookId: res.bookId,
      bookName: res.bookName,
      chapter: res.chapter,
      verse: res.verse,
      endVerse: res.endVerse,
      version: res.version.version,
      text: res.text
    })
    setProyectadas((p) => (p.includes(clave) ? p : [...p, clave]))
  }

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="mx-auto flex h-full w-full max-w-[1000px] flex-col px-6 pb-4 pt-6">
        <header className="mb-4 shrink-0 border-b border-slate-700 pb-4">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-100">
            <Ear className="h-6 w-6 text-listo" />
            Escucha
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Oye la predicación y te ofrece el pasaje que se nombró. Vos decidís si sale:{' '}
            <strong className="text-slate-300">nunca proyecta sola</strong>. El audio no se guarda
            ni sale de esta máquina.
          </p>
        </header>

        {/* Falta whisper */}
        {falta && (
          <section className="mb-4 shrink-0 rounded-lg border border-listo-borde bg-listo-suave p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-listo">
              <AlertTriangle className="h-4 w-4" />
              {falta}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              La transcripción la hace un programa que corre en esta máquina, sin internet. Hay que
              bajarlo una sola vez.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {WHISPER_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void instalar(m.id)}
                  disabled={Boolean(instalando)}
                  title={m.hint}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    m.id === (whisper?.modelo ?? 'base')
                      ? 'bg-listo text-slate-900 hover:brightness-110'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {m.label} · {m.mb} MB
                </button>
              ))}
              {instalando && (
                <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {instalando.step}
                  {instalando.ratio !== null && ` ${Math.round(instalando.ratio * 100)}%`}
                </span>
              )}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">Dónde se buscó</summary>
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-500">
                {whisper?.searched.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {/* Controles */}
        <section className="mb-4 shrink-0 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={alternar}
              disabled={Boolean(falta) || estado === 'iniciando'}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold transition-colors disabled:opacity-50 ${
                escuchando
                  ? 'bg-listo text-slate-900 hover:brightness-110'
                  : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
              }`}
            >
              {estado === 'iniciando' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : escuchando ? (
                <Square className="h-5 w-5" />
              ) : (
                <Ear className="h-5 w-5" />
              )}
              {escuchando ? 'Detener' : 'Escuchar'}
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-400">
              Entrada
              <select
                value={settings?.escuchaDispositivoId ?? ''}
                onChange={(e) =>
                  void updateSettings({ escuchaDispositivoId: e.target.value || null })
                }
                disabled={escuchando}
                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-50"
              >
                <option value="">La que use Windows</option>
                {entradas.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Entrada ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-xs text-slate-500">
              modelo {modeloPorId(whisper?.modelo).label}
              {latencia !== null && ` · ${(latencia / 1000).toFixed(1)} s por ventana`}
              {descartadas > 0 && ` · ${descartadas} ventanas perdidas`}
            </span>
          </div>

          {/* Medidor: la única forma de saber que la consola está entrando. */}
          <div className="mt-3">
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full bg-listo transition-[width] duration-100"
                style={{ width: `${Math.min(100, nivel * 400)}%` }}
                role="meter"
                aria-label="Nivel de entrada"
                aria-valuenow={Math.round(nivel * 100)}
              />
              {/* Marca del umbral: lo que quede a la izquierda no se transcribe. */}
              <span
                className="absolute top-0 h-full w-px bg-slate-500"
                style={{ left: `${UMBRAL_VOZ * 400}%` }}
                title="Por debajo de esta marca se considera silencio"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {escuchando
                ? nivel >= UMBRAL_VOZ
                  ? 'Entra señal.'
                  : 'Silencio: no se transcribe nada hasta que entre voz.'
                : 'Detenida.'}
            </p>
          </div>

          {(errorEscucha || errorProyeccion) && (
            <p className="mt-3 flex items-center gap-2 rounded-md border border-aire-borde bg-aire-suave px-3 py-2 text-sm text-aire">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorEscucha ?? errorProyeccion}
            </p>
          )}
        </section>

        {/* Sugerencias */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-rotulo text-cabina-tinta-tenue">
              Se nombró
            </h2>
            {sugerencias.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  limpiar()
                  setProyectadas([])
                  setCorrecciones({})
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {sugerencias.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                {escuchando
                  ? 'Escuchando. Las citas van a aparecer acá unos segundos después de que se nombren.'
                  : 'Todavía no hay nada. Apretá Escuchar cuando empiece la predicación.'}
              </li>
            )}

            {[...sugerencias].reverse().map((r) => {
              const clave = claveSugerencia(r)
              const arreglo = correcciones[clave]
              const capitulo = arreglo?.cap ?? r.chapter
              const versiculo = arreglo?.vers ?? r.verse
              const dudosa = r.confianza < CONFIANZA_DUDOSA
              const yaSalio = proyectadas.includes(clave)

              return (
                <li
                  key={clave}
                  className={`rounded-lg border p-3 transition-colors ${
                    dudosa ? 'border-slate-700 bg-slate-800/30' : 'border-slate-600 bg-slate-800/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`text-lg font-semibold ${
                        dudosa ? 'text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {referenciaTexto(r.bookId, capitulo, versiculo)}
                      {r.endVerse && !arreglo && `-${r.endVerse}`}
                    </span>

                    {dudosa && (
                      <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[11px] text-slate-400">
                        no se entendió bien — revisá el número
                      </span>
                    )}
                    {/* Distinto de "no se entendió": esto se entendió bien, pero
                        llegó pegada al borde de la ventana y el número puede
                        estar cortado (un "13" que llega como "3"). */}
                    {r.cortada && !dudosa && (
                      <span
                        className="rounded border border-listo-borde px-1.5 py-0.5 text-[11px] text-listo"
                        title="La frase quedó cortada por el borde de la ventana de audio: puede faltarle un dígito al número."
                      >
                        se oyó cortada — confirmá el número
                      </span>
                    )}
                    {yaSalio && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-ok">
                        <Check className="h-3.5 w-3.5" /> ya salió
                      </span>
                    )}

                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditando(editando === clave ? null : clave)}
                        aria-label={`Corregir ${referenciaTexto(r.bookId, capitulo, versiculo)}`}
                        className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => descartarSugerencia(clave)}
                        aria-label={`Descartar ${referenciaTexto(r.bookId, capitulo, versiculo)}`}
                        className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void proyectar(r)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:bg-aire hover:text-white"
                      >
                        <Eye className="h-4 w-4" />
                        Proyectar
                      </button>
                    </div>
                  </div>

                  {editando === clave && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <label className="flex items-center gap-1.5">
                        Capítulo
                        <input
                          type="number"
                          min={1}
                          value={capitulo}
                          onChange={(e) =>
                            setCorrecciones((c) => ({
                              ...c,
                              [clave]: { cap: Number(e.target.value), vers: versiculo ?? 1 }
                            }))
                          }
                          className="w-16 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        Versículo
                        <input
                          type="number"
                          min={1}
                          value={versiculo ?? 1}
                          onChange={(e) =>
                            setCorrecciones((c) => ({
                              ...c,
                              [clave]: { cap: capitulo, vers: Number(e.target.value) }
                            }))
                          }
                          className="w-16 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
                        />
                      </label>
                    </div>
                  )}

                  {/* El fragmento crudo es lo que deja al operador entender de
                      dónde salió la sugerencia, y decidir si le cree. */}
                  <p className="mt-1.5 truncate text-xs italic text-slate-500" title={r.fragmento}>
                    «…{r.fragmento}…»
                  </p>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Transcripción cruda */}
        <section className="mt-3 shrink-0">
          <button
            type="button"
            onClick={() => setVerTranscripcion((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            {verTranscripcion ? 'Ocultar' : 'Ver'} lo que se está oyendo ({ventanas.length})
          </button>
          {verTranscripcion && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-slate-700 bg-slate-950/50 p-2 font-mono text-[11px] leading-relaxed text-slate-500">
              {ventanas.length === 0
                ? 'Todavía no se transcribió nada.'
                : ventanas.map((v, i) => <p key={`${i}-${v.slice(0, 12)}`}>{v}</p>)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
