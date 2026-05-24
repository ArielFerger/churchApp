# Build & Packaging

The app ships as native installers via [electron-builder](https://www.electron.build/).

| Platform | Target | Output |
|---|---|---|
| Windows | NSIS installer | `release/Church Projector-Setup-<version>-x64.exe` |
| Linux | AppImage | `release/Church Projector-<version>-x64.AppImage` |
| Linux | Debian package | `release/Church Projector-<version>-x64.deb` |

## Prerequisites

- Node.js 22 LTS
- npm 10+
- Disk space: ~1 GB for the build cache + outputs

### Windows-only (local builds)

Electron-builder downloads a code-signing helper (`winCodeSign`) that contains
macOS dylib symlinks. Extracting them on Windows requires either admin
privileges or **Developer Mode** enabled:

> Settings → System → For developers → Developer Mode → **On**

This is a one-time toggle and doesn't require restarting. CI runners
(`windows-latest`) already have the necessary permissions.

If you see `Cannot create symbolic link : El cliente no dispone de un
privilegio requerido` during `npm run dist:win`, that's this issue.

## Local build commands

```bash
npm run build         # electron-vite production build (main + preload + renderer)
npm run build:icons   # regenerate icon.png/icon.ico/tray.png from icon.svg
npm run package       # unpacked app dir under release/win-unpacked (no installer)
npm run dist:win      # full Windows NSIS installer
npm run dist:linux    # AppImage + .deb (best run on Linux)
npm run dist          # build for the current platform
```

`dist:linux` from Windows works but Docker is preferable for clean results
(see "Cross-compilation" below).

## What gets shipped

Bundled in the asar:

- `out/main/index.js` — Electron main process
- `out/preload/*.mjs` — control + projection preload scripts
- `out/renderer/*` — both renderer bundles (control + projection)

Bundled as `extraResources` (loaded at runtime via `process.resourcesPath`):

- `data/bibles/*.json` — RVR1909 + RVA-2015 (~9 MB total)

Source files in the repo not shipped: `resources/icons/icon.svg`,
`scripts/*`, documentation, tests.

## Icons

The app icon source lives at `resources/icons/icon.svg`. To regenerate the
derived formats after editing:

```bash
npm run build:icons
```

This produces:

- `resources/icons/icon.png` (1024×1024) — primary source; Linux uses directly
- `resources/icons/icon.ico` (multi-size: 16, 24, 32, 48, 64, 128, 256) — Windows
- `resources/icons/tray.png` (32×32) — reserved for a future system-tray entry

The bundled placeholder shows a stylized projection beam with a cross. Replace
`icon.svg` with the church's actual logo and re-run `npm run build:icons`.

## Releases via GitHub Actions

Tagging a release triggers `.github/workflows/release.yml`, which:

1. Spins up `windows-latest` and `ubuntu-latest` runners.
2. Installs dependencies (`npm ci`).
3. Builds the app (`npm run build`).
4. Packages each platform (`npm run make:win` / `npm run make:linux`).
5. Attaches the resulting installers to the GitHub Release for the tag.

To cut a release:

```bash
# Bump version in package.json (and commit)
npm version patch   # or minor / major
git push --follow-tags
```

The workflow keys off the pushed `v*` tag.

### Code signing

Currently disabled in `electron-builder.yml` (`afterSign: null`). For a
public release on Windows you'll want to:

1. Buy or generate a code-signing certificate (`.pfx`).
2. Store it as a base64-encoded secret in GitHub Actions named `CSC_LINK`,
   and the password as `CSC_KEY_PASSWORD`.
3. Re-enable code signing by removing `afterSign: null` from the config.

Linux AppImage doesn't need signing; the `.deb` is verified by APT.

## Cross-compilation notes

- **Windows from Linux/macOS**: works for the unsigned NSIS installer.
- **Linux from Windows**: works via WSL2 or Docker; native cross-compile is
  flaky for `.deb` (uses dpkg under the hood). Prefer building on a real
  Linux runner.
- **macOS**: not currently a release target; would need an Apple
  developer certificate and a macOS runner.
