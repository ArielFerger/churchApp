#!/usr/bin/env sh
# Instala o revisa las herramientas de Church Projector (Linux).
#   ./herramientas.sh            instala lo que falte
#   ./herramientas.sh --estado   sólo muestra qué hay
# Acepta los mismos argumentos que instalar_herramientas.py.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$AQUI/instalar_herramientas.py" "$@"
elif command -v python >/dev/null 2>&1; then
  exec python "$AQUI/instalar_herramientas.py" "$@"
fi

echo "No se encontró Python 3. Instalalo con el gestor de paquetes:" >&2
echo "  Debian/Ubuntu:  sudo apt install python3" >&2
echo "  Fedora:         sudo dnf install python3" >&2
exit 1
