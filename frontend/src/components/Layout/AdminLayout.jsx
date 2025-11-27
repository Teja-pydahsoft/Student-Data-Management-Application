import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  Settings,
  CalendarCheck,
  ShieldCheck,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { 
  MODULE_ROUTE_MAP, 
  getModuleKeyForPath, 
  hasModuleAccess, 
  getAllowedFrontendModules,
  isFullAccessRole,
  FRONTEND_MODULES
} from '../../constants/rbac';
import toast from 'react-hot-toast';

// Navigation items with frontend module keys as permissions
const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: FRONTEND_MODULES.DASHBOARD },
  { path: '/submissions', icon: ClipboardList, label: 'Pre Registration', permission: FRONTEND_MODULES.SUBMISSIONS },
  { path: '/students', icon: Users, label: 'Student Management', permission: FRONTEND_MODULES.STUDENTS },
  { path: '/promotions', icon: TrendingUp, label: 'Promotions', permission: FRONTEND_MODULES.PROMOTIONS },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance', permission: FRONTEND_MODULES.ATTENDANCE },
  { path: '/courses', icon: Settings, label: 'Settings', permission: FRONTEND_MODULES.COURSES },
  { path: '/users', icon: ShieldCheck, label: 'User Management', permission: FRONTEND_MODULES.USERS },
  { path: '/reports', icon: BarChart3, label: 'Reports', permission: FRONTEND_MODULES.REPORTS }
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Get allowed modules based on user role and permissions
  const allowedModules = useMemo(() => {
    if (!user) return [];
    
    // Super admin and legacy admin have full access to all modules
    if (isFullAccessRole(user.role)) {
      return Object.values(FRONTEND_MODULES);
    }
    
    // For RBAC users, check permissions using the mapping
    if (user.permissions) {
      return getAllowedFrontendModules(user.permissions);
    }
    
    // Legacy staff users with modules array
    return Array.isArray(user.modules) ? user.modules : [];
  }, [user]);

  // Filter navigation items based on user's allowed modules
  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.permission) return true;
      
      // Super admin and legacy admin have full access
      if (isFullAccessRole(user?.role)) return true;
      
      // For RBAC users, check permissions using the mapping
      if (user?.permissions) {
        return hasModuleAccess(user.permissions, item.permission);
      }
      
      // Legacy staff users
      return allowedModules.includes(item.permission);
    });
  }, [allowedModules, user?.role, user?.permissions]);

  // Redirect user if they try to access a module they don't have access to
  useEffect(() => {
    if (!user) return;
    
    // Super admin and legacy admin have full access
    if (isFullAccessRole(user.role)) return;
    
    const currentModuleKey = getModuleKeyForPath(location.pathname);
    
    // Check if user has access to current module
    if (currentModuleKey && !allowedModules.includes(currentModuleKey)) {
      // Redirect to first allowed route or dashboard
      const firstAllowedRoute = allowedModules.length > 0 
        ? MODULE_ROUTE_MAP[allowedModules[0]] 
        : '/';
      navigate(firstAllowedRoute, { replace: true });
    }
  }, [user, allowedModules, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 heading-font">Admin Panel</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-blue-100 text-gray-700 hover:text-blue-700 transition-colors"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200
          transition-[width,transform] duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
        `}
        style={{ willChange: 'width, transform' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo and Close Button */}
          <div className={`border-b border-gray-200 flex items-center transition-[padding,justify-content] duration-300 ease-out ${sidebarCollapsed ? 'justify-center p-4' : 'justify-between p-6'}`}>
            <img
              src="/logo.png"
              alt="Pydah DB Logo"
              className={`
                h-12 w-auto max-w-full object-contain transition-opacity duration-300 ease-out
                ${sidebarCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : 'opacity-100'}
              `}
              loading="lazy"
            />
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 space-y-1 transition-[padding] duration-300 ease-out ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center rounded-md transition-colors
                    ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'}
                    ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-md'
                        : 'text-gray-800 hover:bg-blue-100 hover:text-blue-700'
                    }
                  `}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span 
                    className={`
                      transition-opacity duration-300 ease-out whitespace-nowrap overflow-hidden
                      ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}
                    `}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className={`border-t border-gray-200 transition-[padding] duration-300 ease-out ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            <div 
              className={`
                flex items-center gap-3 mb-2 transition-opacity duration-300 ease-out overflow-hidden
                ${sidebarCollapsed ? 'opacity-0 h-0 mb-0' : 'opacity-100 h-auto mb-2'}
              `}
            >
              <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || user?.username || 'User'}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {user?.email || (isFullAccessRole(user?.role) ? 'Administrator' : 'Team Member')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center rounded-md bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors duration-200 ${
                sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'
              }`}
              title={sidebarCollapsed ? 'Logout' : ''}
            >
              <LogOut size={20} className="flex-shrink-0" />
              <span 
                className={`
                  transition-opacity duration-300 ease-out whitespace-nowrap overflow-hidden
                  ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}
                `}
              >
                Logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`min-h-screen bg-white transition-[margin-left] duration-300 ease-out ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
