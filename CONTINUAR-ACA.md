# Continuar acá

Estado al **11 de agosto de 2026**. Rama **`feat/media-organizacion`**.

> Leé este archivo antes de tocar nada.

---

## Dónde estamos

Versión **1.2.0** publicada (tag `v1.2.0` → GitHub Actions arma los instaladores de Windows
y Linux solo, al recibir el tag).

La app es un **proyector para iglesia**: dos ventanas Electron (control + proyección),
React + TypeScript. `npm run dev` para levantarla.

**280 tests**, typecheck, lint y build en verde. Verificar siempre con:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

### Lo que se hizo en la sesión anterior

| Commit | Qué |
|---|---|
| `d831663` | Media: buscador, categorías (alabanza/adoración/proyección), selección "para hoy" |
| `4ce7d02` | Proyección: el video ahora siempre responde al play/pausa del operador |
| `5a9af5f` | **El typecheck no revisaba ni un archivo** (corría contra el tsconfig raíz, que tiene `files: []`). Al encenderlo aparecieron errores tapados |
| `369c888` | Canciones: mazo compacto, teclado, partes con nombre (`# Coro`) |
| `43548a8` | Canciones: importar letras desde `.txt`, y proyectar sólo la letra |
| `ddfc14d`→`e6370d5` | Descargar de YouTube (MP4/MP3), calidad, listas, sesión propia |
| `4945bfc` | ErrorBoundary en la ventana de control + fade-out que frenaba el tema equivocado |
| `901f65c` | Diseño unificado bajo dirección "cabina" |
| `a4c2ba2` | **Escucha fase 1**: detector de citas bíblicas habladas |

### Lo que se hizo en esta sesión

**Escucha fases 2 y 3.** La app baja whisper, escucha por la entrada de audio, transcribe
en vivo y arma la lista de citas detectadas. Falta ponerle pantalla (fase 4).

Las dos fases se verificaron sobre la app corriendo, no sólo con tests.

---

## En qué quedó el trabajo: módulo Escucha

**Plan completo:** `C:\Users\ariel\.claude\plans\curious-snacking-forest.md`
(copialo al repo si lo vas a necesitar desde otra máquina).

**La idea:** mientras el pastor predica, la app escucha, transcribe, y cuando detecta que
nombró un pasaje lo ofrece para proyectar de un clic.

### Decisiones tomadas (no volver a discutirlas)

- **Audio de la consola de sonido**, no del micrófono de la notebook. El usuario confirmó
  que el micrófono inalámbrico del pastor pasa por consola. Señal limpia = la función es
  viable de verdad.
- **Motor offline** (whisper.cpp), no nube. Razones: la conexión del usuario es Starlink con
  IP marcada por Google y ya dio problemas, y el audio del sermón no debe salir de la
  máquina.
- **whisper.cpp y no Vosk**: whisper se distribuye como ejecutable suelto, igual que yt-dlp
  y ffmpeg que ya usamos. Vosk necesita módulo nativo de Node, que en Electron obliga a
  recompilar por cada versión — trampa de mantenimiento conocida.
- **NUNCA proyectar solo.** Un falso positivo en vivo es peor que no tener la función. La
  app sugiere, el operador confirma. Esto es innegociable.

### Fase 1 — HECHA ✅

`src/shared/utils/escuchaBiblica.ts` + `tests/escuchaBiblica.test.ts` (41 tests).

Funciones puras exportadas:
```ts
leerNumero(palabras, desde)      // "ciento cuarenta y siete" → 147; también dígitos
leerOrdinal(palabras, desde)     // "primera de corintios" → 1
buscarLibro(palabras, desde)     // difuso, tolera "corintos" por "corintios"
detectarReferencias(texto)       // el escáner, sin anclar
fusionar(previas, nuevas)        // deduplica: las ventanas se solapan y el pastor repite
```

Probado contra un flujo de 8 ventanas tipo sermón: detecta las 4 citas reales (una con
rango, una de capítulo entero), fusiona la repartida en dos ventanas, y **no dispara** con
"los hechos de aquel hombre fueron tres" ni "estos números que les doy".

**El riesgo grande, ya mitigado:** `Hechos`, `Números`, `Reyes`, `Jueces`, `Cantares`,
`Proverbios`, `Job`, `Lamentaciones` son palabras corrientes del castellano. Están en
`LIBROS_AMBIGUOS` y exigen contexto explícito (que alguien haya dicho "capítulo"/
"versículo", o que la frase abra con "en"/"vamos a").

