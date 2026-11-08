from fastapi import APIRouter

from app.api.deps import AdminUser, CurrentUser, DBSession, PageParams
from app.schemas.common import Page
from app.schemas.user import UserPublic, UserRead, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=Page[UserPublic], summary="List users (for member pickers)")
def list_users(db: DBSession, _: CurrentUser, pagination: PageParams):
    items, total = UserService(db).list(pagination.offset, pagination.size)
    return pagination.build(items, total)


@router.patch("/me", response_model=UserRead, summary="Update own profile")
def update_me(data: UserUpdate, user: CurrentUser, db: DBSession):
    return UserService(db).update(user, data)


@router.get("/{user_id}", response_model=UserRead, summary="Get user by id (admin)")
def get_user(user_id: int, db: DBSession, _: AdminUser):
    return UserService(db).get(user_id)
