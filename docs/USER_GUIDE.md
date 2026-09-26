# Guía de uso — Church Projector

La app abre **dos ventanas**: la de **Control** (donde trabajás vos) y la de **Proyección** (la que ve la congregación, en la segunda pantalla). La de proyección no se cierra sola; si la perdés de vista, botón **Proyección** arriba a la derecha (doble clic la recarga). **Cerrar la ventana de Control cierra la app entera**, proyección incluida.

Sólo puede haber una copia abierta: si la abrís otra vez, te trae la que ya estaba y te avisa que ya estaba abierta (dos copias se pelearían por el proyector y por el micrófono).

## Cómo está organizada la pantalla

- **A la izquierda, las secciones**: En Vivo, Canciones, Biblia, Media, Audio, Escucha, Descargar y, abajo, Ajustes. **Ctrl+1** a **Ctrl+8** te llevan a cada una sin el mouse. Algunas muestran un numerito: en *Escucha*, las citas que se oyeron y todavía no proyectaste; en *Descargar*, las descargas en curso.
- **Arriba a la derecha, lo que no puede faltar nunca**: *Detener* (parada de pánico, igual que **Esc**), *Blackout*, *Limpiar* y el botón para recuperar la ventana de proyección.
- **La franja AL AIRE**, debajo: dice **qué** ve la congregación ahora (el versículo, la canción, el video, el fondo en loop). Si está en rojo, se está viendo. Si dice *SIN SEÑAL*, la pantalla está vacía. Si hay un fondo detrás de un versículo, lo menciona aparte (*+ fondo: …*).
- **Abajo**, el reproductor de música, siempre visible.
- **Avisos**: cuando termina una descarga, falla algo, o la Escucha oye una cita mientras estás en otra sección, aparece un aviso abajo a la derecha que se va solo.

**Clic derecho** sobre casi cualquier cosa abre un menú con lo que se puede hacer con ella (ver *Menús de clic derecho* más abajo). En los campos de texto, el clic derecho da Cortar, Copiar y Pegar.

**El rojo significa "al aire"** en toda la app: los botones que mandan algo a la pantalla (*Proyectar*, *Mostrar en proyección*, *Iniciar presentación*) se ponen rojos al pasar el mouse, y lo que está saliendo se marca en rojo. El **ámbar** es lo elegido o lo que sigue; el **verde**, lo que salió bien; el **salmón**, los errores.

## Primeros pasos (Ajustes ⚙️)

1. **Pantalla de proyección** — las pantallas aparecen dibujadas como están ubicadas en tu escritorio: tocá la del proyector. La ventana se muda sola, sin reiniciar. Si enchufás el proyector con la app abierta, *Buscar pantallas*.
2. **Carpetas de contenido** — configurá al menos:
   - *Imágenes / videos / GIFs*: tu carpeta general de media.
   - *Música*: tus MP3/FLAC/M4A.
   - *Canciones*: donde se guardan las letras.
   - Opcionales: *Videos de loop (En Vivo)* y *Fondos de Biblia* — carpetas dedicadas para tener todo ordenado; si no las configurás se usa la carpeta de media.
   
   Todas las carpetas admiten **subcarpetas** y tienen vigilancia automática: copiás un archivo y aparece solo en la app.
3. **Audio de los videos** — fade de entrada/salida del sonido de los videos proyectados, con duración regulable.

En Ajustes también están la **lista de atajos de teclado** y, en *Acerca de*, la versión, el botón para abrir el **registro de errores** y *Copiar para pedir ayuda* (arma un texto con los datos que hacen falta para que alguien te ayude). Cada carpeta configurada tiene un botón para abrirla en el explorador.

## En Vivo 🎬

- **Slide de prueba**: texto libre, una línea por renglón → *Proyectar slide*.
- **Fondo único (loop)**: un video o imagen fijo que queda detrás de todo el contenido (letras, versículos). Los videos loopean. Si configuraste la carpeta de loops, navegás sus subcarpetas acá. El que está puesto se marca **AL AIRE**, y arriba de todo aparece una franja con su nombre y el botón *Quitar*.
- **Presentación de fondo**: elegí varias imágenes en orden y rotan solas cada N segundos. Mientras corre, se marca en rojo.
- **Acciones rápidas** (siempre arriba a la derecha): *Detener* (pánico: corta todo, incluido el fondo, y deja negro), *Blackout* (tapa con negro) y *Limpiar* (saca el contenido dejando el fondo).
- En pantallas anchas las tres herramientas quedan en dos columnas.

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
- Clic en un item → panel derecho: **Mostrar en proyección** (con loop opcional para videos). Con el teclado: Tab hasta la tarjeta y Enter.
- **Cola de videos**: en cada video, *Añadir a la cola*. La cola aparece en el panel derecho: reordenala (↑↓), reproducila y avanza sola al terminar cada clip. *Siguiente* salta, *Detener* corta.
- **Barra de transporte** (abajo, en rojo, cuando hay un video al aire): pausa, scrub, volumen, reinicio — y al terminar el video, el botón **De nuevo** lo vuelve a reproducir desde el principio.
- Cada video muestra su **duración** (`4m 12s`).

