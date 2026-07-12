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

  // Two-step now — see auth.js: requestSignupOtp emails a 6-digit code
  // without creating anything yet, verifySignupOtp checks it and actually
  // creates the account (persisting the session exactly like signup used to).
  const requestSignupOtp = async (payload) => {
    const { data } = await api.post("/auth/signup/request-otp", payload);
    return data;
  };

  const verifySignupOtp = async (email, otp) => {
    const { data } = await api.post("/auth/signup/verify-otp", { email, otp });
    persist(data.user, data.token);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    reconnectSocket();
  };

  // permission is server-computed (see auth.js publicAccount): "view" | "edit" | "full".
  // canManage = can create/edit (old binary check, kept for existing call sites).
  // canDelete = the new, stricter check — an "edit" teammate can't delete.
  const canManage = user ? ["edit", "full"].includes(user.permission) : false;
  const canDelete = user ? user.permission === "full" : false;
  const isMasterAdmin = user ? !!user.isMasterAdmin : false;
  const isOwner = user ? user.isMasterAdmin || user.authRole === "admin" : false;

  return (
    <AuthContext.Provider
      value={{ user, ready, login, demoLogin, requestSignupOtp, verifySignupOtp, logout, canManage, canDelete, isMasterAdmin, isOwner }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
