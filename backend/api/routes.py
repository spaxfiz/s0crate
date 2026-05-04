from __future__ import annotations
import asyncio
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.api.models import (
    CreateSessionRequest, ChatRequest, NavigateRequest, SaveSettingsRequest,
    LearningPhase,
)
from backend.learning.session import SessionManager
from backend.learning.navigator import Navigator
from backend.learning.syllabus import count_progress
from backend.learning.phases import PhaseOrchestrator
from backend.ai.engine import AIEngine
from backend.memory.filesystem import FilesystemMemory
from backend.config import Settings, save_settings_env


router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# These get injected from main.py
engine: AIEngine = None  # type: ignore
memory: FilesystemMemory = None  # type: ignore
sessions: SessionManager = None  # type: ignore
orchestrator: PhaseOrchestrator = None  # type: ignore


def init_routes(e: AIEngine, m: FilesystemMemory, s: SessionManager, o: PhaseOrchestrator):
    global engine, memory, sessions, orchestrator
    engine = e
    memory = m
    sessions = s
    orchestrator = o


@router.get("/health")
async def health():
    return {"status": "ok"}


# --- Sessions ---

@router.post("/sessions")
async def create_session(req: CreateSessionRequest):
    session = sessions.create(req.question, model_tier=req.model_tier)
    logger.info(
        "session created session=%s slug=%s question_chars=%s tier=%s",
        session.id, session.slug, len(req.question), req.model_tier,
    )
    return _session_response(session)


@router.post("/sessions/{session_id}/start")
async def start_session(session_id: str):
    """Trigger the first AI question when a session is created."""
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    async def event_stream():
        try:
            logger.info("sse start initial session=%s", session.id)
            async for chunk in orchestrator.handle_initial_question(session):
                event_type = chunk.get("type", "token")
                yield f"event: {event_type}\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            logger.info("sse done initial session=%s phase=%s", session.id, session.phase.value)
        except asyncio.CancelledError:
            logger.info("sse cancelled initial session=%s", session.id)
            raise
        except Exception as e:
            logger.exception("sse error initial session=%s", session.id)
            yield f"event: error\ndata: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            sessions.save(session)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions")
