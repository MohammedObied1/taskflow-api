import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { displayName, formatDay, hueFor, isOverdue, daysUntil, dueDay } from "../lib/format.js";
import { usePrefs } from "../lib/prefs.jsx";

/* ------------------------------------------------------------------ icons */

const PATHS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  check: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  trash: <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  board: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  trend: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" /></>,
  chevron: <path d="M9 18l6-6-6-6" />,
  flag: <path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  done: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
};

export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ compact = false }) {
  return (
    <span className="logo">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && <span className="logo-text">TaskFlow</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ small pieces */

export function Avatar({ user, size = 28 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (!user) {
    return <span className="avatar empty" style={style}><Icon name="user" size={Math.round(size * 0.55)} /></span>;
  }
  const name = displayName(user);
  const initials = name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="avatar" title={name} style={{ ...style, "--h": hueFor(user.username) }}>
      {initials}
    </span>
  );
}

export function AvatarStack({ users, max = 4, size = 28 }) {
  const extra = users.length - max;
  return (
    <span className="avatar-stack">
      {users.slice(0, max).map((u) => <Avatar key={u.id} user={u} size={size} />)}
      {extra > 0 && <span className="avatar more" style={{ width: size, height: size }}>+{extra}</span>}
    </span>
  );
}

export function StatusBadge({ status }) {
  const { t } = usePrefs();
  return <span className={`badge status-${status}`}><i className="dot" />{t(`status.${status}`)}</span>;
}

export function PriorityBadge({ priority, compact = false }) {
  const { t } = usePrefs();
  return (
    <span className={`badge prio prio-${priority}`} title={t(`priority.${priority}`)}>
      <Icon name={priority === "critical" ? "alert" : "flag"} size={12} />
      {!compact && t(`priority.${priority}`)}
    </span>
  );
}

export function RoleBadge({ role }) {
  const { t } = usePrefs();
  return <span className={`badge role role-${role}`}>{t(`roles.${role}`)}</span>;
}

export function DueChip({ task }) {
  const { t, lang } = usePrefs();
  if (!task.due_date) return null;
  const days = daysUntil(task);
  let tone = "";
  let label = formatDay(dueDay(task), lang);
  if (task.status === "done") tone = "muted";
  else if (isOverdue(task)) tone = "danger";
  else if (days === 0) { tone = "warn"; label = t("due.today"); }
  else if (days === 1) { tone = "warn"; label = t("due.tomorrow"); }
  return <span className={`due-chip ${tone}`}><Icon name="calendar" size={12} />{label}</span>;
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" />;
}

export function PageLoader() {
  return <div className="page-loader"><Spinner size={28} /></div>;
}

export function EmptyState({ icon = "folder", title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Field({ label, hint, children, error }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={o.value === value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button type="button" className="icon-btn xs" onClick={() => onChange("")} aria-label="Clear"><Icon name="x" size={14} /></button>}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  const { t } = usePrefs();
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <span className="muted">{t("common.pageOf", { page, pages, total })}</span>
      <div className="pagination-btns">
        <button className="btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>{t("common.prev")}</button>
        <button className="btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>{t("common.next")}</button>
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 56, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-track" />
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-value"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{Math.round(value * 100)}%</text>
    </svg>
  );
}

export function StatusBar({ counts }) {
  const { t } = usePrefs();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="status-bar">
      <div className="status-bar-track">
        {total === 0 ? <span className="status-bar-empty" /> : Object.entries(counts).map(([s, n]) =>
          n > 0 && <span key={s} className={`seg status-${s}`} style={{ flexGrow: n }} title={`${t(`status.${s}`)}: ${n}`} />)}
      </div>
      <ul className="legend">
        {Object.entries(counts).map(([s, n]) => (
          <li key={s}><i className={`dot status-${s}`} />{t(`status.${s}`)}<b>{n}</b></li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ overlays */

// Only the top-most overlay reacts to Escape.
const overlayStack = [];
function useEscape(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const id = {};
    overlayStack.push(id);
    const onKey = (e) => {
      if (e.key === "Escape" && overlayStack[overlayStack.length - 1] === id) ref.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      overlayStack.splice(overlayStack.indexOf(id), 1);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
}

export function Modal({ title, onClose, children, footer, size = "md", onSubmit }) {
  useEscape(onClose);
  const Body = onSubmit ? "form" : "div";
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <Body className={`modal modal-${size}`} role="dialog" aria-modal="true"
        onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(); } : undefined}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </Body>
    </div>,
    document.body,
  );
}

export function Drawer({ onClose, children }) {
  useEscape(onClose);
  return createPortal(
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside className="drawer" role="dialog" aria-modal="true">{children}</aside>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ toasts */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { t } = usePrefs();
  const [toasts, setToasts] = useState([]);

  const push = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({
    success: (text) => push("success", text),
    error: (err) => {
      if (typeof err === "string") return push("error", err);
      const byStatus = { 0: "errors.network", 403: "errors.forbidden", 429: "errors.rateLimit" };
      push("error", byStatus[err?.status] ? t(byStatus[err.status]) : err?.message || t("errors.generic"));
    },
  }), [push, t]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {toasts.map((x) => (
            <div key={x.id} className={`toast ${x.kind}`}>
              <Icon name={x.kind === "success" ? "done" : "alert"} size={17} />
              <span>{x.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ confirm dialog */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const { t } = usePrefs();
  const [state, setState] = useState(null);
  const confirm = useCallback((options) => new Promise((resolve) => setState({ ...options, resolve })), []);
  const close = (answer) => {
    state.resolve(answer);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title} size="sm" onClose={() => close(false)}
          footer={<>
            <button type="button" className="btn ghost" onClick={() => close(false)}>{t("common.cancel")}</button>
            <button type="button" className={`btn ${state.danger ? "danger" : "primary"}`} autoFocus onClick={() => close(true)}>
              {state.confirmLabel || t("common.confirm")}
            </button>
          </>}>
          <p className="muted">{state.text}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
