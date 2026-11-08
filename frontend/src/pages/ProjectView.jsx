import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useData } from "../lib/data.js";
import { displayName, formatDate, hueFor, projectPeople, projectRole } from "../lib/format.js";
import { navigate, useAsync } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import Board from "../components/Board.jsx";
import TaskTable from "../components/TaskTable.jsx";
import {
  Avatar, AvatarStack, EmptyState, Field, Icon, PageLoader, ProgressRing, RoleBadge, Spinner, useConfirm, useToast,
} from "../components/ui.jsx";

export default function ProjectView({ projectId, tab }) {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const { version, openNewTask } = useData();
  const project = useAsync(() => api.project(projectId), [projectId, version]);
  const stats = useAsync(() => api.projectStats(projectId), [projectId, version]);

  if (!project.data) {
    if (!project.error) return <PageLoader />;
    return (
      <div className="page">
        <EmptyState icon="alert" title={t(project.error.status === 404 ? "project.notFound" : project.error.status === 403 ? "project.noAccess" : "errors.loadFailed")}
          action={<a className="btn" href="#/projects">{t("project.back")}</a>} />
      </div>
    );
  }

  const p = project.data;
  const role = projectRole(p, user);
  const canEdit = role === "owner" || role === "editor";
  const people = projectPeople(p);
  const s = stats.data;

  const tabs = [
    { id: "board", icon: "board", label: t("project.board") },
    { id: "list", icon: "list", label: t("project.list") },
    { id: "members", icon: "users", label: t("project.members"), count: people.length },
    ...(role === "owner" ? [{ id: "settings", icon: "sliders", label: t("project.settings") }] : []),
  ];
  const current = tabs.some((x) => x.id === tab) ? tab : "board";

  return (
    <div className="page page-wide">
      <nav className="breadcrumb">
        <a href="#/projects">{t("nav.projects")}</a>
        <Icon name="chevron" size={14} className="flip-rtl" />
        <span className="truncate">{p.name}</span>
      </nav>

      <header className="page-head project-head">
        <div className="project-title">
          <span className="project-mark lg" style={{ "--h": hueFor(p.id * 7919) }}>{p.name[0]?.toUpperCase()}</span>
          <div>
            <h1>{p.name}</h1>
            <p className="muted">{p.description || t("projects.noDescription")}</p>
            <p className="meta-line">
              <RoleBadge role={role} />
              <span className="muted small">{t("project.createdOn", { date: formatDate(p.created_at, lang) })}</span>
            </p>
          </div>
        </div>
        <div className="page-actions">
          <a href={`#/projects/${p.id}/members`} className="stack-link" title={t("project.members")}>
            <AvatarStack users={people.map((m) => m.user)} />
          </a>
          {canEdit && (
            <button className="btn primary" onClick={() => openNewTask({ projectId: p.id })}>
              <Icon name="plus" size={16} />{t("task.new")}
            </button>
          )}
        </div>
      </header>

      <div className="stats-strip card">
        <div className="stat-ring">
          <ProgressRing value={s?.completion_rate ?? 0} />
          <div>
            <b>{t("project.completion")}</b>
            <span className="muted small">{t("project.doneOf", { done: s?.by_status.done ?? 0, total: s?.total_tasks ?? 0 })}</span>
          </div>
        </div>
        <Stat label={t("status.todo")} value={s?.by_status.todo} status="todo" />
        <Stat label={t("status.in_progress")} value={s?.by_status.in_progress} status="in_progress" />
        <Stat label={t("status.in_review")} value={s?.by_status.in_review} status="in_review" />
        <Stat label={t("dash.overdue")} value={s?.overdue} danger={s?.overdue > 0} />
      </div>

      <nav className="tabs" role="tablist">
        {tabs.map((x) => (
          <a key={x.id} href={`#/projects/${p.id}/${x.id}`} role="tab" aria-selected={current === x.id}
            className={`tab ${current === x.id ? "active" : ""}`}>
            <Icon name={x.icon} size={16} />{x.label}
            {x.count !== undefined && <span className="count">{x.count}</span>}
          </a>
        ))}
      </nav>

      {current === "board" && <Board project={p} people={people} canEdit={canEdit} />}
      {current === "list" && <TaskTable projectId={p.id} people={people} />}
      {current === "members" && <Members project={p} people={people} role={role} />}
      {current === "settings" && <Settings project={p} />}
    </div>
  );
}

function Stat({ label, value, status, danger }) {
  return (
    <div className={`stat ${danger ? "danger" : ""}`}>
      <span className="stat-label">{status && <i className={`dot status-${status}`} />}{label}</span>
      <span className="stat-value">{value ?? "–"}</span>
    </div>
  );
}

