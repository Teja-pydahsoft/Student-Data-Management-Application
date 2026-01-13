import React, { useEffect, useMemo, useState } from "react";
import {
    Outlet,
    Link,
    useLocation,
    useNavigate,
} from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    LogOut,
    Menu,
    X,
    Settings,
    CalendarCheck,
    ShieldCheck,
    BarChart3,
    TrendingUp,
    ChevronDown,
    ChevronRight,
    Ticket,
    Briefcase,
    Megaphone,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import {
    MODULE_ROUTE_MAP,
    hasModuleAccess,
    getAllowedFrontendModules,
    isFullAccessRole,
    FRONTEND_MODULES,
} from "../../constants/rbac";
import toast from "react-hot-toast";

// Main App URL for redirection
const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173';

// Navigation items with frontend module keys as permissions
const NAV_ITEMS = [
    {
        path: "/",
        icon: LayoutDashboard,
        label: "Dashboard",
        permission: FRONTEND_MODULES.DASHBOARD,
        isExternal: true,
    },
    {
        path: "/announcements",
        icon: Megaphone,
        label: "Announcements",
        permission: FRONTEND_MODULES.ANNOUNCEMENTS,
        isExternal: true,
    },
    {
        path: "/students",
        icon: Users,
        label: "Student Management",
        permission: FRONTEND_MODULES.STUDENTS,
        isExternal: true,
        subItems: [
            {
                path: "/students",
                label: "Students Database",
                permission: FRONTEND_MODULES.STUDENTS,
                isExternal: true,
            },
            {
                path: "/students/self-registration",
                label: "Self Registration",
                permission: FRONTEND_MODULES.SUBMISSIONS,
                isExternal: true,
            },
        ],
    },
    {
        path: "/promotions",
        icon: TrendingUp,
        label: "Promotions",
        permission: FRONTEND_MODULES.PROMOTIONS,
        isExternal: true,
    },
    {
        path: "/attendance",
        icon: CalendarCheck,
        label: "Attendance",
        permission: FRONTEND_MODULES.ATTENDANCE,
        isExternal: true,
    },
    {
        path: "/courses",
        icon: Settings,
        label: "Settings",
        permission: FRONTEND_MODULES.COURSES,
        isExternal: true,
    },
    {
        path: "/users",
        icon: ShieldCheck,
        label: "User Management",
        permission: FRONTEND_MODULES.USERS,
        isExternal: true,
    },
    {
        path: "/reports",
        icon: BarChart3,
        label: "Reports",
        permission: FRONTEND_MODULES.REPORTS,
        isExternal: true,
    },
    {
        path: "/tickets",
        icon: Ticket,
        label: "Ticket Management",
        permission: FRONTEND_MODULES.TICKETS,
        // No isExternal here as this is the current app
        subItems: [
            {
                path: "/tickets",
                label: "Tickets",
                permission: FRONTEND_MODULES.TICKETS,
            },
            {
                path: "/task-management",
                label: "Task Management",
                permission: FRONTEND_MODULES.TASK_MANAGEMENT,
            },
        ],
    },
    {
        path: "/services",
        icon: Briefcase,
        label: "Services",
        permission: FRONTEND_MODULES.SERVICES,
        isExternal: true,
        subItems: [
            {
                path: "/services/requests",
                label: "Service Requests",
                permission: FRONTEND_MODULES.SERVICES,
                isExternal: true,
            },
            {
                path: "/services/config",
                label: "Configuration",
                permission: FRONTEND_MODULES.SERVICES,
                isExternal: true,
            },
        ],
    },
];

const AdminLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [expandedItems, setExpandedItems] = useState(new Set());

    const handleLogout = () => {
        logout();
        toast.success("Logged out successfully");
        navigate("/login");
    };

    // Get allowed modules based on user role and permissions
    const allowedModules = useMemo(() => {
        if (!user) return [];
        if (isFullAccessRole(user.role)) return Object.values(FRONTEND_MODULES);
        if (user.permissions) return getAllowedFrontendModules(user.permissions);
        return Array.isArray(user.modules) ? user.modules : [];
    }, [user]);

    // Filter navigation items
    const filteredNavItems = useMemo(() => {
        return NAV_ITEMS.filter((item) => {
            if (!item.permission) return true;
            if (isFullAccessRole(user?.role)) return true;
            if (user?.permissions) return hasModuleAccess(user.permissions, item.permission);
            return allowedModules.includes(item.permission);
        }).map((item) => {
            if (item.subItems) {
                const filteredSubItems = item.subItems.filter((subItem) => {
                    if (!subItem.permission) return true;
                    if (isFullAccessRole(user?.role)) return true;
                    if (user?.permissions) return hasModuleAccess(user.permissions, subItem.permission);
                    return allowedModules.includes(subItem.permission);
                });
                return { ...item, subItems: filteredSubItems };
            }
            return item;
        });
    }, [allowedModules, user?.role, user?.permissions]);

    // Check if a route is active
    const isRouteActive = (path) => {
        return location.pathname.startsWith(path);
    };

    // Toggle submenu expansion
    const toggleSubmenu = (path) => {
        setExpandedItems((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(path)) newSet.delete(path);
            else newSet.add(path);
            return newSet;
        });
    };

    // Auto-expand parent menu when on a sub-route
    useEffect(() => {
        filteredNavItems.forEach((item) => {
            if (item.subItems) {
                // Only auto expand if it's the CURRENT app route
                if (!item.isExternal) {
                    const hasActiveSubItem = item.subItems.some(
                        (subItem) => location.pathname === subItem.path,
                    );
                    if (hasActiveSubItem && !expandedItems.has(item.path)) {
                        setExpandedItems((prev) => new Set([...prev, item.path]));
                    }
                }
            }
        });
    }, [location.pathname, filteredNavItems]);

    const handleNavigation = (e, item) => {
        if (item.isExternal) {
            e.preventDefault();
            window.location.href = `${MAIN_APP_URL}${item.path}`;
        } else {
            setSidebarOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900">
            {/* Mobile Header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 heading-font">
                    Ticket Admin Panel
                </h1>
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2.5 rounded-lg hover:bg-blue-100 active:bg-blue-200 text-gray-700 hover:text-blue-700 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                    {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200
          transition-[width,transform] duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          ${sidebarCollapsed ? "w-16" : "w-56"}
          flex flex-col
        `}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Logo */}
                    <div className={`border-b border-gray-200 flex items-center transition-[padding,justify-content] duration-300 ease-out ${sidebarCollapsed ? "justify-center p-3 lg:p-4" : "justify-between p-4 lg:p-6"}`}>
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className={`h-10 sm:h-12 w-auto max-w-full object-contain transition-opacity duration-300 ease-out ${sidebarCollapsed ? "opacity-0 w-0 h-0 overflow-hidden" : "opacity-100"}`}
                            onError={(e) => e.target.style.display = 'none'}
                        />
                        <button
                            onClick={() => {
                                if (window.innerWidth < 1024) setSidebarOpen(false);
                                else setSidebarCollapsed(!sidebarCollapsed);
                            }}
                            className="lg:hidden p-2.5 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
                        >
                            <X size={20} />
                        </button>
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Nav */}
                    <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${sidebarCollapsed ? "p-2" : "p-3 sm:p-4"}`}>
                        {filteredNavItems.map((item) => {
                            const Icon = item.icon;
                            const hasSubItems = item.subItems && item.subItems.length > 0;
                            const isExpanded = expandedItems.has(item.path);
                            const isActive = isRouteActive(item.path);

                            if (hasSubItems && !sidebarCollapsed) {
                                const isActuallyExpanded = isExpanded || (isActive && !item.isExternal);
                                return (
                                    <div key={item.path} className="space-y-1">
                                        <div
                                            onClick={(e) => {
                                                if (item.isExternal) handleNavigation(e, item);
                                                else toggleSubmenu(item.path);
                                            }}
                                            className={`
                        w-full flex items-center justify-between rounded-lg cursor-pointer transition-all duration-200
                        gap-3 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[44px]
                        ${isActive && !item.isExternal
                                                    ? "bg-blue-600 text-white font-semibold"
                                                    : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                                                }
                      `}
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <Icon size={18} />
                                                <span className="text-xs font-medium">{item.label}</span>
                                            </div>
                                            {!item.isExternal && (isActuallyExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />)}
                                        </div>
                                        {isActuallyExpanded && !item.isExternal && (
                                            <div className="ml-2 pl-6 py-2 border-l-2 border-blue-300">
                                                {item.subItems.map(subItem => (
                                                    <Link
                                                        key={subItem.path}
                                                        to={subItem.path}
                                                        onClick={(e) => handleNavigation(e, subItem)}
                                                        className={`flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium rounded-md ${isRouteActive(subItem.path) ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-blue-100"}`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isRouteActive(subItem.path) ? "bg-white" : "bg-blue-500"}`} />
                                                        {subItem.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={(e) => handleNavigation(e, item)}
                                    className={`
                        flex items-center rounded-md transition-all duration-200
                        ${sidebarCollapsed ? "justify-center px-1.5 py-2.5" : "gap-2 px-2.5 py-1.5"}
                        min-h-[36px]
                        ${isActive && !item.isExternal ? "bg-blue-600 text-white font-semibold" : "text-gray-800 hover:bg-blue-100 hover:text-blue-700"}
                      `}
                                    title={sidebarCollapsed ? item.label : ""}
                                >
                                    <Icon size={18} className="flex-shrink-0" />
                                    {!sidebarCollapsed && <span className="text-xs">{item.label}</span>}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer User Info */}
                    <div className={`border-t border-gray-200 ${sidebarCollapsed ? "p-2" : "p-3 sm:p-4"}`}>
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                                    {user?.username?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{user?.name || user?.username}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.role}</p>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className={`w-full flex items-center rounded-md bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors ${sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5"}`}
                            title="Logout"
                        >
                            <LogOut size={20} />
                            {!sidebarCollapsed && <span className="text-xs font-bold">Logout</span>}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`h-screen bg-white transition-[margin-left] duration-300 ease-out flex flex-col ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-56"}`}>
                <div className="flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-2 lg:p-3 flex flex-col">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
