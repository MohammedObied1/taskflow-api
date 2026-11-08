from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models import Project, ProjectMember, ProjectRole, Task, TaskStatus, User, UserRole
from app.schemas.project import ProjectCreate, ProjectMemberAdd, ProjectStats, ProjectUpdate

ROLE_RANK = {ProjectRole.VIEWER: 0, ProjectRole.EDITOR: 1, ProjectRole.OWNER: 2}


class ProjectService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- access control ----------
    def role_for(self, project: Project, user: User) -> ProjectRole | None:
        if user.role == UserRole.ADMIN or project.owner_id == user.id:
            return ProjectRole.OWNER
        membership = next((m for m in project.members if m.user_id == user.id), None)
        return membership.role if membership else None

    def require_role(self, project: Project, user: User, minimum: ProjectRole) -> None:
        role = self.role_for(project, user)
        if role is None or ROLE_RANK[role] < ROLE_RANK[minimum]:
            raise ForbiddenError("Insufficient permissions on this project")

    # ---------- CRUD ----------
    def get(self, project_id: int, user: User, minimum: ProjectRole = ProjectRole.VIEWER) -> Project:
        project = self.db.scalar(
            select(Project)
            .options(selectinload(Project.members).selectinload(ProjectMember.user), selectinload(Project.owner))
            .where(Project.id == project_id)
        )
        if not project:
            raise NotFoundError("Project not found")
        self.require_role(project, user, minimum)
        return project

    def list_for_user(self, user: User, offset: int, limit: int, search: str | None = None) -> "tuple[list[Project], int]":
        stmt = select(Project).options(selectinload(Project.owner))
        if user.role != UserRole.ADMIN:
            member_ids = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
            stmt = stmt.where(or_(Project.owner_id == user.id, Project.id.in_(member_ids)))
        if search:
            stmt = stmt.where(Project.name.ilike(f"%{search}%"))
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = list(self.db.scalars(stmt.order_by(Project.created_at.desc()).offset(offset).limit(limit)))
        return items, total

    def create(self, data: ProjectCreate, owner: User) -> Project:
        project = Project(name=data.name, description=data.description, owner_id=owner.id)
        project.members.append(ProjectMember(user_id=owner.id, role=ProjectRole.OWNER))
        self.db.add(project)
        self.db.commit()
        return self.get(project.id, owner)

    def update(self, project: Project, data: ProjectUpdate) -> Project:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        self.db.commit()
        self.db.refresh(project)
        return project

    def delete(self, project: Project) -> None:
        self.db.delete(project)
        self.db.commit()

    # ---------- members ----------
    def add_member(self, project: Project, data: ProjectMemberAdd) -> Project:
        if not self.db.get(User, data.user_id):
            raise NotFoundError("User not found")
        if any(m.user_id == data.user_id for m in project.members):
            raise ConflictError("User is already a member of this project")
        if data.role == ProjectRole.OWNER:
            raise ForbiddenError("Ownership cannot be granted via membership")
        project.members.append(ProjectMember(user_id=data.user_id, role=data.role))
        self.db.commit()
        self.db.refresh(project)
        return project

    def remove_member(self, project: Project, user_id: int) -> None:
        if user_id == project.owner_id:
            raise ForbiddenError("The project owner cannot be removed")
        membership = next((m for m in project.members if m.user_id == user_id), None)
        if not membership:
            raise NotFoundError("Member not found")
        self.db.delete(membership)
        self.db.commit()

    # ---------- analytics ----------
    def task_count(self, project_id: int) -> int:
        return self.db.scalar(select(func.count()).select_from(Task).where(Task.project_id == project_id)) or 0

    def stats(self, project: Project) -> ProjectStats:
        rows = self.db.execute(select(Task.status, func.count()).where(Task.project_id == project.id).group_by(Task.status)).all()
        by_status = {s.value: 0 for s in TaskStatus}
        by_status.update({status.value: count for status, count in rows})

        prio_rows = self.db.execute(select(Task.priority, func.count()).where(Task.project_id == project.id).group_by(Task.priority)).all()
        by_priority = {p.value: c for p, c in prio_rows}

        total = sum(by_status.values())
        overdue = (
            self.db.scalar(
                select(func.count())
                .select_from(Task)
                .where(
                    Task.project_id == project.id,
                    Task.status != TaskStatus.DONE,
                    Task.due_date.is_not(None),
                    Task.due_date < datetime.now(UTC),
                )
            )
            or 0
        )
        done = by_status.get(TaskStatus.DONE.value, 0)
        return ProjectStats(
            project_id=project.id,
            total_tasks=total,
            by_status=by_status,
            by_priority=by_priority,
            overdue=overdue,
            completion_rate=round(done / total, 3) if total else 0.0,
        )
