import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Tests de la lógica pura (utils compartidos y servicios sin Electron).
 * Los alias replican los de electron.vite.config.ts para que los tests
 * importen igual que el código de producción.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@/control': resolve('src/control'),
      '@/projection': resolve('src/projection'),
      '@/shared': resolve('src/shared'),
      '@electron': resolve('electron')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
