import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, session } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    session.onExpired(() => setUser(null));
    if (!session.get()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => session.set(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username, password) => {
    session.set(await api.login(username, password));
    setUser(await api.me());
  }, []);

  const logout = useCallback(() => {
    session.set(null);
    setUser(null);
    window.location.hash = "/";
  }, []);

  const value = useMemo(() => ({ user, setUser, ready, login, logout }), [user, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
