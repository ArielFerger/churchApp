import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        /**
         * Paleta "cabina": esto es una consola en vivo, no un gestor de
         * contenido. Se opera a oscuras con la congregación mirando la salida,
         * así que el fondo es negro CÁLIDO (el azulado encandila a las dos
         * horas) y el color no decora: dice en qué estado está algo.
         *
         * La regla que ordena todo: `aire` es lo que la congregación está
         * viendo AHORA, y ninguna otra cosa puede usar ese color. Antes el
         * azul significaba "seleccionado", el rojo "Detener" y el ámbar
         * "advertencia", sin ningún sistema detrás.
         */
        cabina: {
          negro: '#0e0d0c',
          panel: '#191614',
          alto: '#221d19',
          tinta: '#efe6d6',
          'tinta-dim': 'rgba(239, 230, 214, 0.72)',
          'tinta-tenue': 'rgba(239, 230, 214, 0.48)',
          linea: 'rgba(239, 230, 214, 0.10)',
          'linea-fuerte': 'rgba(239, 230, 214, 0.20)'
        },
        /** AL AIRE. Reservado: nada que no esté proyectándose puede ser rojo. */
        aire: {
          DEFAULT: '#e2483b',
          suave: 'rgba(226, 72, 59, 0.14)',
          borde: 'rgba(226, 72, 59, 0.55)'
        },
        /** Preparado / seleccionado / lo que sigue. */
        listo: {
          DEFAULT: '#f5b342',
          suave: 'rgba(245, 179, 66, 0.14)',
          borde: 'rgba(245, 179, 66, 0.5)'
        },
        /** Sólo confirmaciones ("listo", "guardado"). */
        ok: '#8fb98a',
        /**
         * Las seis páginas están escritas con la escala `slate` de Tailwind, que
         * es azulada. Antes que tocar cientos de clases a mano —y arriesgar
         * romper media app— se redefine la escala hacia neutros CÁLIDOS: cada
         * `bg-slate-900` pasa a ser el negro de cabina sin cambiar una línea de
         * JSX. El azul frío es exactamente lo que cansa la vista en una cabina a
         * oscuras durante dos horas.
         */
        slate: {
          50: '#faf7f2',
          100: '#efe6d6',
          200: '#d8cec0',
          300: '#b3aa9d',
          400: '#a89e91',
          500: '#948b7e',
          600: '#5c554c',
          700: '#332e29',
          800: '#221d19',
          900: '#141210',
          950: '#0e0d0c'
        }
      },
      fontFamily: {
        /**
         * Sin webfonts a propósito: la app corre sin internet en la PC de una
         * iglesia. Declarar Inter/Manrope/Fraunces sin empaquetarlas es lo que
         * dejó la tipografía librada al azar. Acá se nombra lo que de verdad
         * está instalado y se le saca provecho.
         */
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Segoe UI Variable Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        /** Para la letra dentro de las tarjetas: señala "esto se proyecta". */
        letra: ['Georgia', '"Times New Roman"', 'serif'],
        /** Todo número: contadores, duraciones, resoluciones, velocidades. */
        mono: ['Consolas', '"Cascadia Mono"', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        /** Micro-etiquetas en mayúscula, como las de una consola física. */
        rotulo: '0.14em'
      }
    }
  },
  plugins: [forms]
} satisfies Config
