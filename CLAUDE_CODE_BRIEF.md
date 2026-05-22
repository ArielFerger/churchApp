# Brief para Claude Code — App de Proyección para Iglesia

## 🎯 Contexto

Vamos a construir una app de escritorio para una iglesia que proyecta contenido en una segunda pantalla durante el servicio (letras de canciones, versículos bíblicos, videos, imágenes, GIFs, fondos) y reproduce música de fondo. Multiplataforma: **Windows + Linux**.

## 🧭 Cómo quiero que trabajes

1. **Trabajá fase por fase.** Al final de cada fase mostrame el resultado (árbol de archivos, código de los archivos clave) y **esperá mi confirmación explícita** antes de avanzar.
2. **No te adelantes.** Si una fase dice "X pasos", hacé esos pasos. No agregues features de fases posteriores.
3. **Cuando tengas dudas, preguntá.** Mejor una pregunta corta ahora que rehacer después.
4. **Commits frecuentes** siguiendo Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
5. **TypeScript estricto.** `strict: true` en tsconfig.
6. **Documentá las decisiones técnicas** en `docs/ARCHITECTURE.md` a medida que avanzamos.

---

## 📋 Stack Definido

| Capa | Tecnología |
|---|---|
| Runtime | Electron (última LTS) |
| Build | electron-vite |
| UI | React 18 + TypeScript (strict) |
| Estilos | Tailwind CSS |
| Animaciones | Framer Motion |
| Estado | Zustand |
| Routing | React Router (modo hash) |
| Packaging | electron-builder |
| Persistencia | electron-store + JSON files |
| Watch de archivos | chokidar |
| Iconos | lucide-react |
| Audio | Howler.js |
| Metadata audio | music-metadata |
| Package manager | pnpm |

---

## 🏛️ Principios de Arquitectura (NO NEGOCIABLES)

### 1. La ventana de proyección NUNCA se cierra ni se mueve

> La ventana de proyección se abre **una sola vez** al iniciar el servicio y permanece abierta. Todo el contenido cambia **dentro** de esa ventana vía IPC, no abriendo/cerrando ventanas ni cambiando modos de pantalla completa.

Configuración obligatoria:
```ts
new BrowserWindow({
  x: targetDisplay.bounds.x,
  y: targetDisplay.bounds.y,
  width: targetDisplay.bounds.width,
  height: targetDisplay.bounds.height,
  frame: false,
  fullscreen: true,
  kiosk: true,
  resizable: false,
  movable: false,
  show: false,             // mostrar SOLO en ready-to-show
  backgroundColor: '#000000',
  webPreferences: {
    preload: '...',
    contextIsolation: true,
    nodeIntegration: false
  }
})
```
Y siempre: `projectionWindow.once('ready-to-show', () => projectionWindow.show())`.

### 2. Sistema de capas en proyección

```
Layer 3: Overlays (logo, blackout)
Layer 2: Contenido (texto, media)
Layer 1: Fondo (imagen/video loop)
Layer 0: Color sólido (negro)
```

Cambios de contenido = fade entre capas (CSS / Framer Motion), no recarga ni navegación.

### 3. Pre-carga de media

Cuando el operador **selecciona** un video/imagen, la proyección recibe `preload` y lo carga oculto. Cuando el operador hace clic en **"Mostrar"**, ya está listo y solo se hace fade-in.

### 4. IPC tipado

Todos los mensajes entre control y proyección están definidos en `src/shared/types/ipc.ts`:

```ts
export type ProjectionCommand =
  | { type: 'showSlide'; content: SlideContent; transition?: Transition }
  | { type: 'showBibleVerse'; reference: string; text: string; version: string }
  | { type: 'showMedia'; mediaId: string; mode: 'image' | 'video' | 'gif' }
  | { type: 'preloadMedia'; mediaId: string }
  | { type: 'setBackground'; mediaId: string | null }
  | { type: 'blackout' }
  | { type: 'showLogo' }
  | { type: 'clear' }
```

