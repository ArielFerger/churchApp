import type { ProjectionCommand } from '../types/ipc'

/** Cómo describir en una línea lo que está saliendo por el proyector. */
export interface EnElAire {
  /** Qué tipo de cosa es, en mayúscula corta para el rótulo. */
  clase: 'LETRA' | 'VERSÍCULO' | 'IMAGEN' | 'VIDEO' | 'NEGRO' | null
  /** El texto que identifica lo que se ve. `null` = no hay nada al aire. */
  detalle: string | null
}

const VACIO: EnElAire = { clase: null, detalle: null }

/**
 * Traduce el último comando de proyección a algo que el operador pueda leer de
 * un vistazo.
 *
 * Existe porque la pregunta que más se hace quien opera es "¿qué estoy
 * mostrando ahora?", y hasta ahora la única respuesta que daba la app era una
 * pastilla que decía LIVE — o sea, *que* había algo, nunca *qué*. Para saberlo
 * había que darse vuelta y mirar el proyector.
 */
export function describirEnElAire(
  cmd: ProjectionCommand | null,
  blackout: boolean
): EnElAire {
  if (blackout) return { clase: 'NEGRO', detalle: 'Pantalla en negro' }
  if (!cmd) return VACIO

  switch (cmd.type) {
    case 'showSlide': {
      // La primera línea con texto alcanza para reconocer la estrofa.
      const linea = cmd.content.lines.find((l) => l.trim().length > 0)
      return { clase: 'LETRA', detalle: linea?.trim() ?? 'Slide sin texto' }
    }
    case 'showBibleVerse':
      return { clase: 'VERSÍCULO', detalle: `${cmd.reference} · ${cmd.version}` }
    case 'showMedia':
      return { clase: 'IMAGEN', detalle: null } // el nombre lo resuelve quien lo muestra
    case 'clear':
    case 'stopAll':
      return VACIO
    default:
      return VACIO
  }
}

/** Recorta una línea larga sin cortar una palabra al medio. */
export function recortar(texto: string, max = 68): string {
  if (texto.length <= max) return texto
  const corte = texto.lastIndexOf(' ', max)
  return texto.slice(0, corte > max * 0.6 ? corte : max).trimEnd() + '…'
}
