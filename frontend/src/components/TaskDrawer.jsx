import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useData } from "../lib/data.js";
import { PRIORITIES, STATUSES, displayName, dueDay, projectPeople, projectRole, timeAgo, toDueDate, formatDate } from "../lib/format.js";
import { useAsync } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Avatar, Drawer, DueChip, Icon, PageLoader, PriorityBadge, Spinner, StatusBadge, useConfirm, useToast } from "./ui.jsx";

export default function TaskDrawer({ taskId, onClose }) {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const { bump } = useData();
  const toast = useToast();
  const confirm = useConfirm();

  const task = useAsync(() => api.task(taskId), [taskId]);
  const projectId = task.data?.project_id;
  const project = useAsync(() => (projectId ? api.project(projectId) : Promise.resolve(null)), [projectId]);
  const comments = useAsync(() => api.comments(taskId), [taskId]);

  const role = projectRole(project.data, user);
  const canEdit = role === "owner" || role === "editor";
  const people = projectPeople(project.data);

  // Sync local drafts only when that field changes on the server, so saving e.g. the
  // priority doesn't wipe out a description the user is still typing.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const serverTitle = task.data?.title;
  const serverDescription = task.data?.description;
  useEffect(() => setTitle(serverTitle ?? ""), [serverTitle]);
  useEffect(() => setDescription(serverDescription ?? ""), [serverDescription]);

  // Edits apply optimistically and are sent one at a time, so quick successive changes
  // can't race each other; the server copy is adopted (and pages refreshed) once the queue drains.
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const save = (patch) => {
    const { assignee_id: assigneeId, ...fields } = patch;
    const optimistic = "assignee_id" in patch
      ? { ...fields, assignee: people.find((m) => m.user.id === assigneeId)?.user ?? null }
      : fields;
    task.setData((d) => ({ ...d, ...optimistic }));
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        const updated = await api.updateTask(taskId, patch);
        if (pending.current === 1) task.setData(updated);
      } catch (err) {
        toast.error(err);
        task.reload();
      } finally {
        pending.current -= 1;
        if (pending.current === 0) bump();
      }
    });
  };

  const remove = async () => {
    const ok = await confirm({ title: t("task.deleteTitle"), text: t("task.deleteText"), danger: true, confirmLabel: t("common.delete") });
    if (!ok) return;
    try {
      await api.deleteTask(taskId);
      bump();
      toast.success(t("task.deleted"));
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  if (task.error && !task.data) {
    return (
      <Drawer onClose={onClose}>
        <div className="drawer-head"><span /><button className="icon-btn" onClick={onClose}><Icon name="x" /></button></div>
        <div className="drawer-body"><p className="muted">{t(task.error.status === 404 ? "task.notFound" : "errors.loadFailed")}</p></div>
      </Drawer>
    );
  }

  const data = task.data;
  return (
    <Drawer onClose={onClose}>
      <div className="drawer-head">
        <div className="crumbs">
          {project.data && (
            <a href={`#/projects/${project.data.id}`} onClick={onClose} className="crumb-link">{project.data.name}</a>
          )}
          {data && <span className="muted">/ #{data.id}</span>}
        </div>
        <div className="drawer-actions">
          {canEdit && (
            <button className="icon-btn danger" onClick={remove} title={t("common.delete")} aria-label={t("common.delete")}>
              <Icon name="trash" />
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}><Icon name="x" /></button>
        </div>
      </div>

      {!data ? <PageLoader /> : (
        <div className="drawer-body">
          {canEdit ? (
            <textarea className="title-input" rows={1} value={title} maxLength={200}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              onBlur={() => {
                const next = title.trim();
                if (next && next !== data.title) save({ title: next });
                else setTitle(data.title);
              }} />
          ) : (
            <h2 className="title-static">{data.title}</h2>
          )}

          {!canEdit && role && (
            <p className="readonly-note"><Icon name="lock" size={14} />{t("task.readOnly")}</p>
          )}

          <dl className="props">
            <dt>{t("task.status")}</dt>
            <dd>
              {canEdit ? (
                <select className={`pill-select status-${data.status}`} value={data.status} onChange={(e) => save({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                </select>
              ) : <StatusBadge status={data.status} />}
            </dd>

            <dt>{t("task.priority")}</dt>
            <dd>
              {canEdit ? (
                <select className={`pill-select prio-${data.priority}`} value={data.priority} onChange={(e) => save({ priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
                </select>
              ) : <PriorityBadge priority={data.priority} />}
            </dd>

            <dt>{t("task.assignee")}</dt>
            <dd className="with-avatar">
              <Avatar user={data.assignee} size={24} />
              {canEdit ? (
                <select className="plain-select" value={data.assignee?.id ?? ""}
                  onChange={(e) => save({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">{t("task.unassigned")}</option>
                  {people.map((m) => <option key={m.user.id} value={m.user.id}>{displayName(m.user)}</option>)}
                </select>
              ) : <span>{data.assignee ? displayName(data.assignee) : t("task.unassigned")}</span>}
            </dd>

            <dt>{t("task.dueDate")}</dt>
            <dd>
              {canEdit ? (
                <span className="date-edit">
                  <input type="date" value={dueDay(data) ?? ""} onChange={(e) => save({ due_date: toDueDate(e.target.value) })} />
                  {data.due_date && <DueChip task={data} />}
                </span>
              ) : data.due_date ? <DueChip task={data} /> : <span className="muted">{t("task.noDueDate")}</span>}
            </dd>

            <dt>{t("task.createdBy")}</dt>
            <dd className="with-avatar">
              <Avatar user={data.created_by} size={24} />
              <span>{displayName(data.created_by)}</span>
              <span className="muted small" title={formatDate(data.created_at, lang)}>· {timeAgo(data.created_at, lang)}</span>
            </dd>
          </dl>

          <section className="drawer-section">
            <h3>{t("task.description")}</h3>
            {canEdit ? (
              <textarea className="desc-input" rows={5} value={description} maxLength={5000}
                placeholder={t("task.descriptionPlaceholder")}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  const next = description.trim();
                  if (next !== (data.description ?? "")) save({ description: next || null });
                }} />
            ) : (
              <p className="desc-static">{data.description || <span className="muted">{t("task.noDescription")}</span>}</p>
            )}
          </section>

          <Comments taskId={taskId} comments={comments} role={role} />

          <p className="muted small updated-note">{t("task.updated", { when: timeAgo(data.updated_at, lang) })}</p>
        </div>
      )}
    </Drawer>
  );
}

function Comments({ taskId, comments, role }) {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const list = comments.data ?? [];

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const created = await api.addComment(taskId, text);
      comments.setData((c) => [...(c ?? []), created]);
      setBody("");
    } catch (err) {
      toast.error(err);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteComment(id);
      comments.setData((c) => c.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <section className="drawer-section">
      <h3><Icon name="message" size={16} />{t("comments.title")}<span className="count">{list.length}</span></h3>
      {comments.loading && !comments.data ? <Spinner /> : (
        <ul className="comments">
          {list.length === 0 && <li className="muted small">{t("comments.empty")}</li>}
          {list.map((c) => (
            <li key={c.id} className="comment">
              <Avatar user={c.author} size={30} />
              <div className="comment-main">
                <div className="comment-head">
                  <b>{displayName(c.author)}</b>
                  <span className="muted small" title={formatDate(c.created_at, lang)}>{timeAgo(c.created_at, lang)}</span>
                  {(c.author.id === user.id || role === "owner") && (
                    <button className="icon-btn xs danger comment-del" onClick={() => remove(c.id)} aria-label={t("common.delete")}>
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {role && (
        <div className="composer">
          <Avatar user={user} size={30} />
          <div className="composer-box">
            <textarea rows={2} value={body} maxLength={2000} placeholder={t("comments.placeholder")}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && send()} />
            <div className="composer-foot">
              <span className="muted small">{t("comments.hint")}</span>
              <button className="btn primary sm" onClick={send} disabled={sending || !body.trim()}>
                {sending ? <Spinner size={13} /> : <Icon name="send" size={14} />}{t("comments.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
