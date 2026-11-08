import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useData } from "../lib/data.js";
import { STATUSES, byUrgency, daysUntil, formatDate, hueFor, isOverdue } from "../lib/format.js";
import { useAsync } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Avatar, DueChip, EmptyState, Icon, PageLoader, PriorityBadge, ProgressRing, StatusBar } from "../components/ui.jsx";

export default function Dashboard() {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const { version, projects, projectsLoaded, projectName, openTask, openNewTask, openNewProject } = useData();

  const mine = useAsync(() => api.tasks({ assignee_id: user.id, size: 100 }), [version]);
  const top = projects.slice(0, 6);
  const stats = useAsync(
    () => Promise.all(top.map((p) => api.projectStats(p.id).catch(() => null))),
    [version, top.map((p) => p.id).join()],
  );

  if (!mine.data || !projectsLoaded) return <PageLoader />;

  const tasks = mine.data.items;
  const open = tasks.filter((x) => x.status !== "done");
  const overdue = open.filter(isOverdue);
  const dueSoon = open.filter((x) => {
    const d = daysUntil(x);
    return d !== null && d >= 0 && d <= 7;
  });
  const done = tasks.filter((x) => x.status === "done");
  const focus = [...open].sort(byUrgency).slice(0, 7);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((x) => x.status === s).length]));

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "dash.morning" : hour < 18 ? "dash.afternoon" : "dash.evening");

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{formatDate(new Date().toISOString(), lang)}</p>
          <h1>{t("dash.hello", { greeting, name: user.full_name?.split(" ")[0] || user.username })}</h1>
          <p className="muted">{open.length ? t("dash.summary", { open: open.length, overdue: overdue.length }) : t("dash.allClear")}</p>
        </div>
        <div className="page-actions">
          <button className="btn ghost" onClick={openNewProject}><Icon name="folder" size={16} />{t("projects.new")}</button>
          {projects.length > 0 && <button className="btn primary" onClick={() => openNewTask()}><Icon name="plus" size={16} />{t("task.new")}</button>}
        </div>
      </header>

      <div className="kpis">
        <Kpi icon="target" tone="indigo" label={t("dash.open")} value={open.length} />
        <Kpi icon="clock" tone="amber" label={t("dash.dueSoon")} value={dueSoon.length} />
        <Kpi icon="alert" tone="red" label={t("dash.overdue")} value={overdue.length} />
        <Kpi icon="done" tone="green" label={t("dash.completed")} value={done.length} />
      </div>

      <div className="dash-grid">
        <section className="card panel">
          <header className="panel-head">
            <h2>{t("dash.focus")}</h2>
            <a href="#/tasks" className="link">{t("common.viewAll")}<Icon name="chevron" size={14} className="flip-rtl" /></a>
          </header>
          {focus.length === 0 ? (
            <EmptyState icon="done" title={t("dash.focusEmpty")} text={t("dash.focusEmptyText")} />
          ) : (
            <ul className="focus-list">
              {focus.map((task) => (
                <li key={task.id}>
                  <button className="focus-item" onClick={() => openTask(task.id)}>
                    <i className={`dot status-${task.status}`} />
                    <span className="focus-main">
                      <b className="truncate">{task.title}</b>
                      <small className="muted truncate">{projectName(task.project_id)}</small>
                    </span>
                    <PriorityBadge priority={task.priority} compact />
                    <DueChip task={task} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card panel">
          <header className="panel-head"><h2>{t("dash.workload")}</h2></header>
          {tasks.length === 0 ? <p className="muted">{t("dash.noAssigned")}</p> : <StatusBar counts={counts} />}
          {overdue.length > 0 && (
            <div className="callout danger">
              <Icon name="alert" size={16} />
              <span>{t("dash.overdueCallout", { n: overdue.length })}</span>
            </div>
          )}
        </section>
      </div>

      <section className="section">
        <header className="section-head">
          <h2>{t("nav.projects")}</h2>
          {projects.length > 0 && <a href="#/projects" className="link">{t("common.viewAll")}<Icon name="chevron" size={14} className="flip-rtl" /></a>}
        </header>
        {top.length === 0 ? (
          <div className="card">
            <EmptyState icon="folder" title={t("projects.empty")} text={t("projects.emptyText")}
              action={<button className="btn primary" onClick={openNewProject}><Icon name="plus" size={16} />{t("projects.new")}</button>} />
          </div>
        ) : (
          <div className="project-grid">
            {top.map((p, i) => {
              const s = stats.data?.[i];
              return (
                <a key={p.id} href={`#/projects/${p.id}`} className="card project-card compact">
                  <div className="project-card-top">
                    <span className="project-mark" style={{ "--h": hueFor(p.id * 7919) }}>{p.name[0]?.toUpperCase()}</span>
                    {s ? <ProgressRing value={s.completion_rate} size={48} stroke={5} /> : <span className="ring-placeholder" />}
                  </div>
                  <h3 className="truncate">{p.name}</h3>
                  <div className="project-card-meta">
                    {s ? (
                      <>
                        <span>{t("projects.taskCount", { n: s.total_tasks })}</span>
                        {s.overdue > 0 && <span className="text-danger">{t("projects.overdueCount", { n: s.overdue })}</span>}
                      </>
                    ) : <span className="muted">…</span>}
                    <Avatar user={p.owner} size={22} />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, tone, label, value }) {
  return (
    <div className="card kpi">
      <span className={`kpi-icon tone-${tone}`}><Icon name={icon} size={20} /></span>
      <div>
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">{label}</span>
      </div>
    </div>
  );
}
