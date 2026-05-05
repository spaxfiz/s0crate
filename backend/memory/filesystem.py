from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from slugify import slugify


class FilesystemMemory:
    def __init__(self, output_dir: str | Path = "learning-output"):
        self.output_dir = Path(output_dir)

    def ensure_dir(self):
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def create_session_dir(self, slug: str) -> Path:
        session_dir = self.output_dir / slug
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir

    def save_session(self, slug: str, session_data: dict) -> None:
        self.ensure_dir()
        path = self.output_dir / slug / "session.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(session_data, indent=2, default=str), encoding="utf-8")

    def load_session(self, slug: str) -> dict:
        path = self.output_dir / slug / "session.json"
        if not path.exists():
            raise FileNotFoundError(f"Session not found: {slug}")
        return json.loads(path.read_text(encoding="utf-8"))

    def list_sessions(self) -> list[dict]:
        self.ensure_dir()
        sessions = []
        for session_dir in sorted(self.output_dir.iterdir(), reverse=True):
            json_path = session_dir / "session.json"
            if json_path.exists():
                try:
                    sessions.append(json.loads(json_path.read_text(encoding="utf-8")))
                except (json.JSONDecodeError, OSError):
                    continue
        return sessions

    def delete_session(self, slug: str) -> None:
        import shutil
        session_dir = self.output_dir / slug
        if session_dir.exists():
            shutil.rmtree(session_dir)

    def save_syllabus_md(self, slug: str, markdown: str) -> str:
        path = self.output_dir / slug / "syllabus.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(markdown, encoding="utf-8")
        return str(path.relative_to(self.output_dir))

    def save_topic_md(self, slug: str, title: str, content: str) -> str:
        safe_title = slugify(title)
        path = self.output_dir / slug / f"{safe_title}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return str(path.relative_to(self.output_dir))

    def read_topic_md(self, slug: str, file_path: str) -> str:
        path = self.output_dir / slug / file_path
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8")

    def save_summary_md(self, slug: str, content: str) -> str:
        path = self.output_dir / slug / "summary.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return str(path.relative_to(self.output_dir))

    def append_ai_log(self, slug: str, entry: dict) -> None:
        path = self.output_dir / slug / "ai_log.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")
