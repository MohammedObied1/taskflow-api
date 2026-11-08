// Thin client for the TaskFlow REST API (/api/v1).
// Handles bearer tokens, transparent refresh-token rotation and FastAPI error shapes.

const BASE = "/api/v1";
const STORAGE_KEY = "taskflow.tokens";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

let tokens = readTokens();
let onExpired = () => {};

export const session = {
  get: () => tokens,
  set(next) {
    tokens = next;
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable: keep the session in memory only */
    }
  },
  onExpired(fn) {
    onExpired = fn;
  },
};

function errorMessage(status, data) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // Pydantic validation errors: [{loc: ["body", "field"], msg: "..."}]
    return detail
      .map((e) => {
        const field = (e.loc || []).filter((p) => p !== "body").join(".");
        return field ? `${field}: ${e.msg}` : e.msg;
      })
      .join("\n");
  }
  return `Request failed (${status})`;
}

// Concurrent 401s share one refresh call, so the rotated refresh token is only spent once.
let refreshing = null;
function refreshTokens() {
  if (!tokens?.refresh_token) return Promise.resolve(false);
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      session.set(await res.json());
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request(path, { method = "GET", body, form, query } = {}, canRetry = true) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }

  const headers = {};
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (tokens?.access_token) headers.Authorization = `Bearer ${tokens.access_token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Network error");
  }

  if (res.status === 401 && canRetry && tokens?.refresh_token && path !== "/auth/login") {
    if (await refreshTokens()) return request(path, { method, body, form, query }, false);
    session.set(null);
    onExpired();
  }

  // Gateway errors mean the API itself is down or unreachable — report it like a network failure.
  if ([502, 503, 504].includes(res.status)) throw new ApiError(0, "Network error");
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
  return data;
}

export const api = {
  // auth & users
  login: (username, password) => request("/auth/login", { method: "POST", form: { username, password } }),
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  me: () => request("/auth/me"),
  updateMe: (data) => request("/users/me", { method: "PATCH", body: data }),
  users: (query) => request("/users", { query }),

  // projects
  projects: (query) => request("/projects", { query }),
  project: (id) => request(`/projects/${id}`),
  createProject: (data) => request("/projects", { method: "POST", body: data }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: "PATCH", body: data }),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),
  projectStats: (id) => request(`/projects/${id}/stats`),
  addMember: (id, data) => request(`/projects/${id}/members`, { method: "POST", body: data }),
  removeMember: (id, userId) => request(`/projects/${id}/members/${userId}`, { method: "DELETE" }),

  // tasks & comments
  tasks: (query) => request("/tasks", { query }),
  task: (id) => request(`/tasks/${id}`),
  createTask: (projectId, data) => request(`/projects/${projectId}/tasks`, { method: "POST", body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PATCH", body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
  comments: (taskId) => request(`/tasks/${taskId}/comments`),
  addComment: (taskId, body) => request(`/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
  deleteComment: (id) => request(`/comments/${id}`, { method: "DELETE" }),
};
