#!/usr/bin/env bash
set -e

PB_VERSION="0.39.11"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "⚡ Installing PocketBase v${PB_VERSION} for ProjectBase..."

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64|amd64)
    ARCH_SUFFIX="amd64"
    ;;
  aarch64|arm64)
    ARCH_SUFFIX="arm64"
    ;;
  armv7*|armhf)
    ARCH_SUFFIX="armv7"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

case "$OS" in
  linux)
    OS_SUFFIX="linux"
    ;;
  darwin)
    OS_SUFFIX="darwin"
    ;;
  *)
    echo "Unsupported operating system: $OS"
    exit 1
    ;;
esac

DOWNLOAD_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${OS_SUFFIX}_${ARCH_SUFFIX}.zip"

case "${OS_SUFFIX}_${ARCH_SUFFIX}" in
  linux_amd64)  PB_SHA256="08b9fcda0d5fd42cb315dc15a36dfa121c993855bd635f01d347c31b4328ec34" ;;
  linux_arm64)  PB_SHA256="8c785618840df7ebba795fdf4eba33a5fed64ac5307ad8023b955b4ebb82048b" ;;
  linux_armv7)  PB_SHA256="ba5cde96576716ea8ecf96a11b53a4e0c376f24d93cd48e70aaee54f620ddc5e" ;;
  darwin_amd64) PB_SHA256="888892fe5fe64cea4a1441937671e191b32ed8f322fa09d3d7b3ca2fc1d7be29" ;;
  darwin_arm64) PB_SHA256="9da6fbe11e82c5b1704e56f7457b24682e01c510206c29b798a458119fa2be20" ;;
  *)
    echo "No trusted checksum for ${OS_SUFFIX}_${ARCH_SUFFIX}"
    exit 1
    ;;
esac

echo "📦 Downloading binary from: $DOWNLOAD_URL"

TMP_ZIP="$(mktemp "${TMPDIR:-/tmp}/pocketbase_XXXXXX.zip")"
trap 'rm -f "$TMP_ZIP"' EXIT
curl --fail --silent --show-error --location "$DOWNLOAD_URL" -o "$TMP_ZIP"
if command -v sha256sum >/dev/null 2>&1; then
  echo "${PB_SHA256}  ${TMP_ZIP}" | sha256sum -c -
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(shasum -a 256 "$TMP_ZIP" | awk '{print $1}')"
  [ "$ACTUAL_SHA256" = "$PB_SHA256" ] || {
    echo "PocketBase checksum verification failed"
    exit 1
  }
else
  echo "A SHA-256 utility (sha256sum or shasum) is required"
  exit 1
fi

unzip -o "$TMP_ZIP" pocketbase -d "$DIR" > /dev/null
chmod +x "$DIR/pocketbase"
rm -f "$TMP_ZIP"
trap - EXIT

echo "✓ PocketBase installed successfully:"
"$DIR/pocketbase" --version

echo ""
echo "🚀 ProjectBase is ready! Run './scripts/start.sh' or 'make start' to launch on http://localhost:8120"
