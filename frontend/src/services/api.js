/**
 * API Service
 * Handles all API calls to the backend
 */
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===================== AUTH API =====================

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
};

// ===================== DATA LAKE API =====================

export const dataLakeAPI = {
  getHealth: () => api.get('/data-lake/health'),
  getRawRecords: (params) => api.get('/data-lake/raw', { params }),
  getCanonicalRecords: (params) => api.get('/data-lake/canonical', { params }),
  getServingRecords: (params) => api.get('/data-lake/serving', { params }),
  getServingByEntity: (entityType, params) => api.get(`/data-lake/serving/${entityType}`, { params }),
};

// ===================== INTEGRATIONS API =====================

export const integrationsAPI = {
  list: () => api.get('/integrations/'),
  get: (type) => api.get(`/integrations/${type}`),
  
  // Odoo
  configureOdoo: (config) => api.post('/integrations/odoo/configure', config),
  testOdoo: (config) => api.post('/integrations/odoo/test', config),
  getOdooFields: (model) => api.get(`/integrations/odoo/fields/${model}`),
  
  // Microsoft 365
  configureO365: (config) => api.post('/integrations/ms365/configure', config),
  testO365: (config) => api.post('/integrations/ms365/test', config),
  
  // Field Mappings
  getMappings: (integrationType, entityType) => 
    api.get(`/integrations/mappings/${integrationType}/${entityType}`),
  saveMappings: (integrationType, data) => 
    api.post(`/integrations/mappings/${integrationType}`, data),
  autoMap: (integrationType, entityType) => 
    api.post(`/integrations/mappings/${integrationType}/auto-map`, { entity_type: entityType }),
  
  // Sync
  triggerSync: (integrationType, entityTypes) => 
    api.post(`/integrations/sync/${integrationType}`, { entity_types: entityTypes }),
  getSyncStatus: () => api.get('/integrations/sync/status'),
  getSyncJob: (jobId) => api.get(`/integrations/sync/${jobId}`),
};

// ===================== OPPORTUNITIES API =====================

export const opportunitiesAPI = {
  getAll: (params) => api.get('/opportunities', { params }),
  getById: (id) => api.get(`/opportunities/${id}`),
  create: (data) => api.post('/opportunities', data),
  update: (id, data) => api.put(`/opportunities/${id}`, data),
  getKanban: () => api.get('/opportunities/kanban'),
  updateStage: (id, stage) => api.patch(`/opportunities/${id}/stage?new_stage=${stage}`),
  calculateProbability: (id, data) => api.post(`/opportunities/${id}/calculate-probability`, data),
};

// ===================== ACCOUNTS API =====================

export const accountsAPI = {
  getAll: () => api.get('/accounts'),
  getById: (id) => api.get(`/accounts/${id}`),
  create: (data) => api.post('/accounts', data),
  update: (id, data) => api.put(`/accounts/${id}`, data),
};

// ===================== ACTIVITIES API =====================

export const activitiesAPI = {
  getAll: (params) => api.get('/activities', { params }),
  create: (data) => api.post('/activities', data),
  updateStatus: (id, status) => api.patch(`/activities/${id}/status?status=${status}`),
};

// ===================== DASHBOARD API =====================

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// ===================== SALES METRICS API =====================

export const salesMetricsAPI = {
  get: (userId, period = 'quarterly') => api.get(`/sales-metrics/${userId}?period=${period}`),
};

// ===================== INCENTIVE API =====================

export const incentiveAPI = {
  calculate: (params) => api.post('/incentive-calculator', null, { params }),
  getTemplates: () => api.get('/commission-templates'),
  createTemplate: (data) => api.post('/commission-templates', data),
};

// ===================== SEARCH API =====================

export const searchAPI = {
  global: (query) => api.get(`/search?q=${encodeURIComponent(query)}`),
};

// ===================== CONFIG API =====================

export const configAPI = {
  getLLM: () => api.get('/config/llm'),
  updateLLM: (params) => api.put('/config/llm', null, { params }),
};

export default api;
