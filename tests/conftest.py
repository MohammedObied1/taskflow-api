import os

os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-bytes-long"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def _fresh_db():
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register_and_login(client: TestClient, username: str = "alice", email: str | None = None) -> dict[str, str]:
    payload = {"email": email or f"{username}@example.com", "username": username, "password": "Passw0rd123", "full_name": username.title()}
    r = client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201, r.text
    r = client.post("/api/v1/auth/login", data={"username": username, "password": "Passw0rd123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client):
    return register_and_login(client, "alice")


@pytest.fixture
def auth_bob(client):
    return register_and_login(client, "bob")


@pytest.fixture
def project(client, auth):
    r = client.post("/api/v1/projects", json={"name": "Apollo", "description": "Moon landing"}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()
