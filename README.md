# Socrate

Socrate is an AI-guided desktop learning app built with React, Tauri, and a FastAPI backend.

## Development

Install dependencies, then run both backend and frontend:

```bash
uv sync
npm install
cd src && npm install
bash scripts/dev.sh
```

Open `http://localhost:1420`.

## AI Settings

Runtime settings are stored in `backend/.env` and are not meant to be committed with real secrets.

Supported keys:

```bash
SOCRATE_DEFAULT_MODEL=deepseek/deepseek-chat
SOCRATE_API_KEYS='{"deepseek":"sk-...","openai":"sk-..."}'
```

The settings API and settings modal write to the same file. API keys are returned to the frontend only as boolean configured/unconfigured flags.

Token/context settings default to a 1M context window and compress model-visible history once estimated context reaches 80% of that window:

```bash
SOCRATE_CONTEXT_WINDOW_TOKENS=1000000
SOCRATE_COMPRESSION_THRESHOLD_RATIO=0.8
SOCRATE_COMPRESSION_RECENT_MESSAGES=12
SOCRATE_COMPRESSION_MAX_TOKENS=262144
SOCRATE_QUESTIONING_MAX_TOKENS=32768
SOCRATE_SYLLABUS_MAX_TOKENS=262144
SOCRATE_REVIEW_MAX_TOKENS=65536
SOCRATE_DEEP_DIVE_MAX_TOKENS=131072
SOCRATE_SUMMARY_MAX_TOKENS=262144
```

Compression keeps the full visible chat history in `session.json`; only the context sent back to the model is replaced by a caveman-style compressed summary plus recent messages.

## Logs

Backend logs are written to `logs/socrate.log` and also printed to stdout/stderr. The file rotates automatically.

Optional `.env` settings:

```bash
SOCRATE_LOG_LEVEL=INFO
SOCRATE_LOG_DIR=logs
SOCRATE_LOG_MAX_BYTES=2000000
SOCRATE_LOG_BACKUP_COUNT=5
```

Useful debugging commands:

```bash
tail -f logs/socrate.log
rg "sse error|load failed|syllabus generation failed|deep dive without node" logs/socrate.log
rg "context compression" logs/socrate.log
```

## Desktop

Development desktop run:

```bash
npm run tauri:dev
```

The debug build starts the backend with `uv run uvicorn backend.main:app --host 127.0.0.1 --port 8421`.

Production builds use the configured Tauri sidecar `binaries/socrate-backend`. The current sidecar is a launcher script that locates the bundled backend resources and requires `uv` or a Python environment with the backend dependencies available. A later packaging pass should replace it with a self-contained executable if distributing to machines without Python tooling.
