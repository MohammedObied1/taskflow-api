from datetime import UTC, datetime, timedelta


def _task(client, auth, pid, **overrides):
    payload = {"title": "Write docs", "priority": "high"} | overrides
    r = client.post(f"/api/v1/projects/{pid}/tasks", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_task_crud(client, auth, project):
    task = _task(client, auth, project["id"])
    assert task["status"] == "todo" and task["created_by"]["username"] == "alice"

    r = client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "in_progress", "title": "Write better docs"}, headers=auth)
    assert r.status_code == 200 and r.json()["status"] == "in_progress"

    assert client.delete(f"/api/v1/tasks/{task['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/v1/tasks/{task['id']}", headers=auth).status_code == 404


def test_assignee_must_be_member(client, auth, auth_bob, project):
    bob_id = client.get("/api/v1/auth/me", headers=auth_bob).json()["id"]
    r = client.post(f"/api/v1/projects/{project['id']}/tasks", json={"title": "X", "assignee_id": bob_id}, headers=auth)
    assert r.status_code == 403

    client.post(f"/api/v1/projects/{project['id']}/members", json={"user_id": bob_id, "role": "editor"}, headers=auth)
    task = _task(client, auth, project["id"], assignee_id=bob_id)
    assert task["assignee"]["username"] == "bob"


def test_viewer_cannot_edit_but_can_comment(client, auth, auth_bob, project):
    bob_id = client.get("/api/v1/auth/me", headers=auth_bob).json()["id"]
    client.post(f"/api/v1/projects/{project['id']}/members", json={"user_id": bob_id, "role": "viewer"}, headers=auth)
    task = _task(client, auth, project["id"])

    assert client.post(f"/api/v1/projects/{project['id']}/tasks", json={"title": "nope"}, headers=auth_bob).status_code == 403
    assert client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "done"}, headers=auth_bob).status_code == 403

    r = client.post(f"/api/v1/tasks/{task['id']}/comments", json={"body": "Looks good"}, headers=auth_bob)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert len(client.get(f"/api/v1/tasks/{task['id']}/comments", headers=auth).json()) == 1

    # owner may delete anyone's comment; author may delete own
    assert client.delete(f"/api/v1/comments/{cid}", headers=auth).status_code == 204


def test_filter_search_sort(client, auth, project):
    pid = project["id"]
    _task(client, auth, pid, title="Alpha", priority="low", status="done")
    _task(client, auth, pid, title="Beta", priority="critical")
    _task(client, auth, pid, title="Gamma bugfix", priority="high", status="in_progress")

    assert client.get("/api/v1/tasks?status=done", headers=auth).json()["total"] == 1
    assert client.get("/api/v1/tasks?priority=critical", headers=auth).json()["total"] == 1
    assert client.get("/api/v1/tasks?search=bug", headers=auth).json()["total"] == 1

    titles = [t["title"] for t in client.get("/api/v1/tasks?sort_by=title&order=asc", headers=auth).json()["items"]]
    assert titles == ["Alpha", "Beta", "Gamma bugfix"]


def test_project_stats(client, auth, project):
    pid = project["id"]
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    _task(client, auth, pid, status="done")
    _task(client, auth, pid, status="todo", due_date=past)
    _task(client, auth, pid, status="in_progress")

    stats = client.get(f"/api/v1/projects/{pid}/stats", headers=auth).json()
    assert stats["total_tasks"] == 3
    assert stats["by_status"]["done"] == 1
    assert stats["overdue"] == 1
    assert stats["completion_rate"] == round(1 / 3, 3)
