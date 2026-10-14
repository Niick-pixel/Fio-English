#!/bin/bash
# Instalador de English Coach para macOS.
# Uso (en Terminal):
#   curl -fsSL https://raw.githubusercontent.com/Niick-pixel/Fio-English/main/install.sh | bash
#
# Descarga la última versión publicada, la copia a Aplicaciones y la abre.
# Como el archivo se descarga con curl (no con el navegador), macOS no le pone la marca de
# "descargado de internet" y la app abre sin el aviso de "no se puede verificar".
# Tu progreso no se toca: vive en ~/Library/Application Support/English Coach.
set -euo pipefail

REPO="Niick-pixel/Fio-English"
APP="English Coach.app"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Este instalador es solo para macOS." >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) ARCH="arm64"; CHIP="Apple Silicon" ;;
  *)     ARCH="x64";   CHIP="Intel" ;;
esac
echo "→ Tu Mac es $CHIP ($ARCH)."

echo "→ Buscando la última versión…"
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o "\"browser_download_url\": *\"[^\"]*-$ARCH\.zip\"" \
  | head -1 | sed -E 's/.*"(https[^"]+)"/\1/')
if [ -z "$URL" ]; then
  echo "No encontré un instalador para $ARCH en https://github.com/$REPO/releases" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "→ Descargando $(basename "$URL")…"
curl -fL --progress-bar "$URL" -o "$TMP/app.zip"
ditto -x -k "$TMP/app.zip" "$TMP/unzipped"

# /Applications si tenés permiso; si no, la carpeta Aplicaciones de tu usuario.
DEST="/Applications"
if [ ! -w "$DEST" ]; then
  DEST="$HOME/Applications"
  mkdir -p "$DEST"
fi

osascript -e 'quit app "English Coach"' >/dev/null 2>&1 || true
sleep 1
rm -rf "$DEST/$APP"
ditto "$TMP/unzipped/$APP" "$DEST/$APP"
xattr -dr com.apple.quarantine "$DEST/$APP" 2>/dev/null || true

echo "✓ English Coach instalada en $DEST"
open "$DEST/$APP"
