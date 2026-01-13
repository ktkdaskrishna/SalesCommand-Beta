/**
 * App Component
 * Main application entry point with routing
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccountManagerDashboard from './pages/AccountManagerDashboard';
import Accounts from './pages/Accounts';
import Opportunities from './pages/Opportunities';
import KPIs from './pages/KPIs';
import Integrations from './pages/Integrations';
import DataLake from './pages/DataLake';
import FieldMapping from './pages/FieldMapping';
import AdminPanel from './pages/AdminPanel';
import MyOutlook from './pages/MyOutlook';
import PendingApproval from './pages/PendingApproval';
import Invoices from './pages/Invoices';
import Profile from './pages/Profile';
import Goals from './pages/Goals';
import ActivityTimeline from './pages/ActivityTimeline';

// Components
import Layout from './components/Layout';

// Role-based Dashboard Component
const RoleBasedDashboard = () => {
  const { user, isSuperAdmin } = useAuth();
  
  // All users now see the CRM-focused AccountManagerDashboard
  // Super Admin gets additional admin controls on that dashboard
  // The old technical Dashboard is available at /admin-dashboard for system monitoring
  
  // Show AccountManagerDashboard for everyone (CRM data)
  return <AccountManagerDashboard />;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isPending, isRejected, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to pending approval page if user is not approved
  if (isPending) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Redirect to login if rejected
  if (isRejected) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Pending Route Component (for users awaiting approval)
const PendingRoute = ({ children }) => {
  const { isAuthenticated, isPending, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If not pending, redirect to dashboard
  if (!isPending) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (isAuthenticated) {
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

      {/* Pending Approval Route */}
      <Route
        path="/pending-approval"
        element={
          <PendingRoute>
            <PendingApproval />
          </PendingRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<RoleBasedDashboard />} />
        <Route path="sales-dashboard" element={<AccountManagerDashboard />} />
        <Route path="admin-dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="goals" element={<Goals />} />
        <Route path="activity" element={<ActivityTimeline />} />
        <Route path="kpis" element={<KPIs />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="integrations/:type" element={<Integrations />} />
        <Route path="field-mapping" element={<FieldMapping />} />
        <Route path="data-lake" element={<DataLake />} />
        <Route path="my-outlook" element={<MyOutlook />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin-dashboard" element={<Dashboard />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
