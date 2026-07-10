import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// Every request carries the signed JWT from login — the backend verifies
// it server-side (see middleware/auth.js); nothing here is trusted as-is.
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem("pipeline_auth_user");
    if (stored) {
      const user = JSON.parse(stored);
      if (user.token) config.headers["Authorization"] = `Bearer ${user.token}`;
    }
  } catch {
    // ignore malformed storage
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("pipeline_auth_user");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } else if (error.response?.status === 403) {
      alert(error.response.data?.error || "You don't have permission to do that.");
    }
    return Promise.reject(error);
  }
);

export default api;

// Convenience resource helpers
export const Resource = (name) => ({
  list: () => api.get(`/${name}`).then((r) => r.data),
  get: (id) => api.get(`/${name}/${id}`).then((r) => r.data),
  create: (payload) => api.post(`/${name}`, payload).then((r) => r.data),
  update: (id, payload) => api.put(`/${name}/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/${name}/${id}`).then((r) => r.data),
});

export const Leads = Resource("leads");
export const Contacts = Resource("contacts");
export const Companies = Resource("companies");
export const Deals = Resource("deals");
export const Activities = Resource("activities");
export const Tasks = Resource("tasks");
export const Templates = Resource("templates");
export const Users = Resource("users");
export const Teams = Resource("teams");
export const Invoices = Resource("invoices");
export const Expenses = Resource("expenses");
export const Documents = Resource("documents");
