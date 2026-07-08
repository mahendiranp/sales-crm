import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem("pipeline_auth_user");
    if (stored) {
      const user = JSON.parse(stored);
      config.headers["x-auth-role"] = user.authRole;
      config.headers["x-user-id"] = user.id;
    }
  } catch {
    // ignore malformed storage
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 403) {
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
