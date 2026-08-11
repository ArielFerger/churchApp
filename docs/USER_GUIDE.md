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

### Traer letras que ya tenés (.txt)

**Un `.txt` ya es una canción.** Arrastrá los archivos a cualquier parte de la pantalla de Canciones (o usá *Importar .txt*) y se cargan de una:

- El **nombre del archivo** pasa a ser el título. Si empieza con número de pista (`01 - Sublime gracia.txt`) el número se saca; si el número es parte del nombre (`40 dias.txt`) se respeta. Los guiones bajos pasan a espacios.
- Las **líneas en blanco que ya trae el archivo** separan los slides, que es como está escrita cualquier letra. Los huecos de varias líneas cuentan como uno solo.
- Podés arrastrar **muchos de una** — te avisa cuántos entraron.
- Si estás parado en un álbum, las importadas caen ahí.
- Los `.txt` viejos guardados desde el Bloc de notas o Word (con acentos en la codificación de Windows) se leen bien: no hay que convertir nada.

Después, si querés, les agregás acordes y nombres de parte a mano.

### Escribir la letra (Editar)

Es un solo cuadro de texto:

- **Una línea en blanco** separa un slide del siguiente.
- **`# Coro`** al principio de una estrofa le pone nombre a esa parte (`# Verso 1`, `# Puente`, lo que quieras). Se ve en el mazo para que la reconozcas de un vistazo, pero **nunca se proyecta**.
- **Acordes entre corchetes**, en la posición exacta donde tocan: `que ge[Am]nial, est[A]a canción`. Son sólo para vos: la proyección siempre va sin acordes.

A la pantalla va **sólo la letra**: ni el título de la canción, ni el nombre de la parte, ni los acordes.

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

## Escucha 👂

Mientras el pastor predica, la app oye la entrada de audio y, cuando alguien nombra un pasaje, te lo deja listo para proyectar de un clic. **Nunca proyecta sola**: sugiere, y vos decidís.

- **Elegí la entrada** que trae la voz del predicador. Lo que funciona de verdad es la **salida de la consola de sonido** (el micrófono inalámbrico ya pasa por ahí), no el micrófono de la notebook captando desde el fondo del salón.
- Apretá **Escuchar**. El medidor te confirma que está entrando señal: si no se mueve, la consola no está llegando y no hay nada que transcribir.
- Las citas aparecen **unos 7 u 8 segundos después** de que se nombran. No es un retraso que se pueda achicar mucho: el programa transcribe de a pedazos de 6 segundos.
- Cada sugerencia muestra **el pedazo de lo que se oyó** que la originó, para que puedas juzgar si le creés. Con el lápiz corregís el capítulo o el versículo antes de proyectar.
- Dos avisos distintos: *no se entendió bien* (el reconocedor dudó) y *se oyó cortada* (la frase quedó partida entre dos pedazos y al número puede faltarle un dígito — un "13" que llega como "3"). En los dos casos, confirmá antes de sacarlo.
- Mientras escucha, la cabecera lo dice desde cualquier sección. Si no lo ves, no está tomando.

**El audio no se guarda ni sale de tu máquina.** La transcripción la hace un programa que corre en la misma computadora, sin internet; cada pedazo de audio se borra apenas se transcribe, y al detener se descarta todo. La primera vez hay que bajar ese programa y su modelo (~150 MB), con el botón que aparece en la pantalla.

Funciona mejor de lo que uno esperaría con nombres comunes, pero no es magia: los libros que también son palabras corrientes (Hechos, Números, Reyes) sólo se sugieren cuando el contexto es claro, justamente para no llenarte la lista de falsas alarmas en vivo.

## Descargar 📥

Pegás el enlace de un video, elegís **Video** o **MP3**, y listo. El video cae en tu carpeta de media y el MP3 en la de audio, así que aparecen solos en esas secciones sin mover nada.

- **Resolución**: elegís hasta dónde bajar el video (1080p por defecto). Un 4K no se ve mejor en un proyector y ocupa diez veces más.
- **Calidad del MP3**: 320, 192 o 128 kbps. El MP3 sale con **tapa y datos adentro**, así que en la sección Audio aparece con su carátula y su título en vez de como un archivo pelado.
- Se bajan **de a una** — cuatro descargas en paralelo por la conexión de la iglesia sólo consiguen que las cuatro vayan lentas. Podés encolar varias.
- Mientras baja ves el avance, la velocidad y cuánto falta. **Cancelar** corta en el acto y no deja archivos a medias en la biblioteca.
- **Listas de reproducción**: si pegás el enlace de una lista, por defecto baja sólo ese video. Aparece un botón para **encolar la lista completa**, que la expande y arma un trabajo por video — así ves el avance de cada uno y podés cancelar uno solo sin perder el resto.

La primera vez hace falta instalar dos programas externos: **yt-dlp** (baja) y **ffmpeg** (junta video con audio y arma el MP3). La pantalla tiene un botón que los baja solos (~180 MB). No vienen con la app a propósito: yt-dlp se desactualiza cada pocas semanas cuando YouTube cambia algo, y conviene poder renovarlo sin reinstalar todo. Si ya los tenés instalados (winget, chocolatey, o sueltos en el PATH), la app los encuentra sola; también podés indicar la carpeta en *Ajustes → Herramientas de descarga*.

### Si YouTube te pide "iniciar sesión para confirmar que no sos un robot"

No es un problema de la app. Pasa cuando tu conexión comparte la IP pública con muchos otros usuarios —**Starlink, datos móviles, wifi de un edificio**— y alguno de ellos abusó: Google marca esa IP compartida y le pide identificarse a todos los que estén detrás. Es intermitente: depende de qué IP te toque ese día.

Qué se puede hacer, en orden:

1. **Esperar un rato o probar desde otra red** (por ejemplo el celular como hotspot). Suele alcanzar.
2. **Iniciar sesión desde la app.** Cuando aparece ese error, la pantalla te muestra el botón *Iniciar sesión en YouTube*. Se abre YouTube en una ventana aparte, **vos** entrás con tu cuenta y pasás la verificación como en cualquier navegador, y al cerrar la ventana la app se queda con esa sesión para las descargas.

   La contraseña la escribís en la página real de Google: la app no la ve ni la guarda. Y si cerrás la ventana sin haber entrado, te avisa en vez de dar por hecho que quedó lista.

   Dos advertencias: bajar mucho material con una cuenta puede hacer que Google la marque, así que conviene usar una **cuenta de la iglesia y no la personal**; y *Borrar la sesión* corta cualquier descarga en curso, porque son las que están usando esa credencial.

Lo que **no** hay es forma de saltear el control sin identificarse. Si te encontrás con eso justo antes de una reunión, lo práctico es tener el video ya bajado de antes: por eso conviene no depender de descargar en el momento.

## Atajos útiles

- **Esc** — cierra paneles/palettes.
- En la pestaña Biblia, **cualquier letra** abre el buscador rápido.
- En Canciones → Tocar: **← →** o **espacio** pasan de slide, **1–9** saltan directo, **Inicio/Fin** van al primero/último, **Esc** limpia la pantalla.
- En Media, **Esc** limpia la búsqueda.
