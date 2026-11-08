def test_register_and_me(client, auth):
    r = client.get("/api/v1/auth/me", headers=auth)
    assert r.status_code == 200
    assert r.json()["username"] == "alice"
    assert "hashed_password" not in r.json()


def test_register_duplicate(client, auth):
    r = client.post("/api/v1/auth/register", json={"email": "alice@example.com", "username": "alice2", "password": "Passw0rd123"})
    assert r.status_code == 409


def test_weak_password_rejected(client):
    r = client.post("/api/v1/auth/register", json={"email": "x@example.com", "username": "xuser", "password": "onlyletters"})
    assert r.status_code == 422


def test_login_wrong_password(client, auth):
    r = client.post("/api/v1/auth/login", data={"username": "alice", "password": "wrong"})
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate") == "Bearer"


def test_refresh_token_rotation(client):
    client.post("/api/v1/auth/register", json={"email": "c@example.com", "username": "carol", "password": "Passw0rd123"})
    tokens = client.post("/api/v1/auth/login", data={"username": "carol", "password": "Passw0rd123"}).json()
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    assert "access_token" in r.json()

    # access token must not be accepted as a refresh token
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert r.status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/api/v1/projects").status_code == 401
    assert client.get("/api/v1/projects", headers={"Authorization": "Bearer nonsense"}).status_code == 401
