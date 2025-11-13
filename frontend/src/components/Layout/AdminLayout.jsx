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
import useAuthStore, { MODULE_ROUTE_MAP, getModuleKeyForPath } from '../../store/authStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
  { path: '/forms', icon: FileText, label: 'Forms', permission: 'forms' },
  { path: '/submissions', icon: ClipboardList, label: 'Submissions', permission: 'submissions' },
  { path: '/students', icon: Users, label: 'Students', permission: 'students' },
  { path: '/promotions', icon: TrendingUp, label: 'Promotions', permission: 'promotions' },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance', permission: 'attendance' },
  { path: '/courses', icon: Settings, label: 'Courses', permission: 'courses' },
  { path: '/users', icon: ShieldCheck, label: 'User Management', permission: 'user-management' },
  { path: '/reports', icon: BarChart3, label: 'Reports', permission: 'reports' }
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const allowedModules = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return Object.keys(MODULE_ROUTE_MAP);
    }
    return Array.isArray(user.modules) ? user.modules : [];
  }, [user]);

  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.permission) return true;
      if (user?.role === 'admin') return true;
      return allowedModules.includes(item.permission);
    });
  }, [allowedModules, user?.role]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') return;
    const currentModuleKey = getModuleKeyForPath(location.pathname);
    if (currentModuleKey && !allowedModules.includes(currentModuleKey)) {
      const firstAllowedRoute =
        MODULE_ROUTE_MAP[allowedModules[0]] || MODULE_ROUTE_MAP.dashboard || '/';
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
          fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Pydah DB Logo"
              className="h-12 w-auto max-w-full object-contain"
              loading="lazy"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-md transition-colors
                    ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-md'
                        : 'text-gray-800 hover:bg-blue-100 hover:text-blue-700'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {user?.email || (user?.role === 'admin' ? 'Administrator' : 'Team Member')}
                </p>
              </div>
            </div>
            <button
  onClick={handleLogout}
  className="w-full flex items-center gap-3 px-4 py-3 rounded-md bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors duration-200"
>
  <LogOut size={20} />
  <span>Logout</span>
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
      <main className="lg:ml-64 min-h-screen bg-white">
        <div className="p-4 lg:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;