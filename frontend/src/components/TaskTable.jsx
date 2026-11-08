import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useData } from "../lib/data.js";
import { PRIORITIES, STATUSES, displayName, timeAgo } from "../lib/format.js";
import { useAsync, useDebounced } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Avatar, DueChip, EmptyState, Pagination, PriorityBadge, SearchInput, Segmented, Spinner, StatusBadge } from "./ui.jsx";

const SORTS = ["created_at:desc", "due_date:asc", "title:asc", "status:asc"];

/**
 * Server-side filtered, sorted and paginated task table.
 * `projectId` scopes to one project; otherwise shows a project column + project filter and a mine/all switch.
 */
export default function TaskTable({ projectId, people = [] }) {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const { version, openTask, projects, projectName } = useData();
  const scoped = projectId !== undefined;

  const [filters, setFilters] = useState({
    scope: scoped ? "all" : "mine",
    project: "",
    status: "",
    priority: "",
    assignee: "",
    sort: SORTS[0],
    page: 1,
  });
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  const [sortBy, order] = filters.sort.split(":");
  const assigneeId = !scoped && filters.scope === "mine" ? user.id : filters.assignee;
  const query = {
    project_id: scoped ? projectId : filters.project,
    status: filters.status,
    priority: filters.priority,
    assignee_id: assigneeId,
    search: q,
    sort_by: sortBy,
    order,
    page: filters.page,
    size: 15,
  };
  const result = useAsync(() => api.tasks(query), [JSON.stringify(query), version]);
  const items = result.data?.items ?? [];
  const hasFilters = filters.status || filters.priority || filters.assignee || filters.project || q;

  return (
    <div className="task-table-wrap">
      <div className="toolbar">
        {!scoped && (
          <Segmented value={filters.scope} onChange={(scope) => update({ scope })}
            options={[{ value: "mine", label: t("tasks.assignedToMe"), icon: "user" }, { value: "all", label: t("tasks.allTasks"), icon: "list" }]} />
        )}
        <SearchInput value={search} onChange={(v) => { setSearch(v); update({}); }} placeholder={t("tasks.search")} />
        {!scoped && (
          <select value={filters.project} onChange={(e) => update({ project: e.target.value })}>
            <option value="">{t("tasks.allProjects")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">{t("tasks.anyStatus")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => update({ priority: e.target.value })}>
          <option value="">{t("tasks.anyPriority")}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
        </select>
        {scoped && (
          <select value={filters.assignee} onChange={(e) => update({ assignee: e.target.value })}>
            <option value="">{t("tasks.anyone")}</option>
            {people.map((m) => <option key={m.user.id} value={m.user.id}>{displayName(m.user)}</option>)}
          </select>
        )}
        <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label={t("tasks.sort")}>
          {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s.split(":")[0]}`)}</option>)}
        </select>
        {result.loading && <Spinner size={16} />}
      </div>

      {result.data && items.length === 0 ? (
        <EmptyState icon="check" title={t(hasFilters ? "tasks.noMatches" : "tasks.empty")}
          text={t(hasFilters ? "tasks.noMatchesText" : "tasks.emptyText")} />
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t("task.title")}</th>
                <th>{t("task.status")}</th>
                <th>{t("task.priority")}</th>
                <th className="hide-sm">{t("task.assignee")}</th>
                <th>{t("task.dueDate")}</th>
                <th className="hide-md">{t("task.updatedCol")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((task) => (
                <tr key={task.id} onClick={() => openTask(task.id)} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && openTask(task.id)}>
                  <td className="cell-title">
                    <span className="truncate">{task.title}</span>
                    <small className="muted">#{task.id}{!scoped && ` · ${projectName(task.project_id)}`}</small>
                  </td>
                  <td><StatusBadge status={task.status} /></td>
                  <td><PriorityBadge priority={task.priority} /></td>
                  <td className="hide-sm">
                    <span className="with-avatar">
                      <Avatar user={task.assignee} size={22} />
                      <span className="truncate">{task.assignee ? displayName(task.assignee) : <span className="muted">{t("task.unassigned")}</span>}</span>
                    </span>
                  </td>
                  <td>{task.due_date ? <DueChip task={task} /> : <span className="muted">—</span>}</td>
                  <td className="hide-md muted">{timeAgo(task.updated_at, lang)}</td>
                </tr>
              ))}
              {!result.data && (
                <tr><td colSpan={6} className="table-loading"><Spinner /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {result.data && (
        <Pagination page={result.data.page} pages={result.data.pages} total={result.data.total}
          onChange={(page) => setFilters((f) => ({ ...f, page }))} />
      )}
    </div>
  );
}
