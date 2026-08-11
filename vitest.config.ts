import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Los alias replican los de electron.vite.config.ts para que los tests
 * importen igual que el código de producción.
 *
 * El entorno por defecto es `node`, que es lo que necesitan los tests de
 * lógica pura y de los servicios de Electron. Los que tocan React o el DOM
 * piden happy-dom con `// @vitest-environment happy-dom` en su primera línea,
 * así no se paga el costo de levantar un DOM en los otros.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/control': resolve('src/control'),
      '@/projection': resolve('src/projection'),
      '@/shared': resolve('src/shared'),
      '@electron': resolve('electron')
    }
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node'
  }
})
