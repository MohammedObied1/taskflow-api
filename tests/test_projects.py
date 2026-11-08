def test_create_and_get_project(client, auth, project):
    assert project["name"] == "Apollo"
    assert project["owner"]["username"] == "alice"
    assert project["members"][0]["role"] == "owner"

    r = client.get(f"/api/v1/projects/{project['id']}", headers=auth)
    assert r.status_code == 200
    assert r.json()["task_count"] == 0


def test_list_projects_paginated(client, auth):
    for i in range(3):
        client.post("/api/v1/projects", json={"name": f"P{i}"}, headers=auth)
    r = client.get("/api/v1/projects?page=1&size=2", headers=auth)
    body = r.json()
    assert body["total"] == 3 and len(body["items"]) == 2 and body["pages"] == 2

    r = client.get("/api/v1/projects?search=P1", headers=auth)
    assert r.json()["total"] == 1


def test_non_member_cannot_see_project(client, auth_bob, project):
    r = client.get(f"/api/v1/projects/{project['id']}", headers=auth_bob)
    assert r.status_code == 403
    assert client.get("/api/v1/projects", headers=auth_bob).json()["total"] == 0


def test_membership_roles(client, auth, auth_bob, project):
    bob_id = client.get("/api/v1/auth/me", headers=auth_bob).json()["id"]
    pid = project["id"]

    r = client.post(f"/api/v1/projects/{pid}/members", json={"user_id": bob_id, "role": "viewer"}, headers=auth)
    assert r.status_code == 201
    assert len(r.json()["members"]) == 2

    # viewer can read but not update the project
    assert client.get(f"/api/v1/projects/{pid}", headers=auth_bob).status_code == 200
    assert client.patch(f"/api/v1/projects/{pid}", json={"name": "Hacked"}, headers=auth_bob).status_code == 403

    # duplicate add -> conflict
    assert client.post(f"/api/v1/projects/{pid}/members", json={"user_id": bob_id}, headers=auth).status_code == 409

    # owner cannot be removed, member can
    alice_id = client.get("/api/v1/auth/me", headers=auth).json()["id"]
    assert client.delete(f"/api/v1/projects/{pid}/members/{alice_id}", headers=auth).status_code == 403
    assert client.delete(f"/api/v1/projects/{pid}/members/{bob_id}", headers=auth).status_code == 204
    assert client.get(f"/api/v1/projects/{pid}", headers=auth_bob).status_code == 403


def test_delete_project_cascades(client, auth, project):
    pid = project["id"]
    client.post(f"/api/v1/projects/{pid}/tasks", json={"title": "T"}, headers=auth)
    assert client.delete(f"/api/v1/projects/{pid}", headers=auth).status_code == 204
    assert client.get(f"/api/v1/projects/{pid}", headers=auth).status_code == 404
    assert client.get("/api/v1/tasks", headers=auth).json()["total"] == 0
