# Architecture

## Stack

| Layer | Technology |
|---|---|
| Runtime | Electron |
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
| Package manager | npm |

## Two-window architecture

The app runs two `BrowserWindow` instances:

- **Control window** (`src/control/`) — operator-facing UI. Handles all user input, song/bible/media navigation, audio player.
- **Projection window** (`src/projection/`) — audience-facing display. Receives commands via IPC, never closes.

Communication is mostly one-way: control → main process → projection, via the typed `ProjectionCommand` union (see `src/shared/types/ipc.ts`). Two channels flow back:

- **Playback telemetry** — the projection reports the live video's position/duration/`ended` (`MediaPlaybackState`) so control can render the transport bar and advance the video queue.
- **Settings push** — when settings change, main broadcasts `SETTINGS_UPDATED` to the projection so verse appearance (font, size, background…) applies live.

## Projection layer system

```
Layer 3: Overlays (logo, blackout)
Layer 2: Content (text slides, bible verses + their background, media)
Layer 1: Background (image/video loop or slideshow)
Layer 0: Solid black
```

Content changes use CSS/Framer Motion fades — no reloads, no navigation. Inside Layer 2 the bible-verse background is an absolutely-positioned sub-layer; the verse text sits above it with `relative z-10` (CSS paint order would otherwise hide the text).

## Media scanners

Three independent `MediaScanner` instances (chokidar watchers) index media folders and keep an in-memory registry keyed by a stable sha1-of-path id. Each item records its `folder` relative to the scanned root, which powers the subfolder navigation (breadcrumbs) in the UI.

| Scanner | Folder setting | Used by |
|---|---|---|
| `mediaScanner` | `mediaFolder` | Media gallery, slideshow, default fallback |
| `liveMediaScanner` | `liveLoopFolder` | "Fondo único (loop)" picker in En Vivo |
| `bibleMediaScanner` | `bibleBackgroundsFolder` | Verse background picker in Apariencia |

The projection window merges the three indexes so any id resolves regardless of source.

## Custom protocols

All file serving goes through privileged custom schemes registered before `app.whenReady()` — renderers never see raw filesystem paths, and only ids present in a registry resolve:

| Scheme | Serves | Notes |
|---|---|---|
| `media://<id>` | Images/videos/GIFs from any of the three scanners | Byte-range support for `<video>` seeking |
| `audio://<id>[/artwork]` | Music files + extracted cover art | Range support for Howler seeking |
| `appfont://<id>` | User-uploaded font files | Consumed by `FontFace` in both windows |

## Video queue

The Media page builds an ordered queue of videos (`videoQueueStore`). When the projected clip fires `ended`, the projection emits an immediate (un-throttled) playback event with `ended: true`; `useProjectionBridge` in control advances to the next queued video (pre-loaded ahead of time) or clears the projection at the end. Queued clips never loop.

## Downloads (yt-dlp)

`downloadsService` shells out to two external binaries and owns a **sequential**
queue — one child process at a time, because saturating a church's uplink with
parallel downloads just makes all of them slow.

The binaries are deliberately *not* bundled: yt-dlp goes stale within weeks of
any YouTube change, and ffmpeg is larger than the rest of the app combined.
They're looked up in `settings.toolsFolder` → `userData/tools` → `<app>/tools`
→ `<app>/../tools` → `resources/tools` → PATH, and the page offers to fetch
them from the projects' own GitHub releases.

Everything parsed out of yt-dlp lives in `shared/utils/downloads.ts` as pure
functions, so the wire format is pinned by tests instead of discovered live:

- `buildArgs` — the flag list. Two of them are load-bearing and non-obvious:
  `--progress` (yt-dlp emits no progress at all when stdout isn't a TTY, which
  is always the case under Electron) and the *absence* of `--no-part` (with it,
  a canceled download leaves a truncated file under its final name, and the
  media scanner then indexes it as a playable video).
- `parseProgressLine` / `parseFileLine` — stdout carries progress, ordinary
  log lines and `--print` output interleaved, so each thing we care about is
  requested with its own tag prefix and everything else is ignored.
- `parsePlaylistEntries` — one JSON object per line from `--flat-playlist`,
  skipping private/deleted entries instead of aborting the whole list.

Quality caps are applied to **every** fallback in the `--format` chain, not
just the first: capping only the preferred one means a video with no mp4
silently falls through and downloads in 4K. The last fallback is a bare `best`
on purpose — better a different resolution than a failed download.

Playlists are expanded into one job per video rather than handed to yt-dlp
whole, so each entry gets its own progress and can be canceled individually.

Downloads land straight in the configured media/audio folders, so the existing
chokidar watchers pick them up and they appear in the library with no extra
wiring.

## Songs: one textarea, one parser

A song's canonical form is a single `content` string (`shared/types/song.ts`);
everything the Songs page shows is derived from it by `songParser`, never
stored twice:

- a blank line starts a new slide,
- `[Am]` markers ride along inside the text and are stripped for projection,
- a `# Coro` line names the slide for the operator and is dropped from
  `plainLines`.

