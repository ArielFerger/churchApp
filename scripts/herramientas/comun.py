"""
Lo común a los scripts de herramientas de Church Projector.

Sólo biblioteca estándar de Python (3.8+): los scripts tienen que andar en la
PC de la iglesia sin instalar nada con pip.

Las rutas y los nombres de archivo son EXACTAMENTE los que usa la app
(`electron/services/toolsPaths.ts`), así que lo que instalan estos scripts la
app lo encuentra sola, sin configurar nada:

    <herramientas>/yt-dlp[.exe]
    <herramientas>/ffmpeg[.exe], ffprobe[.exe]
    <herramientas>/deno[.exe]
    <herramientas>/whisper/whisper-cli[.exe], whisper-server[.exe] (+ bibliotecas)
    <herramientas>/whisper/modelos/ggml-*.bin
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import socket
import stat
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable, Iterable, Optional

APP = "church-projector"
ES_WINDOWS = sys.platform.startswith("win")
EXE = ".exe" if ES_WINDOWS else ""
USER_AGENT = "church-projector-herramientas"


# ─── Consola ─────────────────────────────────────────────────────────────────


def _soporta_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if not sys.stdout.isatty():
        return False
    if ES_WINDOWS:
        # Windows 10+ entiende ANSI si se lo pide; os.system("") lo habilita.
        os.system("")
    return True


_COLOR = _soporta_color()


def _c(codigo: str, texto: str) -> str:
    return f"\033[{codigo}m{texto}\033[0m" if _COLOR else texto


def ok(texto: str) -> None:
    print(_c("32", "  ✓ ") + texto)


def aviso(texto: str) -> None:
    print(_c("33", "  ! ") + texto)


def error(texto: str) -> None:
    print(_c("31", "  ✗ ") + texto, file=sys.stderr)


def titulo(texto: str) -> None:
    print("\n" + _c("1", texto))


def tenue(texto: str) -> str:
    return _c("2", texto)


# Algunas consolas de Windows no son UTF-8 y los tildes rompen el print.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass


# ─── Red ─────────────────────────────────────────────────────────────────────


def forzar_ipv4() -> None:
    """
    Resolver sólo direcciones IPv4.

    Mismo problema que obligó a pasarle `-4` a yt-dlp en la app: urllib no
    implementa Happy Eyeballs, así que en una red que anuncia IPv6 sin ruta
    real (común en conexiones hogareñas y en Starlink) se queda colgado para
    siempre intentando IPv6. Medido en la máquina de la iglesia.
    """
    original = socket.getaddrinfo

    def solo_v4(host, port, family=0, type=0, proto=0, flags=0):  # noqa: A002
        return original(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = solo_v4  # type: ignore[assignment]


def pedir_json(url: str, timeout: int = 30) -> object:
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _barra(etiqueta: str, hecho: int, total: Optional[int]) -> None:
    if total:
        pct = hecho / total
        llenas = int(pct * 30)
        barra = "█" * llenas + "░" * (30 - llenas)
        texto = f"\r  {etiqueta:<22} {barra} {pct*100:5.1f}%  {hecho/1e6:7.1f}/{total/1e6:.1f} MB"
    else:
        texto = f"\r  {etiqueta:<22} {hecho/1e6:7.1f} MB"
    sys.stdout.write(texto)
    sys.stdout.flush()


def descargar(url: str, destino: Path, etiqueta: str, intentos: int = 3) -> None:
    """
    Baja `url` a `destino` con escritura atómica: primero a un `.descargando`
    y recién al terminar se renombra. Un archivo cortado por un corte de luz
    no tiene que quedar con el nombre final, porque la app lo daría por
    instalado y fallaría en cada uso.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_name(destino.name + ".descargando")
    ultimo_error: Optional[Exception] = None
    for intento in range(1, intentos + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as r, open(parcial, "wb") as f:
                total = int(r.headers.get("Content-Length") or 0) or None
                hecho = 0
                ultimo = 0.0
                while True:
                    trozo = r.read(1 << 20)
                    if not trozo:
                        break
                    f.write(trozo)
                    hecho += len(trozo)
                    ahora = time.monotonic()
                    if ahora - ultimo > 0.2:
                        _barra(etiqueta, hecho, total)
                        ultimo = ahora
                _barra(etiqueta, hecho, total)
                print()
                if total and hecho < total:
                    raise IOError(f"se cortó la descarga ({hecho} de {total} bytes)")
            os.replace(parcial, destino)
            return
        except (urllib.error.URLError, OSError, IOError) as e:
            ultimo_error = e
            print()
            aviso(f"{etiqueta}: falló el intento {intento} de {intentos} ({e})")
            time.sleep(2 * intento)
        finally:
            if parcial.exists() and not destino.exists():
                try:
                    parcial.unlink()
                except OSError:
                    pass
    raise RuntimeError(f"No se pudo bajar {etiqueta}: {ultimo_error}")


def url_de_asset(repo: str, nombre: str) -> str:
    """
    URL del asset `nombre` en la release más nueva de `repo` que lo tenga.

    No se usa `releases/latest/download/…` a secas: whisper.cpp publicó una
    "latest" sin binarios y esa URL daba 404. Misma lógica que
    `src/shared/utils/githubReleases.ts`.
    """
    try:
        releases = pedir_json(f"https://api.github.com/repos/{repo}/releases?per_page=15")
        if isinstance(releases, list):
            for r in releases:
                if not isinstance(r, dict) or r.get("draft"):
                    continue
                for a in r.get("assets") or []:
                    if a.get("name") == nombre and a.get("browser_download_url"):
                        return a["browser_download_url"]
    except Exception as e:  # noqa: BLE001
        aviso(f"no se pudo consultar la API de GitHub ({e}); se usa el enlace directo")
    return f"https://github.com/{repo}/releases/latest/download/{nombre}"


# ─── Plataforma y carpetas ───────────────────────────────────────────────────


def plataforma() -> str:
    """`win32-x64`, `linux-arm64`…: la misma clave que usa la app."""
    sistema = "win32" if ES_WINDOWS else ("darwin" if sys.platform == "darwin" else "linux")
    maquina = platform.machine().lower()
    if maquina in ("amd64", "x86_64", "x64"):
        arq = "x64"
    elif maquina in ("arm64", "aarch64"):
        arq = "arm64"
    elif maquina in ("i386", "i686", "x86"):
        arq = "ia32"
    else:
        arq = maquina
    return f"{sistema}-{arq}"


def carpeta_datos_app() -> Path:
    """La carpeta `userData` de Electron para esta app."""
    if ES_WINDOWS:
        base = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config")
    return base / APP


def ajustes_app() -> dict:
    """Los ajustes guardados por la app (electron-store), o {} si no hay."""
    archivo = carpeta_datos_app() / "church-projector-settings.json"
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        return datos.get("settings", {}) if isinstance(datos, dict) else {}
    except (OSError, ValueError):
        return {}


def carpeta_herramientas_por_defecto() -> Path:
    """
    Donde la app instala por su cuenta: la carpeta configurada en Ajustes o,
    si no hay, `userData/tools`.
    """
    configurada = ajustes_app().get("toolsFolder")
    if configurada:
        return Path(configurada)
    return carpeta_datos_app() / "tools"


def carpetas_candidatas(extra: Iterable[Path] = ()) -> list[Path]:
    """Donde la app busca, en el mismo orden (salvo las de dentro del instalador)."""
    repo = Path(__file__).resolve().parents[2]
    dirs = [*extra, carpeta_herramientas_por_defecto(), carpeta_datos_app() / "tools", repo / "tools", repo.parent / "tools"]
    vistas: list[Path] = []
    for d in dirs:
        if d not in vistas:
            vistas.append(d)
    return vistas


def buscar(nombre: str, dirs: Iterable[Path], en_path: bool = True) -> Optional[Path]:
    for d in dirs:
        p = d / (nombre + EXE)
        if p.is_file():
            return p
    if en_path:
        encontrado = shutil.which(nombre)
        if encontrado:
            return Path(encontrado)
    return None


def hacer_ejecutable(ruta: Path) -> None:
    if not ES_WINDOWS and ruta.exists():
        ruta.chmod(ruta.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def version_de(binario: Path, argumento: str = "--version", timeout: int = 20) -> Optional[str]:
    import subprocess

    try:
        r = subprocess.run(
            [str(binario), argumento], capture_output=True, text=True, timeout=timeout
        )
        salida = (r.stdout or r.stderr).strip().splitlines()
        return salida[0].strip() if salida else None
    except (OSError, subprocess.SubprocessError):
        return None


ProgresoFn = Callable[[str], None]