### 5. El módulo de audio es independiente de la proyección

El audio se reproduce en el **renderer de la ventana de control** con Howler.js. La proyección no sabe nada de él. La música sigue sonando aunque haya blackout, cambio de slide, etc.

---

## 📁 Estructura de Carpetas

```
church-projector/
├── .github/workflows/
│   ├── build.yml
│   └── release.yml
├── electron/
│   ├── main.ts
│   ├── preload/
│   │   ├── control.ts
│   │   └── projection.ts
│   ├── ipc/
│   │   ├── projection.ts
│   │   ├── files.ts
│   │   ├── audio.ts
│   │   ├── settings.ts
│   │   └── displays.ts
│   ├── windows/
│   │   ├── controlWindow.ts
│   │   └── projectionWindow.ts
│   └── services/
│       ├── mediaScanner.ts
│       ├── audioScanner.ts
│       └── bibleService.ts
├── src/
│   ├── control/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Live.tsx
│   │   │   ├── Songs.tsx
│   │   │   ├── Bible.tsx
│   │   │   ├── Media.tsx
│   │   │   ├── Audio.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── SlideList.tsx
│   │   │   ├── PreviewMonitor.tsx
│   │   │   ├── LiveMonitor.tsx
│   │   │   ├── LiveIndicator.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   └── audio/
│   │   │       ├── LibraryBrowser.tsx
│   │   │       ├── PlaylistPanel.tsx
│   │   │       ├── TrackList.tsx
│   │   │       ├── MiniPlayer.tsx
│   │   │       ├── PlayerControls.tsx
│   │   │       ├── VolumeSlider.tsx
│   │   │       └── ProgressBar.tsx
│   │   ├── audio/
│   │   │   ├── audioEngine.ts
│   │   │   ├── playlistManager.ts
│   │   │   └── crossfade.ts
│   │   └── hooks/
│   ├── projection/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── BackgroundLayer.tsx
│   │   │   ├── ContentLayer.tsx
│   │   │   ├── OverlayLayer.tsx
│   │   │   ├── SongSlide.tsx
│   │   │   ├── BibleSlide.tsx
│   │   │   ├── MediaSlide.tsx
│   │   │   └── BlackScreen.tsx
│   │   └── transitions/
│   │       └── Fade.tsx
│   ├── shared/
│   │   ├── store/
│   │   │   ├── liveStore.ts
│   │   │   ├── libraryStore.ts
│   │   │   ├── audioStore.ts
│   │   │   └── settingsStore.ts
│   │   ├── types/
│   │   │   ├── ipc.ts
│   │   │   ├── song.ts
│   │   │   ├── bible.ts
│   │   │   ├── audio.ts
│   │   │   └── media.ts
│   │   ├── utils/
│   │   │   ├── bibleParser.ts
│   │   │   └── songParser.ts
│   │   └── constants.ts
│   ├── styles/
│   │   └── globals.css
│   ├── control.html
│   └── projection.html
├── resources/
│   ├── icons/
│   │   ├── icon.png
│   │   ├── icon.ico
│   │   └── tray.png
│   ├── fonts/
│   └── default-backgrounds/
├── data/
│   ├── bibles/
│   │   ├── rvr1909.json
│   │   └── rva2015.json
│   └── seed-songs/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── BUILD.md
│   └── USER_GUIDE.md
├── scripts/
│   └── convert-bible.ts
├── tests/
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── package.json
├── README.md
├── LICENSE
└── .gitignore
```

---

## 🧬 Esquemas de Datos