**Dos trampas que ya se pisaron** (están comentadas en el código, no las repitas):
1. El matcher difuso se tragaba la palabra de al lado: `"en corintios"` queda a distancia 2
   de `"1corintios"`. Por eso el escáner saltea posiciones que arrancan con preposición o
   relleno.
2. El ordinal hay que usarlo para **armar la clave** (`"1"+"corintios"` → `1corintios`), no
   para numerar el libro ya resuelto — eso buscaba `"11 Corintios"`. Acertaba de rebote con
   confianza 0.62 en vez de 1.

### Fase 2 — HECHA ✅

`src/shared/utils/whisper.ts` (puro) + `electron/services/escuchaService.ts` +
`electron/services/toolsPaths.ts`. 26 tests nuevos.

```ts
resolveWhisper()                  // { binPath, modelo, modelPath, instalados, searched }
queFalta(estado?)                 // texto para el operador, o null si está todo
installWhisper(onProgress, id?)   // baja binario + modelo, atómico y con avance
transcribirWav(wav, opciones?)    // → { texto, ms, modelo }
dispose()                         // mata lo que quede corriendo
```

Ya está instalado en esta máquina: `D:\churchAPP\tools\whisper\whisper-cli.exe` y
`D:\churchAPP\tools\whisper\modelos\ggml-base.bin`. Están **fuera del repo**, no hace falta
volver a bajarlos.

**Verificación real** (transcribió voz castellana sintetizada y el detector de la fase 1
sacó las tres citas correctas):

```bash
WHISPER_E2E=1 npx vitest run tests/whisperE2E.test.ts
```

Ese test está apagado por defecto: baja 150 MB si faltan y tarda un minuto. El detalle de
lo que salió está en `docs/PLAN-escucha.md`, sección Verificación.

**Números medidos** (modelo `base`, 6 hilos, sin video corriendo):
- **1,2 s** por ventana de 6 s → ~7,2 s de latencia total, dentro de lo estimado.
- Falta medirlo **con la proyección al aire**, que es lo que importa.

**Lo que se aprendió, y cambia decisiones de la fase 3:**
1. **Whisper nunca contesta vacío.** Seis segundos de silencio devuelven `[MÚSICA]`; seis de
   ruido, `(Cantando)`. `parseTranscripcion` los tira, pero la ventana igual se transcribió
   y gastó CPU: la puerta por energía (VAD) antes de mandarla no es opcional.
2. **Escribe los números en dígitos** ("capítulo 3"), no en palabras. El detector ya los
   lee, pero significa que toda la maquinaria de `leerNumero` con palabras se usa menos de
   lo esperado en la vida real.
3. **Se come letras al principio de la frase** ("Habramos" por "abramos"). Lo absorbe el
   matching difuso mientras el error no caiga sobre el nombre del libro.

**Dos cosas del diseño que no son obvias:**
- Whisper **no es un ejecutable suelto** como yt-dlp: necesita sus DLL al lado. Por eso vive
  en su propia carpeta y el instalador sube el contenido de la carpeta donde aparezca el
  ejecutable, en vez de mover sólo el `.exe` (el zip cambió de forma entre versiones).
- Se le manda un **prompt con vocabulario bíblico** (`PROMPT_BIBLICO`) para que escriba bien
  los nombres propios. En la prueba sólo corrigió acentos y no costó latencia; el beneficio
  grande, si lo hay, se va a ver con libros raros (Habacuc, Sofonías).

### Fase 3 — HECHA ✅

El camino completo anda: entrada de audio → worklet → ventanas de 6 s con 1,5 s de solape →
puerta por energía → IPC → WAV temporal → whisper → detector → sugerencias.

```
capturaVoz.ts      getUserMedia + AudioWorklet, entrega Int16Array a 16 kHz
audioVentanas.ts   troceo con solape, RMS/VAD, WAV (puro, 15 tests)
escuchaEnVivo.ts   pega las tres puntas: micrófono, whisper y store
escuchaStore.ts    estado + sugerencias fusionadas (puro, 10 tests)
ipc/escucha.ts     estado, instalar, transcribirVentana
```

