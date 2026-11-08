from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ProjectRole
from app.schemas.common import ORMModel
from app.schemas.user import UserPublic


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ProjectMemberRead(ORMModel):
    user: UserPublic
    role: ProjectRole


class ProjectMemberAdd(BaseModel):
    user_id: int
    role: ProjectRole = ProjectRole.VIEWER


class ProjectRead(ORMModel):
    id: int
    name: str
    description: str | None
    owner: UserPublic
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectRead):
    members: list[ProjectMemberRead]
    task_count: int = 0


class ProjectStats(BaseModel):
    project_id: int
    total_tasks: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    overdue: int
    completion_rate: float
