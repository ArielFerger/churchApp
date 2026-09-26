import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      screens: {
        /** Notebooks chicas y la ventana de control achicada al lado del proyector. */
        xs: '480px',
        /** Monitores de cabina grandes: aprovechar el ancho, no estirar. */
        '3xl': '1920px'
      },
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
          'tinta-dim': 'rgba(239, 230, 214, 0.74)',
          // 0,48 daba un contraste de ~4:1 sobre el panel, por debajo de lo
          // que pide WCAG para texto chico (4,5:1). Las micro-etiquetas de 11 px
          // usan justamente este tono.
          'tinta-tenue': 'rgba(239, 230, 214, 0.58)',
          linea: 'rgba(239, 230, 214, 0.10)',
          'linea-fuerte': 'rgba(239, 230, 214, 0.20)'
        },
        /** AL AIRE. Reservado: nada que no esté proyectándose puede ser rojo. */
        aire: {
          DEFAULT: '#e2483b',
          suave: 'rgba(226, 72, 59, 0.14)',
          borde: 'rgba(226, 72, 59, 0.55)'
        },
        /** Preparado / seleccionado / lo que sigue / la acción principal. */
        listo: {
          DEFAULT: '#f5b342',
          suave: 'rgba(245, 179, 66, 0.14)',
          borde: 'rgba(245, 179, 66, 0.5)'
        },
        /** Sólo confirmaciones ("listo", "guardado", "descargado"). */
        ok: {
          DEFAULT: '#8fb98a',
          suave: 'rgba(143, 185, 138, 0.14)',
          borde: 'rgba(143, 185, 138, 0.45)'
        },
        /**
         * Errores. No puede ser el rojo de `aire` —un error no está al aire—,
         * así que es un salmón más claro y menos saturado: se lee como "algo
         * falló" sin confundirse con la barra AL AIRE.
         */
        falla: {
          DEFAULT: '#f28b82',
          suave: 'rgba(242, 139, 130, 0.12)',
          borde: 'rgba(242, 139, 130, 0.45)'
        },
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
          500: '#9a9184',
          600: '#5c554c',
          700: '#332e29',
          800: '#221d19',
          900: '#141210',
          950: '#0e0d0c'
        }
      },
      fontFamily: {
        /**
         * Fuentes EMPAQUETADAS con la app (`@fontsource`, ver `main.tsx`): la
         * app corre sin internet en la PC de una iglesia, y tiene que verse
         * igual en Windows y en Linux. Antes se nombraban Segoe UI y Consolas,
         * que en Linux no existen y dejaban la tipografía librada al azar.
         * Las de sistema quedan de respaldo por si algo falla al cargar.
         */
        sans: ['"Inter Variable"', '"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Inter Variable"', '"Segoe UI Variable Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        /** Para la letra dentro de las tarjetas: señala "esto se proyecta". */
        letra: ['"Source Serif 4 Variable"', 'Georgia', '"Times New Roman"', 'serif'],
        serif: ['"Source Serif 4 Variable"', 'Georgia', '"Times New Roman"', 'serif'],
        /** Todo número: contadores, duraciones, resoluciones, velocidades. */
        mono: ['"JetBrains Mono Variable"', 'Consolas', '"Cascadia Mono"', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        /** Micro-etiquetas en mayúscula, como las de una consola física. */
        rotulo: '0.14em'
      },
      keyframes: {
        'barrido-indeterminado': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' }
        },
        'latido-suave': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        },
        ecualizador: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' }
        }
      },
      animation: {
        /** Barra de progreso cuando no se sabe el total. */
        indeterminado: 'barrido-indeterminado 1.4s ease-in-out infinite',
        latido: 'latido-suave 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: [forms]
} satisfies Config
