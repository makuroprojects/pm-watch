#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist"
ARCH="${ARCH:-arm64}"

mkdir -p "$OUT"
rm -f "$OUT/pmw" "$OUT/pmw-darwin-$ARCH"

echo "→ Compiling pmw (darwin-$ARCH)"
bun build --compile \
  --target="bun-darwin-$ARCH" \
  "$ROOT/src/agent.ts" \
  --outfile "$OUT/pmw"

chmod +x "$OUT/pmw"

# Rename with arch suffix for release artifact; keep local 'pmw' symlink.
cp "$OUT/pmw" "$OUT/pmw-darwin-$ARCH"

echo "✓ Built:"
ls -lh "$OUT"