**Verificado sobre la app corriendo, sin micrófono**: Chromium puede hacerse pasar por una
placa de sonido y leer un WAV. Es *la* forma de probar esto sin hablarle a la máquina:

```bash
npx electron . --remote-debugging-port=9222 --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=C:/ruta/sermon.wav
```

Y como todavía no hay pantalla, la Escucha se maneja desde el depurador: `App.tsx` expone
`window.__escucha` (`iniciar`, `detener`, `entradasDeAudio`, `store`) **sólo cuando el modo
no es production**. Ojo con esto: `electron-vite build` deja `import.meta.env.DEV` en false
aunque se le pase `--mode development`, así que el hook mira `MODE`. Para manejarlo por CDP
hay que compilar con `npx electron-vite build --mode development`.

Resultados (sermón sintetizado de 23 s, repetido, 50 s de escucha):
- Las tres citas correctas y **ninguna de más**. 0 ventanas descartadas.
- **875–1006 ms** por ventana. Con un video 1080p decodificando al mismo tiempo: **998 ms
  de promedio y 0 frames perdidos**. La CPU no era el problema que se temía.
- Primera sugerencia a los **8,1 s** de arrancar, como estaba estimado.

**Un defecto real que encontró esta prueba** (y que cambió una decisión de la fase 1):
decir "Juan capítulo tres versículo dieciséis" lleva ~2,5 s, más que el solape de 1,5 s, así
que **siempre** hay una ventana que corta en "Juan capítulo tres". La lista mostraba `Juan 3`
y `Juan 3:16` como dos pasajes. Ahora `fusionar()` absorbe el capítulo pelado cuando ya hay
un versículo de ese mismo capítulo. Se pierde poder sugerir "el capítulo entero", que es raro
y se resuelve desde la sección Biblia.

**Decisiones de la captura que no son obvias:**
- Se apagan `echoCancellation`, `noiseSuppression` y `autoGainControl`. Están pensados para
  videollamadas y sobre una línea limpia de consola sólo bombean el ruido de fondo entre
  frase y frase, que es justo lo que hace alucinar a whisper.
- El `AudioContext` se crea directo a 16 kHz y el remuestreo lo hace Chromium. Bajar de 48 a
  16 kHz a mano, sin filtro previo, mete aliasing y empeora la transcripción.
- **El worklet tiene que ser un archivo de `public/`**, no un blob ni un data URL: la CSP de
  `control.html` es `script-src 'self'` y los bloquea. El síntoma es un escueto "Unable to
  load a worklet's module" que no menciona CSP por ningún lado.
- Si llega una ventana mientras whisper trabaja, **se descarta** en vez de encolarse: una
  cola hace que la Escucha se atrase cada vez más del predicador, para siempre. Hay contador
  (`descartadas`) para que se note si pasa.

No hay `setPermissionRequestHandler` en ningún lado, así que Electron concede el micrófono
por defecto. `backgroundThrottling: false` ya está puesto en la ventana de control.

### Fase 4 — SIGUIENTE: la sección Escucha

`src/control/pages/Escucha.tsx`. Para agregar una sección hacen falta **tres** ediciones en
`src/control/App.tsx`: el import, la entrada en `navItems`, y el `<Route>` dentro de
`SeccionesConRed`. Al hacerlo, sacar el hook `window.__escucha` o dejarlo (sirve igual para
manejar la Escucha por CDP cuando haya que probar).

Lo que falta, y ya tiene todo lo que necesita abajo:
- Selector de entrada de audio (`entradasDeAudio()`) y **medidor de nivel** (`store.nivel`,
  que ya se actualiza ~8 veces por segundo). El medidor no es decorativo: es la única forma
  de que el operador sepa que la consola está entrando.
- Botón grande Escuchar/Detener → `iniciarEscucha()` / `detenerEscucha()`.
- Lista de sugerencias (`store.sugerencias`, ya deduplicadas y en orden del sermón), con
  `lookup` + `showBibleVerse` al hacer clic. **Nunca proyectar solo.**
- Panel plegable con `store.ventanas` (la transcripción cruda) para entender por qué algo
  apareció o no.
- Guardar el dispositivo elegido en `AppSettings` (hoy sólo está `escuchaModelo`).
- Si falta whisper, ofrecer `installEscucha()` con el avance de `onEscuchaProgress`.

---

