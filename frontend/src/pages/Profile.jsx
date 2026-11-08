import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatDate } from "../lib/format.js";
import { usePrefs } from "../lib/prefs.jsx";
import { Avatar, Field, Icon, RoleBadge, Spinner, useToast } from "../components/ui.jsx";

export default function Profile() {
  const { t, lang } = usePrefs();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const pwError =
    pw.next && pw.next.length < 8 ? t("profile.pwShort")
      : pw.next && !(/\d/.test(pw.next) && /[a-z]/i.test(pw.next)) ? t("profile.pwWeak")
        : pw.confirm && pw.confirm !== pw.next ? t("profile.pwMismatch")
          : "";

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      setUser(await api.updateMe({ full_name: fullName.trim() || null }));
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(err);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwError || !pw.next || pw.next !== pw.confirm) return;
    setSavingPw(true);
    try {
      await api.updateMe({ password: pw.next });
      setPw({ next: "", confirm: "" });
      toast.success(t("profile.pwChanged"));
    } catch (err) {
      toast.error(err);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t("profile.title")}</h1>
          <p className="muted">{t("profile.subtitle")}</p>
        </div>
      </header>

      <div className="profile-layout">
        <section className="card profile-card">
          <Avatar user={user} size={84} />
          <h2>{user.full_name || user.username}</h2>
          <p className="muted"><bdi>@{user.username}</bdi></p>
          <RoleBadge role={user.role} />
          <dl className="profile-facts">
            <dt>{t("auth.email")}</dt><dd>{user.email}</dd>
            <dt>{t("profile.memberSince")}</dt><dd>{formatDate(user.created_at, lang)}</dd>
          </dl>
          <button className="btn ghost block" onClick={logout}><Icon name="logout" size={16} />{t("auth.logout")}</button>
        </section>

        <div className="profile-forms">
          <form className="card panel" onSubmit={saveName}>
            <header className="panel-head"><h2>{t("profile.details")}</h2></header>
            <Field label={t("auth.fullName")}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t("auth.username")} hint={t("profile.usernameFixed")}>
              <input value={user.username} disabled />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={savingName || fullName.trim() === (user.full_name ?? "")}>
                {savingName && <Spinner size={14} />}{t("common.save")}
              </button>
            </div>
          </form>

          <form className="card panel" onSubmit={savePassword}>
            <header className="panel-head"><h2>{t("profile.password")}</h2></header>
            <div className="grid-2">
              <Field label={t("profile.newPassword")}>
                <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
              </Field>
              <Field label={t("profile.confirmPassword")}>
                <input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
              </Field>
            </div>
            {pwError ? <p className="field-error">{pwError}</p> : <p className="field-hint">{t("auth.passwordHint")}</p>}
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={savingPw || !!pwError || !pw.next || pw.next !== pw.confirm}>
                {savingPw && <Spinner size={14} />}{t("profile.changePassword")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
