import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
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
    BellOff
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import NotificationPermissionModal from '../NotificationPermissionModal';
import NotificationIcon from '../Notifications/NotificationIcon';
import { getSubscriptionStatus, registerServiceWorker, subscribeUser } from '../../services/pushService';

const StudentLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    useEffect(() => {
        checkPushStatus();
    }, []);

    const checkPushStatus = async () => {
        const status = await getSubscriptionStatus();
        if (status === 'granted') {
            setIsSubscribed(true);
        } else if (status === 'default') {
            setIsSubscribed(false);
            // Show modal automatically if permission is default (not yet asked)
            // Delay slightly for better UX
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

            {/* Mobile Menu Button */}
            <div className="lg:hidden fixed top-4 right-4 z-50 flex gap-2 items-center">
                <button
                    className="p-2.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200 text-gray-700 active:scale-95 transition-all"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

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

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-white/90 backdrop-blur-xl border-r border-gray-200/60 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)] transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                ${desktopSidebarOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full'}
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
                            className="hidden lg:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
                                onClick={() => setSidebarOpen(false)}
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

                    {/* User Info Card (Moved to Bottom) */}
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

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className={`flex-1 h-screen overflow-y-auto p-4 lg:p-8 relative z-10 transition-all duration-300 ${desktopSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>

                {/* Notification Icon - Bottom Right for ALL devices */}
                <div className="fixed bottom-8 right-8 z-50">
                    <NotificationIcon />
                </div>

                <div className="w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default StudentLayout;

