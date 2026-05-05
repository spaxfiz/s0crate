#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIDECAR_BASE="$ROOT_DIR/src-tauri/binaries/socrate-backend"
HELP_ONLY=0
NO_BUNDLE=0
LAUNCHER_SIDECAR=0

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      HELP_ONLY=1
      ;;
    --no-bundle)
      NO_BUNDLE=1
      ;;
    --launcher-sidecar)
      LAUNCHER_SIDECAR=1
      ;;
  esac
done

log() { printf '==> %s\n' "$*"; }

clean_stale_dmg_state() {
  local volume="/Volumes/Socrate"
  if [ -d "$volume" ]; then
    log "Detach stale DMG volume: $volume"
    hdiutil detach "$volume" >/dev/null 2>&1 || true
  fi
  rm -f "$ROOT_DIR"/src-tauri/target/release/bundle/macos/rw.*.Socrate_*.dmg
}

target_triple() {
  rustc -vV | awk '/host:/ {print $2}'
}

write_sidecar() {
  local target="$1"
  local sidecar="${SIDECAR_BASE}-${target}"
  mkdir -p "$(dirname "$sidecar")"
  cat > "$sidecar" <<'SIDECAR'
#!/usr/bin/env bash
set -euo pipefail

export SOCRATE_HOST="${SOCRATE_HOST:-127.0.0.1}"
export SOCRATE_PORT="${SOCRATE_PORT:-8421}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

PROJECT_ROOT="${SOCRATE_PROJECT_ROOT:-}"
if [ -z "$PROJECT_ROOT" ]; then
  for candidate in \
    "$PWD" \
    "$SCRIPT_DIR/../.." \
    "$SCRIPT_DIR/../../.." \
    "$SCRIPT_DIR/../Resources" \
    "$SCRIPT_DIR/../../Resources" \
    "$SCRIPT_DIR/../Resources/resources" \
    "$SCRIPT_DIR/../../Resources/resources"; do
    if [ -f "$candidate/pyproject.toml" ] && [ -d "$candidate/backend" ]; then
      PROJECT_ROOT="$(cd "$candidate" && pwd)"
      break
    fi
  done
fi

if [ -z "$PROJECT_ROOT" ] || [ ! -f "$PROJECT_ROOT/pyproject.toml" ]; then
  echo "Error: Socrate backend project root not found. Set SOCRATE_PROJECT_ROOT." >&2
  exit 1
fi

cd "$PROJECT_ROOT"

if command -v uv >/dev/null 2>&1; then
  exec uv run uvicorn backend.main:app --host "$SOCRATE_HOST" --port "$SOCRATE_PORT"
elif command -v python3 >/dev/null 2>&1; then
  exec python3 -m uvicorn backend.main:app --host "$SOCRATE_HOST" --port "$SOCRATE_PORT"
else
  echo "Error: Neither uv nor python3 found." >&2
  exit 1
fi
SIDECAR
  chmod +x "$sidecar"
  log "Sidecar ready: ${sidecar#$ROOT_DIR/}"
}

build_binary_sidecar() {
  local target="$1"
  local sidecar="${SIDECAR_BASE}-${target}"
  mkdir -p "$(dirname "$sidecar")" "$ROOT_DIR/.build/pyinstaller"

  if [ "${SOCRATE_SKIP_SIDECAR_BUILD:-0}" = "1" ] && [ -x "$sidecar" ]; then
    log "Reuse existing self-contained sidecar: ${sidecar#$ROOT_DIR/}"
    return
  fi

  rm -f "$sidecar"

  log "Build self-contained backend sidecar with PyInstaller"
  (
    cd "$ROOT_DIR"
    uv run --with pyinstaller pyinstaller \
      --clean \
      --noconfirm \
      --onefile \
      --name "socrate-backend-${target}" \
      --distpath "$ROOT_DIR/src-tauri/binaries" \
      --workpath "$ROOT_DIR/.build/pyinstaller/work" \
      --specpath "$ROOT_DIR/.build/pyinstaller/spec" \
      --collect-all litellm \
      --collect-all tiktoken \
      --collect-submodules backend \
      --collect-submodules tiktoken_ext \
      --hidden-import tiktoken_ext.openai_public \
      --hidden-import uvicorn.loops.auto \
      --hidden-import uvicorn.protocols.http.auto \
      --hidden-import uvicorn.protocols.websockets.auto \
      --hidden-import uvicorn.lifespan.on \
      backend/sidecar.py
  )

  chmod +x "$sidecar"
  log "Self-contained sidecar ready: ${sidecar#$ROOT_DIR/}"
}

log "Bootstrap Tauri dependencies"
bash "$ROOT_DIR/scripts/bootstrap.sh" --tauri

export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v rustc >/dev/null 2>&1; then
  echo "Missing dependency: rustc" >&2
  echo "Rust was installed or checked by bootstrap, but rustc is still not on PATH." >&2
  echo "Try: export PATH=\"\$HOME/.cargo/bin:\$PATH\"" >&2
  exit 1
fi

TARGET_TRIPLE="$(target_triple)"
if [ "$LAUNCHER_SIDECAR" = "1" ]; then
  write_sidecar "$TARGET_TRIPLE"
else
  build_binary_sidecar "$TARGET_TRIPLE"
fi

log "Build Tauri desktop binary"
cd "$ROOT_DIR"
if [ "$NO_BUNDLE" = "0" ]; then
  clean_stale_dmg_state
fi
declare -a TAURI_ARGS=()
for arg in "$@"; do
  if [ "$arg" != "--launcher-sidecar" ]; then
    TAURI_ARGS+=("$arg")
  fi
done
if [ "${#TAURI_ARGS[@]}" -gt 0 ]; then
  npx tauri build "${TAURI_ARGS[@]}"
else
  npx tauri build
fi

if [ "$HELP_ONLY" = "1" ]; then
  exit 0
fi

log "Tauri build output"
find "$ROOT_DIR/src-tauri/target/release" -maxdepth 1 -type f -perm -111 2>/dev/null | sort || true
if [ "$NO_BUNDLE" = "0" ]; then
  find "$ROOT_DIR/src-tauri/target/release/bundle" -maxdepth 3 -type f 2>/dev/null | sort || true
fi
