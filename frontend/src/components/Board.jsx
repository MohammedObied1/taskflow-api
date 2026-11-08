import { useState } from "react";
import { api } from "../lib/api.js";
import { useData } from "../lib/data.js";
import { PRIORITIES, PRIORITY_RANK, STATUSES, byUrgency, displayName } from "../lib/format.js";
import { useAsync } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Avatar, DueChip, Icon, PageLoader, PriorityBadge, SearchInput, Spinner, useToast } from "./ui.jsx";

/** Kanban board for one project. Drag cards between columns to change their status (editors and owners). */
export default function Board({ project, people, canEdit }) {
  const { t } = usePrefs();
  const toast = useToast();
  const { version, bump, openTask } = useData();
  const tasks = useAsync(() => api.tasks({ project_id: project.id, size: 100 }), [project.id, version]);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  if (!tasks.data) return tasks.error ? <p className="muted">{t("errors.loadFailed")}</p> : <PageLoader />;

  const all = tasks.data.items;
  const needle = search.trim().toLowerCase();
  const visible = all.filter((task) =>
    (!needle || task.title.toLowerCase().includes(needle) || task.description?.toLowerCase().includes(needle)) &&
    (!priority || task.priority === priority) &&
    (!assignee || (assignee === "none" ? !task.assignee : String(task.assignee?.id) === assignee)));

  const move = async (task, status) => {
    if (task.status === status) return;
    tasks.setData((d) => ({ ...d, items: d.items.map((x) => (x.id === task.id ? { ...x, status } : x)) }));
    try {
      await api.updateTask(task.id, { status });
      bump();
    } catch (err) {
      toast.error(err);
      tasks.reload();
    }
  };

  const onDrop = (status) => (e) => {
    e.preventDefault();
    const task = all.find((x) => x.id === Number(e.dataTransfer.getData("text/plain")));
    setOverColumn(null);
    setDragId(null);
    if (task) move(task, status);
  };

  return (
    <div className="board-wrap">
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder={t("board.filter")} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">{t("tasks.anyPriority")}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
        </select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">{t("tasks.anyone")}</option>
          <option value="none">{t("task.unassigned")}</option>
          {people.map((m) => <option key={m.user.id} value={m.user.id}>{displayName(m.user)}</option>)}
        </select>
        {tasks.loading && <Spinner size={16} />}
        {canEdit && <span className="muted small toolbar-hint"><Icon name="board" size={14} />{t("board.dragHint")}</span>}
      </div>

      <div className="board">
        {STATUSES.map((status) => {
          const cards = visible
            .filter((task) => task.status === status)
            .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byUrgency(a, b));
          return (
            <section key={status}
              className={`column ${overColumn === status ? "drop-target" : ""}`}
              onDragOver={canEdit ? (e) => { e.preventDefault(); setOverColumn(status); } : undefined}
              onDragLeave={canEdit ? (e) => !e.currentTarget.contains(e.relatedTarget) && setOverColumn(null) : undefined}
              onDrop={canEdit ? onDrop(status) : undefined}>
              <header className="column-head">
                <i className={`dot status-${status}`} />
                <h3>{t(`status.${status}`)}</h3>
                <span className="count">{cards.length}</span>
              </header>
              <div className="column-body">
                {cards.map((task) => (
                  <article key={task.id}
                    className={`card task-card ${dragId === task.id ? "dragging" : ""}`}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(task.id));
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(task.id);
                    }}
                    onDragEnd={() => { setDragId(null); setOverColumn(null); }}
                    onClick={() => openTask(task.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openTask(task.id)}>
                    <div className="task-card-top">
                      <PriorityBadge priority={task.priority} />
                      <DueChip task={task} />
                    </div>
                    <h4>{task.title}</h4>
                    {task.description && <p className="clamp-2">{task.description}</p>}
                    <div className="task-card-foot">
                      <span className="muted small">#{task.id}</span>
                      <Avatar user={task.assignee} size={24} />
                    </div>
                  </article>
                ))}
                {cards.length === 0 && <div className="column-empty">{t("board.emptyColumn")}</div>}
              </div>
              {canEdit && <QuickAdd projectId={project.id} status={status} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function QuickAdd({ projectId, status }) {
  const { t } = usePrefs();
  const toast = useToast();
  const { bump } = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const text = title.trim();
    if (!text) return setOpen(false);
    setSaving(true);
    try {
      await api.createTask(projectId, { title: text, status });
      setTitle("");
      bump();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button className="quick-add-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} />{t("board.addTask")}
      </button>
    );
  }
  return (
    <form className="quick-add" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input autoFocus value={title} maxLength={200} disabled={saving} placeholder={t("board.quickPlaceholder")}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && (setTitle(""), setOpen(false))}
        onBlur={() => !title.trim() && setOpen(false)} />
      <span className="muted small">{t("board.quickHint")}</span>
    </form>
  );
}
