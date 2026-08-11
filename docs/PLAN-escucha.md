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

**Fase 1 — el detector, sin micrófono ni modelo.** `escuchaBiblica.ts` completo con su
batería de tests sobre frases reales de predicación. Es el grueso de la innovación y se
verifica entero con `npm test`. Si el detector no es bueno, no vale la pena seguir.

**Fase 2 — whisper como herramienta.** Extender el patrón de `downloadsService`: detectar/
bajar `whisper-cli.exe` + modelo, y transcribir un WAV de prueba de punta a punta.

**Fase 3 — captura en vivo.** getUserMedia + worklet + troceo con solapamiento + IPC.

**Fase 4 — la sección Escucha** y el enganche con proyección.

Cada fase se puede parar y dejar andando lo anterior.

---

## Archivos

**Nuevos**
- `src/shared/utils/escuchaBiblica.ts` — el detector (puro)
- `tests/escuchaBiblica.test.ts` — batería sobre frases de predicación
- `electron/services/escuchaService.ts` — whisper: resolver binario, trocear, transcribir
- `electron/ipc/escucha.ts` — canales
- `src/control/pages/Escucha.tsx` — la sección
- `src/control/audio/capturaVoz.ts` — getUserMedia + downsample a 16 kHz
- `src/shared/store/escuchaStore.ts` — estado de escucha y sugerencias

**Modificados**
- `src/control/App.tsx` — import + `navItems` + `<Route>` (las tres ediciones de siempre)
- `src/shared/constants.ts` — canales IPC
- `electron/preload/control.ts` + `src/shared/types/electronAPI.d.ts` — API
- `electron/main.ts` — registrar handlers + `dispose()` al cerrar
- `src/shared/types/ipc.ts` — `AppSettings`: dispositivo de entrada, modelo, carpeta

---

## Verificación

1. **Fase 1:** `npm test` — el detector contra frases reales, incluyendo los casos
   ambiguos ("los hechos de ese hombre" NO debe disparar Hechos).
2. **Fase 2:** transcribir un WAV grabado a propósito diciendo tres referencias, y
   comprobar que salen las tres.
3. **Fase 3:** con la consola conectada, hablar al micrófono y ver la transcripción
   aparecer; medir la latencia real contra los 8 s estimados.
4. **Fase 4:** end-to-end por CDP — decir una referencia, ver la sugerencia, clic,
   y confirmar en la ventana de proyección que salió el versículo correcto.
5. `npm run typecheck && npm run lint && npm run build` en cada fase.

---

## Lo que puede salir mal

- **Whisper alucina sobre silencio** — inventa texto cuando no hay voz. Mitigación: puerta
  por energía (VAD simple) antes de mandar la ventana a transcribir.
- **CPU** — whisper compite con la decodificación de video de la proyección. Con el modelo
  `base` debería andar, pero hay que medirlo con un video corriendo. El interruptor de
  apagado es la válvula de escape.
- **La latencia puede molestar** más de lo estimado si el pastor cita y sigue de largo.
- **Precisión con nombres propios bíblicos** — whisper puede escribir "Habacuc" de cinco
  formas distintas. El matching difuso ayuda, pero los libros raros van a fallar más.