### Canción (JSON)
```json
{
  "id": "cuan-grande-es-el",
  "title": "Cuán Grande es Él",
  "author": "Stuart K. Hine",
  "tags": ["adoración"],
  "language": "es",
  "createdAt": "2026-05-22T10:00:00Z",
  "updatedAt": "2026-05-22T10:00:00Z",
  "sections": [
    {
      "id": "v1",
      "type": "verse",
      "label": "Verso 1",
      "slides": [
        { "id": "v1-s1", "lines": ["Señor mi Dios...", "..."] }
      ]
    },
    {
      "id": "chorus",
      "type": "chorus",
      "label": "Coro",
      "slides": [{ "id": "c-s1", "lines": ["..."] }]
    }
  ],
  "order": ["v1", "chorus", "v2", "chorus"]
}
```

### Biblia (JSON)
```json
{
  "metadata": { "version": "RVR1909", "language": "es", "name": "Reina-Valera 1909" },
  "books": [
    {
      "id": "GEN",
      "name": "Génesis",
      "chapters": [
        { "number": 1, "verses": [{ "number": 1, "text": "En el principio..." }] }
      ]
    }
  ]
}
```

### Audio
```ts
export interface AudioTrack {
  id: string;
  filePath: string;
  title: string;
  artist?: string;
  album?: string;
  duration: number;
  artworkPath?: string;
  addedAt: string;
}

export interface AudioPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AudioPlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  position: number;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  crossfadeDuration: number;
}
```

---

## 🗺️ Roadmap por Fases

### Fase 0 — Setup inicial
1. Inicializar repo git en local.
2. Scaffold con `electron-vite` template `react-ts`.
3. Configurar `pnpm`, Tailwind, ESLint, Prettier.
4. Crear estructura de carpetas completa (vacía donde haga falta, con `.gitkeep`).
5. Configurar `tsconfig.json` con `strict: true` y path aliases (`@/control`, `@/projection`, `@/shared`, `@electron`).
6. Crear `.gitignore`, `README.md`, `LICENSE` (MIT).
7. Primer build local funcionando (`pnpm dev` abre ventana en blanco).
8. Commit inicial: `chore: initial scaffold`.

**Checkpoint:** mostrame el árbol y el resultado de `pnpm dev`.

### Fase 1 — Esqueleto de doble ventana
9. Implementar `controlWindow.ts` y `projectionWindow.ts`.
10. Detección de monitores (Electron `screen` API) + selector en una pantalla de Settings básica.
11. Sistema de IPC tipado (definir todos los tipos en `src/shared/types/ipc.ts`).
12. Sistema de capas en proyección con un comando `blackout` funcional.
13. Atajos de debug: Esc = blackout, F11 = toggle proyección.
14. LiveIndicator (badge rojo "LIVE") en la ventana de control.

**Checkpoint:** demostrame que abrir la app abre 2 ventanas, una en cada monitor, y que Esc activa blackout sin lag.

### Fase 2 — Media (imágenes, videos, gifs)
15. Selector de carpeta de media en Settings (`dialog.showOpenDialog`).
16. Escaneo con `chokidar`.
17. Galería en `Media.tsx` con thumbnails.
18. Comando `showMedia` con preload + fade.
19. Comando `setBackground` con loop.

**Checkpoint:** seleccionar una carpeta con media, ver thumbnails, proyectar imagen y video sin lag visible.

### Fase 3 — Canciones (JSON)
20. Implementar tipos completos de `song.ts`.
21. Cargar/guardar canciones en `userData/songs/*.json`.
22. Vista lista en `Songs.tsx` con búsqueda.
23. Editor mínimo (form de título + secciones + slides).
24. Render de slide de canción en proyección (fuente grande, contraste, sombra).

**Checkpoint:** crear una canción, proyectar cada slide en orden, editar mientras está LIVE (con indicador).

### Fase 4 — Biblia (multi-versión)
25. Script `convert-bible.ts` para normalizar Biblias al esquema.
26. Bundlear RVR1909 y RVA-2015 en `data/bibles/`.
27. Selector versión → libro → capítulo → versículo.
28. Búsqueda por referencia tipo `Juan 3:16` o `Jn 3:16`.
29. Render de versículo proyectado.

