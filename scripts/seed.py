"""Populate the database with demo data.

Usage:  python -m scripts.seed
"""

from datetime import UTC, datetime, timedelta

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models import Comment, Project, ProjectMember, ProjectRole, Task, TaskPriority, TaskStatus, User, UserRole


def run() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).first():
            print("Database already seeded - skipping.")
            return

        admin = User(
            email="admin@taskflow.dev", username="admin", full_name="Admin", role=UserRole.ADMIN, hashed_password=hash_password("Admin1234")
        )
        alice = User(email="alice@taskflow.dev", username="alice", full_name="Alice Ahmad", hashed_password=hash_password("Alice1234"))
        bob = User(email="bob@taskflow.dev", username="bob", full_name="Bob Khalil", hashed_password=hash_password("Bob12345"))
        db.add_all([admin, alice, bob])
        db.flush()

        project = Project(name="TaskFlow Launch", description="Ship v1 of the TaskFlow platform", owner_id=alice.id)
        project.members = [
            ProjectMember(user_id=alice.id, role=ProjectRole.OWNER),
            ProjectMember(user_id=bob.id, role=ProjectRole.EDITOR),
        ]
        db.add(project)
        db.flush()

        now = datetime.now(UTC)
        tasks = [
            Task(
                title="Design database schema",
                status=TaskStatus.DONE,
                priority=TaskPriority.HIGH,
                project_id=project.id,
                assignee_id=alice.id,
                created_by_id=alice.id,
                due_date=now - timedelta(days=7),
            ),
            Task(
                title="Implement JWT auth",
                status=TaskStatus.DONE,
                priority=TaskPriority.CRITICAL,
                project_id=project.id,
                assignee_id=bob.id,
                created_by_id=alice.id,
            ),
            Task(
                title="Write API documentation",
                status=TaskStatus.IN_PROGRESS,
                priority=TaskPriority.MEDIUM,
                project_id=project.id,
                assignee_id=bob.id,
                created_by_id=alice.id,
                due_date=now + timedelta(days=3),
            ),
            Task(
                title="Set up CI pipeline",
                status=TaskStatus.IN_REVIEW,
                priority=TaskPriority.HIGH,
                project_id=project.id,
                assignee_id=alice.id,
                created_by_id=bob.id,
            ),
            Task(
                title="Load testing",
                status=TaskStatus.TODO,
                priority=TaskPriority.LOW,
                project_id=project.id,
                created_by_id=alice.id,
                due_date=now - timedelta(days=1),
            ),
        ]
        db.add_all(tasks)
        db.flush()
        db.add(Comment(body="Schema reviewed and approved.", task_id=tasks[0].id, author_id=bob.id))
        db.add(Comment(body="Remember to document the refresh flow.", task_id=tasks[2].id, author_id=alice.id))
        db.commit()
        print("Seeded: 3 users (admin/Admin1234, alice/Alice1234, bob/Bob12345), 1 project, 5 tasks.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
