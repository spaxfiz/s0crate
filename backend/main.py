from __future__ import annotations
import logging
import time
import uvicorn
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import Settings
from backend.logging_config import configure_logging
from backend.ai.engine import AIEngine
from backend.memory.filesystem import FilesystemMemory
from backend.learning.session import SessionManager
from backend.learning.phases import PhaseOrchestrator
from backend.api.routes import router as api_router, init_routes


class RequestLoggingMiddleware:
    """Raw ASGI middleware — avoids BaseHTTPMiddleware task-group cancellation bug."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = logging.getLogger("backend.request")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        method = scope.get("method", "?")
        path = scope.get("path", "?")
        status_code = 0

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            self.logger.exception(
                "request failed method=%s path=%s elapsed_ms=%.1f",
                method, path, elapsed_ms,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        self.logger.info(
            "request method=%s path=%s status=%s elapsed_ms=%.1f",
            method, path, status_code, elapsed_ms,
        )


def create_app() -> FastAPI:
    settings = Settings()
    configure_logging(settings)
    logger = logging.getLogger(__name__)
    fast_model = settings.fast_model or settings.default_model
    pro_model = settings.pro_model or fast_model
    logger.info(
        "starting app host=%s port=%s fast_model=%s pro_model=%s output_dir=%s log_dir=%s context_window_tokens=%s compression_threshold_ratio=%s",
        settings.host,
        settings.port,
        fast_model,
        pro_model,
        settings.output_dir,
        settings.log_dir,
        settings.context_window_tokens,
        settings.compression_threshold_ratio,
    )

    # Initialize components
    memory = FilesystemMemory(settings.output_dir)
    engine = AIEngine(
        fast_model=fast_model,
        pro_model=pro_model,
        api_keys=settings.api_keys,
    )
    session_mgr = SessionManager(memory)
    orchestrator = PhaseOrchestrator(engine, memory, settings)

    # Wire routes
    init_routes(engine, memory, session_mgr, orchestrator)

    app = FastAPI(title="Socrate", version="0.1.0")

    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    return app


app = create_app()


def main():
    settings = Settings()
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )


if __name__ == "__main__":
    main()
