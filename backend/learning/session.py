from __future__ import annotations
import logging
import uuid
from datetime import datetime
from slugify import slugify
from backend.api.models import LearningSession, LearningPhase
from backend.memory.filesystem import FilesystemMemory

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self, memory: FilesystemMemory):
        self.memory = memory
        self._cache: dict[str, LearningSession] = {}

    def create(self, question: str) -> LearningSession:
        session_id = str(uuid.uuid4())[:8]
        name = question[:30].strip()
        session = LearningSession(
            id=session_id,
            name=name,
            slug=slugify(name) or session_id,
            original_question=question,
            phase=LearningPhase.QUESTIONING,
        )
        self._cache[session.id] = session
        self._save(session)
        return session

    def load(self, session_id: str) -> LearningSession:
        if session_id in self._cache:
            session = self._cache[session_id]
            self._repair_invalid_phase(session)
            return session
        sessions = self.list()
        for s in sessions:
            if s.id == session_id:
                self._repair_invalid_phase(s)
                self._cache[session_id] = s
                return s
        raise FileNotFoundError(f"Session {session_id} not found")

    def list(self) -> list[LearningSession]:
        raw = self.memory.list_sessions()
        sessions = []
        for data in raw:
            try:
                session = LearningSession(**data)
                self._repair_invalid_phase(session)
                sessions.append(session)
            except Exception:
                continue
        sessions.sort(key=lambda s: s.updated_at, reverse=True)
        return sessions

    def delete(self, session_id: str) -> None:
        session = self.load(session_id)
        self.memory.delete_session(session.slug)
        self._cache.pop(session_id, None)

    def save(self, session: LearningSession) -> None:
        session.updated_at = datetime.now()
        self._cache[session.id] = session
        self._save(session)

    def _save(self, session: LearningSession) -> None:
        self.memory.save_session(session.slug, session.model_dump(mode="json"))

    def _repair_invalid_phase(self, session: LearningSession) -> None:
        if session.phase in (LearningPhase.SYLLABUS, LearningPhase.DEEP_DIVE):
            if not session.syllabus or not session.current_node_id:
                logger.warning(
                    "repair invalid session phase session=%s phase=%s has_syllabus=%s current_node=%s",
                    session.id,
                    session.phase.value,
                    bool(session.syllabus),
                    session.current_node_id,
                )
                session.phase = LearningPhase.QUESTIONING
                session.current_node_id = None
                self._save(session)
