from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.router import api_router
from app.api.v1 import health
from app.core.config import settings
from app.core.database import init_db
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import register_middleware

DESCRIPTION = """
**TaskFlow** is a project & task management backend built with FastAPI.

## Features
* 🔐 JWT authentication with access/refresh token rotation
* 👥 Project membership with role-based access (owner / editor / viewer)
* ✅ Tasks with status, priority, due dates, assignees, and comments
* 🔎 Filtering, full-text search, sorting, and pagination
* 📊 Per-project analytics (completion rate, overdue tasks)
* 🛡️ Rate limiting, request tracing, structured error responses
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_middleware(app)
    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # In the Docker image the frontend is pre-built into frontend/dist; mounting it here
    # lets a single container serve both the API and the UI. In local dev this directory
    # doesn't exist, so the API runs on its own and the UI is served by `npm run dev`.
    frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app


app = create_app()
