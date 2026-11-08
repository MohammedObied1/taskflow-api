from fastapi import APIRouter
from sqlalchemy import text

from app import __version__
from app.api.deps import DBSession

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness & readiness probe")
def health(db: DBSession) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "version": __version__, "database": "connected"}
