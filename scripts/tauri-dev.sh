#!/bin/bash
# Launch Tauri dev mode with proper PATH for Rust toolchain
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
npx tauri dev
