from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models import Comment, Project, ProjectRole, Task, TaskPriority, TaskStatus, User
from app.schemas.task import CommentCreate, TaskCreate, TaskUpdate
from app.services.project_service import ProjectService

SORTABLE = {"created_at": Task.created_at, "due_date": Task.due_date, "priority": Task.priority, "title": Task.title, "status": Task.status}


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.projects = ProjectService(db)

    def _base_query(self):
        return select(Task).options(selectinload(Task.assignee), selectinload(Task.created_by), selectinload(Task.project))

    def get(self, task_id: int, user: User, minimum: ProjectRole = ProjectRole.VIEWER) -> Task:
        task = self.db.scalar(self._base_query().where(Task.id == task_id))
        if not task:
            raise NotFoundError("Task not found")
        project = self.projects.get(task.project_id, user, minimum)
        task.project = project
        return task

    def list(
        self,
        user: User,
        offset: int,
        limit: int,
        project_id: int | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        assignee_id: int | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        order: str = "desc",
    ) -> "tuple[list[Task], int]":
        stmt = self._base_query()
        if project_id is not None:
            self.projects.get(project_id, user)  # enforces access
            stmt = stmt.where(Task.project_id == project_id)
        else:
            accessible, _ = self.projects.list_for_user(user, 0, 10_000)
            stmt = stmt.where(Task.project_id.in_([p.id for p in accessible]))
        if status:
            stmt = stmt.where(Task.status == status)
        if priority:
            stmt = stmt.where(Task.priority == priority)
        if assignee_id is not None:
            stmt = stmt.where(Task.assignee_id == assignee_id)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(or_(Task.title.ilike(like), Task.description.ilike(like)))

        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        column = SORTABLE.get(sort_by, Task.created_at)
        stmt = stmt.order_by(column.desc() if order == "desc" else column.asc(), Task.id)
        items = list(self.db.scalars(stmt.offset(offset).limit(limit)))
        return items, total

    def _validate_assignee(self, project: Project, assignee_id: int | None) -> None:
        if assignee_id is None:
            return
        if not any(m.user_id == assignee_id for m in project.members) and project.owner_id != assignee_id:
            raise ForbiddenError("Assignee must be a member of the project")

    def create(self, project_id: int, data: TaskCreate, user: User) -> Task:
        project = self.projects.get(project_id, user, ProjectRole.EDITOR)
        self._validate_assignee(project, data.assignee_id)
        task = Task(**data.model_dump(), project_id=project.id, created_by_id=user.id)
        self.db.add(task)
        self.db.commit()
        return self.get(task.id, user)

    def update(self, task_id: int, data: TaskUpdate, user: User) -> Task:
        task = self.get(task_id, user, ProjectRole.EDITOR)
        changes = data.model_dump(exclude_unset=True)
        if "assignee_id" in changes:
            self._validate_assignee(task.project, changes["assignee_id"])
        for field, value in changes.items():
            setattr(task, field, value)
        self.db.commit()
        return self.get(task.id, user)

    def delete(self, task_id: int, user: User) -> None:
        task = self.get(task_id, user, ProjectRole.EDITOR)
        self.db.delete(task)
        self.db.commit()

    # ---------- comments ----------
    def list_comments(self, task_id: int, user: User) -> "list[Comment]":
        self.get(task_id, user)
        return list(
            self.db.scalars(
                select(Comment).options(selectinload(Comment.author)).where(Comment.task_id == task_id).order_by(Comment.created_at)
            )
        )

    def add_comment(self, task_id: int, data: CommentCreate, user: User) -> Comment:
        self.get(task_id, user)  # viewers may comment
        comment = Comment(body=data.body, task_id=task_id, author_id=user.id)
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def delete_comment(self, comment_id: int, user: User) -> None:
        comment = self.db.get(Comment, comment_id)
        if not comment:
            raise NotFoundError("Comment not found")
        task = self.get(comment.task_id, user)
        is_owner = self.projects.role_for(task.project, user) == ProjectRole.OWNER
        if comment.author_id != user.id and not is_owner:
            raise ForbiddenError("You can only delete your own comments")
        self.db.delete(comment)
        self.db.commit()
