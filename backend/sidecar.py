from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn


def _app_data_dir() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Socrate"
    if sys.platform == "win32":
        base = os.environ.get("APPDATA")
        if base:
            return Path(base) / "Socrate"
    base = os.environ.get("XDG_DATA_HOME")
    if base:
        return Path(base) / "socrate"
    return Path.home() / ".local" / "share" / "socrate"


def _configure_packaged_runtime() -> None:
    data_dir = _app_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)

    env_path = data_dir / ".env"
    if not env_path.exists():
        env_path.write_text(
            "\n".join(
                [
                    "SOCRATE_HOST=127.0.0.1",
                    "SOCRATE_PORT=8421",
                    f"SOCRATE_OUTPUT_DIR={data_dir / 'learning-output'}",
                    f"SOCRATE_LOG_DIR={data_dir / 'logs'}",
                    "SOCRATE_LOG_LEVEL=INFO",
                    "",
                ],
            ),
            encoding="utf-8",
        )
        env_path.chmod(0o600)

    os.environ.setdefault("SOCRATE_ENV_PATH", str(env_path))
    os.environ.setdefault("SOCRATE_OUTPUT_DIR", str(data_dir / "learning-output"))
    os.environ.setdefault("SOCRATE_LOG_DIR", str(data_dir / "logs"))


def main() -> None:
    _configure_packaged_runtime()
    host = os.environ.get("SOCRATE_HOST", "127.0.0.1")
    port = int(os.environ.get("SOCRATE_PORT", "8421"))
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
