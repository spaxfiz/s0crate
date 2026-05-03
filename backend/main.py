from __future__ import annotations
import logging
import time
import uvicorn
from fastapi import Request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import Settings
from backend.logging_config import configure_logging
from backend.ai.engine import AIEngine
from backend.memory.filesystem import FilesystemMemory
from backend.learning.session import SessionManager
from backend.learning.phases import PhaseOrchestrator
from backend.api.routes import router as api_router, init_routes


def create_app() -> FastAPI:
    settings = Settings()
    configure_logging(settings)
    logger = logging.getLogger(__name__)
    logger.info(
        "starting app host=%s port=%s model=%s output_dir=%s log_dir=%s context_window_tokens=%s compression_threshold_ratio=%s",
        settings.host,
        settings.port,
        settings.default_model,
        settings.output_dir,
        settings.log_dir,
        settings.context_window_tokens,
        settings.compression_threshold_ratio,
    )

    # Initialize components
    memory = FilesystemMemory(settings.output_dir)
    engine = AIEngine(
        model=settings.default_model,
        api_keys=settings.api_keys,
    )
    session_mgr = SessionManager(memory)
    orchestrator = PhaseOrchestrator(engine, memory, settings)

    # Wire routes
    init_routes(engine, memory, session_mgr, orchestrator)

    app = FastAPI(title="Socrate", version="0.1.0")

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logging.getLogger("backend.request").exception(
                "request failed method=%s path=%s elapsed_ms=%.1f",
                request.method,
                request.url.path,
                elapsed_ms,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        logging.getLogger("backend.request").info(
            "request method=%s path=%s status=%s elapsed_ms=%.1f",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

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
