# Development

## Prerequisites

- Node.js 22 LTS
- pnpm 9+

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start in development mode (HMR enabled) |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript check without emit |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm make:win` | Build Windows installer |
| `pnpm make:linux` | Build Linux packages |

## Path aliases

| Alias | Resolves to |
|---|---|
| `@/control/*` | `src/control/*` |
| `@/projection/*` | `src/projection/*` |
| `@/shared/*` | `src/shared/*` |
| `@electron/*` | `electron/*` |
