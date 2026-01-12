import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
    Home,
    CalendarCheck,
    User,
    Users,
    LogOut,
    Menu,
    X,
    FileText,
    CreditCard,
    Ticket,
    Megaphone,
    Briefcase,
    CheckCircle,
    Bell,
    BellOff,
    MoreHorizontal
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import toast from 'react-hot-toast';
import NotificationPermissionModal from '../NotificationPermissionModal';
import NotificationIcon from '../Notifications/NotificationIcon';
import { getSubscriptionStatus, registerServiceWorker, subscribeUser } from '../../services/pushService';
import RegistrationPendingModal from '../RegistrationPendingModal';

const StudentLayout = ({ children }) => {
    // State
    const [sidebarOpen, setSidebarOpen] = useState(false); // Kept for logic compatibility or specialized tablet views
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [showRestrictionModal, setShowRestrictionModal] = useState(false);
    const [fetchedStatus, setFetchedStatus] = useState(null);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false); // New: For mobile "More" menu

    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();

    useEffect(() => {
        const fetchStudentStatus = async () => {
            if (user?.admission_number) {
                try {
                    const res = await api.get(`/students/${user.admission_number}`);
                    if (res.data.success && res.data.data) {
                        setFetchedStatus(res.data.data);
                    }
                } catch (error) {
                    console.error('Failed to fetch student status in layout', error);
                }
            }
        };
        fetchStudentStatus();
    }, [user?.admission_number]);

    // Registration Status Check
    const isRegistrationPending = () => {
        const data = fetchedStatus || user;
        const rawSource = data?.registration_status
            || (data?.student_data ? (data.student_data['Registration Status'] || data.student_data.registration_status) : '')
            || '';
        const raw = String(rawSource).trim().toLowerCase();
        return raw !== 'completed';
    };

    const isPending = isRegistrationPending();
    const allowedPaths = ['/student/dashboard', '/student/semester-registration'];

    useEffect(() => {
        if (isPending && !allowedPaths.includes(location.pathname)) {
            setShowRestrictionModal(true);
        } else if (!isPending) {
            setShowRestrictionModal(false);
        }
    }, [location.pathname, isPending]);

    const handleNavigation = (e, path) => {
        if (isPending && !allowedPaths.includes(path)) {
            e.preventDefault();
            setShowRestrictionModal(true);
            setMostRecentNavClick(null); // specific logic cleaner
        }
        setMoreMenuOpen(false); // Close mobile drawer on nav
    };

    const handleModalClose = () => {
        setShowRestrictionModal(false);
        if (isPending && !allowedPaths.includes(location.pathname)) {
            navigate('/student/dashboard');
        }
    };

    useEffect(() => {
        checkPushStatus();
    }, []);

    const checkPushStatus = async () => {
        const status = await getSubscriptionStatus();
        if (status === 'granted') {
            setIsSubscribed(true);
        } else if (status === 'default') {
            setIsSubscribed(false);
            setTimeout(() => setNotificationModalOpen(true), 1500);
        } else {
            setIsSubscribed(false);
        }
    };

    const handleAllowNotifications = async () => {
        const registration = await registerServiceWorker();
        if (registration) {
            const success = await subscribeUser(registration);
            if (success) {
                setIsSubscribed(true);
                toast.success('You will now receive notifications!');
                setNotificationModalOpen(false);
            } else {
                toast.error('Failed to subscribe. Please try again.');
            }
        } else {
            toast.error('Push messaging not supported or service worker failed.');
        }
    };

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/student/login');
    };

    const navItems = [
        { icon: Home, label: 'Dashboard', path: '/student/dashboard' },
        { icon: Megaphone, label: 'Announcements', path: '/student/announcements' },
        { icon: Users, label: 'Clubs', path: '/student/clubs' },
        { icon: CalendarCheck, label: 'Event Calendar', path: '/student/events' },
        { icon: CheckCircle, label: 'Attendance', path: '/student/attendance' },
        { icon: FileText, label: 'Sem Registration', path: '/student/semester-registration' },
        { icon: Briefcase, label: 'Services', path: '/student/services' },
        { icon: CreditCard, label: 'Fee Management', path: '/student/fees' },
    ];

    // Split items for Mobile Navigation
    // Primary: Dashboard, Attendance, Fees, Services (or Registration if pending)
    const mobilePrimaryPaths = isPending
        ? ['/student/dashboard', '/student/attendance', '/student/fees', '/student/semester-registration']
        : ['/student/dashboard', '/student/attendance', '/student/fees', '/student/services'];

    // Helper to find item by path
    const findItem = (path) => navItems.find(item => item.path === path);

    const mobilePrimaryItems = mobilePrimaryPaths.map(path => findItem(path)).filter(Boolean);
    const mobileSecondaryItems = navItems.filter(item => !mobilePrimaryPaths.includes(item.path));


    return (
        <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
            {/* Background Pattern */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40"
                style={{
                    backgroundImage: `radial-gradient(#CBD5E1 1.5px, transparent 1.5px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            <NotificationPermissionModal
                isOpen={notificationModalOpen}
                onClose={() => setNotificationModalOpen(false)}
                onAllow={handleAllowNotifications}
            />

            <RegistrationPendingModal
                isOpen={showRestrictionModal}
                onClose={handleModalClose}
            />

            {/* Desktop Sidebar Toggle Button */}
            {!desktopSidebarOpen && (
                <button
                    className="hidden lg:flex fixed top-6 left-6 z-50 p-2 bg-white/80 backdrop-blur-md rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-gray-900 transition-all hover:scale-105 active:scale-95"
                    onClick={() => setDesktopSidebarOpen(true)}
                    title="Expand Sidebar"
                >
                    <Menu size={20} />
                </button>
            )}

            {/* Sidebar (HIDDEN on Mobile) */}
            <aside className={`
                hidden lg:flex
                fixed inset-y-0 left-0 z-40 w-72 bg-white/90 backdrop-blur-xl border-r border-gray-200/60 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)] transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
                ${desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="h-full flex flex-col">
                    {/* Logo Area */}
                    <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                <span className="font-bold text-lg">P</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900 tracking-tight heading-font">
                                Student Portal
                            </span>
                        </div>
                        <button
                            onClick={() => setDesktopSidebarOpen(false)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={(e) => handleNavigation(e, item.path)}
                                className={({ isActive }) => `
                                  relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group
                                  ${isActive
                                        ? 'bg-blue-50/80 text-blue-700 shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-blue-600 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 scale-y-0'}`}></span>
                                        <item.icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="tracking-wide">{item.label}</span>
                                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-lg shadow-blue-400"></div>}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    {/* User Info Card */}
                    <div
                        onClick={() => navigate('/student/profile')}
                        className="mx-4 mb-2 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md transition-all"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="h-10 w-10 rounded-full ring-2 ring-white shadow-md bg-gray-200 overflow-hidden shrink-0">
                                {user?.student_photo ? (
                                    <img src={user.student_photo} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <User size={18} />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'Student'}</p>
                                </div>
                                <p className="text-xs font-medium text-gray-500 truncate">{user?.admission_number}</p>
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/30">
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2.5 px-4 py-3.5 w-full rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 group"
                        >
                            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`
                flex-1 h-screen overflow-y-auto p-4 lg:p-8 relative z-10 transition-all duration-300 
                ${desktopSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}
                pb-24 lg:pb-8
            `}>
                {/* Notification Icon */}
                <div className="fixed bottom-20 lg:bottom-8 right-4 lg:right-8 z-50">
                    <NotificationIcon />
                </div>

                <div className="w-full">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation - Enhanced Styling */}
            <div className="lg:hidden fixed bottom-5 left-4 right-4 bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl z-50 pb-safe animate-slide-up">
                <div className="flex items-center justify-around px-2 py-3">
                    {mobilePrimaryItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={(e) => handleNavigation(e, item.path)}
                            className={({ isActive }) => `
                                flex-1 flex flex-col items-center justify-center gap-1.5 p-1 transition-all duration-300
                                ${isActive ? 'text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-600'}
                            `}
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={`relative p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                                        <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-pulse-subtle' : ''} />
                                        {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></div>}
                                    </div>
                                    <span className={`text-[10px] font-semibold tracking-wide truncate w-full text-center leading-none ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                                        {/* Shorten labels for mobile */}
                                        {item.label === 'Fee Management' ? 'Fees' :
                                            item.label === 'Attendance' ? 'Attend' :
                                                item.label === 'Sem Registration' ? 'Register' :
                                                    item.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}

                    {/* More Button */}
                    <button
                        onClick={() => setMoreMenuOpen(true)}
                        className={`flex-1 flex flex-col items-center justify-center gap-1.5 p-1 transition-all duration-300 ${moreMenuOpen ? 'text-blue-600 scale-105' : 'text-gray-400'}`}
                    >
                        <div className={`relative p-1 rounded-xl ${moreMenuOpen ? 'bg-blue-50' : ''}`}>
                            <Menu size={24} />
                        </div>
                        <span className="text-[10px] font-semibold tracking-wide leading-none text-gray-500">Menu</span>
                    </button>
                </div>
            </div>

            {/* Mobile More Menu Drawer */}
            {moreMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setMoreMenuOpen(false)}
                    />

                    {/* Drawer Content - with margin for bottom bar */}
                    <div className="relative bg-[#F8FAFC] rounded-t-3xl p-6 shadow-2xl animate-fade-in-up pb-28">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Ofther Menu</h3>
                            <button onClick={() => setMoreMenuOpen(false)} className="p-2 bg-white rounded-full text-gray-600 shadow-sm border border-gray-100">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {mobileSecondaryItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={(e) => handleNavigation(e, item.path)}
                                    className={({ isActive }) => `
                                        flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border
                                        ${isActive
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
                                            : 'bg-white text-gray-600 border-gray-100 shadow-sm hover:shadow-md active:scale-95'}
                                    `}
                                >
                                    <item.icon size={24} />
                                    <span className="text-[10px] font-bold text-center line-clamp-2 leading-tight">
                                        {item.label === 'Sem Registration' ? 'Reg.' : item.label}
                                    </span>
                                </NavLink>
                            ))}
                        </div>

                        {/* Profile & Logout in Drawer */}
                        <div className="space-y-3">
                            <div
                                onClick={() => {
                                    navigate('/student/profile');
                                    setMoreMenuOpen(false);
                                }}
                                className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden">
                                    {user?.student_photo ? (
                                        <img src={user.student_photo} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        <User size={20} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'Student'}</p>
                                    <p className="text-xs text-gray-500">View Profile</p>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    <MoreHorizontal size={18} className="text-gray-400" />
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-50 text-red-600 font-bold border border-red-100 active:bg-red-100 transition-colors"
                            >
                                <LogOut size={20} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentLayout;
