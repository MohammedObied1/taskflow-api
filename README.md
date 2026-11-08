# TaskFlow API

A production-style **project & task management REST API** built with FastAPI, SQLAlchemy 2.0 and PostgreSQL.
Designed to demonstrate clean backend architecture: layered services, role-based access control, JWT auth,
database migrations, automated tests, Docker, and CI.

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)](.github/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688)
![Tests](https://img.shields.io/badge/backend-17%20passing%20%7C%2091%25%20coverage-brightgreen)
![Frontend Tests](https://img.shields.io/badge/frontend-26%20passing-brightgreen)

---

## ✨ Features

| Area | What's included |
|---|---|
| **Authentication** | Register / login (OAuth2 password flow), JWT access + refresh tokens with rotation, bcrypt hashing, password-strength validation |
| **Authorization** | Global roles (`admin`, `user`) + per-project roles (`owner`, `editor`, `viewer`) enforced in the service layer |
| **Projects** | CRUD, membership management, per-project analytics (completion rate, overdue count, breakdown by status/priority) |
| **Tasks** | CRUD, status & priority, due dates, assignee validation, threaded comments |
| **Querying** | Filtering, full-text search, multi-field sorting, generic pagination envelope |
| **Platform** | Request-ID tracing, timing headers, sliding-window rate limiting, unified error responses, CORS |
| **Data** | SQLAlchemy 2.0 typed models, Alembic migrations, SQLite (dev) / PostgreSQL (prod) |
| **Quality** | 17 integration tests with pytest, Ruff linting, GitHub Actions CI, multi-stage Docker build |

---

## 🏗️ Architecture

```
app/
├── main.py            # App factory, middleware & router wiring
├── core/              # Cross-cutting concerns
│   ├── config.py      #   Typed settings (pydantic-settings, .env)
│   ├── database.py    #   Engine, session factory, declarative base
│   ├── security.py    #   Password hashing & JWT helpers
│   ├── exceptions.py  #   Domain exceptions → HTTP responses
│   ├── middleware.py  #   Request tracing & rate limiting
│   └── logging.py
├── models/            # SQLAlchemy ORM models (User, Project, ProjectMember, Task, Comment)
├── schemas/           # Pydantic request / response models
├── services/          # Business logic & access control (no HTTP concerns)
└── api/
    ├── deps.py        # Dependencies: DB session, current user, pagination
    └── v1/            # Thin routers: auth, users, projects, tasks, health
alembic/               # Database migrations
scripts/seed.py        # Demo data
tests/                 # Pytest suite (isolated in-memory DB per test)
```

**Request flow:** `Router → Dependency injection → Service → SQLAlchemy → DB`.
Routers only translate HTTP; all rules (permissions, validation, invariants) live in services so they are testable and reusable.

### Data model

```
User ──< ProjectMember >── Project ──< Task ──< Comment
 │                            │          │
 └─── owns ───────────────────┘          └── assignee / created_by ──> User
```

---

## 🚀 Quick start

### Local (SQLite)

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head          # create schema
python -m scripts.seed        # optional demo data
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** for interactive Swagger UI (or `/redoc`).

Demo accounts after seeding: `alice / Alice1234`, `bob / Bob12345`, `admin / Admin1234`.

### Docker (PostgreSQL + built frontend)

```bash
docker compose up --build
```

The image builds the React app in a separate build stage and serves it from the same FastAPI container
alongside the API, so **http://localhost:8000** gives you the full web UI (Swagger stays at `/docs`).
The API container runs migrations automatically and waits for the database health check.

### Web UI (React + Vite)

A dependency-light React client lives in [`frontend/`](frontend). With the API running on `:8000`:

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :8000)
```

Sign in with a demo account (one-click buttons on the login screen) to get:

- **Dashboard**: your open / due-soon / overdue work plus per-project completion.
- **Kanban board**: drag cards between columns to change status, with quick-add per column.
- **Task list**: server-side filtering, search, sorting and pagination.
- **Task drawer**: inline editing of every field, plus threaded comments.
- **Members & settings**: add or remove editors and viewers, rename or delete the project.
- **Role-aware UI**: viewers get a read-only board and can still comment.
- **English / Arabic** (full RTL) and **light / dark** themes, responsive down to phone width.

Tokens are stored client-side and refreshed transparently via `/auth/refresh` when an access token expires.

---

## 🔌 API overview

All endpoints are under `/api/v1`. Authenticated routes expect `Authorization: Bearer <access_token>`.

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/auth/register` | Create account | public |
| POST | `/auth/login` | Get tokens (form: `username`, `password`) | public |
| POST | `/auth/refresh` | Rotate tokens | public |
| GET | `/auth/me` | Current user | user |
| GET | `/users` | List users (paginated) | user |
| PATCH | `/users/me` | Update profile / password | user |
| GET | `/projects` | My projects (`?search=`, `?page=`, `?size=`) | user |
| POST | `/projects` | Create project | user |
| GET/PATCH/DELETE | `/projects/{id}` | Read / update / delete | viewer / owner / owner |
| GET | `/projects/{id}/stats` | Analytics | viewer |
| POST | `/projects/{id}/members` | Add member with role | owner |
| DELETE | `/projects/{id}/members/{user_id}` | Remove member | owner |
| GET | `/tasks` | Search tasks (`status`, `priority`, `assignee_id`, `search`, `sort_by`, `order`) | user |
| POST | `/projects/{id}/tasks` | Create task | editor |
| GET/PATCH/DELETE | `/tasks/{id}` | Read / update / delete | viewer / editor / editor |
| GET/POST | `/tasks/{id}/comments` | List / add comments | viewer |
| DELETE | `/comments/{id}` | Delete comment | author or owner |
| GET | `/health` | Liveness probe | public |

### Example

```bash
# register + login
curl -s -X POST localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","username":"me","password":"Passw0rd123"}'

TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -d 'username=me&password=Passw0rd123' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# create a project and a task
curl -s -X POST localhost:8000/api/v1/projects -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Apollo"}'

curl -s -X POST localhost:8000/api/v1/projects/1/tasks -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"Land on the moon","priority":"critical"}'
```

Paginated responses share one envelope:

```json
{ "items": [...], "total": 42, "page": 1, "size": 20, "pages": 3 }
```

---

## 🧪 Testing & quality

```bash
pytest                 # runs 17 tests with coverage report
ruff check app tests   # lint
ruff format app tests  # format
```

Tests use an in-memory SQLite database that is rebuilt for every test, so they are fast and fully isolated.

The frontend has its own Vitest suite covering the API client (auth headers, error mapping, token-refresh
retry flow) and the pure formatting/permission helpers (`lib/format.js`):

```bash
cd frontend
npm test               # runs 26 tests with Vitest + jsdom
```

The GitHub Actions workflow runs backend lint + tests (3.11/3.12), the frontend tests + build, then builds the Docker image.

---

## 🔐 Security notes

- Passwords hashed with **bcrypt**; never returned by the API.
- Access tokens are short-lived (60 min); refresh tokens (7 days) are typed so they cannot be swapped for access tokens.
- Every permission check happens server-side in the service layer, independent of the client.
- Rate limiting is in-memory per process; for horizontal scaling swap the store for Redis (see `core/middleware.py`).
- Set a strong `SECRET_KEY` (e.g. `openssl rand -hex 32`) and `ENVIRONMENT=production` in deployment.

---

## 🗺️ Roadmap / ideas

- Redis-backed rate limiting & caching
- WebSocket notifications on task updates
- Email verification & password reset
- Audit log of task changes
- Async SQLAlchemy + asyncpg

---

## 📄 License

MIT
