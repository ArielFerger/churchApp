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
| `npm run typecheck` | TypeScript check without emit (both projects: node + web) |
| `npm run lint` | ESLint |
| `npm test` | Vitest (lógica pura de `shared/utils` + servicios de main) |
| `npm run test:watch` | Vitest en watch |
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

## Tests

`tests/` corre con Vitest en entorno Node y cubre la lógica pura: helpers de
carpetas y búsqueda de media, reglas de los metadatos (categorías + "para
hoy"), el parser de referencias bíblicas y el servicio de persistencia
`mediaMetaService` (con `app.getPath` mockeado contra una carpeta temporal, así
se ejercita el ida y vuelta real contra el disco).

La regla al agregar lógica: si se puede escribir como función pura en
`src/shared/utils/`, va ahí y se testea; los componentes quedan como capa de
presentación. Por eso el vencimiento diario de "para hoy", el saneado del JSON
y el matching del buscador viven fuera de React.

`npm run typecheck` chequea **los dos** proyectos de TypeScript por separado.
El `tsconfig.json` raíz solo tiene referencias (`files: []`), así que un
`tsc --noEmit` contra él no revisa ni un archivo.
