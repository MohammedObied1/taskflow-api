from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DBSession, PageParams
from app.models import ProjectRole
from app.schemas.common import Page
from app.schemas.project import ProjectCreate, ProjectDetail, ProjectMemberAdd, ProjectRead, ProjectStats, ProjectUpdate
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=Page[ProjectRead], summary="List projects I own or belong to")
def list_projects(db: DBSession, user: CurrentUser, pagination: PageParams, search: str | None = Query(default=None, max_length=120)):
    items, total = ProjectService(db).list_for_user(user, pagination.offset, pagination.size, search)
    return pagination.build(items, total)


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED, summary="Create a project")
def create_project(data: ProjectCreate, db: DBSession, user: CurrentUser):
    return ProjectService(db).create(data, user)


@router.get("/{project_id}", response_model=ProjectDetail, summary="Project details with members")
def get_project(project_id: int, db: DBSession, user: CurrentUser):
    service = ProjectService(db)
    project = service.get(project_id, user)
    detail = ProjectDetail.model_validate(project)
    detail.task_count = service.task_count(project.id)
    return detail


@router.patch("/{project_id}", response_model=ProjectDetail, summary="Update a project (owner)")
def update_project(project_id: int, data: ProjectUpdate, db: DBSession, user: CurrentUser):
    service = ProjectService(db)
    project = service.get(project_id, user, ProjectRole.OWNER)
    return service.update(project, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a project (owner)")
def delete_project(project_id: int, db: DBSession, user: CurrentUser):
    service = ProjectService(db)
    service.delete(service.get(project_id, user, ProjectRole.OWNER))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/stats", response_model=ProjectStats, summary="Task analytics for a project")
def project_stats(project_id: int, db: DBSession, user: CurrentUser):
    service = ProjectService(db)
    return service.stats(service.get(project_id, user))


@router.post("/{project_id}/members", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED, summary="Add a member (owner)")
def add_member(project_id: int, data: ProjectMemberAdd, db: DBSession, user: CurrentUser):
    service = ProjectService(db)
    project = service.get(project_id, user, ProjectRole.OWNER)
    return service.add_member(project, data)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a member (owner)")
def remove_member(project_id: int, user_id: int, db: DBSession, user: CurrentUser):
    service = ProjectService(db)
    service.remove_member(service.get(project_id, user, ProjectRole.OWNER), user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
