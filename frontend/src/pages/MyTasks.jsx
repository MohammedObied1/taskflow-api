import { useData } from "../lib/data.js";
import { usePrefs } from "../lib/prefs.jsx";
import TaskTable from "../components/TaskTable.jsx";
import { Icon } from "../components/ui.jsx";

export default function MyTasks() {
  const { t } = usePrefs();
  const { projects, openNewTask } = useData();
  return (
    <div className="page page-wide">
      <header className="page-head">
        <div>
          <h1>{t("nav.myTasks")}</h1>
          <p className="muted">{t("tasks.subtitle")}</p>
        </div>
        {projects.length > 0 && (
          <div className="page-actions">
            <button className="btn primary" onClick={() => openNewTask()}><Icon name="plus" size={16} />{t("task.new")}</button>
          </div>
        )}
      </header>
      <TaskTable />
    </div>
  );
}
