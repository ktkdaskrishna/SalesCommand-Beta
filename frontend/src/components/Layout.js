/**
 * Layout Component
 * Dynamic role-based navigation fetched from API
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { configAPI } from '../services/api';
import {
  LayoutDashboard,
  Database,
  Plug2,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Wand2,
  Shield,
  Mail,
  Target,
  Building2,
  BarChart3,
  FileText,
  Calendar,
  DollarSign,
  Users,
  Briefcase,
} from 'lucide-react';

// Icon mapping for dynamic navigation
const ICON_MAP = {
  LayoutDashboard,
  Database,
  Plug2,
  Settings,
  Wand2,
  Mail,
  Target,
  Building2,
  BarChart3,
  FileText,
  Calendar,
  DollarSign,
  Users,
  Briefcase,
};

const Layout = () => {
  const { user, logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [navigation, setNavigation] = useState({ main_menu: [], admin_menu: [] });
  const [navLoading, setNavLoading] = useState(true);

  // Fetch navigation based on user's role
  useEffect(() => {
    const fetchNavigation = async () => {
      if (!token) return;
      
      try {
        const response = await configAPI.getUserNavigation();
        setNavigation(response.data);
      } catch (err) {
        console.error('Failed to fetch navigation:', err);
        // Fallback to default navigation
        setNavigation({
          main_menu: [
            { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', enabled: true },
            { id: 'accounts', label: 'Accounts', icon: 'Building2', path: '/accounts', enabled: true },
            { id: 'opportunities', label: 'Opportunities', icon: 'Target', path: '/opportunities', enabled: true },
            { id: 'kpis', label: 'KPIs', icon: 'BarChart3', path: '/kpis', enabled: true },
            { id: 'email', label: 'Email & Calendar', icon: 'Mail', path: '/my-outlook', enabled: true },
          ],
          admin_menu: user?.is_super_admin ? [
            { id: 'system-config', label: 'System Config', icon: 'Settings', path: '/admin', enabled: true },
            { id: 'integrations', label: 'Integrations', icon: 'Plug2', path: '/integrations', enabled: true },
            { id: 'data-lake', label: 'Data Lake', icon: 'Database', path: '/data-lake', enabled: true },
          ] : []
        });
      } finally {
        setNavLoading(false);
      }
    };

    fetchNavigation();
  }, [token, user]);

  // Redirect to appropriate landing page based on role
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      // Non-admin users go to sales dashboard by default
      if (user && !user.is_super_admin) {
        // Check if sales-dashboard is in their navigation
        const hasSalesDashboard = navigation.main_menu.some(
          item => item.path === '/sales-dashboard' || item.id === 'dashboard'
        );
        if (hasSalesDashboard && location.pathname === '/') {
          navigate('/dashboard', { replace: true });
        }
      }
    }
  }, [user, navigation, location.pathname, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get enabled navigation items
  const mainNavItems = navigation.main_menu?.filter(item => item.enabled) || [];
  const adminNavItems = navigation.admin_menu?.filter(item => item.enabled) || [];

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/') return true;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Render icon from string name
  const renderIcon = (iconName, className = "w-5 h-5 shrink-0") => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent ? <IconComponent className={className} /> : <Briefcase className={className} />;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-zinc-900/50 border-r border-zinc-800 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-white">Securado</span>
                <span className="text-xs text-zinc-500 block -mt-1">Sales Intel</span>
              </div>
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
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Main Menu */}
          {sidebarOpen && (
            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3 px-3">
              Main Menu
            </p>
          )}
          
          {navLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            mainNavItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
                data-testid={`nav-${item.id}`}
              >
                {renderIcon(item.icon)}
                {sidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            ))
          )}

          {/* Admin Section */}
          {adminNavItems.length > 0 && (
            <>
              {sidebarOpen ? (
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mt-6 mb-3 px-3">
                  Administration
                </p>
              ) : (
                <div className="border-t border-zinc-800 my-4" />
              )}
              
              {adminNavItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-purple-600/20 text-purple-400 border-l-2 border-purple-500'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  {renderIcon(item.icon)}
                  {sidebarOpen && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-zinc-800">
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              user?.is_super_admin 
                ? 'bg-gradient-to-br from-purple-500 to-violet-600' 
                : 'bg-gradient-to-br from-emerald-500 to-teal-600'
            }`}>
              {user?.is_super_admin ? (
                <Shield className="w-5 h-5 text-white" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {user?.is_super_admin ? (
                    <span className="text-purple-400">Super Admin</span>
                  ) : (
                    <span className="text-emerald-400 capitalize">{user?.role?.replace('_', ' ') || 'User'}</span>
                  )}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`mt-4 w-full text-zinc-400 hover:text-red-400 hover:bg-red-500/10 ${sidebarOpen ? '' : 'justify-center'}`}
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-zinc-950">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
