from __future__ import annotations

import json
import os
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = Path(os.environ.get("SOCRATE_ENV_PATH", BACKEND_DIR / ".env"))


class Settings(BaseSettings):
    default_model: str = "deepseek/deepseek-v4-pro"
    fast_model: str = ""
    pro_model: str = ""
    api_keys: dict[str, str] = Field(default_factory=dict)

    host: str = "127.0.0.1"
    port: int = 8421

    output_dir: Path = Path("learning-output")
    log_dir: Path = Path("logs")
    log_level: str = "INFO"
    log_max_bytes: int = 2_000_000
    log_backup_count: int = 5

    context_window_tokens: int = 1_000_000
    compression_threshold_ratio: float = 0.8
    compression_recent_messages: int = 12
    compression_max_tokens: int = 262_144

    questioning_max_tokens: int = 32_768
    syllabus_max_tokens: int = 262_144
    review_max_tokens: int = 65_536
    deep_dive_max_tokens: int = 131_072
    summary_max_tokens: int = 262_144

    cors_origins: list[str] = [
        "http://localhost:1420",
        "http://localhost:1421",
        "http://localhost:5173",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ]

    model_config = SettingsConfigDict(env_prefix="SOCRATE_", env_file=ENV_PATH, extra="ignore")

    @field_validator("api_keys", mode="before")
    @classmethod
    def parse_api_keys(cls, value: Any) -> dict[str, str]:
        if value in (None, ""):
            return {}
        if isinstance(value, dict):
            return {str(k): str(v) for k, v in value.items() if v}
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return {}
            if isinstance(parsed, dict):
                return {str(k): str(v) for k, v in parsed.items() if v}
        return {}


def save_settings_env(
    fast_model: str | None,
    pro_model: str | None,
    api_keys: dict[str, str] | None,
    default_model: str | None = None,
) -> None:
    values = _read_env_file(ENV_PATH)
    if default_model:
        values["SOCRATE_DEFAULT_MODEL"] = default_model
    if fast_model is not None:
        values["SOCRATE_FAST_MODEL"] = fast_model
    if pro_model is not None:
        values["SOCRATE_PRO_MODEL"] = pro_model
    if api_keys is not None:
        merged = Settings().api_keys.copy()
        for provider, key in api_keys.items():
            if key:
                merged[provider] = key
        values["SOCRATE_API_KEYS"] = json.dumps(merged, ensure_ascii=False)
    _write_env_file(ENV_PATH, values)


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = _unquote_env_value(value.strip())
    return values


def _write_env_file(path: Path, values: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{key}={_quote_env_value(value)}" for key, value in sorted(values.items())]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _unquote_env_value(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def _quote_env_value(value: str) -> str:
    if value == "" or any(ch.isspace() for ch in value) or value.startswith(("{", "[")):
        return json.dumps(value, ensure_ascii=False)
    return value
