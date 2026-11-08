import { useState } from "react";
import { api } from "../lib/api.js";
import { useData } from "../lib/data.js";
import { PRIORITIES, STATUSES, displayName, projectPeople, toDueDate } from "../lib/format.js";
import { navigate, useAsync } from "../lib/hooks.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Field, Modal, Spinner, useToast } from "./ui.jsx";

export function NewTaskModal({ projectId, status = "todo", onClose }) {
  const { t } = usePrefs();
  const toast = useToast();
  const { projects, bump, openTask } = useData();
  const [form, setForm] = useState({
    project_id: projectId ?? projects[0]?.id ?? "",
    title: "",
    description: "",
    status,
    priority: "medium",
    assignee_id: "",
    due: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const project = useAsync(() => (form.project_id ? api.project(form.project_id) : Promise.resolve(null)), [form.project_id]);
  const people = projectPeople(project.data);

  const submit = async () => {
    if (!form.title.trim() || !form.project_id) return;
    setSaving(true);
    try {
      const task = await api.createTask(form.project_id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        due_date: toDueDate(form.due),
      });
      bump();
      toast.success(t("task.created"));
      onClose();
      if (projectId === undefined) openTask(task.id);
    } catch (err) {
      toast.error(err);
      setSaving(false);
    }
  };

  return (
    <Modal title={t("task.new")} onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
        <button type="submit" className="btn primary" disabled={saving || !form.title.trim() || !form.project_id}>
          {saving && <Spinner size={14} />}{t("task.create")}
        </button>
      </>}>
      {projectId === undefined && (
        <Field label={t("task.project")}>
          <select value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: Number(e.target.value), assignee_id: "" }))}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <Field label={t("task.title")}>
        <input autoFocus value={form.title} onChange={set("title")} maxLength={200} placeholder={t("task.titlePlaceholder")} />
      </Field>
      <Field label={t("task.description")}>
        <textarea rows={4} value={form.description} onChange={set("description")} maxLength={5000} placeholder={t("task.descriptionPlaceholder")} />
      </Field>
      <div className="grid-2">
        <Field label={t("task.status")}>
          <select value={form.status} onChange={set("status")}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t("task.priority")}>
          <select value={form.priority} onChange={set("priority")}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </select>
        </Field>
        <Field label={t("task.assignee")}>
          <select value={form.assignee_id} onChange={set("assignee_id")}>
            <option value="">{t("task.unassigned")}</option>
            {people.map((m) => <option key={m.user.id} value={m.user.id}>{displayName(m.user)}</option>)}
          </select>
        </Field>
        <Field label={t("task.dueDate")}>
          <input type="date" value={form.due} onChange={set("due")} />
        </Field>
      </div>
    </Modal>
  );
}

export function NewProjectModal({ onClose }) {
  const { t } = usePrefs();
  const toast = useToast();
  const { bump } = useData();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const project = await api.createProject({ name: name.trim(), description: description.trim() || null });
      bump();
      toast.success(t("projects.created"));
      onClose();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err);
      setSaving(false);
    }
  };

  return (
    <Modal title={t("projects.new")} onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
        <button type="submit" className="btn primary" disabled={saving || !name.trim()}>
          {saving && <Spinner size={14} />}{t("projects.create")}
        </button>
      </>}>
      <Field label={t("projects.name")}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t("projects.namePlaceholder")} />
      </Field>
      <Field label={t("projects.description")}>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder={t("projects.descriptionPlaceholder")} />
      </Field>
    </Modal>
  );
}
