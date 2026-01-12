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
  Plug,
  Search,
  Command,
} from "lucide-react";

// NavLink component
const NavLink = ({ item, pathname, onClick, className = "" }) => {
  const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
        className
      )}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
      <span>{item.label}</span>
    </Link>
  );
};

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
    { icon: Plug, label: "Integrations", path: "/integrations" },
  ];

  const superAdminItems = [
    { icon: Shield, label: "System Config", path: "/admin/config" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 w-64 h-screen flex flex-col transform transition-transform duration-200 ease-out",
          "bg-slate-900",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              SalesCommand
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-4">
          <button className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg text-slate-400 text-sm transition-colors">
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-auto flex items-center gap-0.5 text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              <Command className="w-3 h-3" />K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto scrollbar-thin">
          <div className="mb-2">
            <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Main Menu
            </span>
          </div>
          {navItems.map((item) => (
            <NavLink 
              key={item.path} 
              item={item} 
              pathname={location.pathname}
              onClick={onClose}
            />
          ))}

          {isExecutive() && (
            <>
              <div className="pt-6 mb-2">
                <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Administration
                </span>
              </div>
              {adminItems.map((item) => (
                <NavLink 
                  key={item.path}
                  item={item} 
                  pathname={location.pathname}
                  onClick={onClose}
                />
              ))}
            </>
          )}

          {user?.role === "super_admin" && (
            <>
              <div className="pt-6 mb-2">
                <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  System
                </span>
              </div>
              {superAdminItems.map((item) => (
                <NavLink 
                  key={item.path}
                  item={item} 
                  pathname={location.pathname}
                  onClick={onClose}
                />
              ))}
            </>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-slate-700">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {getRoleLabel(user?.role)}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </aside>
    </>
  );
};

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/dashboard") return "Dashboard";
    if (path === "/accounts") return "Accounts";
    if (path === "/opportunities") return "Opportunities";
    if (path === "/activities") return "Activities";
    if (path === "/kpis") return "KPIs";
    if (path === "/incentives") return "Incentives";
    if (path === "/users") return "Users";
    if (path.startsWith("/integrations")) return "Integrations";
    if (path === "/admin/config") return "System Configuration";
    return "Dashboard";
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30" data-testid="main-header">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
          data-testid="menu-toggle"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/insights"
          className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
          data-testid="ai-insights-btn"
          title="AI Insights"
        >
          <Sparkles className="w-5 h-5" />
        </Link>

        <button
          className="p-2.5 hover:bg-slate-100 rounded-lg relative transition-colors"
          data-testid="notifications-btn"
          title="Notifications"
        >
          <Bell className="w-5 h-5 text-slate-500" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        <div className="w-px h-8 bg-slate-200 mx-2" />

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 p-1.5 pr-3 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="user-dropdown-btn"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-medium">
              {getInitials(user?.name)}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {user?.name?.split(' ')[0]}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowDropdown(false)} 
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-scale-in">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="font-medium text-slate-900">{user?.name}</p>
                  <p className="text-sm text-slate-500 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    to="/settings"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </div>
                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
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
