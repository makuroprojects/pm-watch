#!/usr/bin/env bash
# pm-watch per-user installer.
# Downloads pmw binary to ~/.local/bin and ensures it's on PATH.
#
# Usage:
#   curl -fsSL https://example.com/install.sh | bash
#   curl -fsSL https://example.com/install.sh | bash -s -- --version v0.1.0
#   RELEASE_URL=file:///path/to/pmw bash install.sh   # for local testing

set -euo pipefail

REPO="${PMW_REPO:-makuroprojects/pm-watch}"
VERSION="latest"
BIN_DIR="$HOME/.local/bin"
BIN="$BIN_DIR/pmw"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

OS="$(uname -s)"
ARCH_RAW="$(uname -m)"
if [[ "$OS" != "Darwin" ]]; then
  echo "✗ pm-watch currently supports macOS only. Detected: $OS" >&2
  exit 1
fi
case "$ARCH_RAW" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) echo "✗ Unsupported arch: $ARCH_RAW" >&2; exit 1 ;;
esac

if [[ -n "${RELEASE_URL:-}" ]]; then
  URL="$RELEASE_URL"
else
  if [[ "$VERSION" == "latest" ]]; then
    # Query the releases API so that prereleases are also discoverable.
    VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases" \
      | grep -m1 '"tag_name"' \
      | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
    if [[ -z "$VERSION" ]]; then
      echo "✗ Failed to resolve latest release for $REPO" >&2
      exit 1
    fi
    echo "→ Resolved latest: $VERSION"
  fi
  URL="https://github.com/$REPO/releases/download/$VERSION/pmw-darwin-$ARCH"
fi

mkdir -p "$BIN_DIR"

echo "→ Downloading $URL"
if ! curl -fsSL "$URL" -o "$BIN.tmp"; then
  echo "✗ Download failed" >&2
  exit 1
fi
mv "$BIN.tmp" "$BIN"
chmod +x "$BIN"
xattr -cr "$BIN" 2>/dev/null || true

# Ensure PATH
SHELL_NAME="$(basename "${SHELL:-}")"
case "$SHELL_NAME" in
  zsh)  RC="$HOME/.zshrc" ;;
  bash) RC="$HOME/.bashrc" ;;
  *)    RC="$HOME/.profile" ;;
esac

if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
  if [[ -w "$(dirname "$RC")" ]]; then
    if ! grep -q '.local/bin' "$RC" 2>/dev/null; then
      echo '' >> "$RC"
      echo '# Added by pm-watch installer' >> "$RC"
      echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$RC"
      echo "✓ Added $BIN_DIR to PATH in $RC"
      echo "  → open a new terminal or run: source $RC"
    fi
  fi
fi

echo ""
echo "✓ pmw installed at $BIN"
"$BIN" --help | head -n 3
echo ""
echo "Next: pmw init"
