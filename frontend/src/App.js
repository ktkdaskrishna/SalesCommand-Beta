import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AccountManagerDashboard from "./pages/AccountManagerDashboard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Opportunities from "./pages/Opportunities";
import Activities from "./pages/Activities";
import KPIs from "./pages/KPIs";
import Incentives from "./pages/Incentives";
import Integrations from "./pages/Integrations";
import OdooIntegrationHub from "./components/OdooIntegrationHub";
import SalesforceIntegrationHub from "./components/SalesforceIntegrationHub";
import HubSpotIntegrationHub from "./components/HubSpotIntegrationHub";
import MS365IntegrationHub from "./components/MS365IntegrationHub";
import AIInsights from "./pages/AIInsights";
import UsersPage from "./pages/Users";
import SuperAdminConfig from "./pages/SuperAdminConfig";
import "./App.css";

// Role-based Dashboard Selector
const DashboardSelector = () => {
  const { user } = useAuth();
  
  // Account Managers get the enhanced dashboard with Kanban
  if (user?.role === "account_manager") {
    return <AccountManagerDashboard />;
  }
  
  // Others get the standard dashboard
  return <Dashboard />;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route Component (redirects to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardSelector />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <Accounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/:id"
        element={
          <ProtectedRoute>
            <AccountDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/opportunities"
        element={
          <ProtectedRoute>
            <Opportunities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/opportunities/:id"
        element={
          <ProtectedRoute>
            <Opportunities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities"
        element={
          <ProtectedRoute>
            <Activities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kpis"
        element={
          <ProtectedRoute>
            <KPIs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incentives"
        element={
          <ProtectedRoute>
            <Incentives />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <Integrations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <AIInsights />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/config"
        element={
          <ProtectedRoute>
            <SuperAdminConfig />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integration-hub"
        element={
          <ProtectedRoute>
            <IntegrationHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations/odoo"
        element={
          <ProtectedRoute>
            <OdooIntegrationHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations/salesforce"
        element={
          <ProtectedRoute>
            <SalesforceIntegrationHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations/hubspot"
        element={
          <ProtectedRoute>
            <HubSpotIntegrationHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations/ms365"
        element={
          <ProtectedRoute>
            <MS365IntegrationHub />
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "white",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
