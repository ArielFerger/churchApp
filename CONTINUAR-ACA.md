# Continuar acá

Estado al **26 de septiembre de 2026**. Rama **`feat/mejoras-integrales`**, versión
**1.3.0** (tag `v1.3.0` → GitHub Actions arma los instaladores de Windows y Linux).

> Leé este archivo antes de tocar nada.

---

## Dónde estamos

La app es un **proyector para iglesia**: dos ventanas Electron (control + proyección),
React + TypeScript. `npm run dev` para levantarla.

**Más de 370 tests**, typecheck, lint y build en verde. El CI ahora corre en
**Windows y Linux**. Verificar siempre con:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

### Lo que se hizo en la sesión del 26/09

| Área | Qué |
|---|---|
| Escucha — detector | **No entendía "Juan 3:16"** (el formato de whisper): encontraba 1 de 5 citas. Tokenizador nuevo; contexto ("el versículo 31"); ordinales escritos; validación contra versículos reales |
| Escucha — motor | whisper-server persistente, cortes por frase con piso de ruido adaptativo, `audio_ctx`, costura entre fragmentos, filtro de alucinaciones, modelos cuantizados. ~660 ms por frase en la app |
| Escucha — pantalla | Texto del versículo en cada sugerencia, Ctrl+Enter, Anterior/Siguiente (Ctrl+←/→), transcripción con citas resaltadas, gestión de modelos |
| Herramientas | Instalación en Windows y Linux (extract-zip + tar), assets por la API de GitHub (la URL de whisper daba 404), deno automático, actualizar yt-dlp, procesos matables en Linux |
| Descargas | Varias URLs, tramo exacto, reintentar, mostrar en carpeta, miniaturas (la CSP las bloqueaba), `--trim-filenames` corregido |
| Scripts | `scripts/herramientas/`: instalar/actualizar/diagnosticar y descargar desde la terminal, sólo Python estándar; viajan con el instalador |
| Plataforma | Una sola instancia, permisos explícitos (micrófono sólo audio y sólo el control), X11 en Linux, fuentes empaquetadas |
| Diseño | Riel de navegación (Ctrl+1…8), kit de componentes, token `falla`, colores con significado en todas las secciones, animaciones con "reducir movimiento", Ajustes rediseñado, barra AL AIRE que incluye el fondo |
| Accesibilidad | Nombres accesibles, foco visible, anuncios, contraste AA, botones de hover visibles con teclado |

### Ajustes después de la primera prueba del usuario (1.3.0)

| Pedido | Qué se hizo |
|---|---|
| "No reconoce Job, escucha *hop*" | Clave fonética castellana (h muda, j↔h, v↔b, z/c↔s) + alias para nombres cortos + libros cortos en el prompt |
| "Reacciona 12 s después" | Transcripción **provisional** de la frase en curso cada 2 s (prioridad para las completas en el main); cortes más cortos (pausa 550 ms, blando 5 s, máximo 10 s). Medido: una cita aparece ~2–2,5 s después de nombrarse |
| "Me tuve que acercar mucho al micro" | **Volumen de entrada** (−6 a +30 dB, en vivo) + normalización de cada frase antes de whisper |
| "Al cerrar no se cierra la proyección" | Cerrar la ventana de control cierra la app |
| "No se debería poder abrir otra" | Ya había instancia única; ahora la primera avisa con un diálogo |
| "Clic derecho con opciones" | Menú contextual propio en Media, En Vivo, Audio, Canciones, Biblia, Escucha y Descargas; menú nativo de edición en los campos de texto |

De paso: **crear y renombrar álbumes nunca funcionó** (usaban `prompt()`, que Electron no
soporta: devuelve `null` en silencio). Ahora es un campo en el lugar.

Detalle técnico en `docs/ARCHITECTURE.md` (secciones *Escucha*, *External tools*,
*Platform*, *design system*) y en `docs/PLAN-escucha.md` (fase 5).

---

## Lo que falta

- **Probar la Escucha un domingo con la consola real.** Es lo único que no se puede
  simular. De ahí sale si la sensibilidad por defecto (0,5) y el modelo Base alcanzan,
  o conviene Small comprimido (`small-q5_1`).
- **Probar una descarga de YouTube.** Desde la red de desarrollo YouTube pide
  iniciar sesión (IP de Starlink marcada) y no hay sesión guardada. Todo el resto del
  camino se probó con archivos públicos (tramo exacto, MP3 a 192 kbps).
- **yt-dlp de `D:\churchAPP\tools` tiene 84 días.** No se tocó a propósito; la app
  ofrece actualizarlo (botón ámbar en Descargar).
- **Linux en una máquina real.** El CI corre tests y build en Ubuntu, pero la
  instalación de herramientas, la ubicación de la proyección en el segundo monitor y
  el micrófono vía PipeWire sólo se probaron en el código, no en un escritorio Linux.
- Canciones tiene su propia hoja de estilos (`.songbook`, dentro de `Songs.tsx`). Usa
  los mismos colores que el resto, pero no el kit de componentes. Funciona; migrarla es
  cosmético.

---

## Cómo verificar sobre la app corriendo

Se hace manejando la app por CDP (clics y lectura del DOM), no sólo con tests.

```bash
npx electron-vite build --mode development
npx electron . --remote-debugging-port=9222 --user-data-dir=<carpeta-de-prueba> \
  --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<sermon.wav>
```

- **`--user-data-dir` funciona**: la app usa esa carpeta como `userData`. Así se prueba
  con carpetas de media y música de mentira sin tocar la configuración real. Un
  `church-projector-settings.json` con `{ "settings": { "mediaFolder": …, "audioFolder": … } }`
  alcanza.
