import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          500: '#4f6ef7',
          900: '#1a1f3c'
        },
        // Warm palette used by the Songs page (lifted from the user's mockup).
        songbook: {
          deep: '#14100c',
          warm: '#1c1611',
          ink: '#f0e3cd',
          'ink-dim': 'rgba(240, 227, 205, 0.55)',
          'ink-faint': 'rgba(240, 227, 205, 0.28)',
          'border-soft': 'rgba(245, 226, 196, 0.08)',
          'border-strong': 'rgba(245, 226, 196, 0.18)',
          amber: '#f5b342',
          'amber-soft': '#d4954a',
          sage: '#8fb98a',
          rust: '#c97554',
          danger: '#d65a4a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        manrope: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace']
      }
    }
  },
  plugins: [forms]
} satisfies Config
