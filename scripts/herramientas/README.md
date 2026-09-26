# Herramientas externas — scripts

La app usa programas que **no** vienen dentro del instalador (se desactualizan
rápido o pesan más que la app entera). La app los puede bajar sola desde las
secciones **Descargar** y **Escucha**; estos scripts hacen lo mismo desde la
terminal, sirven para diagnosticar, y permiten bajar videos sin abrir la app.

| Programa | Para qué | Lo usa |
|---|---|---|
| **yt-dlp** | Baja los videos | Descargar |
| **ffmpeg** (+ ffprobe) | Junta video y audio, arma los MP3 | Descargar |
| **deno** | Intérprete de JavaScript que YouTube exige | Descargar |
| **whisper** (cli + server) | Transcribe la predicación, sin internet | Escucha |
| **modelo de whisper** | El "cerebro" de la transcripción | Escucha |

Requisito: **Python 3.8 o más nuevo**. No hace falta `pip install` de nada.

## Instalar / revisar

| Sistema | Cómo |
|---|---|
| Windows | Doble clic en `herramientas.cmd` |
| Linux | `./herramientas.sh` |
| Cualquiera | `python3 instalar_herramientas.py` |
| Desde el repo | `npm run herramientas:instalar` |

Opciones útiles:

```bash
python3 instalar_herramientas.py --estado          # qué hay y dónde
python3 instalar_herramientas.py --actualizar      # yt-dlp y whisper a la última
python3 instalar_herramientas.py --modelo small-q5_1
python3 instalar_herramientas.py --solo yt-dlp ffmpeg deno
python3 instalar_herramientas.py --dir D:/herramientas
python3 instalar_herramientas.py --solo whisper --compilar-whisper   # Linux sin paquete
```

Instala en la **misma carpeta donde busca la app** (la de *Ajustes → Herramientas*
si está configurada; si no, `%APPDATA%\church-projector\tools` en Windows o
`~/.config/church-projector/tools` en Linux). La app las encuentra sola.

Modelos de whisper: `tiny` (75 MB), `base` (148 MB), `small-q5_1` (190 MB,
recomendado), `small` (488 MB), `medium-q5_0` (539 MB), `large-v3-turbo-q5_0`
(574 MB, sólo PCs potentes).

## Bajar videos sin abrir la app

```bash
python3 descargar_youtube.py https://youtu.be/xxxx
python3 descargar_youtube.py --audio https://youtu.be/xxxx https://youtu.be/yyyy
python3 descargar_youtube.py --lista "https://www.youtube.com/playlist?list=..."
python3 descargar_youtube.py --archivo enlaces.txt --calidad 720
python3 descargar_youtube.py https://youtu.be/xxxx --desde 12:05 --hasta 15:30
```

Usa exactamente las mismas opciones que la app (mp4 a 1080p como máximo, MP3
con tapa y datos, IPv4, reintentos) y la **sesión de YouTube** que hayas
guardado desde la app. Sin `--destino`, deja los archivos en las carpetas de
media/audio de la app.

## Por qué IPv4

Los scripts resuelven sólo direcciones IPv4 (se puede cambiar con `--ipv6`).
Python, igual que yt-dlp, no prueba IPv4 cuando IPv6 no responde: en redes
que anuncian IPv6 sin ruta real (muy común con Starlink y algunos
proveedores) la descarga se queda colgada para siempre sin mostrar nada.
