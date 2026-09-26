import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, MonitorPlay } from 'lucide-react'
import type { PasajeEnPantalla } from '@/shared/store/escuchaStore'
import { textoReferencia } from '@/shared/utils/navegacionBiblica'
import Boton from '../ui/Boton'
import { Panel, Rotulo, Tecla } from '../ui/Panel'
import { fundido } from '../ui/movimiento'

/**
 * Lo que salió a la pantalla desde la Escucha, con los botones para seguir
 * versículo por versículo. El predicador anuncia "Juan 3:16" y sigue leyendo
 * el 17, el 18: el operador acompaña desde acá sin volver a la sección Biblia.
 *
 * Usa el rojo `aire` porque ES lo que la congregación está viendo — y sólo
 * mientras siga siéndolo: si después se proyectó otra cosa, el panel lo dice.
 */
export default function PanelEnPantalla({
  pasaje,
  texto,
  sigueAlAire,
  puedeAnterior,
  puedeSiguiente,
  onAnterior,
  onSiguiente
}: {
  pasaje: PasajeEnPantalla | null
  texto: string | null
  sigueAlAire: boolean
  puedeAnterior: boolean
  puedeSiguiente: boolean
  onAnterior: () => void
  onSiguiente: () => void
}) {
  return (
    <Panel
      aria-labelledby="escucha-en-pantalla"
      className={sigueAlAire && pasaje ? 'border-aire-borde' : ''}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Rotulo id="escucha-en-pantalla" className={sigueAlAire && pasaje ? '!text-aire' : ''}>
          {sigueAlAire && pasaje ? 'Al aire desde la Escucha' : 'Última proyectada'}
        </Rotulo>
        <MonitorPlay
          className={`h-4 w-4 ${sigueAlAire && pasaje ? 'text-aire' : 'text-cabina-tinta-tenue'}`}
          aria-hidden
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {pasaje ? (
          <motion.div
            key={`${pasaje.bookId}-${pasaje.chapter}-${pasaje.verse}-${pasaje.endVerse ?? ''}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={fundido}
          >
            <p className="font-display text-lg font-semibold text-cabina-tinta">
              {textoReferencia(pasaje.bookId, pasaje.chapter, pasaje.verse, pasaje.endVerse)}
            </p>
            {texto && (
              <p className="mt-1 line-clamp-3 font-letra text-[15px] leading-snug text-cabina-tinta-dim">
                {texto}
              </p>
            )}
            {!sigueAlAire && (
              <p className="mt-2 text-xs text-cabina-tinta-tenue">
                Ya no está en pantalla: después se proyectó otra cosa.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.p
            key="vacio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-cabina-tinta-tenue"
          >
            Cuando proyectes una cita, aparece acá para seguir versículo por versículo.
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-3 flex items-center gap-2">
        <Boton
          variante="neutro"
          tamano="sm"
          onClick={onAnterior}
          disabled={!pasaje || !puedeAnterior}
          icono={<ChevronLeft className="h-4 w-4" aria-hidden />}
          aria-label="Versículo anterior"
          aria-keyshortcuts="Control+ArrowLeft"
          className="flex-1"
        >
          Anterior
        </Boton>
        <Boton
          variante="neutro"
          tamano="sm"
          onClick={onSiguiente}
          disabled={!pasaje || !puedeSiguiente}
          aria-label="Versículo siguiente"
          aria-keyshortcuts="Control+ArrowRight"
          className="flex-1"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Boton>
      </div>
      <p className="mt-2 text-[11px] text-cabina-tinta-tenue">
        <Tecla>Ctrl</Tecla> + <Tecla>←</Tecla> / <Tecla>→</Tecla> para moverte sin el mouse.
      </p>
    </Panel>
  )
}
