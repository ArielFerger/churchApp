import type { Transition, Variants } from 'framer-motion'

/**
 * Presets de animación de la ventana de control.
 *
 * Criterio: esto es una consola en vivo, no una vidriera. Las animaciones
 * existen para que el ojo siga qué cambió (una sugerencia nueva, una descarga
 * que terminó), no para lucirse. Son cortas —el operador no puede esperar a
 * que termine una transición para apretar el siguiente botón— y respetan la
 * preferencia del sistema de reducir movimiento (`MotionConfig` en App.tsx).
 */

/** Resorte firme, sin rebote visible: para posiciones y tamaños. */
export const resorte: Transition = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }

/** Fundido rápido: para opacidad. */
export const fundido: Transition = { duration: 0.16, ease: [0.2, 0, 0, 1] }

/** Entrada de una fila nueva en una lista (sugerencias, descargas). */
export const filaLista: Variants = {
  inicial: { opacity: 0, y: -6, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { ...resorte, opacity: fundido } },
  salida: { opacity: 0, x: 24, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }
}

/** Cambio de sección: sube apenas y aparece. */
export const pagina: Variants = {
  inicial: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.2, 0, 0, 1] } },
  salida: { opacity: 0, transition: { duration: 0.08 } }
}

/** Paneles que se despliegan (ajustes, detalle técnico). */
export const desplegable: Variants = {
  cerrado: { opacity: 0, height: 0, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
  abierto: { opacity: 1, height: 'auto', transition: { duration: 0.2, ease: [0.2, 0, 0, 1] } }
}
