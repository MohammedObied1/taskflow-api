import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { usePrefs } from "../lib/prefs.jsx";
import { Field, Icon, Logo, Segmented, Spinner, useToast } from "../components/ui.jsx";

const DEMO = [
  { username: "alice", password: "Alice1234", role: "owner" },
  { username: "bob", password: "Bob12345", role: "editor" },
  { username: "admin", password: "Admin1234", role: "admin" },
];

export default function Login() {
  const { t, lang, setLang, theme, setTheme } = usePrefs();
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", email: "", full_name: "" });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const signIn = async (username, password) => {
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err.status === 401 ? t("auth.invalid") : err.status === 0 ? t("errors.network") : err.message);
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "login") return signIn(form.username.trim(), form.password);
    setBusy(true);
    setError("");
    try {
      await api.register({
        email: form.email.trim(),
        username: form.username.trim(),
        full_name: form.full_name.trim() || null,
        password: form.password,
      });
      toast.success(t("auth.registered"));
      await signIn(form.username.trim(), form.password);
    } catch (err) {
      setError(err.status === 0 ? t("errors.network") : err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <Logo />
        <div className="auth-hero-copy">
          <h1>{t("auth.heroTitle")}</h1>
          <p>{t("auth.heroText")}</p>
          <ul>
            <li><Icon name="board" />{t("auth.feature1")}</li>
            <li><Icon name="users" />{t("auth.feature2")}</li>
            <li><Icon name="trend" />{t("auth.feature3")}</li>
          </ul>
        </div>
        <div className="auth-hero-mock" aria-hidden="true">
          {["todo", "in_progress", "done"].map((s, i) => (
            <div key={s} className="mock-col">
              <span className={`mock-head status-${s}`}><i className={`dot status-${s}`} />{t(`status.${s}`)}</span>
              {Array.from({ length: 3 - i }, (_, n) => <span key={n} className="mock-card" style={{ width: `${88 - n * 14}%` }} />)}
            </div>
          ))}
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-prefs">
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("prefs.theme")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button className="lang-btn" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            <Icon name="globe" size={16} />{lang === "ar" ? "English" : "العربية"}
          </button>
        </div>

        <form className="auth-card" onSubmit={submit}>
          <div className="only-mobile auth-mobile-logo"><Logo /></div>
          <h2>{t(mode === "login" ? "auth.welcome" : "auth.createTitle")}</h2>
          <p className="muted">{t(mode === "login" ? "auth.welcomeText" : "auth.createText")}</p>

          <Segmented value={mode} onChange={(m) => { setMode(m); setError(""); }}
            options={[{ value: "login", label: t("auth.signIn") }, { value: "register", label: t("auth.register") }]} />

          {mode === "register" && (
            <>
              <Field label={t("auth.fullName")}>
                <input value={form.full_name} onChange={set("full_name")} autoComplete="name" maxLength={120} />
              </Field>
              <Field label={t("auth.email")}>
                <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
              </Field>
            </>
          )}
          <Field label={t(mode === "login" ? "auth.usernameOrEmail" : "auth.username")}
            hint={mode === "register" ? t("auth.usernameHint") : undefined}>
            <input required value={form.username} onChange={set("username")} autoComplete="username" autoFocus />
          </Field>
          <Field label={t("auth.password")} hint={mode === "register" ? t("auth.passwordHint") : undefined}>
            <input type="password" required value={form.password} onChange={set("password")}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </Field>

          {error && <div className="form-error"><Icon name="alert" size={16} /><span>{error}</span></div>}

          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy && <Spinner size={16} />}
            {t(mode === "login" ? "auth.signIn" : "auth.createAccount")}
          </button>

          {mode === "login" && (
            <div className="demo">
              <span className="demo-label">{t("auth.demo")}</span>
              <div className="demo-list">
                {DEMO.map((d) => (
                  <button key={d.username} type="button" className="demo-btn" disabled={busy} onClick={() => signIn(d.username, d.password)}>
                    <b>{d.username}</b>
                    <small>{t(`roles.${d.role}`)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
