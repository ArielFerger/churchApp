#!/usr/bin/env python3
"""
Descarga videos (o sólo el audio en MP3) de YouTube, con las mismas opciones
que la sección Descargar de Church Projector.

Sirve para bajar material fuera de la app: en otra PC, por lote desde una
lista, o programado. Sólo biblioteca estándar; usa el yt-dlp que encuentre (el
de la app, el del sistema, o el módulo de Python si está instalado).

    python descargar_youtube.py https://youtu.be/xxxx
    python descargar_youtube.py --audio https://youtu.be/xxxx https://youtu.be/yyyy
    python descargar_youtube.py --lista "https://www.youtube.com/playlist?list=..."
    python descargar_youtube.py --archivo enlaces.txt --calidad 720
    python descargar_youtube.py https://youtu.be/xxxx --desde 12:05 --hasta 15:30
    python descargar_youtube.py https://youtu.be/xxxx --destino D:\\Media

Sin --destino, los videos van a la carpeta de media de la app y los MP3 a la
de audio (tal como los configuraste en Ajustes). Si la app no tiene carpetas
configuradas, van a ./descargas.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import (  # noqa: E402
    ajustes_app,
    aviso,
    buscar,
    carpeta_datos_app,
    carpetas_candidatas,
    error,
    ok,
    tenue,
    titulo,
)

CALIDADES = {"1080": "1080", "720": "720", "480": "480", "max": None}


def parse_tiempo(texto: str) -> int:
    """'1:30' → 90, '1:02:03' → 3723, '45' → 45 (igual que la app)."""
    t = texto.strip()
    if not re.fullmatch(r"\d{1,3}(:\d{1,2}){0,2}", t):
        raise argparse.ArgumentTypeError(f"'{texto}' no es un tiempo (usá 1:30 o 1:02:03)")
    partes = [int(x) for x in t.split(":")]
    if any(n >= 60 for n in partes[1:]):
        raise argparse.ArgumentTypeError(f"'{texto}': minutos y segundos van de 0 a 59")
    total = 0
    for n in partes:
        total = total * 60 + n
    return total


def formato_tiempo(s: int) -> str:
    """90 → '1m30', 3723 → '1h02m03'. Sin puntos: yt-dlp confunde lo que
    sigue a un punto con la extensión al cortar el tramo con ffmpeg, y un
    '[0.02-0.07]' terminaba como '[0.0.07]'."""
    h, m, seg = s // 3600, (s % 3600) // 60, s % 60
    return f"{h}h{m:02d}m{seg:02d}" if h else f"{m}m{seg:02d}"


EXTRA: list[Path] = []


def comando_ytdlp() -> Optional[list[str]]:
    """El yt-dlp a usar: primero el de la app, después el del sistema, y por
    último el módulo de Python (`pip install yt-dlp`)."""
    dirs = carpetas_candidatas(EXTRA)
    binario = buscar("yt-dlp", dirs)
    if binario:
        return [str(binario)]
    if importlib.util.find_spec("yt_dlp") is not None:
        return [sys.executable, "-m", "yt_dlp"]
    return None


def runtime_js() -> Optional[str]:
    """Intérprete de JavaScript para el desafío de YouTube, nombrado como lo pide yt-dlp."""
    dirs = carpetas_candidatas(EXTRA)
    for nombre in ("deno", "node", "bun"):
        ruta = buscar(nombre, dirs)
        if ruta:
            return f"{nombre}:{ruta}"
    return None


def argumentos(a: argparse.Namespace, destino: Path) -> list[str]:
    """Los mismos flags que arma `buildArgs` en src/shared/utils/downloads.ts."""
    args = [
        "--socket-timeout", "20",
        "--retries", "3",
        "--fragment-retries", "3",
        "--extractor-retries", "2",
        "--no-mtime",
        "--concurrent-fragments", "4",
        # yt-dlp recorta la RUTA ENTERA (no el nombre) a este largo: 230 queda
        # debajo del límite de 260 de Windows con lugar para el ".part".
        "--trim-filenames", "230",
        "--windows-filenames",
        "--newline",
    ]
    # IPv4: en redes con IPv6 anunciado sin ruta, yt-dlp se cuelga para siempre.
    if not a.ipv6:
        args.insert(0, "-4")
    js = runtime_js()
    if js:
        args += ["--js-runtimes", js]

    # Sesión: el archivo de cookies que guarda la app al iniciar sesión, o uno propio.
    cookies = a.cookies
    if not cookies and not a.sin_sesion:
        de_la_app = carpeta_datos_app() / "youtube-cookies.txt"
        if de_la_app.exists():
            cookies = de_la_app
    if cookies:
        args += ["--cookies", str(cookies)]
    elif a.cookies_navegador:
        args += ["--cookies-from-browser", a.cookies_navegador]

    args += ["--yes-playlist"] if a.lista else ["--no-playlist"]

    sufijo = ""
    if a.desde is not None or a.hasta is not None:
        desde = a.desde or 0
        if a.hasta is None or a.hasta <= desde:
            raise SystemExit("El tramo no es válido: --hasta tiene que ser después de --desde.")
        args += ["--download-sections", f"*{desde}-{a.hasta}", "--force-keyframes-at-cuts"]
        sufijo = f" [{formato_tiempo(desde)}-{formato_tiempo(a.hasta)}]"

    plantilla = "%(playlist_index)03d - %(title)s" if a.lista else "%(title)s"
    args += ["--output", str(destino / f"{plantilla}{sufijo}.%(ext)s")]

    ffmpeg = buscar("ffmpeg", carpetas_candidatas(EXTRA))
    if ffmpeg:
        args += ["--ffmpeg-location", str(ffmpeg.parent)]
    else:
        aviso("no se encontró ffmpeg: sin él no se puede juntar video y audio ni armar MP3")

    if a.audio:
        args += [
            "--extract-audio", "--audio-format", "mp3", "--audio-quality", f"{a.bitrate}K",
            "--embed-thumbnail", "--embed-metadata", "--convert-thumbnails", "jpg",
        ]
    else:
        tope = CALIDADES[a.calidad]
        cap = f"[height<={tope}]" if tope else ""
        args += [
            "--format",
            f"bestvideo{cap}[ext=mp4]+bestaudio[ext=m4a]/best{cap}[ext=mp4]/bestvideo{cap}+bestaudio/best{cap}/best",
            "--merge-output-format", "mp4",
            "--embed-chapters", "--embed-metadata",
        ]
    return args


def leer_enlaces(a: argparse.Namespace) -> list[str]:
    enlaces = list(a.enlaces)
    if a.archivo:
        for linea in Path(a.archivo).read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#"):
                enlaces.append(linea)
    # Mismas reglas que la app: se completa el https y se descartan repetidos.
    vistos: list[str] = []
    for e in enlaces:
        e = e.strip().strip("<>()").rstrip(".,;")
        if re.match(r"^(www\.|m\.)?(youtube\.com|youtu\.be)/", e, re.I):
            e = "https://" + e
        if re.match(r"^https?://\S+$", e, re.I) and e not in vistos:
            vistos.append(e)
        elif e:
            aviso(f"se ignora '{e}': no parece un enlace")
    return vistos


def main() -> int:
    p = argparse.ArgumentParser(
        description="Descarga videos o MP3 de YouTube con las opciones de Church Projector.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("enlaces", nargs="*", help="uno o más enlaces")
    p.add_argument("--archivo", help="archivo de texto con un enlace por línea")
    p.add_argument("--audio", action="store_true", help="sólo el audio, en MP3")
    p.add_argument("--calidad", choices=list(CALIDADES), default="1080", help="resolución máxima (default 1080)")
    p.add_argument("--bitrate", choices=["320", "192", "128"], default="320", help="calidad del MP3")
    p.add_argument("--lista", action="store_true", help="bajar la lista de reproducción entera")
    p.add_argument("--desde", type=parse_tiempo, help="inicio del tramo (1:30)")
    p.add_argument("--hasta", type=parse_tiempo, help="fin del tramo (4:05)")
    p.add_argument("--destino", type=Path, help="carpeta destino")
    p.add_argument("--cookies", type=Path, help="archivo de cookies (formato Netscape)")
    p.add_argument("--cookies-navegador", help="leer la sesión de un navegador (chrome, edge, firefox…)")
    p.add_argument("--sin-sesion", action="store_true", help="no usar la sesión guardada por la app")
    p.add_argument("--herramientas", type=Path, help="carpeta con yt-dlp/ffmpeg/deno (antes que las de la app)")
    p.add_argument("--ipv6", action="store_true", help="no forzar IPv4")
    a = p.parse_args()
    if a.herramientas:
        EXTRA.append(a.herramientas.expanduser().resolve())

    enlaces = leer_enlaces(a)
    if not enlaces:
        p.print_help()
        return 2

    cmd = comando_ytdlp()
    if not cmd:
        error("No se encontró yt-dlp.")
        print("  Instalalo con:  python instalar_herramientas.py --solo yt-dlp ffmpeg deno")
        print("  o:              python -m pip install yt-dlp")
        return 1

    ajustes = ajustes_app()
    carpeta_app = ajustes.get("audioFolder" if a.audio else "mediaFolder")
    destino = (a.destino or (Path(carpeta_app) if carpeta_app else Path.cwd() / "descargas")).expanduser()
    destino.mkdir(parents=True, exist_ok=True)

    print(f"Church Projector · descargas · {len(enlaces)} {'enlace' if len(enlaces) == 1 else 'enlaces'}")
    print(tenue(f"yt-dlp: {' '.join(cmd)}"))
    print(tenue(f"destino: {destino}"))
    if not runtime_js():
        aviso("no hay intérprete de JavaScript (deno/node): YouTube puede negarse a entregar los videos")

    base = argumentos(a, destino)
    fallidos: list[str] = []
    # De a uno, como la app: bajar varios a la vez por la conexión de una
    # iglesia sólo hace que todos vayan lentos (y dispara el control anti-bots).
    for i, url in enumerate(enlaces, 1):
        titulo(f"[{i}/{len(enlaces)}] {url}")
        r = subprocess.run([*cmd, url, *base])
        if r.returncode == 0:
            ok("listo")
        else:
            error(f"falló (código {r.returncode})")
            fallidos.append(url)

    print()
    if fallidos:
        error(f"{len(fallidos)} de {len(enlaces)} fallaron:")
        for f in fallidos:
            print("   " + f)
        print(tenue("  Si YouTube pide confirmar que no sos un robot: iniciá sesión desde la app"))
        print(tenue("  (Descargar → Iniciar sesión) y volvé a correr este script."))
        return 1
    ok(f"Todo listo en {destino}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        error("Cancelado.")
        sys.exit(130)
    except shutil.Error as e:
        error(str(e))
        sys.exit(1)
