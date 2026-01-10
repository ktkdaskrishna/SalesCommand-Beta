import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn, getInitials, getRoleLabel } from "../lib/utils";
import {
  LayoutDashboard,
  Building2,
  Target,
  ListTodo,
  BarChart3,
  Gift,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Users,
  Shield,
} from "lucide-react";

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, isExecutive } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Building2, label: "Accounts", path: "/accounts" },
    { icon: Target, label: "Opportunities", path: "/opportunities" },
    { icon: ListTodo, label: "Activities", path: "/activities" },
    { icon: BarChart3, label: "KPIs", path: "/kpis" },
    { icon: Gift, label: "Incentives", path: "/incentives" },
  ];

  const adminItems = [
    { icon: Users, label: "Users", path: "/users" },
    { icon: Settings, label: "Integrations", path: "/integrations" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "sidebar fixed lg:sticky top-0 left-0 z-50 transform transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">
                SalesCommand
              </span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "sidebar-link",
                  location.pathname === item.path && "active"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}

            {isExecutive() && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Admin
                  </span>
                </div>
                {adminItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      "sidebar-link",
                      location.pathname === item.path && "active"
                    )}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium">
                {getInitials(user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {getRoleLabel(user?.role)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="header justify-between" data-testid="main-header">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
          data-testid="menu-toggle"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-semibold text-slate-900">
          {getRoleLabel(user?.role)} Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Insights */}
        <Link
          to="/insights"
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
          data-testid="ai-insights-btn"
        >
          <Sparkles className="w-5 h-5" />
        </Link>

        {/* Notifications */}
        <button
          className="p-2 hover:bg-slate-100 rounded-lg relative"
          data-testid="notifications-btn"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg"
            data-testid="user-dropdown-btn"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-medium">
              {getInitials(user?.name)}
            </div>
            <ChevronDown className="w-4 h-4 text-slate-600" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-medium text-slate-900">{user?.name}</p>
                <p className="text-sm text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