## Cosas del proyecto que conviene saber

### Verificación: se hace sobre la app corriendo, no sólo con tests

Hay drivers por CDP en el scratchpad de las sesiones anteriores (`drive-dl.mjs`,
`drive-songs.mjs`, `drive-concurrencia.mjs`, `drive-escucha.mjs`, `drive-con-video.mjs`,
`cdp.mjs`). Se levanta con:

```bash
npx electron . --remote-debugging-port=9222
```

y se maneja la ventana de control por WebSocket. Si el scratchpad se perdió, `cdp.mjs` es
un cliente CDP de 60 líneas, fácil de rehacer.

### Trampas ya conocidas

- **yt-dlp necesita `-4`**: la red del usuario anuncia IPv6 sin ruta funcional y yt-dlp
  (urllib) no hace Happy Eyeballs — se cuelga para siempre, sin timeout ni mensaje.
  `--socket-timeout` NO rescata de esto.
- **yt-dlp necesita `--js-runtimes node`**: sólo habilita `deno` por su cuenta.
- **yt-dlp reescribe el archivo de cookies al terminar**: borrarlo con una descarga en
  curso no sirve, el proceso lo resucita al morir.
- **El mensaje "not a bot" de YouTube trae apóstrofo tipográfico** que la consola de Windows
  rompe. Nunca buscar `you're`.
- **Las fuentes declaradas no existían** (Inter, Fraunces, Manrope, JetBrains Mono sin
  empaquetar y sin internet). Ahora se usan las de Windows a propósito. No declares fuentes
  que no estén.
- **`Escape` está capturado globalmente** como parada de pánico (`stopAll`). Ningún módulo
  nuevo puede usarlo.
- **`fil` resuelve a Filemón**, no a Filipenses (colisión de abreviaturas en
  `bibleBooks.ts`).
- **El repo no está formateado con Prettier.** `npm run format` sobre todo reescribiría
  media docena de archivos que nadie tocó y ensuciaría el diff. Formateá sólo lo que
  escribís. Lo que CI mira es `npm run lint`, que sí pasa.
- **`import.meta.env.DEV` es `false` en cualquier `electron-vite build`**, incluso con
  `--mode development`. Para código que sólo debe existir en desarrollo, mirar
  `import.meta.env.MODE !== 'production'`.
- **La CSP de las ventanas es `script-src 'self'`**: nada de blobs ni data URLs para cargar
  scripts (worklets, workers). Tiene que ser un archivo de `public/`.
- **Mandar `showMedia` por fuera de la sección En Vivo deja el video en pausa.** La
  reproducción la maneja la pantalla. Para probar por CDP, `play()` a mano sobre el
  `<video>` de la ventana de proyección.

### Tests

- Lógica pura y servicios de Electron → `tests/*.test.ts`, entorno `node`
- Todo lo que toque React o el DOM → `tests/ui/*.test.tsx` con
  `// @vitest-environment happy-dom` en la primera línea
- Están separados porque el proyecto de TypeScript de node no sabe resolver React ni los
  alias de `src/`; mezclarlos da TS6307

### Diseño: dirección "cabina"

Tokens en `tailwind.config.ts`. La regla que ordena todo: **`aire` (rojo) es lo que la
congregación está viendo AHORA y ninguna otra cosa puede usar ese color**; `listo` (ámbar)
es lo preparado o seleccionado. La escala `slate` de Tailwind está redefinida hacia neutros
cálidos, así que `bg-slate-900` ya escrito da el negro de cabina.

Elemento firma: la **barra AL AIRE** (`src/control/components/BarraAlAire.tsx`), que dice
qué se está proyectando, no sólo que hay algo.

---

## Pendientes menores

- El ErrorBoundary de control tiene 7 tests unitarios, pero **no se logró forzar un error de
  render desde afuera del bundle** para ejercitarlo sobre la app corriendo.
- Las categorías de media se guardan por ruta absoluta: mover o renombrar un archivo le hace
  perder su categoría. Se dejó así a propósito (limpiar huérfanos automáticamente borraría
  todo al cambiar la carpeta de media). Si molesta, se resuelve guardando también la ruta
  relativa.
- La rama nunca se mergeó a `main`. Las versiones anteriores (1.0.x, 1.1.0) también se
  taggearon desde ramas de feature, así que no rompe ninguna convención del repo.
