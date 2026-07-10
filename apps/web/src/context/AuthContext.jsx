import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import { reconnectSocket } from "../lib/socket";

const AuthContext = createContext(null);
const STORAGE_KEY = "pipeline_auth_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  // The JWT is what actually authenticates every API call (see api/client.js) —
  // stored alongside the user profile so a page refresh doesn't lose the session.
  const persist = (u, token) => {
    const withToken = { ...u, token };
    setUser(withToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withToken));
    reconnectSocket();
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    persist(data.user, data.token);
    return data.user;
  };

  const demoLogin = async (authRole) => {
    const { data } = await api.post("/auth/demo-login", { authRole });
    persist(data.user, data.token);
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    persist(data.user, data.token);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    reconnectSocket();
  };

  const canManage = user ? user.authRole !== "viewer" : false;
  const isMasterAdmin = user ? !!user.isMasterAdmin : false;

  return (
    <AuthContext.Provider value={{ user, ready, login, demoLogin, signup, logout, canManage, isMasterAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
