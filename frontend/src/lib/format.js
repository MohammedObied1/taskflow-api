export const STATUSES = ["todo", "in_progress", "in_review", "done"];
export const PRIORITIES = ["low", "medium", "high", "critical"];
export const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const displayName = (user) => (user ? user.full_name || user.username : "");

// SQLite returns naive datetimes; the API stores UTC, so treat a missing offset as UTC.
export function parseDate(value) {
  if (!value) return null;
  return new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`);
}

// Due dates are compared as calendar days ("YYYY-MM-DD") to stay timezone-proof.
export const dueDay = (task) => (task?.due_date ? task.due_date.slice(0, 10) : null);

export function dayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export const isOverdue = (task) => task.status !== "done" && !!task.due_date && dueDay(task) < dayKey();

export function daysUntil(task) {
  const key = dueDay(task);
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

// End of the chosen day, so a task only becomes overdue once its day has passed.
export const toDueDate = (key) => (key ? `${key}T23:59:59Z` : null);

export const locale = (lang) => (lang === "ar" ? "ar-u-nu-latn" : "en");

export function formatDay(key, lang) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  const sameYear = y === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale(lang), {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(new Date(y, m - 1, d));
}

export function formatDate(value, lang) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "long", year: "numeric" }).format(date) : "";
}

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(value, lang) {
  const date = parseDate(value);
  if (!date) return "";
  const seconds = (date - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "second");
}

export function byUrgency(a, b) {
  const da = dueDay(a) ?? "9999-99-99";
  const db = dueDay(b) ?? "9999-99-99";
  return da.localeCompare(db) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

// Everyone who can be assigned: the members list, plus the owner if the seed didn't add them as a member.
export function projectPeople(project) {
  const members = [...(project?.members ?? [])];
  if (project && !members.some((m) => m.user.id === project.owner.id)) {
    members.unshift({ user: project.owner, role: "owner" });
  }
  return members;
}

// Mirrors ProjectService.role_for on the backend.
export function projectRole(project, user) {
  if (!project || !user) return null;
  if (user.role === "admin" || project.owner.id === user.id) return "owner";
  return project.members.find((m) => m.user.id === user.id)?.role ?? null;
}

export const hueFor = (seed) => [...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);
