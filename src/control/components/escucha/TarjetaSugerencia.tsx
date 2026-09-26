import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Check, Eye, Link2, Pencil, Repeat2, X } from 'lucide-react'
import type { Sugerencia } from '@/shared/store/escuchaStore'
import { textoReferencia } from '@/shared/utils/navegacionBiblica'
import { bookById } from '@/shared/utils/bibleBooks'
import Boton from '../ui/Boton'
import { filaLista } from '../ui/movimiento'
import type { EstadoVersiculo } from './useVersiculos'

/** Por debajo de esto la sugerencia se muestra apagada y pidiendo revisión. */
export const CONFIANZA_DUDOSA = 0.6

export interface Correccion {
  cap: number
  vers: number
}

/**
 * Una cita que se oyó. Todo lo que hay en la tarjeta está para que el
 * operador decida en un segundo si la proyecta: la referencia, el texto del
 * versículo, el pedazo de habla de donde salió, y las señales de duda.
 *
 * NUNCA se proyecta sola. El botón es la única vía.
 */
const TarjetaSugerencia = forwardRef<
  HTMLLIElement,
  {
    sugerencia: Sugerencia
    correccion: Correccion | undefined
    editando: boolean
    yaSalio: boolean
    /** Salió de una frase que todavía no terminó: puede cambiar. */
    provisional?: boolean
    esLaMasNueva: boolean
    version: string | null
    previa: EstadoVersiculo | undefined
    onProyectar: () => void
    onDescartar: () => void
    onEditar: () => void
    onCorregir: (c: Correccion) => void
    /** Clic derecho: las mismas acciones, más copiar. */
    onMenu?: (e: React.MouseEvent) => void
  }
