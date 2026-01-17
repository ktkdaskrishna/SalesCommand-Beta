/**
 * API Service
 * Handles all API calls to the backend with automatic token refresh
 */
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Token refresh configuration
const TOKEN_REFRESH_THRESHOLD_MS = 30 * 60 * 1000; // Refresh when 30 mins left
let isRefreshing = false;
let refreshSubscribers = [];

// Subscribe to token refresh
const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

// Notify all subscribers with new token
const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Check if token needs refresh (decode JWT and check exp)
const shouldRefreshToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expTime = payload.exp * 1000; // Convert to ms
    const now = Date.now();
    const timeLeft = expTime - now;
    
    // Refresh if less than threshold time remaining
    return timeLeft > 0 && timeLeft < TOKEN_REFRESH_THRESHOLD_MS;
  } catch (e) {
    return false;
  }
};

// Refresh the token
const refreshToken = async () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token to refresh');
  
  const response = await axios.post(
    `${API_URL}/api/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  const { access_token, user } = response.data;
  localStorage.setItem('token', access_token);
  localStorage.setItem('user', JSON.stringify(user));
  
  return access_token;
};

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and check for refresh
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // Check if token needs refresh (but don't block the request)
      if (shouldRefreshToken() && !isRefreshing && !config.url.includes('/auth/refresh')) {
        isRefreshing = true;
        try {
          const newToken = await refreshToken();
          config.headers.Authorization = `Bearer ${newToken}`;
          onTokenRefreshed(newToken);
          console.log('Token refreshed proactively');
        } catch (err) {
          console.warn('Proactive token refresh failed:', err.message);
        } finally {
          isRefreshing = false;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for ongoing refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const newToken = await refreshToken();
        onTokenRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // For other 401 errors (like invalid token), redirect to login
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
  refreshToken: () => api.post('/auth/refresh'),
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
  syncAllFromOdoo: () => api.post('/integrations/odoo/sync-all'),
  getSyncStatus: () => api.get('/integrations/sync/status'),
  getSyncJob: (jobId) => api.get(`/integrations/sync/${jobId}`),
  
  // CQRS Sync
  triggerCQRSSync: () => api.post('/integrations/cqrs/sync/trigger'),
  getCQRSSyncStatus: (jobId) => api.get(`/integrations/cqrs/sync/status/${jobId}`),
  getCQRSHealth: () => api.get('/integrations/cqrs/health'),
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

// ===================== SALES API (Blue Sheet & Dashboard) =====================

export const salesAPI = {
  getDashboard: () => api.get('/sales/dashboard'),
  getRealDashboard: () => api.get('/dashboard/real'),  // Real Odoo data
  getRealOpportunities: () => api.get('/opportunities/real'),  // Real Odoo opportunities
  getReceivables: () => api.get('/receivables'),  // Real Odoo invoices
  getKanban: () => api.get('/opportunities/kanban'),
  calculateProbability: (oppId, data) => api.post(`/opportunities/${oppId}/calculate-probability`, data),
  getActivitiesByOpportunity: (oppId) => api.get(`/activities?opportunity_id=${oppId}`),
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
  
  // CQRS v2 endpoints (new, optimized)
  getV2Dashboard: () => api.get('/v2/dashboard/'),
  getV2Opportunities: () => api.get('/v2/dashboard/opportunities'),
  getV2Profile: () => api.get('/v2/dashboard/users/profile'),
  getV2Hierarchy: () => api.get('/v2/dashboard/users/hierarchy'),
  
  // Legacy v1 endpoints (fallback)
  getDashboard: () => api.get('/sales/dashboard/real'),
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
  
  // Widgets
  getWidgets: () => api.get('/config/widgets'),
  
  // Navigation
  getNavigationItems: () => api.get('/config/navigation-items'),
  getUserNavigation: () => api.get('/config/user/navigation'),
  
  // Roles
  getRoles: () => api.get('/config/roles'),
  getRole: (id) => api.get(`/config/roles/${id}`),
  createRole: (data) => api.post('/config/roles', data),
  updateRole: (id, data) => api.put(`/config/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/config/roles/${id}`),
  
  // User Dashboard
  getUserDashboard: () => api.get('/config/user/dashboard'),
  saveUserDashboard: (data) => api.put('/config/user/dashboard', data),
  resetUserDashboard: () => api.delete('/config/user/dashboard'),
  
  // Service Lines
  getServiceLines: () => api.get('/config/service-lines'),
  createServiceLine: (params) => api.post('/config/service-lines', null, { params }),
  updateServiceLine: (id, params) => api.put(`/config/service-lines/${id}`, null, { params }),
  
  // Pipeline Stages
  getPipelineStages: () => api.get('/config/pipeline-stages'),
  updatePipelineStage: (id, params) => api.put(`/config/pipeline-stages/${id}`, null, { params }),
  createPipelineStage: (params) => api.post('/config/pipeline-stages', null, { params }),
  
  // Blue Sheet Weights
  getBlueSheetWeights: () => api.get('/config/bluesheet-weights'),
  updateBlueSheetWeights: (data) => api.put('/config/bluesheet-weights', data),
  
  // Targets
  getTargets: (params) => api.get('/config/targets', { params }),
  createTarget: (data) => api.post('/config/targets', data),
  updateTarget: (id, params) => api.put(`/config/targets/${id}`, null, { params }),
  deleteTarget: (id) => api.delete(`/config/targets/${id}`),
};

// ===================== KPIs API =====================

export const kpisAPI = {
  getAll: (params) => api.get('/kpis', { params }),
  getById: (id) => api.get(`/kpis/${id}`),
  create: (data) => api.post('/kpis', data),
  update: (id, data) => api.put(`/kpis/${id}`, data),
  delete: (id) => api.delete(`/kpis/${id}`),
};

export default api;
