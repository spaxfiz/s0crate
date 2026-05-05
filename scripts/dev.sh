#!/usr/bin/env bash
# Socrate development mode: installs/checks deps, then starts backend + frontend.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/bootstrap.sh"

echo "Starting Socrate dev environment..."
echo ""

# Start Python backend in background
echo "Starting backend on :8421..."
cd "$ROOT_DIR"
uv run uvicorn backend.main:app --reload --reload-exclude 'src-tauri/target/*' --port 8421 &
BACKEND_PID=$!

# Start Vite frontend
echo "Starting frontend on :1420..."
cd src
npm run dev &
FRONTEND_PID=$!

# Trap to clean up on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo ""
echo "  Backend:  http://localhost:8421"
echo "  Frontend: http://localhost:1420"
echo ""
echo "Press Ctrl+C to stop."

wait
