"""FastAPI application: REST API, session WebSocket and (when built) the React app from app/web/dist."""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__, api, config, stt, tts, ws
from .engines import antigravity_cli

log = logging.getLogger("uvicorn.error")


def preload_speech() -> None:
    """Load Whisper and Kokoro once at startup so the first session does not wait for them (D33).
    Off with IC_PRELOAD=0 (tests)."""
    settings = config.load_settings()
    try:
        tts.preload(settings, settings.get("voice") or "", settings.get("kokoro_speed", 1.0))
    except Exception as exc:  # speech is optional
        log.warning("Kokoro preload failed: %s", type(exc).__name__)
    recogniser = stt.get_stt(settings)
    if recogniser.available:
        recogniser.warm_up()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    antigravity_cli.forget_left_over()                   # D87: chats a killed Vukoli left in Antigravity's history
    if os.getenv("IC_PRELOAD", "1") != "0":
        task = asyncio.ensure_future(asyncio.to_thread(preload_speech))
    yield
    if task is not None and not task.done():
        task.cancel()
    await antigravity_cli.close_spares()                 # D87: no `agy` left waiting after Vukoli quits


def create_app() -> FastAPI:
    config.ensure_meta()
    app = FastAPI(title="Vukoli", version=__version__, docs_url="/api/docs", redoc_url=None,
                  openapi_url="/api/openapi.json", lifespan=lifespan)
    app.include_router(api.router)
    app.include_router(ws.router)
    if config.e2e_enabled():                             # IC_E2E=1 (browser tests) only: reset, steer the scripted engine, seed
        from . import e2e
        app.include_router(e2e.router)

    @app.middleware("http")
    async def no_store(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    dist = config.web_dist_dir()
    if dist.joinpath("index.html").is_file():
        if dist.joinpath("assets").is_dir():
            app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            if path.startswith(("api/", "ws/")):
                return JSONResponse({"detail": {"code": "not_found", "message": "Not found."}}, status_code=404)
            target = (dist / path).resolve()
            if path and target.is_file() and dist.resolve() in target.parents and target.name != "index.html":
                return FileResponse(target)
            # Revalidate the shell on every load, so a rebuilt UI shows up without a hard reload.
            return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
    else:
        @app.get("/", include_in_schema=False)
        async def root():
            return JSONResponse({"app": "Vukoli API", "version": __version__,
                                 "ui": "Not built yet. Build app/web (npm run build) or run its dev server.",
                                 "docs": "/api/docs"})
    return app


app = create_app()
