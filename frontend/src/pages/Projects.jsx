import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useData } from "../lib/data.js";
import { displayName, hueFor, timeAgo } from "../lib/format.js";
import { useAsync, useDebounced } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Avatar, EmptyState, Icon, PageLoader, Pagination, SearchInput, Spinner } from "../components/ui.jsx";

export default function Projects() {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const { version, openNewProject } = useData();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const result = useAsync(() => api.projects({ search: q, page, size: 12 }), [q, page, version]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t("nav.projects")}</h1>
          <p className="muted">{t("projects.subtitle")}</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={openNewProject}><Icon name="plus" size={16} />{t("projects.new")}</button>
        </div>
      </header>

      <div className="toolbar">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t("projects.search")} />
        {result.loading && result.data && <Spinner size={16} />}
        {result.data && <span className="muted small toolbar-end">{t("projects.total", { n: result.data.total })}</span>}
      </div>

      {!result.data ? <PageLoader /> : result.data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon="folder" title={t(q ? "projects.noMatches" : "projects.empty")} text={t(q ? "tasks.noMatchesText" : "projects.emptyText")}
            action={!q && <button className="btn primary" onClick={openNewProject}><Icon name="plus" size={16} />{t("projects.new")}</button>} />
        </div>
      ) : (
        <>
          <div className="project-grid">
            {result.data.items.map((p) => (
              <a key={p.id} href={`#/projects/${p.id}`} className="card project-card">
                <div className="project-card-top">
                  <span className="project-mark" style={{ "--h": hueFor(p.id * 7919) }}>{p.name[0]?.toUpperCase()}</span>
                  {p.owner.id === user.id && <span className="badge role role-owner">{t("roles.owner")}</span>}
                </div>
                <h3>{p.name}</h3>
                <p className="clamp-2 muted">{p.description || t("projects.noDescription")}</p>
                <div className="project-card-meta">
                  <span className="with-avatar"><Avatar user={p.owner} size={22} /><span className="truncate">{displayName(p.owner)}</span></span>
                  <span className="muted small">{t("projects.updated", { when: timeAgo(p.updated_at, lang) })}</span>
                </div>
              </a>
            ))}
          </div>
          <Pagination page={result.data.page} pages={result.data.pages} total={result.data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
