#!/usr/bin/env bash
# Launch Tauri dev mode after dependency checks.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/bootstrap.sh" --tauri

cd "$ROOT_DIR"
export PATH="$HOME/.cargo/bin:$PATH"
npx tauri dev
