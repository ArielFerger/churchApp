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

### External tools on Windows and Linux

Everything about finding, fetching, unpacking and killing external tools lives
in `electron/services/toolsPaths.ts`, shared by downloads and Escucha:

| Tool | Windows asset | Linux asset | Notes |
|---|---|---|---|
| yt-dlp | `yt-dlp.exe` | `yt-dlp_linux` / `_aarch64` | The plain `yt-dlp` is a Python zipapp; the `_linux` one is standalone |
| ffmpeg + ffprobe | BtbN `win64-gpl.zip` | BtbN `linux64-gpl.tar.xz` | |
| deno | `deno-x86_64-pc-windows-msvc.zip` | `deno-x86_64-unknown-linux-gnu.zip` | Only if no deno/node/bun is found |
| whisper | `whisper-bin-x64.zip` | `whisper-bin-ubuntu-x64.tar.gz` | CLI + server + shared libs |

- **Release lookup.** `releases/latest/download/<asset>` only works if the
  release tagged "latest" carries that file. whisper.cpp stopped doing that
  (v1.9.4 shipped without binaries; packages go to `bNNNN` releases) and the
  in-app install silently 404'd. `urlDeAsset` asks the GitHub API for the
  newest release that has the asset (`shared/utils/githubReleases.ts`, pure and
  tested) and falls back to the shortcut if the API is unreachable.
- **Unpacking.** Zips go through `extract-zip` (pure JS, streamed from disk);
  tarballs through the system `tar`, which exists on every Linux and on
  Windows 10+, and preserves exec bits and the `libwhisper.so → .so.1`
  symlinks. It used to be PowerShell's `Expand-Archive`, so nothing could be
  installed on Linux.
- **Killing.** On Windows `taskkill /T /F`; on POSIX processes are spawned
  `detached` and the whole process group gets the signal — yt-dlp spawns
  ffmpeg, and a SIGTERM to the parent alone left ffmpeg writing the file.
- **Linux libraries.** whisper's `.so` files sit next to the binary;
  `entornoConBibliotecas` adds that folder to `LD_LIBRARY_PATH`.
- **Updating yt-dlp.** `actualizarYtDlp` re-downloads in place (atomic rename)
  when the binary is ours, or drops a private copy in the tools folder (which
  wins over PATH) when it came from a package manager. The page shows the
  version's age (`diasDeAntiguedad`) and turns the button amber past 45 days.

Two yt-dlp flags added later, both measured:

- `--concurrent-fragments 4` — YouTube serves DASH fragments; fetching four at
  a time is much faster without opening parallel downloads.
