import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@electron': resolve('electron'),
        '@/shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          control: resolve('electron/preload/control.ts'),
          projection: resolve('electron/preload/projection.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: {
          control: resolve('src/control.html'),
          projection: resolve('src/projection.html')
        }
      }
    },
    resolve: {
      alias: {
        '@/control': resolve('src/control'),
        '@/projection': resolve('src/projection'),
        '@/shared': resolve('src/shared'),
        '@/styles': resolve('src/styles')
      }
    },
    plugins: [react()]
  }
})
