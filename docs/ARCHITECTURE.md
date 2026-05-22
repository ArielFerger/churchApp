# Architecture

## Stack

| Layer | Technology |
|---|---|
| Runtime | Electron (latest LTS) |
| Build | electron-vite |
| UI | React 18 + TypeScript strict |
| Styles | Tailwind CSS |
| Animations | Framer Motion |
| State | Zustand |
| Routing | React Router (hash mode) |
| Packaging | electron-builder |
| Persistence | electron-store + JSON files |
| File watch | chokidar |
| Icons | lucide-react |
| Audio | Howler.js |
| Audio metadata | music-metadata |
| Package manager | pnpm |

## Two-window architecture

The app runs two `BrowserWindow` instances:

- **Control window** (`src/control/`) — operator-facing UI. Handles all user input, song/bible/media navigation, audio player.
- **Projection window** (`src/projection/`) — audience-facing display. Receives commands via IPC, never closes.

Communication is strictly one-way: control → main process → projection, via typed `ProjectionCommand` union (see `src/shared/types/ipc.ts`).

## Projection layer system

```
Layer 3: Overlays (logo, blackout)
Layer 2: Content (text, media)
Layer 1: Background (image/video loop)
Layer 0: Solid black
```

Content changes use CSS/Framer Motion fades — no reloads, no navigation.

## Audio independence

Audio runs entirely in the control renderer via Howler.js. The projection window has no knowledge of audio state. Music continues regardless of projection commands (blackout, slide change, etc.).

## IPC contract

All IPC messages are typed in `src/shared/types/ipc.ts`. No raw strings — always use `IPC_CHANNELS` constants from `src/shared/constants.ts`.

## Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-22 | Scaffold with electron-vite + react-ts | Best DX for Electron + Vite, HMR support, two-renderer setup |
| 2026-05-22 | Hash router for renderer | electron-vite serves files via file://, hash router avoids path resolution issues |
| 2026-05-22 | pnpm as package manager | Faster installs, strict dependency resolution, disk space savings |
