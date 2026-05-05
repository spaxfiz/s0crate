#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_RUST=0

for arg in "$@"; do
  case "$arg" in
    --tauri|--rust)
      WITH_RUST=1
      ;;
    --help|-h)
      cat <<'HELP'
Usage: bash scripts/bootstrap.sh [--tauri]

Installs/checks local development dependencies:
  - uv and Python dependencies
  - root npm dependencies
  - desktop frontend npm dependencies
  - H5 npm dependencies
  - Rust toolchain when --tauri is passed
HELP
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

log() { printf '==> %s\n' "$*"; }

append_path() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

install_uv() {
  if command -v uv >/dev/null 2>&1; then
    return
  fi
  log "Install uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  append_path "$HOME/.local/bin"
  if ! command -v uv >/dev/null 2>&1; then
    echo "uv install finished, but uv is not on PATH. Add ~/.local/bin to PATH." >&2
    exit 1
  fi
}

install_rust() {
  append_path "$HOME/.cargo/bin"
  if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1; then
    return
  fi
  log "Install Rust toolchain"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  append_path "$HOME/.cargo/bin"
  if ! command -v cargo >/dev/null 2>&1; then
    echo "Rust install finished, but cargo is not on PATH. Add ~/.cargo/bin to PATH." >&2
    exit 1
  fi
}

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    local rerun="bash scripts/bootstrap.sh"
    if [ "$WITH_RUST" = "1" ]; then
      rerun="$rerun --tauri"
    fi
    echo "Missing dependency: $1" >&2
    echo "Install it, then rerun: $rerun" >&2
    exit 1
  fi
}

npm_install_if_needed() {
  local dir="$1"
  local label="$2"
  if [ ! -f "$dir/package.json" ]; then
    return
  fi
  if [ "${SOCRATE_SKIP_NPM_INSTALL:-0}" = "1" ]; then
    log "Skip npm install for $label"
    return
  fi
  if [ ! -d "$dir/node_modules" ] || [ ! -f "$dir/node_modules/.package-lock.json" ]; then
    log "Install npm dependencies for $label"
    (cd "$dir" && npm install)
  else
    log "npm dependencies present for $label"
  fi
}

install_uv
ensure_command node
ensure_command npm

if [ "$WITH_RUST" = "1" ]; then
  install_rust
  if [ "$(uname -s)" = "Darwin" ] && ! xcode-select -p >/dev/null 2>&1; then
    log "Install Xcode Command Line Tools"
    xcode-select --install || true
    echo "Finish Xcode Command Line Tools install, then rerun this script." >&2
    exit 1
  fi
fi

log "Install Python dependencies"
(cd "$ROOT_DIR" && uv sync)

npm_install_if_needed "$ROOT_DIR" "root"
npm_install_if_needed "$ROOT_DIR/src" "desktop frontend"
npm_install_if_needed "$ROOT_DIR/h5" "H5 frontend"

if [ "$WITH_RUST" = "1" ]; then
  log "Rust host: $(rustc -vV | awk '/host:/ {print $2}')"
fi

log "Bootstrap complete"