`SlideContent` carries **lyrics and nothing else**. Song title, part name and
chords are all cabin-side aids; the projection window has no way to render
them, which is the point — there is no setting to get them back on screen by
accident.

Importing a `.txt` needs no new format: the file *is* the content. The only
work is `decodeSongFile` (UTF-8 strict, falling back to windows-1252, because
lyrics files written in old Notepad/Word are full of `ó` bytes that aren't
valid UTF-8) and `normalizeImportedText` (BOM, CRLF, runs of blank lines). It
runs entirely in the renderer off a drop / file input — no main-process dialog
involved.

Legacy songs (`sections`/`order`, pre-2026-05) are converted on read by
`synthesizeContent`, which writes their section labels back out as `# label`
lines — so an old song opens in the deck with its parts already named. New
saves only ever write `content`.

The perform view keeps a `cursor` (where the operator is) separate from
`liveIndex` (what the projector shows, resolved by matching the projected
lines). Two slides with identical lyrics — a repeated chorus — would otherwise
always highlight the first one, so the cursor wins when it matches.

## Media metadata (categories + "para hoy")

The scanners only know what's on disk. What the operator adds on top — a
category per file and the ephemeral "for today" selection — lives in
`userData/media-meta.json`, owned by `mediaMetaService` (main) and mirrored in
`mediaMetaStore` (control renderer, optimistic writes confirmed by main).

- **Categories** (`alabanza` / `adoracion` / `proyeccion`, defined once in
  `shared/types/media.ts`) are keyed by `mediaId`, which is a hash of the
  absolute path — moving or renaming a file loses its category and leaves a
  harmless orphan entry. Orphans are deliberately never pruned: doing it
  automatically would wipe everything the first time someone points the media
  folder somewhere else.
- **"Para hoy"** stores `{ date, ids }`. On read, a `date` that isn't today
  yields an empty list, so the selection expires by itself between services —
  including with the app left open across midnight.

The pure rules (rollover, dedupe, sanitising untrusted JSON) live in
`shared/utils/mediaMeta.ts` so main and renderer share them and they're
testable without Electron.

Search (`searchMedia` in `shared/utils/mediaFolders.ts`) is renderer-side over
the already-loaded index: accent-insensitive, multi-term AND, matching both
file name and folder path across the whole library.

## Bible verse appearance

`AppSettings.bibleDisplay` holds font id, size %, color, bold, shadow, background media id and background dim. The **Apariencia** panel (Bible tab) edits it with a scaled live preview; the projection re-renders on every settings push. User fonts live in `userData/bible-fonts/` (managed by `fontsService`, CRUD over IPC, broadcast to both windows) and are registered at runtime via the `FontFace` API — no internet needed at projection time.

## Audio independence

Audio runs entirely in the control renderer via Howler.js. The projection window has no knowledge of audio state. Music continues regardless of projection commands (blackout, slide change, etc.).

Playlists are persisted to `userData/audio-playlists.json`. Playback has a **context**: when a track starts from a playlist tab, next/prev and auto-advance follow that playlist's order (stopping at its end); the manual queue always takes priority.

## Persistence (userData)

| File / folder | Contents |
|---|---|
| `church-projector-settings.json` (electron-store) | `AppSettings`: display, folders, fades, `bibleDisplay` |
| `media-meta.json` | Media categories + the "para hoy" selection (see below) |
| `audio-state.json` | Last track, position, volume (session resume) |
| `audio-playlists.json` | Music playlists |
| `bible-fonts/` | Uploaded font files |
| `songs/` | Song library JSONs |

Settings are merged over defaults on read (deep-merge for `bibleDisplay`), so upgrades that add keys never break saved configs.

## IPC contract

All IPC messages are typed in `src/shared/types/ipc.ts` and `src/shared/types/electronAPI.d.ts`. No raw strings — always use `IPC_CHANNELS` constants from `src/shared/constants.ts`. Renderers only talk through the `contextBridge` APIs exposed by `electron/preload/*`.

## Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-22 | Scaffold with electron-vite + react-ts | Best DX for Electron + Vite, HMR support, two-renderer setup |
| 2026-05-22 | Hash router for renderer | electron-vite serves files via file://, hash router avoids path resolution issues |
| 2026-05-22 | pnpm as package manager | Faster installs, strict dependency resolution, disk space savings |
| 2026-06-08 | Switched to npm | pnpm unavailable in the dev environment; lockfile is `package-lock.json` |
| 2026-06-09 | `folder` field on MediaItem + breadcrumb UI | Subfolder organization without restructuring the scanner registry |
| 2026-06-09 | Dedicated scanners for live loops / bible backgrounds | Independent folders per use-case, same watcher pattern, ids stay globally resolvable |
| 2026-06-09 | Queue advance driven by an explicit `ended` telemetry flag | The 4/sec throttled telemetry could miss the end; an immediate event can't |
| 2026-06-10 | Fonts as user-uploaded files served via `appfont://` | Offline-safe at projection time (no Google Fonts CDN dependency) |
| 2026-06-10 | Verse appearance lives in settings, pushed to projection | Live application while tweaking; survives restarts; no per-command payload bloat |
