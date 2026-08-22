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

echo "📦 Downloading binary from: $DOWNLOAD_URL"

TMP_ZIP="$(mktemp /tmp/pocketbase_XXXXXX.zip)"
curl -sL "$DOWNLOAD_URL" -o "$TMP_ZIP"

unzip -o "$TMP_ZIP" pocketbase -d "$DIR" > /dev/null
chmod +x "$DIR/pocketbase"
rm -f "$TMP_ZIP"

echo "✓ PocketBase installed successfully:"
"$DIR/pocketbase" --version

echo ""
echo "🚀 ProjectBase is ready! Run './scripts/start.sh' or 'make start' to launch on http://localhost:8120"
