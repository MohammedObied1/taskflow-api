from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DBSession
from app.schemas.token import RefreshRequest, Token
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Create a new account")
def register(data: UserCreate, db: DBSession):
    return UserService(db).create(data)


@router.post("/login", response_model=Token, summary="Obtain access & refresh tokens")
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DBSession):
    service = AuthService(db)
    user = service.authenticate(form.username, form.password)
    return service.issue_tokens(user)


@router.post("/refresh", response_model=Token, summary="Rotate tokens using a refresh token")
def refresh(data: RefreshRequest, db: DBSession):
    return AuthService(db).refresh(data.refresh_token)


@router.get("/me", response_model=UserRead, summary="Current authenticated user")
def me(user: CurrentUser):
    return user
