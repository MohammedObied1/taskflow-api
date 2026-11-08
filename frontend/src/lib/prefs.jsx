import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries } from "../i18n.js";
import { storage } from "./hooks.js";

const PrefsContext = createContext(null);

const lookup = (dict, key) => key.split(".").reduce((node, part) => node?.[part], dict);

function initialTheme() {
  const saved = storage.get("taskflow.theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function PrefsProvider({ children }) {
  const [lang, setLang] = useState(() => (storage.get("taskflow.lang") === "ar" ? "ar" : "en"));
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    storage.set("taskflow.lang", lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.set("taskflow.theme", theme);
  }, [theme]);

  const t = useCallback(
    (key, vars) => {
      let text = lookup(dictionaries[lang], key) ?? lookup(dictionaries.en, key) ?? key;
      if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, theme, setTheme, t }), [lang, theme, t]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