## Audio 🎧

- La música es **independiente de la proyección**: seguí proyectando lo que quieras, la música no se corta.
- **Pestañas**: *Toda la música* + tus playlists. *Nueva playlist* crea una; dentro podés renombrar, reordenar tracks y eliminarla (doble confirmación).
- En cada track: ➕ lo agrega a playlists (o crea una nueva con él), 🎵 lo encola, ▶ lo reproduce. El que está sonando se marca con unas barritas que se mueven sobre su tapa.
- Si reproducís desde una playlist, al terminar cada tema sigue el próximo **de esa playlist**; la cola manual siempre tiene prioridad.
- El **mini reproductor** (abajo, siempre visible): play/pausa, anterior/siguiente, stop con fade, seek y volumen. Al reabrir la app, retoma donde quedaste.

## Escucha 👂

Mientras el pastor predica, la app oye la entrada de audio y, cuando alguien nombra un pasaje, te lo deja listo para proyectar. **Nunca proyecta sola**: sugiere, y vos decidís.

### Antes de empezar

- **Elegí la entrada** que trae la voz del predicador. Lo que funciona de verdad es la **salida de la consola de sonido** (el micrófono inalámbrico ya pasa por ahí), no el micrófono de la notebook captando desde el fondo del salón.
- La primera vez hay que bajar el programa de transcripción y un **modelo**. Si dudás, el *Base* (148 MB) o el *Small comprimido* (190 MB, entiende mejor los nombres raros). Los grandes son más precisos pero tardan más: si la **demora** que muestra la pantalla pasa de 3 segundos, conviene uno más chico. Se cambian en *Modelo de transcripción* (con la Escucha detenida).

### Durante la predicación

- Apretá **Escuchar**. La primera vez tarda uno o dos segundos en cargar el modelo.
- El **medidor** está en decibeles, como el de la consola. La rayita blanca es el **umbral**: por debajo se considera silencio y no se transcribe. Se ajusta sola al ruido de fondo.
- **Volumen de entrada**: si la voz llega baja (el medidor apenas se mueve, o tenés que acercarte mucho al micrófono), subilo. Con la línea de la consola suele alcanzar con 0 dB; con el micrófono de una notebook a unos metros, entre +12 y +24 dB. Se ajusta en vivo, sin detener.
- **Sensibilidad**: si igual se pierde voz floja, subila; si transcribe ruido o música, bajala.
- Además, cada frase se lleva sola a un volumen cómodo antes de transcribirla: whisper entiende mucho peor el audio bajo.
- La app corta el audio **en las pausas del predicador**, frase por frase. Mientras el pastor sigue hablando, cada un par de segundos transcribe **lo que va de la frase**: una cita aparece **unos 2 segundos después de nombrarse**, marcada *Oyendo…*, y se confirma sola cuando termina la frase (si el número se había oído a medias, se corrige).
- Cada sugerencia muestra **el texto del versículo**: si es lo que el pastor está leyendo, no hay duda. También el pedazo de lo que se oyó, cuántas veces se nombró (×2) y, si el libro no se dijo en esa frase, de qué cita anterior se tomó (*"y ahora el versículo 31"* → sigue en Romanos 8).
- **Proyectar** la manda a la pantalla. **Ctrl+Enter** proyecta la más nueva sin el mouse.
- Una vez proyectada, el panel **Al aire desde la Escucha** tiene *Anterior* y *Siguiente* (**Ctrl+←** / **Ctrl+→**) para seguir versículo por versículo mientras el pastor lee, cruzando de capítulo si hace falta.
- Con el lápiz corregís el capítulo o el versículo antes de proyectar.
- Avisos: *no se entendió bien* (el reconocedor dudó) y *se oyó cortada* (el pastor habló de corrido más de lo que entra en un pedazo y al número puede faltarle un dígito). En los dos casos, confirmá antes de sacarlo.
- *Lo que se está oyendo* muestra la transcripción en vivo con las citas resaltadas: sirve para entender por qué apareció (o no) algo.
- Mientras escucha, la cabecera lo dice desde cualquier sección, con cuántas citas esperan. Si oye una cita mientras estás en otra sección, te avisa.