function Members({ project, people, role }) {
  const { t } = usePrefs();
  const { user } = useAuth();
  const { bump } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const isOwner = role === "owner";
  const users = useAsync(() => (isOwner ? api.users({ size: 100 }) : Promise.resolve(null)), [isOwner]);
  const [pick, setPick] = useState("");
  const [newRole, setNewRole] = useState("editor");
  const [adding, setAdding] = useState(false);

  const memberIds = new Set(people.map((m) => m.user.id));
  const candidates = (users.data?.items ?? []).filter((u) => !memberIds.has(u.id));

  const add = async (e) => {
    e.preventDefault();
    if (!pick) return;
    setAdding(true);
    try {
      await api.addMember(project.id, { user_id: Number(pick), role: newRole });
      setPick("");
      bump();
      toast.success(t("members.added"));
    } catch (err) {
      toast.error(err);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (member) => {
    const ok = await confirm({
      title: t("members.removeTitle"),
      text: t("members.removeText", { name: displayName(member.user) }),
      danger: true,
      confirmLabel: t("members.remove"),
    });
    if (!ok) return;
    try {
      await api.removeMember(project.id, member.user.id);
      bump();
      toast.success(t("members.removed"));
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="members-layout">
      <section className="card panel">
        <header className="panel-head"><h2>{t("project.members")}<span className="count">{people.length}</span></h2></header>
        <ul className="member-list">
          {people.map((m) => (
            <li key={m.user.id}>
              <Avatar user={m.user} size={38} />
              <div className="member-main">
                <b>{displayName(m.user)}{m.user.id === user.id && <span className="you">{t("members.you")}</span>}</b>
                <small className="muted"><bdi>@{m.user.username}</bdi></small>
              </div>
              <RoleBadge role={m.role} />
              {isOwner && m.user.id !== project.owner.id ? (
                <button className="icon-btn danger" onClick={() => remove(m)} title={t("members.remove")} aria-label={t("members.remove")}>
                  <Icon name="trash" size={16} />
                </button>
              ) : <span className="icon-btn-spacer" />}
            </li>
          ))}
        </ul>
      </section>

      <aside className="members-side">
        {isOwner && (
          <form className="card panel" onSubmit={add}>
            <header className="panel-head"><h2>{t("members.add")}</h2></header>
            <Field label={t("members.user")}>
              <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={!users.data}>
                <option value="">{users.data ? (candidates.length ? t("members.choose") : t("members.noneLeft")) : "…"}</option>
                {candidates.map((u) => <option key={u.id} value={u.id}>{displayName(u)} (@{u.username})</option>)}
              </select>
            </Field>
            <Field label={t("members.role")}>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="editor">{t("roles.editor")}</option>
                <option value="viewer">{t("roles.viewer")}</option>
              </select>
            </Field>
            <button type="submit" className="btn primary block" disabled={!pick || adding}>
              {adding && <Spinner size={14} />}{t("members.addBtn")}
            </button>
          </form>
        )}
        <div className="card panel roles-help">
          <header className="panel-head"><h2>{t("members.rolesTitle")}</h2></header>
          {["owner", "editor", "viewer"].map((r) => (
            <p key={r}><RoleBadge role={r} /><span className="muted small">{t(`members.roleHelp.${r}`)}</span></p>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Settings({ project }) {
  const { t } = usePrefs();
  const { bump } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
  }, [project.name, project.description]);

  const dirty = name.trim() !== project.name || description.trim() !== (project.description ?? "");

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProject(project.id, { name: name.trim(), description: description.trim() || null });
      bump();
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    const ok = await confirm({
      title: t("settings.deleteTitle"),
      text: t("settings.deleteText", { name: project.name }),
      danger: true,
      confirmLabel: t("settings.deleteBtn"),
    });
    if (!ok) return;
    try {
      await api.deleteProject(project.id);
      bump();
      toast.success(t("settings.deleted"));
      navigate("/projects");
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="settings">
      <form className="card panel" onSubmit={save}>
        <header className="panel-head"><h2>{t("settings.general")}</h2></header>
        <Field label={t("projects.name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </Field>
        <Field label={t("projects.description")}>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={!dirty || !name.trim() || saving}>
            {saving && <Spinner size={14} />}{t("common.save")}
          </button>
        </div>
      </form>

      <section className="card panel danger-zone">
        <header className="panel-head"><h2>{t("settings.danger")}</h2></header>
        <div className="danger-row">
          <div>
            <b>{t("settings.deleteTitle")}</b>
            <p className="muted small">{t("settings.deleteHelp")}</p>
          </div>
          <button type="button" className="btn danger" onClick={destroy}><Icon name="trash" size={16} />{t("settings.deleteBtn")}</button>
        </div>
      </section>
    </div>
  );
}
