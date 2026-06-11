# Development

## Prerequisites

- Node.js 22 LTS
- npm 10+

## Setup

```bash
npm install
npm run dev
```

`npm run dev` builds main + preloads, levanta el dev server de Vite (HMR en ambas ventanas) y abre la app.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode (HMR enabled) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check without emit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run convert-bibles` | Regenera los JSON de biblias en `data/bibles/` |
| `npm run build:icons` | Regenera los íconos desde `resources/icons/icon.svg` |
| `npm run dist:win` | Build Windows installer |
| `npm run dist:linux` | Build Linux packages (correr en Linux/CI) |

## Path aliases

| Alias | Resolves to |
|---|---|
| `@/control/*` | `src/control/*` |
| `@/projection/*` | `src/projection/*` |
| `@/shared/*` | `src/shared/*` |
| `@electron/*` | `electron/*` |

## Estructura y convenciones

- **Todo el IPC está tipado**: canales en `src/shared/constants.ts`, payloads en `src/shared/types/`. Nada de strings sueltos.
- **Una store Zustand por dominio** en `src/shared/store/` (settings, library, audio, colas…). Las páginas leen de las stores; los efectos de IPC viven en hooks (`useProjectionBridge`, `useAudioPlayer`).
- **El proceso main no conoce React**: expone servicios (scanners, persistencia, protocolos) detrás de handlers IPC delgados en `electron/ipc/`.
- Los renderers nunca tocan rutas de archivos: todo se sirve por los protocolos `media://`, `audio://` y `appfont://` gateados por registro de ids.
