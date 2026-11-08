import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./lib/api.js";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { DataContext, useData } from "./lib/data.js";
import { hueFor } from "./lib/format.js";
import { useAsync, useRoute } from "./lib/hooks.js";
import { PrefsProvider, usePrefs } from "./lib/prefs.jsx";
import { Avatar, ConfirmProvider, Icon, Logo, PageLoader, ToastProvider } from "./components/ui.jsx";
import TaskDrawer from "./components/TaskDrawer.jsx";
import { NewProjectModal, NewTaskModal } from "./components/modals.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectView from "./pages/ProjectView.jsx";
import MyTasks from "./pages/MyTasks.jsx";
import Profile from "./pages/Profile.jsx";

export default function App() {
  return (
    <PrefsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </PrefsProvider>
  );
}

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (!user) return <Login />;
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function DataProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [taskId, setTaskId] = useState(null);
  const [newTask, setNewTask] = useState(null);
  const [newProject, setNewProject] = useState(false);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Teammates change things too: refresh everything when the user comes back to the tab.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && bump();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [bump]);

  // One shared request for every project the user can see (sidebar, name lookups, pickers).
  const projects = useAsync(() => api.projects({ size: 100 }), [version]);

  const value = useMemo(() => {
    const list = projects.data?.items ?? [];
    return {
      version,
      bump,
      projects: list,
      projectsLoaded: !!projects.data,
      projectName: (id) => list.find((p) => p.id === id)?.name ?? `#${id}`,
      openTask: setTaskId,
      openNewTask: (options = {}) => setNewTask(options),
      openNewProject: () => setNewProject(true),
    };
  }, [version, bump, projects.data]);

  return (
    <DataContext.Provider value={value}>
      {children}
      {taskId && <TaskDrawer key={taskId} taskId={taskId} onClose={() => setTaskId(null)} />}
      {newTask && <NewTaskModal {...newTask} onClose={() => setNewTask(null)} />}
      {newProject && <NewProjectModal onClose={() => setNewProject(false)} />}
    </DataContext.Provider>
  );
}

function Shell() {
  const route = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, [route]);

  const [path] = route.split("?");
  const seg = path.split("/").filter(Boolean);
  let page;
  if (seg[0] === "projects" && seg[1]) page = <ProjectView key={seg[1]} projectId={Number(seg[1])} tab={seg[2] || "board"} />;
  else if (seg[0] === "projects") page = <Projects />;
  else if (seg[0] === "tasks") page = <MyTasks />;
  else if (seg[0] === "profile") page = <Profile />;
  else page = <Dashboard />;

  return (
    <div className="app">
      <Sidebar path={path} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="main">
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="Menu"><Icon name="menu" /></button>
          <Logo />
        </div>
        <main className="content">{page}</main>
      </div>
    </div>
  );
}

function Sidebar({ path, open, onClose }) {
  const { t, lang, setLang, theme, setTheme } = usePrefs();
  const { user, logout } = useAuth();
  const { projects, openNewProject } = useData();

  const link = (href, icon, label, active) => (
    <a href={`#${href}`} className={`nav-link ${active ? "active" : ""}`}>
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </a>
  );

  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-btn only-mobile" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>

        <nav className="nav">
          {link("/", "grid", t("nav.dashboard"), path === "/")}
          {link("/tasks", "check", t("nav.myTasks"), path.startsWith("/tasks"))}
          {link("/projects", "folder", t("nav.projects"), path === "/projects")}
        </nav>

        <div className="nav-section">
          <span>{t("nav.yourProjects")}</span>
          <button className="icon-btn xs" onClick={openNewProject} title={t("projects.new")} aria-label={t("projects.new")}>
            <Icon name="plus" size={15} />
          </button>
        </div>
        <nav className="nav nav-projects">
          {projects.slice(0, 8).map((p) => (
            <a key={p.id} href={`#/projects/${p.id}`}
              className={`nav-link ${path.startsWith(`/projects/${p.id}`) ? "active" : ""}`}>
              <i className="project-dot" style={{ "--h": hueFor(p.id * 7919) }} />
              <span className="truncate">{p.name}</span>
            </a>
          ))}
          {projects.length === 0 && <p className="nav-empty">{t("nav.noProjects")}</p>}
          {projects.length > 8 && <a href="#/projects" className="nav-link muted">{t("nav.allProjects", { n: projects.length })}</a>}
        </nav>

        <div className="sidebar-foot">
          <div className="prefs">
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={t(theme === "dark" ? "prefs.light" : "prefs.dark")} aria-label={t("prefs.theme")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button className="lang-btn" onClick={() => setLang(lang === "ar" ? "en" : "ar")} title={t("prefs.language")}>
              <Icon name="globe" size={16} />
              {lang === "ar" ? "English" : "العربية"}
            </button>
          </div>
          <div className="user-card">
            <a href="#/profile" className="user-card-link">
              <Avatar user={user} size={34} />
              <span className="user-card-text">
                <b className="truncate">{user.full_name || user.username}</b>
                <small className="truncate"><bdi>@{user.username}</bdi>{user.role === "admin" ? ` · ${t("roles.admin")}` : ""}</small>
              </span>
            </a>
            <button className="icon-btn" onClick={logout} title={t("auth.logout")} aria-label={t("auth.logout")}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