>(function TarjetaSugerencia(
  {
    sugerencia: r,
    correccion,
    editando,
    yaSalio,
    provisional = false,
    esLaMasNueva,
    version,
    previa,
    onProyectar,
    onDescartar,
    onEditar,
    onCorregir,
    onMenu
  },
  ref
) {
  const capitulo = correccion?.cap ?? r.chapter
  const versiculo = correccion?.vers ?? r.verse
  const referencia = textoReferencia(r.bookId, capitulo, versiculo, correccion ? undefined : r.endVerse)
  const dudosa = r.confianza < CONFIANZA_DUDOSA
  const idTitulo = `sug-${r.bookId}-${r.chapter}-${r.verse ?? 'c'}-${r.endVerse ?? ''}`

  return (
    <motion.li
      ref={ref}
      layout
      variants={filaLista}
      initial="inicial"
      animate="visible"
      exit="salida"
      aria-labelledby={idTitulo}
      onContextMenu={onMenu}
      className={`group relative rounded-xl border p-3.5 transition-colors ${
        yaSalio
          ? 'border-cabina-linea bg-cabina-panel/60'
          : dudosa
            ? 'border-cabina-linea bg-cabina-panel'
            : esLaMasNueva
              ? 'border-listo-borde bg-cabina-panel shadow-[0_0_0_1px_rgba(245,179,66,0.15)]'
              : 'border-cabina-linea-fuerte bg-cabina-panel'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          id={idTitulo}
          className={`font-display text-xl font-semibold tracking-tight ${
            dudosa || yaSalio ? 'text-cabina-tinta-dim' : 'text-cabina-tinta'
          }`}
        >
          {referencia}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {provisional ? (
            <span
              className="animate-latido rounded border border-listo-borde px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-rotulo text-listo"
              title="Se oyó mientras el predicador sigue hablando: se confirma cuando termina la frase"
            >
              Oyendo…
            </span>
          ) : (
            esLaMasNueva &&
            !yaSalio && (
              <span className="rounded bg-listo-suave px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-rotulo text-listo">
                Nueva
              </span>
            )
          )}
          {r.veces > 1 && (
            <span
              className="inline-flex items-center gap-1 rounded border border-cabina-linea-fuerte px-1.5 py-0.5 text-[11px] text-cabina-tinta-dim"
              title="Cuántas veces se nombró este pasaje"
            >
              <Repeat2 className="h-3 w-3" aria-hidden />×{r.veces}
            </span>
          )}
          {r.inferida && (
            <span
              className="inline-flex items-center gap-1 rounded border border-cabina-linea-fuerte px-1.5 py-0.5 text-[11px] text-cabina-tinta-dim"
              title="El libro no se nombró en esta frase: se tomó de la cita anterior"
            >
              <Link2 className="h-3 w-3" aria-hidden />
              sigue en {bookById(r.bookId)?.name ?? r.bookId}
            </span>
          )}
          {dudosa && (
            <span className="rounded border border-cabina-linea-fuerte px-1.5 py-0.5 text-[11px] text-cabina-tinta-dim">
              no se entendió bien — revisá el número
            </span>
          )}
          {/* Distinto de "no se entendió": esto se entendió bien, pero llegó
              pegada a un corte forzado y el número puede estar cortado (un
              "13" que llega como "3"). */}
          {r.cortada && !dudosa && !provisional && (
            <span
              className="rounded border border-listo-borde px-1.5 py-0.5 text-[11px] text-listo"
              title="La frase quedó cortada por el largo máximo de un fragmento: puede faltarle un dígito al número."
            >
              se oyó cortada — confirmá el número
            </span>
          )}
          {yaSalio && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ok">
              <Check className="h-3.5 w-3.5" aria-hidden /> ya salió
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            onClick={onEditar}
            aria-label={`Corregir ${referencia}`}
            aria-expanded={editando}
            title="Corregir capítulo o versículo"
            icono={<Pencil className="h-4 w-4" aria-hidden />}
          />
          <Boton
            variante="peligro"
            tamano="sm"
            soloIcono
            onClick={onDescartar}
            aria-label={`Descartar ${referencia}`}
            title="Sacar de la lista"
            icono={<X className="h-4 w-4" aria-hidden />}
          />
          <Boton
            variante="aire"
            tamano="sm"
            onClick={onProyectar}
            aria-label={`Proyectar ${referencia}`}
            icono={<Eye className="h-4 w-4" aria-hidden />}
          >
            Proyectar
          </Boton>
        </div>
      </div>

      {editando && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-cabina-alto px-3 py-2 text-sm text-cabina-tinta-dim">
          <label className="flex items-center gap-1.5">
            Capítulo
            <input
              type="number"
              min={1}
              value={capitulo}
              onChange={(e) => onCorregir({ cap: Number(e.target.value), vers: versiculo ?? 1 })}
              className="w-20 rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1 text-cabina-tinta"
            />
          </label>
          <label className="flex items-center gap-1.5">
            Versículo
            <input
              type="number"
              min={1}
              value={versiculo ?? 1}
              onChange={(e) => onCorregir({ cap: capitulo, vers: Number(e.target.value) })}
              className="w-20 rounded-md border border-cabina-linea-fuerte bg-cabina-negro px-2 py-1 text-cabina-tinta"
            />
          </label>
        </div>
      )}

      {/* El texto del versículo: la forma más rápida de confirmar que la cita
          es la que el pastor está leyendo. */}
      {previa && !correccion && (
        <p className="mt-2 line-clamp-2 font-letra text-[15px] leading-snug text-cabina-tinta-dim">
          {previa.estado === 'cargando' && <span className="text-cabina-tinta-tenue">Buscando el texto…</span>}
          {previa.estado === 'ok' && previa.texto}
          {previa.estado === 'no-existe' && (
            <span className="font-sans text-sm text-listo">
              Este pasaje no está en {version ?? 'la versión elegida'}: revisá el número.
            </span>
          )}
        </p>
      )}

      {/* El fragmento crudo es lo que deja al operador entender de dónde salió
          la sugerencia, y decidir si le cree. */}
      <p className="mt-1.5 truncate text-xs italic text-cabina-tinta-tenue" title={r.fragmento}>
        «…{r.fragmento}…»
      </p>
    </motion.li>
  )
})

export default TarjetaSugerencia