**Checkpoint:** buscar `Juan 3:16` en ambas versiones y proyectar.

### Fase 5 — Módulo de Audio (independiente)
30. Setup de Howler.js + music-metadata.
31. Escaneo de carpeta de audio + extracción de ID3 (incluida carátula).
32. `Audio.tsx`: biblioteca + lista de tracks.
33. MiniPlayer fijo abajo de la ventana de control (visible en todas las pestañas).
34. Controles: play/pause/skip/seek/volumen.
35. Fade-out al stop manual.
36. Persistencia de última sesión (track, volumen, posición).

**Checkpoint:** seleccionar carpeta de música, ver tracks con metadata, reproducir mientras se proyectan canciones/versículos (audio independiente).

### Fase 6 — Empaquetado
37. Configurar `electron-builder` para `.exe` (NSIS), `.AppImage` y `.deb`.
38. Iconos en `resources/icons/`.
39. GitHub Actions: `build.yml` y `release.yml`.
40. Documentar el proceso en `docs/BUILD.md`.

**Checkpoint:** generar instaladores locales y probarlos en una VM Windows y un Linux.

### Fase 7 — Refinamiento (a definir con el usuario)
41. Editor de canciones más completo.
42. Playlists / orden de servicio.
43. Crossfade de audio + shuffle/repeat.
44. Temas visuales (colores, fuentes).
45. Atajos configurables.
46. Tests automatizados.

---

## ⚙️ Decisiones Confirmadas

- **Canciones**: formato JSON propio (ver esquema arriba).
- **Biblia**: múltiples versiones desde el inicio. Bundlear RVR1909 + RVA-2015 (dominio público).
- **Sin login**: uso comunitario directo.
- **Audio MP3**: módulo independiente, no acoplado a la proyección.
- **Edición en vivo**: el operador puede editar mientras proyecta (con indicador "LIVE" rojo siempre visible).
- **Resolución objetivo**: 1920x1080.
- **Idioma**: español. Estructurar con `i18next` desde el inicio aunque sea un solo idioma.

---

## 🛡️ Reglas de Código

1. **TypeScript estricto** — `strict: true`, sin `any` salvo justificado en comentario.
2. **Path aliases** — nunca `../../../`. Usar `@/control`, `@/projection`, `@/shared`, `@electron`.
3. **IPC** — todos los mensajes pasan por tipos en `src/shared/types/ipc.ts`. Nada de strings sueltos.
4. **Estado** — Zustand stores en `src/shared/store/`. No prop drilling profundo.
5. **Componentes** — funcionales con hooks. Sin `class` components.
6. **Estilos** — Tailwind. CSS custom solo para animaciones complejas o cosas que Tailwind no resuelve.
7. **Logs** — `electron-log` en main, `console` solo en dev en renderer.
8. **Errores** — todo `try/catch` en operaciones de FS y IPC; mostrar errores en una toast no bloqueante.
9. **Performance** — videos `<video>` HTML nativo, no librerías. Imágenes grandes redimensionadas al precargar.
10. **Cursor en proyección** — `cursor: none` en CSS global del proyection renderer.

---

## 🚀 Comando inicial para arrancar

**Empezá por la Fase 0.** Hacé exactamente los 8 pasos listados, ni más ni menos. Cuando termines:

1. Mostrame el árbol completo del proyecto con `tree -L 3 -I 'node_modules|dist|out'` (o equivalente).
2. Mostrame el contenido de: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `tailwind.config.ts`, `.gitignore`, `README.md`.
3. Confirmame que `pnpm dev` abre una ventana en blanco sin errores.
4. **Esperá mi OK antes de avanzar a la Fase 1.**

Si en cualquier momento tenés dudas sobre una decisión, **preguntame antes de implementar**. Prefiero responderte un mensaje corto que tener que rehacer trabajo.

Vamos.
