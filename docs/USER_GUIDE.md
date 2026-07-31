# Guía de uso — Church Projector

La app abre **dos ventanas**: la de **Control** (donde trabajás vos) y la de **Proyección** (la que ve la congregación, en la segunda pantalla). La de proyección nunca se cierra; si la perdés de vista, botón **Proyección** arriba a la derecha (doble clic la recarga).

## Primeros pasos (Ajustes ⚙️)

1. **Pantalla de proyección** — elegí el monitor del proyector. La ventana se muda sola, sin reiniciar.
2. **Carpetas de contenido** — configurá al menos:
   - *Imágenes / videos / GIFs*: tu carpeta general de media.
   - *Música*: tus MP3/FLAC/M4A.
   - *Canciones*: donde se guardan las letras.
   - Opcionales: *Videos de loop (En Vivo)* y *Fondos de Biblia* — carpetas dedicadas para tener todo ordenado; si no las configurás se usa la carpeta de media.
   
   Todas las carpetas admiten **subcarpetas** y tienen vigilancia automática: copiás un archivo y aparece solo en la app.
3. **Audio de los videos** — fade de entrada/salida del sonido de los videos proyectados, con duración regulable.

## En Vivo 🎬

- **Slide de prueba**: texto libre, una línea por renglón → *Proyectar slide*.
- **Fondo único (loop)**: un video o imagen fijo que queda detrás de todo el contenido (letras, versículos). Los videos loopean. Si configuraste la carpeta de loops, navegás sus subcarpetas acá.
- **Presentación de fondo**: elegí varias imágenes en orden y rotan solas cada N segundos.
- **Acciones rápidas** (siempre arriba a la derecha): *Detener todo* (pánico: negro total), *Blackout*, *Logo* y *Clear* (limpia el contenido dejando el fondo).

## Canciones 🎵

Dos modos, con el interruptor arriba a la derecha: **Editar** (cargar la letra) y **Tocar** (dirigir la reunión). Al abrir la sección vas directo a Tocar.

### Escribir la letra (Editar)

Es un solo cuadro de texto:

- **Una línea en blanco** separa un slide del siguiente.
- **`# Coro`** al principio de una estrofa le pone nombre a esa parte (`# Verso 1`, `# Puente`, lo que quieras). Se ve en el mazo para que la reconozcas de un vistazo, pero **nunca se proyecta**.
- **Acordes entre corchetes**, en la posición exacta donde tocan: `que ge[Am]nial, est[A]a canción`. Son sólo para vos: la proyección siempre va sin acordes.

Mientras la canción exista, **se guarda sola** — no hace falta apretar Guardar. Las canciones nuevas sí se crean a mano con *Crear canción*, así no quedan borradores vacíos dando vueltas.

### Dirigir (Tocar)

La canción entera se ve como un **mazo de cuadritos**, uno por slide, para tener todos los pedazos a la vista sin scrollear:

- **Click en un cuadro** lo proyecta. El que está al aire queda marcado en rojo.
- **Teclado**: <kbd>←</kbd> <kbd>→</kbd> (o <kbd>espacio</kbd>) pasan de slide, <kbd>1</kbd>–<kbd>9</kbd> saltan directo, <kbd>Inicio</kbd>/<kbd>Fin</kbd> van al primero/último y <kbd>Esc</kbd> limpia la pantalla. Es lo cómodo en vivo: no hace falta soltar nada para buscar el mouse.
- **XS · S · M · L** cambia el tamaño de los cuadros: más chicos, más pedacitos entran en pantalla. Queda elegido para la próxima vez.
- **Con acordes / Sin acordes** solo afecta lo que ves vos.
- El contador (`2/7`) te dice en qué slide vas. Si el coro se repite, marca el que tocaste, no el primero con la misma letra.

Podés agrupar canciones en **álbumes** para el repertorio del servicio (el desplegable filtra la lista) y buscarlas por nombre, autor o etiqueta.

## Biblia 📖

- **Buscar versículos**: tres formas.
  1. Escribí una referencia en el buscador: `Juan 3:16`, `Jn 3:16-18`, `1 Cor 13` — muestra el versículo en todas las versiones para comparar.
  2. **Empezá a escribir en cualquier lado** de la pestaña: se abre el buscador rápido. Tipeás el libro → Espacio → capítulo → Espacio → versículo (rangos con `-`) → Enter. Solo te deja tipear capítulos y versículos que existen (te muestra el rango, ej. `1–21`).
  3. Navegá por el panel: libro → capítulo → clic en el versículo para proyectarlo.
