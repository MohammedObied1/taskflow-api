from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models import User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if not user:
            raise NotFoundError("User not found")
        return user

    def get_by_username(self, username: str) -> User | None:
        return self.db.scalar(select(User).where(User.username == username))

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def create(self, data: UserCreate) -> User:
        exists = self.db.scalar(select(User).where(or_(User.email == data.email, User.username == data.username)))
        if exists:
            raise ConflictError("A user with this email or username already exists")
        user = User(
            email=data.email,
            username=data.username,
            full_name=data.full_name,
            hashed_password=hash_password(data.password),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, data: UserUpdate) -> User:
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.password:
            user.hashed_password = hash_password(data.password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list(self, offset: int, limit: int) -> "tuple[list[User], int]":
        from sqlalchemy import func

        total = self.db.scalar(select(func.count()).select_from(User)) or 0
        items = list(self.db.scalars(select(User).order_by(User.id).offset(offset).limit(limit)))
        return items, total
