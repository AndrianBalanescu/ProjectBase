#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@projectbase.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-projectbase123456}"
PORT="${PROJECTBASE_PORT:-8120}"

echo "⚡ Bootstrapping ProjectBase..."

# 1. Download binary if not present
if [ ! -f "$DIR/pocketbase" ]; then
    echo "📦 Downloading PocketBase binary..."
    "$DIR/scripts/install.sh"
fi

# 2. Setup Superuser
echo "🔑 Ensuring superuser account ($ADMIN_EMAIL)..."
"$DIR/pocketbase" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --dir "$DIR/pb_data" > /dev/null 2>&1 || true

echo "✓ Superuser ready:"
echo "   Email:    $ADMIN_EMAIL"
echo "   Password: $ADMIN_PASSWORD"

echo ""
echo "🚀 Bootstrap complete! Launching ProjectBase on port $PORT..."
exec "$DIR/scripts/start.sh"