- **Una sola instancia**: si ya hay una app abierta, la segunda se cierra al toque. Matá
  `electron.exe` (y `whisper-server.exe`) antes de relanzar.
- `cdp.mjs` es un cliente de 60 líneas sobre el `WebSocket` global de Node 22+:
  `Runtime.evaluate` para leer/clickear y `Page.captureScreenshot` (con
  `Emulation.setDeviceMetricsOverride` para probar anchos: 900 px es el caso duro).
- `window.__escucha` sigue existiendo fuera de modo production (`iniciar`, `detener`,
  `store`).
- **Voz castellana para las pruebas**: esta máquina no tiene voz española de Windows
  (SAPI sólo trae inglés). Se generó el sermón con `edge-tts` (voz `es-AR-TomasNeural`)
  en un venv del scratchpad y se pasó a WAV 16 kHz mono con ffmpeg.

---

## Trampas ya conocidas

### Nuevas (26/09)

- **`prompt()` no existe en Electron** (devuelve `null` sin avisar). `confirm()` y
  `alert()` sí. Para pedir un texto, un campo en el lugar.
- **Los menús contextuales NO se cierran con Esc**: Esc es la parada de pánico en el
  main (`before-input-event`) y no hay forma de que un menú lo intercepte antes.
- **Captura de pantalla por CDP con `Emulation.setDeviceMetricsOverride`** dispara un
  `resize`, y el menú contextual se cierra al redimensionar: para capturar un menú
  abierto, capturar sin cambiar el tamaño.

- **whisper escribe "Juan 3:16"**, no "Juan tres dieciséis". Cualquier cambio al
  detector tiene que pasar el test `el sermón de prueba transcrito por whisper`, que
  tiene la transcripción real.
- **`releases/latest/download/<asset>` puede dar 404** aunque el asset exista en otra
  release: whisper.cpp publica binarios en tags `bNNNN` y la "latest" sale vacía. Usar
  `urlDeAsset` (API de GitHub).
- **`--trim-filenames` de yt-dlp recorta la RUTA ENTERA**, no el nombre. Con 150 y
  una carpeta larga, el título quedaba mutilado. Está en 230.
- **Nada de puntos en el sufijo del tramo**: yt-dlp parte en los puntos al recortar
  nombres y `[0.02-0.07]` terminaba como `[0.0.07]`. Se usa `[0m02-0m07]`.
- **`audio_ctx` por debajo de ~512 hace que whisper corte frases** ("Buenos,", "El,").
  El mínimo es 768.
- **Un `<input type="range">` mide ~130 px de ancho mínimo** como ítem flex: sin
  `min-w-0`, el reproductor desbordaba a 900 px y aparecía scroll horizontal en toda
  la app.
- **Variables CSS que se referencian a sí mismas** (`--ct-listo: var(--ct-listo)`)
  quedan inválidas en silencio. Pasaba en Canciones y rompía todos sus acentos.
- **El rojo es "al aire"**: un error va en `falla` (salmón), y lo que está saliendo en
  `aire`. Al migrar colores a mano es fácil confundirlos (pasó con el versículo
  proyectado de Biblia).
- **Python en Windows escribe CRLF** en modo texto: usar `newline='\n'` (o `''` para
  conservar lo que tenía el archivo). El repo tiene `core.autocrlf=true`.
- **Heredocs largos con muchas comillas se rompen** en la herramienta de shell de la
  sesión: escribir el script a un archivo y ejecutarlo.
- **git**: el repo es de otro SID de Windows; usar
  `git -c safe.directory=D:/churchAPP/churchApp …` en vez de tocar la config global.

### De antes (siguen valiendo)

- **yt-dlp necesita `-4`**: la red anuncia IPv6 sin ruta funcional y yt-dlp (urllib)
  no hace Happy Eyeballs — se cuelga para siempre. Los scripts de Python fuerzan IPv4
  por lo mismo.
- **yt-dlp necesita `--js-runtimes`**: sólo habilita `deno` por su cuenta.
- **yt-dlp reescribe el archivo de cookies al terminar**: borrarlo con una descarga en
  curso no sirve.
- **El mensaje "not a bot" de YouTube trae apóstrofo tipográfico** que la consola de
  Windows rompe. Nunca buscar `you're`.
- **`Escape` está capturado globalmente** como parada de pánico (`stopAll`).
- **`import.meta.env.DEV` es `false` en cualquier `electron-vite build`**: mirar
  `import.meta.env.MODE !== 'production'`.
- **La CSP de las ventanas es `script-src 'self'`**: nada de blobs ni data URLs para
  scripts (el worklet de la Escucha tiene que ser un archivo de `public/`).
- **Mandar `showMedia` por fuera de En Vivo deja el video en pausa**: la reproducción
  la maneja la pantalla.
- **El repo no está formateado con Prettier**: formateá sólo lo que escribís.

### Tests

- Lógica pura y servicios de Electron → `tests/*.test.ts`, entorno `node`.
- Todo lo que toque React o el DOM → `tests/ui/*.test.tsx` con
  `// @vitest-environment happy-dom` en la primera línea.
- Con framer-motion, lo que sale de pantalla se queda en el DOM durante el fundido:
  usar `waitFor` para afirmar que desapareció.

### Diseño: dirección "cabina"

Tokens en `tailwind.config.ts`, componentes en `src/control/components/ui/`. La regla:
**el color dice estado** — `aire` (rojo) lo que la congregación ve y los botones que
mandan algo a la pantalla; `listo` (ámbar) lo elegido, lo que sigue y el foco;
`ok` (verde) confirmaciones; `falla` (salmón) errores. Las categorías de Media
(celeste, violeta, verde azulado) son identidad, no estado, y quedan como están.
