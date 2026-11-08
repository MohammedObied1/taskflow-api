from typing import Literal

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DBSession, PageParams
from app.models import TaskPriority, TaskStatus
from app.schemas.common import Page
from app.schemas.task import CommentCreate, CommentRead, TaskCreate, TaskRead, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter(tags=["Tasks"])


@router.get("/tasks", response_model=Page[TaskRead], summary="Search tasks across accessible projects")
def list_tasks(
    db: DBSession,
    user: CurrentUser,
    pagination: PageParams,
    project_id: int | None = None,
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    priority: TaskPriority | None = None,
    assignee_id: int | None = None,
    search: str | None = Query(default=None, max_length=200),
    sort_by: Literal["created_at", "due_date", "priority", "title", "status"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
):
    items, total = TaskService(db).list(
        user, pagination.offset, pagination.size, project_id, status_filter, priority, assignee_id, search, sort_by, order
    )
    return pagination.build(items, total)


@router.post("/projects/{project_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED, summary="Create a task (editor)")
def create_task(project_id: int, data: TaskCreate, db: DBSession, user: CurrentUser):
    return TaskService(db).create(project_id, data, user)


@router.get("/tasks/{task_id}", response_model=TaskRead, summary="Get a task")
def get_task(task_id: int, db: DBSession, user: CurrentUser):
    return TaskService(db).get(task_id, user)


@router.patch("/tasks/{task_id}", response_model=TaskRead, summary="Update a task (editor)")
def update_task(task_id: int, data: TaskUpdate, db: DBSession, user: CurrentUser):
    return TaskService(db).update(task_id, data, user)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a task (editor)")
def delete_task(task_id: int, db: DBSession, user: CurrentUser):
    TaskService(db).delete(task_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/tasks/{task_id}/comments", response_model=list[CommentRead], summary="List comments on a task")
def list_comments(task_id: int, db: DBSession, user: CurrentUser):
    return TaskService(db).list_comments(task_id, user)


@router.post("/tasks/{task_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED, summary="Comment on a task")
def add_comment(task_id: int, data: CommentCreate, db: DBSession, user: CurrentUser):
    return TaskService(db).add_comment(task_id, data, user)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a comment (author or owner)")
def delete_comment(comment_id: int, db: DBSession, user: CurrentUser):
    TaskService(db).delete_comment(comment_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
