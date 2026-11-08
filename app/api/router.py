from fastapi import APIRouter

from app.api.v1 import auth, health, projects, tasks, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(tasks.router)

__all__ = ["api_router", "health"]
