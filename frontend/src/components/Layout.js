/**
 * Layout Component
 * Main application layout with sidebar navigation
 */
import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import {
  LayoutDashboard,
  Database,
  Plug2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
  Wand2,
  Shield,
  Users,
  Mail,
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/integrations', icon: Plug2, label: 'Integrations' },
    { path: '/field-mapping', icon: Wand2, label: 'Field Mapping' },
    { path: '/data-lake', icon: Database, label: 'Data Lake' },
    { path: '/my-outlook', icon: Mail, label: 'My Outlook' },
  ];

  // Admin items - only shown to super admins
  const adminItems = [
    { path: '/admin', icon: Settings, label: 'System Config' },
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-zinc-900/50 border-r border-zinc-800 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Database className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white">SalesIntel</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-400 hover:text-white"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Main Menu Label */}
          {sidebarOpen && (
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3 px-3">
              Main Menu
            </p>
          )}
          
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-emerald-600/10 text-emerald-500'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}

          {/* Admin Section - Only for Super Admins */}
          {user?.is_super_admin && (
            <>
              {sidebarOpen && (
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mt-6 mb-3 px-3">
                  Administration
                </p>
              )}
              {!sidebarOpen && <div className="border-t border-zinc-800 my-3" />}
              
              {adminItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-purple-600/10 text-purple-400'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-zinc-800">
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              user?.is_super_admin ? 'bg-purple-600/20' : 'bg-zinc-800'
            }`}>
              {user?.is_super_admin ? (
                <Shield className="w-5 h-5 text-purple-400" />
              ) : (
                <User className="w-5 h-5 text-zinc-400" />
              )}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {user?.is_super_admin ? (
                    <span className="text-purple-400">Super Admin</span>
                  ) : (
                    <span className="capitalize">{user?.role?.replace('_', ' ')}</span>
                  )}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`mt-4 w-full text-zinc-400 hover:text-white hover:bg-zinc-800 ${sidebarOpen ? '' : 'justify-center'}`}
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
