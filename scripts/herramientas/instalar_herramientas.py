#!/usr/bin/env python3
"""
Instala, actualiza o revisa las herramientas externas de Church Projector.

    yt-dlp   baja los videos de YouTube
    ffmpeg   junta video y audio, arma los MP3 (incluye ffprobe)
    deno     intérprete de JavaScript que YouTube exige para entregar los videos
    whisper  transcripción local para la sección Escucha (+ el modelo)

Funciona en Windows y en Linux (x64 y arm64) sólo con Python 3.8+, sin pip.
Lo instala en la misma carpeta donde la app busca, así que la app lo encuentra
sola. Ejemplos:

    python instalar_herramientas.py                 # todo lo que falte
    python instalar_herramientas.py --estado        # sólo mirar qué hay
    python instalar_herramientas.py --actualizar    # yt-dlp y whisper a la última
    python instalar_herramientas.py --modelo small-q5_1
    python instalar_herramientas.py --solo whisper --compilar-whisper   # Linux sin paquete
    python instalar_herramientas.py --dir D:\\herramientas

Todo lo que se baja viene de los repositorios oficiales de cada proyecto en
GitHub y Hugging Face.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import (  # noqa: E402
    EXE,
    ES_WINDOWS,
    aviso,
    buscar,
    carpeta_herramientas_por_defecto,
    carpetas_candidatas,
    descargar,
    error,
    forzar_ipv4,
    hacer_ejecutable,
    ok,
    plataforma,
    tenue,
    titulo,
    url_de_asset,
    version_de,
)

# Los mismos nombres que la app (src/shared/utils/downloads.ts y whisper.ts).
YTDLP = {
    "win32-x64": "yt-dlp.exe",
    "win32-arm64": "yt-dlp_arm64.exe",
    "win32-ia32": "yt-dlp_x86.exe",
    "linux-x64": "yt-dlp_linux",
    "linux-arm64": "yt-dlp_linux_aarch64",
    "darwin-x64": "yt-dlp_macos",
    "darwin-arm64": "yt-dlp_macos",
}
FFMPEG = {
    "win32-x64": "ffmpeg-master-latest-win64-gpl.zip",
    "win32-arm64": "ffmpeg-master-latest-winarm64-gpl.zip",
    "linux-x64": "ffmpeg-master-latest-linux64-gpl.tar.xz",
    "linux-arm64": "ffmpeg-master-latest-linuxarm64-gpl.tar.xz",
}
FFMPEG_BASE = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/"
DENO = {
    "win32-x64": "deno-x86_64-pc-windows-msvc.zip",
    "win32-arm64": "deno-aarch64-pc-windows-msvc.zip",
    "linux-x64": "deno-x86_64-unknown-linux-gnu.zip",
    "linux-arm64": "deno-aarch64-unknown-linux-gnu.zip",
    "darwin-x64": "deno-x86_64-apple-darwin.zip",
    "darwin-arm64": "deno-aarch64-apple-darwin.zip",
}
WHISPER = {
    "win32-x64": "whisper-bin-x64.zip",
    "win32-arm64": "whisper-bin-win-cpu-arm64.zip",
    "linux-x64": "whisper-bin-ubuntu-x64.tar.gz",
    "linux-arm64": "whisper-bin-ubuntu-arm64.tar.gz",
}
MODELOS = {
    "tiny": ("ggml-tiny.bin", 75),
    "base": ("ggml-base.bin", 148),
    "small-q5_1": ("ggml-small-q5_1.bin", 190),
    "small": ("ggml-small.bin", 488),
    "medium-q5_0": ("ggml-medium-q5_0.bin", 539),
    "large-v3-turbo-q5_0": ("ggml-large-v3-turbo-q5_0.bin", 574),
}
MODELO_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"

COMPONENTES = ("yt-dlp", "ffmpeg", "deno", "whisper")


# ─── Descompresión ───────────────────────────────────────────────────────────


def extraer(paquete: Path, destino: Path) -> None:
    """
    Zip con zipfile, tar con tarfile (soporta .xz). zipfile no conserva los
    permisos de ejecución: se restauran después, en `hacer_ejecutable`.
    tarfile sí los conserva, junto con los enlaces simbólicos de las
    bibliotecas de whisper en Linux (libwhisper.so -> libwhisper.so.1).
    """
    destino.mkdir(parents=True, exist_ok=True)
    nombre = paquete.name.lower()
    if nombre.endswith(".zip"):
        with zipfile.ZipFile(paquete) as z:
            z.extractall(destino)
    elif nombre.endswith((".tar.gz", ".tgz", ".tar.xz")):
        with tarfile.open(paquete) as t:
            # Python 3.12+ pide declarar el filtro; en versiones viejas no existe.
            if hasattr(tarfile, "data_filter"):
                t.extractall(destino, filter="tar")
            else:
                t.extractall(destino)
    else:
        raise RuntimeError(f"No sé descomprimir {paquete.name}")


def buscar_dentro(carpeta: Path, nombre: str) -> Optional[Path]:
    for p in carpeta.rglob(nombre):
        if p.is_file():
            return p
    return None


# ─── Instaladores ────────────────────────────────────────────────────────────


def instalar_ytdlp(dir_: Path, plat: str) -> None:
    asset = YTDLP.get(plat)
    if not asset:
        raise RuntimeError(f"yt-dlp no publica un ejecutable para {plat}")
    destino = dir_ / ("yt-dlp" + EXE)
    descargar(url_de_asset("yt-dlp/yt-dlp", asset), destino, "yt-dlp")
    hacer_ejecutable(destino)
    ok(f"yt-dlp {version_de(destino) or ''} en {destino}")


def instalar_ffmpeg(dir_: Path, plat: str) -> None:
    asset = FFMPEG.get(plat)
    if not asset:
        raise RuntimeError(
            f"No hay un ffmpeg estático para {plat}. Instalalo con el gestor de paquetes "
            "(apt install ffmpeg / dnf install ffmpeg)."
        )
    with tempfile.TemporaryDirectory(prefix="church-ffmpeg-", dir=dir_) as tmp:
        paquete = Path(tmp) / asset
        descargar(FFMPEG_BASE + asset, paquete, "ffmpeg")
        print(tenue("  descomprimiendo…"))
        extraer(paquete, Path(tmp) / "x")
        for nombre in ("ffmpeg", "ffprobe"):
            origen = buscar_dentro(Path(tmp) / "x", nombre + EXE)
            if not origen:
                raise RuntimeError(f"el paquete de ffmpeg no traía {nombre}{EXE}")
            destino = dir_ / (nombre + EXE)
            shutil.move(str(origen), destino)
            hacer_ejecutable(destino)
    ok(f"ffmpeg y ffprobe en {dir_}")


def instalar_deno(dir_: Path, plat: str) -> None:
    asset = DENO.get(plat)
    if not asset:
        raise RuntimeError(f"deno no publica un ejecutable para {plat}")
    with tempfile.TemporaryDirectory(prefix="church-deno-", dir=dir_) as tmp:
        paquete = Path(tmp) / asset
        descargar(url_de_asset("denoland/deno", asset), paquete, "deno")
        extraer(paquete, Path(tmp) / "x")
        origen = buscar_dentro(Path(tmp) / "x", "deno" + EXE)
        if not origen:
            raise RuntimeError("el paquete de deno no traía el ejecutable")
        destino = dir_ / ("deno" + EXE)
        shutil.move(str(origen), destino)
        hacer_ejecutable(destino)
    ok(f"deno {version_de(destino) or ''} en {destino}")


def instalar_whisper_binario(dir_: Path, plat: str) -> None:
    asset = WHISPER.get(plat)
    if not asset:
        raise RuntimeError(
            f"whisper.cpp no publica binarios para {plat}. Usá --compilar-whisper."
        )
    carpeta = dir_ / "whisper"
    carpeta.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="church-whisper-", dir=dir_) as tmp:
        paquete = Path(tmp) / asset
        descargar(url_de_asset("ggml-org/whisper.cpp", asset), paquete, "whisper")
        print(tenue("  descomprimiendo…"))
        extraer(paquete, Path(tmp) / "x")
        exe = buscar_dentro(Path(tmp) / "x", "whisper-cli" + EXE) or buscar_dentro(
            Path(tmp) / "x", "main" + EXE
        )
        if not exe:
            raise RuntimeError("el paquete de whisper no traía el ejecutable")
        # Se sube la carpeta entera del ejecutable: las bibliotecas que
        # necesita (DLL o .so) están ahí al lado.
        for item in exe.parent.iterdir():
            destino = carpeta / item.name
            if destino.is_dir() and not destino.is_symlink():
                shutil.rmtree(destino)
            elif destino.exists() or destino.is_symlink():
                destino.unlink()
            shutil.move(str(item), destino)
    for nombre in ("whisper-cli", "whisper-server", "main", "server"):
        hacer_ejecutable(carpeta / (nombre + EXE))
    ok(f"whisper en {carpeta}")


def compilar_whisper(dir_: Path) -> None:
    """
    Compila whisper.cpp desde el código fuente, para plataformas sin paquete
    oficial. Necesita git, cmake y un compilador de C++ (en Debian/Ubuntu:
    `sudo apt install git cmake build-essential`).

    Se compila estático (sin .so aparte) y optimizado para el procesador de
    esta máquina: el binario no sirve para copiarlo a otra PC, pero es el más
    rápido acá.
    """
    for herramienta in ("git", "cmake"):
        if not shutil.which(herramienta):
            raise RuntimeError(
                f"Falta {herramienta}. En Debian/Ubuntu: sudo apt install git cmake build-essential"
            )
    carpeta = dir_ / "whisper"
    carpeta.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="church-whisper-src-") as tmp:
        fuente = Path(tmp) / "whisper.cpp"
        print(tenue("  clonando whisper.cpp…"))
        subprocess.run(
            ["git", "clone", "--depth", "1", "https://github.com/ggml-org/whisper.cpp", str(fuente)],
            check=True,
        )
        build = fuente / "build"
        print(tenue("  configurando…"))
        subprocess.run(
            [
                "cmake", "-S", str(fuente), "-B", str(build),
                "-DCMAKE_BUILD_TYPE=Release",
                "-DBUILD_SHARED_LIBS=OFF",
                "-DGGML_NATIVE=ON",
                "-DWHISPER_BUILD_EXAMPLES=ON",
                "-DWHISPER_BUILD_TESTS=OFF",
            ],
            check=True,
        )
        print(tenue("  compilando (puede tardar varios minutos)…"))
        subprocess.run(
            ["cmake", "--build", str(build), "--config", "Release", "-j",
             "--target", "whisper-cli", "whisper-server"],
            check=True,
        )
        for nombre in ("whisper-cli", "whisper-server"):
            origen = buscar_dentro(build, nombre + EXE)
            if not origen:
                raise RuntimeError(f"la compilación no produjo {nombre}")
            destino = carpeta / (nombre + EXE)
            shutil.copy2(origen, destino)
            hacer_ejecutable(destino)
    ok(f"whisper compilado en {carpeta}")


def instalar_modelo(dir_: Path, modelo: str) -> None:
    archivo, mb = MODELOS[modelo]
    destino = dir_ / "whisper" / "modelos" / archivo
    if destino.exists():
        ok(f"modelo {modelo} ya estaba ({destino})")
        return
    print(tenue(f"  modelo {modelo}: {mb} MB"))
    descargar(MODELO_URL + archivo, destino, f"modelo {modelo}")
    ok(f"modelo {modelo} en {destino}")


# ─── Estado ──────────────────────────────────────────────────────────────────


def estado(dirs: list[Path]) -> dict[str, Optional[Path]]:
    encontrado = {
        "yt-dlp": buscar("yt-dlp", dirs),
        "ffmpeg": buscar("ffmpeg", dirs),
        "javascript": buscar("deno", dirs) or buscar("node", dirs) or buscar("bun", dirs),
        "whisper-cli": buscar("whisper-cli", [d / "whisper" for d in dirs], en_path=True),
        "whisper-server": buscar("whisper-server", [d / "whisper" for d in dirs], en_path=True),
    }
    return encontrado


def mostrar_estado(dirs: list[Path]) -> None:
    titulo("Herramientas encontradas")
    e = estado(dirs)
    for nombre, ruta in e.items():
        if ruta:
            version = version_de(ruta) if nombre in ("yt-dlp", "ffmpeg", "javascript") else None
            ok(f"{nombre:<15} {ruta}" + (f"  {tenue(version)}" if version else ""))
        else:
            aviso(f"{nombre:<15} no está")
    modelos = []
    for d in dirs:
        carpeta = d / "whisper" / "modelos"
        if carpeta.is_dir():
            modelos += [f"{m.name} ({m.stat().st_size // 1_000_000} MB)" for m in carpeta.glob("ggml-*.bin")]
    if modelos:
        ok("modelos de whisper: " + ", ".join(sorted(set(modelos))))
    else:
        aviso("ningún modelo de whisper")
    print(tenue("\n  Se buscó en: " + "; ".join(str(d) for d in dirs) + "; y en el PATH"))


# ─── Programa ────────────────────────────────────────────────────────────────


def main() -> int:
    p = argparse.ArgumentParser(
        description="Instala las herramientas externas de Church Projector (Windows y Linux).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--dir", type=Path, help="carpeta de herramientas (por defecto, la de la app)")
    p.add_argument("--estado", action="store_true", help="sólo mostrar qué hay instalado")
    p.add_argument("--solo", nargs="+", choices=COMPONENTES, help="instalar sólo estos componentes")
    p.add_argument("--actualizar", action="store_true", help="volver a bajar yt-dlp y whisper aunque estén")
    p.add_argument("--forzar", action="store_true", help="reinstalar todo aunque ya esté")
    p.add_argument("--modelo", choices=list(MODELOS), default="base", help="modelo de whisper (default: base)")
    p.add_argument("--compilar-whisper", action="store_true", help="compilar whisper desde el código fuente")
    p.add_argument("--ipv6", action="store_true", help="permitir IPv6 (por defecto sólo IPv4, ver comun.py)")
    args = p.parse_args()

    if not args.ipv6:
        forzar_ipv4()

    plat = plataforma()
    dir_ = (args.dir or carpeta_herramientas_por_defecto()).expanduser().resolve()
    dirs = carpetas_candidatas([dir_])

    print(f"Church Projector · herramientas · {plat}")
    print(tenue(f"Carpeta de instalación: {dir_}"))

    if args.estado:
        mostrar_estado(dirs)
        return 0

    dir_.mkdir(parents=True, exist_ok=True)
    quiero = set(args.solo or COMPONENTES)
    actual = estado(dirs)
    fallas: list[str] = []

    def paso(nombre: str, falta: bool, instalar) -> None:  # type: ignore[no-untyped-def]
        if nombre not in quiero:
            return
        titulo(nombre)
        if not falta and not args.forzar:
            ok("ya está instalado")
            return
        try:
            instalar()
        except Exception as e:  # noqa: BLE001
            error(str(e))
            fallas.append(nombre)

    paso("yt-dlp", actual["yt-dlp"] is None or args.actualizar, lambda: instalar_ytdlp(dir_, plat))
    paso("ffmpeg", actual["ffmpeg"] is None, lambda: instalar_ffmpeg(dir_, plat))
    # Sólo hace falta un intérprete: si ya hay node o bun, deno no se baja.
    paso("deno", actual["javascript"] is None, lambda: instalar_deno(dir_, plat))

    if "whisper" in quiero:
        titulo("whisper")
        falta_bin = actual["whisper-cli"] is None or actual["whisper-server"] is None
        try:
            if args.compilar_whisper:
                compilar_whisper(dir_)
            elif falta_bin or args.actualizar or args.forzar:
                if plat in WHISPER:
                    instalar_whisper_binario(dir_, plat)
                else:
                    aviso(f"no hay paquete para {plat}: se compila desde el código fuente")
                    compilar_whisper(dir_)
            else:
                ok("programa ya instalado")
            instalar_modelo(dir_, args.modelo)
        except Exception as e:  # noqa: BLE001
            error(str(e))
            fallas.append("whisper")

    mostrar_estado(dirs)
    if fallas:
        error("No se pudo instalar: " + ", ".join(fallas))
        return 1
    print()
    ok("Listo. Abrí (o reabrí) la app: encuentra las herramientas sola.")
    if args.dir and args.dir.resolve() != carpeta_herramientas_por_defecto().resolve():
        aviso(f"Instalaste en una carpeta propia: configurala en la app, Ajustes → Herramientas ({dir_}).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        error("Cancelado.")
        sys.exit(130)
