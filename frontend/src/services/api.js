import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
};

// Users
export const usersAPI = {
  getAll: () => api.get("/users"),
};

// Accounts
export const accountsAPI = {
  getAll: () => api.get("/accounts"),
  getById: (id) => api.get(`/accounts/${id}`),
  create: (data) => api.post("/accounts", data),
  update: (id, data) => api.put(`/accounts/${id}`, data),
};

// Opportunities
export const opportunitiesAPI = {
  getAll: (params) => api.get("/opportunities", { params }),
  getById: (id) => api.get(`/opportunities/${id}`),
  create: (data) => api.post("/opportunities", data),
  update: (id, data) => api.put(`/opportunities/${id}`, data),
};

// Activities
export const activitiesAPI = {
  getAll: (params) => api.get("/activities", { params }),
  create: (data) => api.post("/activities", data),
  update: (id, data) => api.put(`/activities/${id}`, data),
  updateStatus: (id, status) => api.patch(`/activities/${id}/status?status=${status}`),
};

// KPIs
export const kpisAPI = {
  getAll: (params) => api.get("/kpis", { params }),
  create: (data) => api.post("/kpis", data),
  update: (id, data) => api.put(`/kpis/${id}`, data),
};

// Incentives
export const incentivesAPI = {
  getAll: (params) => api.get("/incentives", { params }),
  create: (data) => api.post("/incentives", data),
};

// Integrations
export const integrationsAPI = {
  getAll: () => api.get("/integrations"),
  save: (data) => api.post("/integrations", data),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get("/dashboard/stats"),
  getPipelineByStage: () => api.get("/dashboard/pipeline-by-stage"),
  getActivitiesByStatus: () => api.get("/dashboard/activities-by-status"),
  getRevenueTrend: () => api.get("/dashboard/revenue-trend"),
  getConfigs: () => api.get("/dashboard/config"),
  saveConfig: (data) => api.post("/dashboard/config", data),
};

// Notifications
export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

// AI Insights
export const aiAPI = {
  getInsights: () => api.post("/ai/insights"),
};

// Configuration (Super Admin)
export const configAPI = {
  getSystem: () => api.get("/config/system"),
  getUserConfig: () => api.get("/config/user-config"),
  getUserPermissions: () => api.get("/config/user-permissions"),
  getModules: () => api.get("/config/modules"),
  getRoles: () => api.get("/config/roles"),
  createRole: (data) => api.post("/config/roles", data),
  updateRole: (roleId, data) => api.put(`/config/roles/${roleId}`, data),
  deleteRole: (roleId) => api.delete(`/config/roles/${roleId}`),
  updateRolePermissions: (roleId, permissions) => api.put(`/config/roles/${roleId}/permissions`, permissions),
  getBlueSheet: () => api.get("/config/blue-sheet"),
  updateBlueSheet: (data) => api.put("/config/blue-sheet", data),
  getLLM: () => api.get("/config/llm"),
  updateLLM: (data) => api.put("/config/llm", data),
  getUI: () => api.get("/config/ui"),
  updateUI: (data) => api.put("/config/ui", data),
  resetDefaults: (section) => api.post("/config/reset-defaults", null, { params: { section } }),
};

// Seed data
export const seedAPI = {
  seed: () => api.post("/seed"),
};

export default api;
