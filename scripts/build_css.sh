#!/usr/bin/env bash
# scripts/build_css.sh
# Compiles and tree-shakes Tailwind CSS into a static minified bundle (app/pb_public/css/style.css)

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "⚡ Compiling static Tailwind CSS..."
npx tailwindcss -i <(echo '@tailwind base; @tailwind components; @tailwind utilities;') \
  --content "$DIR/app/pb_public/**/*.{html,js}" \
  -o "$DIR/app/pb_public/css/style.css" \
  --minify

echo "✓ Static CSS generated at app/pb_public/css/style.css ($(wc -c < "$DIR/app/pb_public/css/style.css") bytes)"