async def list_sessions():
    all_sessions = sessions.list()
    result = []
    for s in all_sessions:
        done, total = (0, 0)
        if s.syllabus:
            done, total = count_progress(s.syllabus)
        result.append({
            "id": s.id,
            "name": s.name,
            "originalQuestion": s.original_question,
            "createdAt": s.created_at.isoformat(),
            "updatedAt": s.updated_at.isoformat(),
            "phase": s.phase.value,
            "progress": [done, total],
        })
    return result


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")
    return _session_response(session)


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    try:
        sessions.delete(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")
    logger.info("session deleted session=%s", session_id)
    return {"ok": True}


# --- Navigation ---

@router.post("/sessions/{session_id}/navigate")
async def navigate(session_id: str, req: NavigateRequest):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    nav = Navigator(session)
    try:
        node = nav.navigate_to(req.node_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if node.id != "root":
        session.phase = LearningPhase.DEEP_DIVE
    sessions.save(session)
    logger.info("navigate session=%s node=%s phase=%s", session.id, req.node_id, session.phase.value)
    return {
        "currentNodeId": session.current_node_id,
        "phase": session.phase.value,
        "breadcrumb": nav.get_breadcrumb(),
        "messages": [m.model_dump(mode="json") for m in node.conversation_history],
        "hasNext": Navigator(session).has_next(),
    }


@router.post("/sessions/{session_id}/back")
async def navigate_back(session_id: str):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    nav = Navigator(session)
    parent = nav.navigate_back()
    if parent:
        session.phase = LearningPhase.DEEP_DIVE
    sessions.save(session)

    current = nav.get_current_node()
    logger.info("navigate back session=%s current=%s phase=%s", session.id, session.current_node_id, session.phase.value)
    return {
        "currentNodeId": session.current_node_id,
        "phase": session.phase.value,
        "breadcrumb": nav.get_breadcrumb(),
        "messages": [m.model_dump(mode="json") for m in current.conversation_history] if current else [],
        "hasNext": nav.has_next(),
    }


@router.post("/sessions/{session_id}/overview")
async def navigate_overview(session_id: str):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    nav = Navigator(session)
    nav.navigate_overview()
    sessions.save(session)
    logger.info("navigate overview session=%s", session.id)

    return {
        "currentNodeId": session.current_node_id,
        "phase": session.phase.value,
        "breadcrumb": nav.get_breadcrumb(),
        "messages": [m.model_dump(mode="json") for m in session.conversation_history],
        "hasNext": nav.has_next(),
    }


@router.post("/sessions/{session_id}/next")
async def navigate_next(session_id: str):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    nav = Navigator(session)
    node = nav.navigate_next()
    if node:
        session.phase = LearningPhase.DEEP_DIVE
    sessions.save(session)
    current = nav.get_current_node()
    logger.info(
        "navigate next session=%s current=%s has_next_node=%s phase=%s",
        session.id,
        session.current_node_id,
        node is not None,
        session.phase.value,
    )
    return {
        "currentNodeId": session.current_node_id,
        "phase": session.phase.value,
        "breadcrumb": nav.get_breadcrumb(),
        "messages": [m.model_dump(mode="json") for m in current.conversation_history] if current else [],
        "hasNext": node is not None and nav.has_next(),
    }


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    nav = Navigator(session)
    current = nav.get_current_node()
    if not current:
        return [m.model_dump(mode="json") for m in session.conversation_history]
    if session.phase in (LearningPhase.QUESTIONING, LearningPhase.SUMMARIZATION):
        return [m.model_dump(mode="json") for m in session.conversation_history]
    return [m.model_dump(mode="json") for m in current.conversation_history]


# --- Chat (SSE) ---

@router.post("/sessions/{session_id}/chat")
async def chat(session_id: str, req: ChatRequest):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    async def event_stream():
        try:
            logger.info("sse start chat session=%s phase=%s message_chars=%s", session.id, session.phase.value, len(req.message))
            async for chunk in orchestrator.handle_message(session, req.message):
                event_type = chunk.get("type", "token")
                yield f"event: {event_type}\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            logger.info("sse done chat session=%s phase=%s", session.id, session.phase.value)
        except asyncio.CancelledError:
            logger.info("sse cancelled chat session=%s", session.id)
            raise
        except Exception as e:
            logger.exception("sse error chat session=%s", session.id)
            yield f"event: error\ndata: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            sessions.save(session)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions/{session_id}/summary")
async def create_summary(session_id: str):
    try:
        session = sessions.load(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")

    async def event_stream():
        try:
            logger.info("sse start summary session=%s", session.id)
            async for chunk in orchestrator.generate_summary(session):
                event_type = chunk.get("type", "token")
                yield f"event: {event_type}\ndata: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            logger.info("sse done summary session=%s", session.id)
        except asyncio.CancelledError:
            logger.info("sse cancelled summary session=%s", session.id)
            raise
        except Exception as e:
            logger.exception("sse error summary session=%s", session.id)
            yield f"event: error\ndata: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            sessions.save(session)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Settings ---

@router.get("/settings")
async def get_settings():
    return {
        "fastModel": engine.fast_model,
        "proModel": engine.pro_model,
        "apiKeys": {k: bool(v) for k, v in engine.api_keys.items()},
    }


@router.post("/settings")
async def save_settings(req: SaveSettingsRequest):
    save_settings_env(fast_model=req.fast_model, pro_model=req.pro_model, api_keys=req.api_keys)
    settings = Settings()
    engine.update(
        fast_model=settings.fast_model or settings.default_model,
        pro_model=settings.pro_model or settings.default_model,
        api_keys=settings.api_keys,
    )
    orchestrator.update_settings(settings)
    logger.info(
        "settings saved fast_model=%s pro_model=%s providers=%s",
        engine.fast_model,
        engine.pro_model,
        sorted(settings.api_keys.keys()),
    )
    return {"ok": True}


# --- Helpers ---

def _session_response(session):
    nav = Navigator(session)
    current = nav.get_current_node()
    breadcrumb = nav.get_breadcrumb()
    done, total = (0, 0)
    if session.syllabus:
        done, total = count_progress(session.syllabus)

    syllabus_data = None
    if session.syllabus:
        syllabus_data = session.syllabus.model_dump(mode="json")

    return {
        "id": session.id,
        "name": session.name,
        "slug": session.slug,
        "originalQuestion": session.original_question,
        "createdAt": session.created_at.isoformat(),
        "updatedAt": session.updated_at.isoformat(),
        "phase": session.phase.value,
        "modelTier": session.model_tier,
        "syllabus": syllabus_data,
        "currentNodeId": session.current_node_id,
        "contextSummary": session.context_summary,
        "breadcrumb": breadcrumb,
        "progress": [done, total],
        "messages": _current_messages(session, current),
        "hasNext": nav.has_next(),
    }


def _current_messages(session, current) -> list[dict]:
    if current and session.phase not in (LearningPhase.QUESTIONING, LearningPhase.SUMMARIZATION):
        return [m.model_dump(mode="json") for m in current.conversation_history]
    return [m.model_dump(mode="json") for m in session.conversation_history]
