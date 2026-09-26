# Módulo Escucha — detectar citas bíblicas habladas

## Contexto

Durante la predicación, el pastor anuncia pasajes de viva voz ("abramos en primera de
corintios trece"). Hoy el operador tiene que escuchar, entender, y tipear la referencia en
la sección Biblia mientras la congregación espera. Si se distrae o el pastor va rápido, el
versículo llega tarde o no llega.

La idea: la app escucha el audio del predicador, transcribe, detecta cuando se nombró un
pasaje, y lo deja listo para proyectar de un clic.

**Decisiones ya tomadas:**
- **Audio de la consola de sonido** (micrófono inalámbrico → consola → entrada de línea o
  interfaz USB). Señal limpia, sin ruido de sala. Esto es lo que hace la función viable:
  con el micrófono de la notebook captando desde el fondo del salón, la precisión no
  alcanzaría.
- **Motor offline, en la PC.** Sin nube: la conexión ya dio problemas (Starlink con IP
  marcada) y el audio del sermón no tiene por qué salir de la máquina.

**Regla de oro: nunca proyectar solo.** Un falso positivo en vivo es peor que no tener la
función. La app sugiere; el operador confirma.

---

## Lo que ya existe y se reusa

| Qué | Dónde | Para qué |
|---|---|---|
| Tabla de 66 libros con abreviaturas | `src/shared/utils/bibleBooks.ts` — `BIBLE_BOOKS`, `normalizeBookName` | Vocabulario del detector |
| Lookup del texto | `electron/services/bibleService.ts` — `lookup()`, `getBookStats()` | Traer el versículo y validar rangos |
| Proyectar versículo | `{ type: 'showBibleVerse', reference, text, version }` en `src/shared/types/ipc.ts` | Salida |
| Patrón de binario externo | `electron/services/downloadsService.ts` — `resolveTools()`, `installTools()` | Molde exacto para bajar/ubicar whisper |
| Historial | `src/shared/store/bibleHistoryStore.ts` | Registrar lo proyectado |

**No se toca `bibleParser.ts`.** Su regex está anclada (`^...$`), exige dígitos y espacio
obligatorio: `"primera de corintios trece"` devuelve `null`. Sirve para lo que hace (input
tipeado, 13 tests) y la UI de Biblia depende de ella. El habla necesita un detector nuevo.

---

## Motor: whisper.cpp como binario suelto

**Por qué whisper.cpp y no Vosk:** Vosk tiene mejor latencia (streaming nativo) pero su
integración con Node es un **módulo nativo**, que en Electron obliga a recompilar contra el
ABI de cada versión — una trampa de mantenimiento conocida. whisper.cpp se distribuye como
**ejecutable suelto**, que es exactamente el patrón que este proyecto ya tiene funcionando
con yt-dlp y ffmpeg: se baja de un release, se spawnea, se lee stdout. Cero acoplamiento
con la versión de Electron.

Además, con audio limpio de consola, whisper es notablemente más preciso en castellano.

**Modelo:** `ggml-base` (~148 MB) para arrancar. Con línea limpia alcanza, y es rápido.
`ggml-small` (~466 MB) queda como opción configurable si la precisión no convence.
Va a `D:` junto a las otras herramientas — el `C:` está al 88%.

**Latencia:** whisper es por lotes, no streaming. Se trocea el audio en ventanas de ~6 s
con ~1,5 s de solapamiento (para no cortar palabras al medio). Latencia total estimada:
6 s de ventana + 1-2 s de inferencia ≈ **8 s** desde que lo dice hasta que aparece. Es
aceptable para el caso de uso: entre que el pastor anuncia el pasaje y la gente lo busca
pasan 15-20 s.

> **Medido en la fase 2** (modelo `base`, 6 hilos, máquina del usuario, sin video
> corriendo): **1,2 s** por ventana de 6 s — o sea ~7,2 s de latencia total, dentro de lo
> estimado. Falta medirlo otra vez con la proyección al aire, que es la prueba que importa.

---

## Arquitectura

```
Renderer (control)                    Main
─────────────────                     ────
getUserMedia(deviceId)
  → AudioWorklet: 16 kHz mono
  → PCM16 en ventanas de 6s  ──IPC──> escuchaService
                                        escribe WAV temporal
                                        spawn whisper-cli.exe -l es
                                        lee el texto, borra el WAV
       transcripción parcial  <──IPC──  emite
  → detectarReferencias(texto)
  → valida contra getBookStats
  → lista de sugerencias
  → [clic] → lookup + showBibleVerse
```

La detección corre en el **renderer** sobre el texto: son funciones puras, testeables sin
micrófono ni modelo. El main queda tonto (captura → transcribe → devuelve texto).

---

## El detector — el corazón

`src/shared/utils/escuchaBiblica.ts`, todo funciones puras:

```ts
export interface ReferenciaDetectada {
  bookId: string
  chapter: number
  verse: number | null        // null = capítulo entero
  endVerse?: number
  confianza: number           // 0..1
  fragmento: string           // el texto crudo que la originó, para mostrarlo
  offset: number              // posición en el flujo, para deduplicar
}

/** "dieciséis" → 16, "ciento cuarenta y siete" → 147 (Salmos llega a 150). */
export function leerNumero(
  palabras: string[], desde: number
): { valor: number; consumidas: number } | null

/** "primera de corintios" → 1, "segunda de juan" → 2. */
export function leerOrdinal(
  palabras: string[], desde: number
): { orden: 1 | 2 | 3; consumidas: number } | null

/** Matching difuso sobre los 66 libros, tolerante a errores del reconocedor. */
export function buscarLibro(
  palabras: string[], desde: number
): { libro: BookMeta; consumidas: number; puntaje: number } | null

/** Escanea un flujo de palabras SIN puntuación y devuelve todo lo que parezca una cita. */
export function detectarReferencias(texto: string): ReferenciaDetectada[]

/** Fusiona con lo ya detectado: si el pastor repite la cita, no duplica. */
export function fusionar(
  previas: ReferenciaDetectada[], nuevas: ReferenciaDetectada[]
): ReferenciaDetectada[]
```

**Formas del habla que tiene que reconocer:**

| Lo que dice | Qué debe salir |
|---|---|
| "abramos en juan capítulo tres versículo dieciséis" | JHN 3:16 |
| "vamos a primera de corintios trece" | 1CO 13, capítulo entero |
| "salmo veintitrés" | PSA 23 |
| "mateo cinco tres" (sin decir capítulo/versículo) | MAT 5:3 |
| "juan tres dieciséis al dieciocho" | JHN 3:16-18 |

**Matching difuso:** para cada posición, se prueban ventanas de 1 a 4 palabras contra el
vocabulario normalizado (nombres + abreviaturas de `bibleBooks.ts`). Exacto → 1.0;
distancia de edición ≤ 2 sobre nombres de ≥ 5 letras → 0.6-0.95; por debajo del umbral se
descarta. Esto cubre que el reconocedor escriba "corintos" o "san juan" pegado.

**Confianza:** sube si el libro matcheó exacto y si aparecieron las palabras
"capítulo"/"versículo"; baja si el match fue difuso o el número quedó fuera de rango.

---

## El riesgo grande: nombres de libros que son palabras comunes

`Hechos`, `Números`, `Jueces`, `Reyes`, `Cantares`, `Salmos`, `Proverbios` son sustantivos
del castellano corriente. "los hechos de ese hombre" o "los números no mienten" van a
disparar falsos positivos todo el tiempo si no se los trata aparte.

**Mitigación:** esos libros exigen (a) número inmediatamente después, y (b) umbral de
confianza más alto, y (c) preferentemente la palabra "capítulo"/"versículo" o una
preposición de apertura antes ("en", "a", "vamos a"). Se define una lista
`LIBROS_AMBIGUOS` con reglas más estrictas.

Esto es lo primero que hay que probar con transcripciones reales.

---

## UX

Sección nueva **Escucha** en la navegación (`src/control/pages/Escucha.tsx`):

- Arriba: selector de dispositivo de entrada, botón grande **Escuchar / Detener**, y un
  medidor de nivel para confirmar que entra señal de la consola.
- Al medio: **sugerencias**, la más nueva arriba. Cada una muestra la referencia, el
  fragmento que la originó ("...abramos en juan capítulo tres...") y un botón
  **Proyectar**. Las de baja confianza se ven en gris, con la referencia editable antes de
  proyectar.
- Abajo, plegable: la transcripción en vivo, para que el operador entienda por qué apareció
  o no apareció algo.

Mientras escucha, indicador en el header (`App.tsx`) para que nunca haya duda de que el
micrófono está tomando.

---

## Privacidad

- El audio **no se guarda**: los WAV de cada ventana van a temp y se borran apenas se
  transcriben.
- Nada sale de la máquina (el motor es local).
- Apagado por defecto; hay que apretar Escuchar cada vez.
- La transcripción vive en memoria y se descarta al detener.

---

## Fases

**Fase 1 — HECHA.** El detector, sin micrófono ni modelo: `escuchaBiblica.ts` completo con
su batería de tests sobre frases reales de predicación. Es el grueso de la innovación y se
verifica entero con `npm test`.

**Fase 2 — HECHA.** whisper como herramienta: `whisper.ts` (puro) + `escuchaService.ts`
bajan `whisper-cli.exe` y el modelo, y transcriben un WAV. Verificado de punta a punta
contra voz de verdad — ver "Verificación" más abajo.

**Fase 3 — HECHA.** Captura en vivo: getUserMedia + worklet + troceo con solapamiento +
puerta por energía + IPC. Verificada sobre la app corriendo con un dispositivo de audio
falso — ver "Verificación".

**Fase 4 — HECHA.** La sección Escucha, el indicador en la cabecera y el enganche con
proyección (lookup + `showBibleVerse` + historial).

Cada fase se puede parar y dejar andando lo anterior.

---

**Fase 5 — HECHA (26/09/2026).** Motor nuevo, medido sobre la app corriendo:

- **El detector no leía el formato de whisper.** Whisper escribe "Juan 3:16"; el
  detector limpiaba el ":" y leía "316". Con un sermón de 52 s sintetizado con
  voz neural argentina encontraba 1 de 5 citas. Ahora un tokenizador separa
  `3:16`, `8.28`, `5:3-12`, `3,16` y recuerda las posiciones: 5 de 5.
- **Contexto**: "y ahora el versículo 31" resuelve con la cita anterior (o con
  lo proyectado), vigente 3 minutos; "el capítulo 13 de primera de Corintios"
  toma el libro de después. Se marcan como inferidas.
- **whisper-server persistente** (CLI de respaldo): ~3,4 s → ~1,3 s por
  fragmento; con `audio_ctx` ≥ 768, ~0,78 s sin perder citas.
- **Cortes por frase** (`segmentadorVoz.ts`) en vez de ventanas de 6 s: piso de
  ruido por mínimo en 3 s, corte en pausas de 650 ms, forzado a 12 s con
  solape. El umbral fijo de 0,008 desapareció; queda una sensibilidad.
- **Costura** entre fragmentos (las últimas 8 palabras se re-analizan con el
  nuevo) y **validación** contra la cantidad real de versículos.
- **Pantalla**: texto del versículo en cada sugerencia, Ctrl+Enter, panel "al
  aire" con Anterior/Siguiente (Ctrl+←/→), transcripción con las citas
  resaltadas, gestión de modelos cuantizados.
- **Instalación**: la URL de whisper daba 404 (la release "latest" sin
  binarios); ahora se resuelve por la API de GitHub. Instala también en Linux.

En la app (dispositivo de audio falso, manejada por CDP): 5/5 citas en orden,
~660 ms por frase, ningún falso positivo con "los hechos de aquel hombre".

Lo que sigue sin poder simularse: **la consola real y una voz humana un
domingo**. De esa prueba sale si la sensibilidad por defecto (0,5) y el modelo
Base alcanzan, o conviene Small comprimido.

## Archivos

**Nuevos**
- `src/shared/utils/escuchaBiblica.ts` — el detector (puro) ✅
- `tests/escuchaBiblica.test.ts` — batería sobre frases de predicación ✅
- `src/shared/utils/whisper.ts` — modelos, argumentos y parseo de la salida (puro) ✅
- `electron/services/toolsPaths.ts` — lo común a las herramientas externas ✅
- `electron/services/escuchaService.ts` — whisper: resolver binario, bajar, transcribir ✅
- `tests/whisper.test.ts`, `tests/escuchaService.test.ts` ✅
- `tests/whisperE2E.test.ts` — punta a punta, apagado salvo que se pida ✅
- `src/shared/utils/audioVentanas.ts` — troceo, solape, VAD y WAV (puro) ✅
- `src/shared/types/escucha.ts` — las formas que cruzan el puente ✅
- `src/public/escucha-worklet.js` — el recolector del hilo de audio ✅
- `src/control/audio/escuchaEnVivo.ts` — pega micrófono, whisper y estado ✅
- `tests/audioVentanas.test.ts`, `tests/escuchaStore.test.ts` ✅
- `electron/ipc/escucha.ts` — canales ✅
- `src/control/audio/capturaVoz.ts` — getUserMedia + worklet a 16 kHz ✅
- `src/shared/store/escuchaStore.ts` — estado de escucha y sugerencias ✅
- `src/control/pages/Escucha.tsx` — la sección ✅
- `src/control/components/IndicadorEscucha.tsx` — el aviso de la cabecera ✅
- `tests/ui/escucha.test.tsx` — que la pantalla no proyecte sola ✅

**Modificados**
- `src/shared/constants.ts` — canales IPC ✅
- `electron/preload/control.ts` + `src/shared/types/electronAPI.d.ts` — API ✅
- `electron/main.ts` — registrar handlers + `dispose()` al cerrar ✅
- `src/shared/types/ipc.ts` — `AppSettings`: modelo de whisper y dispositivo de entrada ✅
- `src/control/App.tsx` — import + `navItems` + `<Route>` ✅ (y una cuarta edición que no
  estaba prevista: el indicador de la cabecera)
- `docs/USER_GUIDE.md` — la sección Escucha explicada para quien opera ✅

---

## Verificación

1. **Fase 1:** `npm test` — el detector contra frases reales, incluyendo los casos
   ambiguos ("los hechos de ese hombre" NO debe disparar Hechos).
2. **Fase 2 — hecha.** `WHISPER_E2E=1 npx vitest run tests/whisperE2E.test.ts` sintetiza un
   sermón de 23 s con la voz castellana de Windows, lo transcribe con el modelo `base` y le
   pasa el resultado al detector de la fase 1. Salió:

   > «Buenos días, hermanos. **Habramos** nuestras Biblias en **Juan capítulo 3 versículo
   > 16**. ¿Por qué de tal manera amodió Salmundo? Y ahora vamos a **primera de Corintios
   > capítulo 13**, donde Pablo nos habla del amor. Terminamos leyendo el **Salmo 23**. El
   > Seinio Ures mi pastor, nada me faltara.»

   → `JHN 3:16` (1.0), `1CO 13` (1.0), `PSA 23` (0.95). Las tres, y ninguna de más.

   Dos cosas que enseñó y que hay que tener presentes:
   - **Whisper escribe los números en dígitos**, no en palabras ("capítulo 3"). El detector
     ya los lee, pero significa que los casos de `leerNumero` con palabras se ejercitan
     menos de lo que uno supondría en la vida real.
   - **Se come letras al principio** ("Habramos" por "abramos", "Seinio Ures" por "Señor
     es"). El matching difuso lo absorbe mientras el error no caiga sobre el nombre del
     libro.

   Es una voz sintética: prueba que la cañería anda, no cuánta precisión va a haber el
   domingo. Eso se mide en la fase 3.
3. **Fase 3 — hecha, sin micrófono humano.** Chromium sabe hacerse pasar por una placa de
   sonido: se levanta la app con

   ```bash
   npx electron . --remote-debugging-port=9222 --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<sermon.wav>
   ```

   y `getUserMedia` recibe el WAV como si fuera la consola. Con eso se maneja la Escucha por
   CDP y se ve el camino completo: worklet → ventanas → whisper → detector → sugerencias.

   Resultado sobre 50 s (el sermón de 23 s, repetido): las tres citas correctas y **ninguna
   de más**, 0 ventanas descartadas, whisper entre 875 y 1006 ms por ventana.

   **Con un video 1080p decodificando al mismo tiempo** (verificado por el contador de
   frames del `<video>`, 0 perdidos): 998 ms de promedio contra ~940 sin video. La CPU no
   es el problema que se temía, al menos con el modelo `base`.

   Falta lo único que no se puede simular: la consola de sonido real y una voz humana.
4. **Fase 4 — hecha.** End-to-end por CDP manejando la interfaz como el operador (clics y
   lectura del DOM, sin tocar ningún store): ir a Escucha → apretar Escuchar → esperar →
   clic en Proyectar → leer la ventana de proyección. Salió:

   ```
   [8s]  sugerencias: Juan 3:16
   [16s] sugerencias: 1 Corintios 13, Juan 3:16
   [22s] sugerencias: Salmos 23, 1 Corintios 13, Juan 3:16
   proyección → «Salmo de David. JEHOVÁ es mi pastor; nada me faltará. Salmos 23:1 · RVR1909»
   ```

   Y el indicador de la cabecera aparece al escuchar y se apaga al detener.
5. `npm run typecheck && npm run lint && npm run build` en cada fase.

---

## Lo que puede salir mal

- **Whisper alucina sobre silencio** — **confirmado en la fase 2**: seis segundos de
  silencio devuelven `[MÚSICA]`, y seis de ruido de fondo, `(Cantando)`. Nunca contesta
  vacío. `parseTranscripcion` tira esas anotaciones, pero eso no alcanza: la ventana igual
  se transcribió y gastó CPU. Falta la puerta por energía (VAD simple) antes de mandarla,
  que es trabajo de la fase 3.
- **CPU** — **medido en la fase 3 y no es problema**: con un video 1080p al aire, whisper
  pasó de ~940 ms a 998 ms por ventana y el video no perdió un solo frame. Igual queda el
  interruptor de apagado como válvula de escape, y el contador de ventanas descartadas para
  darse cuenta si algún día sí lo es.
- **La latencia puede molestar** más de lo estimado si el pastor cita y sigue de largo.
- **Precisión con nombres propios bíblicos** — whisper puede escribir "Habacuc" de cinco
  formas distintas. El matching difuso ayuda, pero los libros raros van a fallar más.