- `--trim-filenames 230` — yt-dlp applies this limit to the **whole path**,
  not the file name. At 150 with a 118-character folder, titles were cut to
  ~30 characters. The clip suffix (` [1m30-4m05]`) avoids `:` (Windows) and
  `.` (yt-dlp's trimming splits on dots and mangled `[0.02-0.07]`).

Clips use `--download-sections *start-end --force-keyframes-at-cuts` so the cut
lands on the requested second instead of the nearest keyframe.

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

### Two flags that decide whether this works at all

`networkArgs` goes into *every* yt-dlp invocation (download, probe, playlist
expansion), and two entries there are load-bearing:

- **`-4`.** yt-dlp uses Python's urllib, which — unlike curl — does not
  implement Happy Eyeballs. On a network that advertises IPv6 without a working
  route (common on consumer links), yt-dlp tries IPv6 and blocks forever: no
  timeout, no message, not even the "Extracting URL" line. Measured on the
  developer's machine: hangs indefinitely without it, answers in seconds with
  it. `--socket-timeout` does *not* rescue this — the stall is before any
  socket read.
- **`--js-runtimes`.** YouTube requires solving a JS challenge to hand over
  formats. yt-dlp only enables `deno` on its own, so a machine with node
  installed and on PATH still reports `JS runtimes: none` and the challenge
  never resolves. `resolveTools` looks for deno/node/bun/quickjs in the tools
  folders and on PATH and names it explicitly.

The queue is strictly sequential, guarded by a `pumping` flag. Without it,
`enqueuePlaylist` calling `enqueue` in a loop fired one `pump()` per entry in
the same tick — `running` is only assigned inside `runJob`, so every one of
them saw a free queue and spawned its own yt-dlp. A 50-video playlist meant 50
simultaneous processes against the same URL, which is also exactly the traffic
pattern that gets an IP served a CAPTCHA: the app used to inflict the block on
itself.

### YouTube session

When YouTube answers "sign in to confirm you're not a bot" — IP reputation, not
anything the app did — `openYoutubeLogin` opens a real youtube.com window in its
own `persist:` partition. **A human does the human verification**: the app never
sees the password and never tries to solve the challenge itself. On close, the
partition's cookies are exported to Netscape format for `--cookies`.

Two things that are easy to get wrong here:

- Merely loading youtube.com leaves ~8 consent and visitor cookies, so counting
  cookies would report "session saved" for someone who never logged in.
  `hasAuthCookies` looks for the actual Google auth names instead.
- yt-dlp **rewrites** the cookies file when it exits (the file says "generated
  by yt-dlp" inside). Deleting it while a download is running does nothing —
  the dying process recreates it a second later — so `clearYoutubeSession`
  stops everything using it first, then deletes and verifies.

The exported file is a credential: it lives in userData, is never logged, and
its contents are never surfaced in the UI.

Errors are translated by `explainError` into something an operator can act on,
with the raw stderr kept in `job.errorDetail` so it can be read and copied from
the page. Collapsing stderr to "the last line starting with ERROR" hid every
Python traceback and every warning behind `yt-dlp terminó con código 1`.

Playlists are expanded into one job per video rather than handed to yt-dlp
whole, so each entry gets its own progress and can be canceled individually.

Downloads land straight in the configured media/audio folders, so the existing
chokidar watchers pick them up and they appear in the library with no extra
wiring.

## Escucha (listening for spoken citations)

Pipeline, renderer → main → renderer:

```
getUserMedia (console line in, no AGC/NS/EC)
  → AudioWorklet (public/escucha-worklet.js) → 128 ms Float32 chunks at 16 kHz
  → SegmentadorVoz: 30 ms frames, adaptive noise floor, cut at pauses
  → phrase PCM + prompt (biblical vocabulary + last ~30 words) ──IPC──▶
      escuchaService → whisper-server (persistent, 127.0.0.1, random port)
      ◀── verbose_json ── parseRespuestaServidor (no_speech_prob, hallucinations)
  → escuchaStore.aplicarVentana: stitch with previous tail, detect, merge
  → suggestions (operator confirms with the verse text visible) → showBibleVerse
```

Design points, each backed by a measurement on a 52 s sermon synthesized with a
neural Spanish voice (tests reproduce the transcript verbatim):

- **Detector reads whisper's format.** Whisper writes "Juan 3:16" almost always.
  The first detector split on spaces and stripped punctuation, turning it into
  "316" — a chapter John doesn't have. It found 1 of 5 citations; the
  tokenizer (`tokenizar`, with character spans) now splits `3:16`, `8.28`,
  `5:3-12`, `3,16` and records the separator. `:` counts as an explicit marker
  (unlocks ambiguous books like "Hechos 2:38") but never enables context
  resolution ("a las 10:30").
- **Context.** "y ahora el versículo 31" resolves against the last cited or
  projected passage (3-minute validity); "el capítulo 13 de primera de
  Corintios" takes the book from after. Inferred suggestions are flagged.
- **whisper-server instead of one whisper-cli per window.** The CLI reloads the
  model on every call (~3.4 s vs ~1.3 s per fragment with the model in RAM).
  The server is warmed up when the operator presses Escuchar, idles out after
  10 minutes, and the CLI remains as a fallback (missing server, or three
  crashes in two minutes). Audio travels in the HTTP request: no WAV on disk.
- **`audio_ctx`.** Whisper always computes a 30 s window. `audioCtxPara` caps
  it at ≥768 (~15 s): ~1430 → ~780 ms per phrase with the same citations.
  Below ~512 the model starts truncating phrases and citations are lost.
- **Phrases, not clock windows.** `SegmentadorVoz` tracks the noise floor as the
  minimum over the last 3 s (works through continuous speech because words
  have gaps; a constant console hiss becomes the floor instead of "speech"),
  opens a phrase after 3 voiced frames with 300 ms pre-roll, closes it on a
  650 ms pause (240 ms once it's longer than 7 s), and force-cuts at 12 s
  carrying 1.5 s of overlap. Sensitivity (0..1) sets the margin over the floor.
- **Stitching.** The last 8 tokens of the previous fragment are re-analysed
  with the new one, and only citations ending in the new text are kept: a
  breath between "vamos a segunda de" and "Corintios 5:17" yields 2CO, not 1CO.
- **Only one transcription in flight.** A fragment that arrives while whisper
  is busy is dropped (counted), never queued: a queue makes the listener fall
  further behind forever.

End to end in the running app (fake audio device, CDP-driven): 5/5 citations
in order, ~660 ms per phrase, no false positive on "los hechos de aquel
hombre", and "Siguiente" after projecting Juan 3:16 put Juan 3:17 on screen.

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

## Platform

- **Single instance.** `requestSingleInstanceLock`; a second launch focuses the
  first. Two instances meant two projection windows fighting for the monitor.
- **Permissions.** Electron grants everything unless a handler says otherwise.
  `permisos.ts` allows only `media` (audio only), clipboard and fullscreen for
  the app's own pages; the YouTube login partition gets nothing.
- **Linux display server.** When `DISPLAY` is set, `--ozone-platform=x11` is
  appended (overridable): under Wayland an app cannot place a window on a given
  monitor, and the projection window must land on the projector.
- **Fonts** are bundled (`@fontsource-variable`: Inter, JetBrains Mono, Source
  Serif 4) so both OSes render the same, offline. Segoe UI and Consolas do not
  exist on Linux.

## Control window design system ("cabina")

Tokens in `tailwind.config.ts`; the rule is that colour means state:

| Token | Meaning |
|---|---|
| `aire` (red) | What the congregation sees now — and buttons that put something there |
| `listo` (amber) | Selected / next / primary action / keyboard focus |
| `ok` (green) | Confirmations |
| `falla` (salmon) | Errors and destructive actions (cannot be `aire`: an error isn't on air) |

Components in `src/control/components/ui/` (`Boton`, `Panel`, `Aviso`,
`BarraProgreso`, `Interruptor`, `EncabezadoPagina`) and motion presets in
`movimiento.ts`. `MotionConfig reducedMotion="user"` plus a
`prefers-reduced-motion` block in `styles/control.css` honour the OS setting in
the control window only — the projection keeps its fades. Navigation is a
vertical rail (`RielNavegacion`, Ctrl+1…8) because eight tabs plus the quick
actions did not fit in one header row below ~1500 px.

## Tool scripts

`scripts/herramientas/` holds stdlib-only Python scripts that install/update/
diagnose the external tools into the same folders the app searches, and
download from YouTube with the same flags as the app. They force IPv4 for the
same reason `-4` is passed to yt-dlp. They ship with the installer under
`resources/scripts/herramientas`.

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
| 2026-09-26 | Detector tokenizes digit separators (`3:16`) | Whisper's usual format was invisible to the detector (1/5 citations found) |
| 2026-09-26 | whisper-server kept alive, CLI as fallback | Model reload dominated each fragment's latency |
| 2026-09-26 | Voice-activity segmentation instead of fixed 6 s windows | Citations split by clock cuts; fixed energy threshold broke with other consoles |
| 2026-09-26 | GitHub API to resolve release assets | whisper.cpp's "latest" release has no binaries (404) |
| 2026-09-26 | extract-zip + system tar instead of PowerShell | Tools could not be installed on Linux |
| 2026-09-26 | Bundled fonts, vertical navigation rail, `falla` token | Cross-OS rendering; header overflow; red reserved for on-air |