- **Recientes**: los últimos versículos proyectados quedan como chips para volver con un clic.
- **Versiones**: botones RVR1909 / RVR1960 / RVA2015; la ⭐ fija tu versión predeterminada.
- **Apariencia** (🎨): configurá cómo se ven los versículos proyectados:
  - **Fuente**: descargá una fuente de [fonts.google.com](https://fonts.google.com) (*Download family*), descomprimí el ZIP y subí el `.ttf` con *Agregar fuentes*. Queda guardada en la app.
  - **Tamaño** (50–200 %), **color**, **negrita** y **sombra**.
  - **Fondo**: una imagen o video detrás del texto, con control de *Oscurecer fondo* para que se lea bien. Sale de la carpeta *Fondos de Biblia* (o de media).
  - Todo se guarda solo, se ve en la vista previa y se aplica en vivo en la proyección. *Probar en proyección* manda un versículo de muestra.

## Media 🖼️

- Galería con filtros (Todos / Imágenes / Videos / GIFs) y **carpetas**: entrá con un clic, volvé con el breadcrumb (`Media › Alabanza › Fondos`).
- **Buscador** (arriba): escribí parte del nombre o de la carpeta y busca en **toda** la carpeta de media, sin importar dónde estés parado. Ignora tildes y mayúsculas (`adoracion` encuentra `Adoración`, `ninos` encuentra `niños`) y podés poner varias palabras: `alabanza azul` trae lo que cumpla las dos. Cada resultado muestra en qué carpeta vive. **Esc** o la ✕ limpian la búsqueda.
- **Categorías**: en el panel derecho etiquetá cada archivo como *Alabanza*, *Adoración* o *Proyección*. La etiqueta se ve en la tarjeta y se guarda sola. Volver a tocar la categoría activa se la saca. Arriba tenés la barra **Categoría** para filtrar (incluye *Sin categoría*), con el conteo de cada una.
- **Para hoy** ⭐: marcá con la estrella los archivos del servicio de hoy (desde la tarjeta o desde el panel derecho). Aparecen en una **fila fija arriba**, visible desde cualquier carpeta y sin que los filtros la toquen, así los tenés a mano durante la reunión. Es una selección momentánea: **se vacía sola al cambiar de día**, o a mano con *Vaciar* (eso no borra las categorías).
- Clic en un item → panel derecho: **Mostrar en proyección** (con loop opcional para videos).
- **Cola de videos**: en cada video, *Añadir a la cola*. La cola aparece en el panel derecho: reordenala (↑↓), reproducila y avanza sola al terminar cada clip. *Siguiente* salta, *Detener* corta.
- **Barra de transporte** (abajo, cuando hay un video al aire): pausa, scrub, volumen, reinicio — y al terminar el video, el botón **De nuevo** lo vuelve a reproducir desde el principio.
- Cada video muestra su **duración** (`4m 12s`).

## Audio 🎧

- La música es **independiente de la proyección**: seguí proyectando lo que quieras, la música no se corta.
- **Pestañas**: *Toda la música* + tus playlists. *Nueva playlist* crea una; dentro podés renombrar, reordenar tracks y eliminarla (doble confirmación).
- En cada track: ➕ lo agrega a playlists (o crea una nueva con él), 🎵 lo encola, ▶ lo reproduce.
- Si reproducís desde una playlist, al terminar cada tema sigue el próximo **de esa playlist**; la cola manual siempre tiene prioridad.
- El **mini reproductor** (abajo, siempre visible): play/pausa, anterior/siguiente, stop con fade, seek y volumen. Al reabrir la app, retoma donde quedaste.

## Atajos útiles

- **Esc** — cierra paneles/palettes.
- En la pestaña Biblia, **cualquier letra** abre el buscador rápido.
- En Canciones → Tocar: **← →** o **espacio** pasan de slide, **1–9** saltan directo, **Inicio/Fin** van al primero/último, **Esc** limpia la pantalla.
- En Media, **Esc** limpia la búsqueda.