Nombres que el reconocedor escribe raro —"hop" por *Job*, "Ageo" por *Hageo*, "Ebreos" por *Hebreos*, "Sacarías" por *Zacarías*— se entienden igual: la app compara cómo suenan, no cómo se escriben.

### Privacidad

**El audio no se guarda ni sale de tu máquina.** La transcripción la hace un programa que corre en la misma computadora, sin internet; el audio viaja en memoria y se descarta apenas se transcribe, y al detener se borra todo. El modelo queda cargado 10 minutos por si volvés a escuchar, y después se libera la memoria.

Los libros que también son palabras corrientes (Hechos, Números, Reyes) sólo se sugieren cuando el contexto es claro ("Hechos 2:38", "vamos a Hechos"), justamente para no llenarte la lista de falsas alarmas en vivo.

## Descargar 📥

Pegás el enlace de un video (o **varios juntos**, por ejemplo la lista que te mandaron por WhatsApp), elegís **Video** o **MP3**, y listo. El video cae en tu carpeta de media y el MP3 en la de audio, así que aparecen solos en esas secciones sin mover nada. El botón *Pegar* trae lo que tengas copiado.

- **Resolución**: elegís hasta dónde bajar el video (1080p por defecto). Un 4K no se ve mejor en un proyector y ocupa diez veces más.
- **Calidad del MP3**: 320, 192 o 128 kbps. El MP3 sale con **tapa y datos adentro**, así que en la sección Audio aparece con su carátula y su título en vez de como un archivo pelado.
- Se bajan **de a una** — cuatro descargas en paralelo por la conexión de la iglesia sólo consiguen que las cuatro vayan lentas. Podés encolar varias.
- **Sólo un tramo**: activá el interruptor y poné *desde* y *hasta* (por ejemplo `12:05` y `15:30`) para bajar únicamente ese pedazo, cortado en el segundo exacto. El archivo lleva el tramo en el nombre, así no pisa al video entero.
- Mientras baja ves el avance, la velocidad y cuánto falta. **Cancelar** corta en el acto y no deja archivos a medias en la biblioteca.
- Las que terminaron tienen un botón para **mostrarlas en su carpeta**; las que fallaron o cancelaste, uno para **reintentar** (útil después de iniciar sesión o de actualizar yt-dlp). Si estás en otra sección, un aviso te dice cuando termina o falla cada una.
- **Listas de reproducción**: si pegás el enlace de una lista, por defecto baja sólo ese video. Aparece un botón para **encolar la lista completa**, que la expande y arma un trabajo por video — así ves el avance de cada uno y podés cancelar uno solo sin perder el resto.

La primera vez hacen falta tres programas externos: **yt-dlp** (baja), **ffmpeg** (junta video con audio y arma el MP3) y un intérprete de JavaScript (**deno**, o node si ya lo tenés), que YouTube exige para entregar los videos. *Instalar lo que falta* los baja solos, en Windows y en Linux. No vienen con la app a propósito: yt-dlp se desactualiza cada pocas semanas cuando YouTube cambia algo.

Arriba se ve la versión de yt-dlp y **hace cuántos días salió**: pasado mes y medio, el botón *Actualizar yt-dlp* se pone ámbar. Es lo primero que hay que probar cuando una descarga que antes andaba empieza a fallar.

Si ya los tenés instalados (winget, chocolatey, el gestor de paquetes de Linux, o sueltos en el PATH), la app los encuentra sola; también podés indicar la carpeta en *Ajustes → Herramientas*. Y se pueden instalar o bajar videos sin abrir la app, con los scripts de la sección siguiente.

### Si YouTube te pide "iniciar sesión para confirmar que no sos un robot"

No es un problema de la app. Pasa cuando tu conexión comparte la IP pública con muchos otros usuarios —**Starlink, datos móviles, wifi de un edificio**— y alguno de ellos abusó: Google marca esa IP compartida y le pide identificarse a todos los que estén detrás. Es intermitente: depende de qué IP te toque ese día.

Qué se puede hacer, en orden:

1. **Esperar un rato o probar desde otra red** (por ejemplo el celular como hotspot). Suele alcanzar.
2. **Iniciar sesión desde la app.** Cuando aparece ese error, la pantalla te muestra el botón *Iniciar sesión en YouTube*. Se abre YouTube en una ventana aparte, **vos** entrás con tu cuenta y pasás la verificación como en cualquier navegador, y al cerrar la ventana la app se queda con esa sesión para las descargas.

   La contraseña la escribís en la página real de Google: la app no la ve ni la guarda. Y si cerrás la ventana sin haber entrado, te avisa en vez de dar por hecho que quedó lista.

   Dos advertencias: bajar mucho material con una cuenta puede hacer que Google la marque, así que conviene usar una **cuenta de la iglesia y no la personal**; y *Borrar la sesión* corta cualquier descarga en curso, porque son las que están usando esa credencial.

Lo que **no** hay es forma de saltear el control sin identificarse. Si te encontrás con eso justo antes de una reunión, lo práctico es tener el video ya bajado de antes: por eso conviene no depender de descargar en el momento.

## Menús de clic derecho 🖱️

El clic derecho (o la tecla de menú, o **Shift+F10** con el teclado) abre lo que se puede hacer con cada cosa. Las opciones que mandan algo a la pantalla se ponen rojas al pasar el mouse. Se cierra tocando afuera.

- **Media y fondos de En Vivo**: Mostrar en proyección, Mostrar en loop, Poner/Quitar de fondo, Añadir a la cola de videos o **Reproducir a continuación** (suena después del que está al aire), agregar a la presentación, Marcar para hoy, **Categoría ▸**, Mostrar en la carpeta, Copiar el nombre.
- **Música**: Reproducir, **Reproducir a continuación**, Agregar a la cola, **Playlists ▸** (con tilde en las que ya lo tienen: tocás para agregar o sacar), Quitar de la playlist abierta, Mostrar en la carpeta, Copiar el título.
- **Canciones**: Tocar, Editar, **Mover a álbum ▸**, Eliminar.
- **Biblia** (sobre un versículo): Proyectar este, **Proyectar del N al M** (del que está al aire hasta ese, para leer de corrido), Copiar el texto, Copiar la referencia.
- **Escucha** (sobre una cita): Proyectar, Corregir el número, Copiar la referencia, Descartar.
- **Descargas**: Mostrar en la carpeta, Reintentar, Abrir en el navegador, Copiar el enlace o el detalle del error, Cancelar o Sacar de la lista.

Con el teclado: flechas para moverse, **Enter** para elegir, **→** abre un submenú y **←** vuelve. **Esc no cierra el menú**: en esta app Esc es siempre la parada de pánico.

En Canciones, *Nuevo álbum* y *Renombrar* ahora abren un campo en el lugar (antes no hacían nada).

## Herramientas desde la terminal 🧰

Con la app vienen dos scripts de Python (en la carpeta de instalación, `resources/scripts/herramientas`, o en el repositorio en `scripts/herramientas`). Sólo necesitan Python 3.8 o más nuevo:

- **`herramientas.cmd`** (Windows, doble clic) o **`herramientas.sh`** (Linux): instala lo que falte —yt-dlp, ffmpeg, deno, whisper y su modelo— en la carpeta donde la app los busca. Con `--estado` sólo muestra qué hay; con `--actualizar` baja lo último.
- **`descargar_youtube.py`**: baja videos o MP3 con las mismas opciones que la app, sin abrirla (`--audio`, `--calidad 720`, `--lista`, `--desde 1:30 --hasta 4:05`, `--archivo enlaces.txt`). Usa la sesión de YouTube que hayas guardado en la app.

Detalle en `scripts/herramientas/README.md`.

## Atajos útiles

Están todos también en *Ajustes → Atajos de teclado*.

- **Esc** — detener todo (desde cualquier ventana). En paneles y buscadores, cierra o limpia.
- **F11** — mostrar u ocultar la ventana de proyección.
- **Ctrl+1 … Ctrl+8** — ir a cada sección.
- **Tab** — moverse con el teclado; el primer Tab ofrece *Saltar al contenido*. Lo enfocado se marca con un borde ámbar.
- En Biblia, **cualquier letra** abre el buscador rápido.
- En Canciones → Tocar: **← →** o **espacio** pasan de slide, **1–9** saltan directo, **Inicio/Fin** van al primero/último.
- En Escucha: **Ctrl+Enter** proyecta la cita más nueva; **Ctrl+← / Ctrl+→**, versículo anterior / siguiente.
- **Shift+F10** o la tecla de menú — el menú de clic derecho del elemento enfocado.
- En Media, **Esc** limpia la búsqueda.

Si el sistema tiene activado *reducir movimiento* (accesibilidad), la ventana de control deja las animaciones al mínimo. La proyección no se toca.
