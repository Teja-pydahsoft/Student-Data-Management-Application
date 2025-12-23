import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    Home,
    CalendarCheck,
    User,
    LogOut,
    Menu,
    X,
    FileText,
    CreditCard
    Ticket,
    Megaphone,
    Briefcase,
    CheckCircle
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const StudentLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/student/login');
    };

    const navItems = [
        { icon: Home, label: 'Dashboard', path: '/student/dashboard' },
        { icon: Megaphone, label: 'Announcements', path: '/student/announcements' },
        { icon: CalendarCheck, label: 'Event Calendar', path: '/student/events' },
        { icon: CheckCircle, label: 'Attendance', path: '/student/attendance' },
        { icon: FileText, label: 'Sem Registration', path: '/student/semester-registration' },

        { icon: Briefcase, label: 'Services', path: '/student/services' },
        { icon: User, label: 'Profile', path: '/student/profile' },
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

            {/* Mobile Menu Button */}
            <button
                className="lg:hidden fixed top-4 right-4 z-50 p-2.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200 text-gray-700 active:scale-95 transition-all"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-white/90 backdrop-blur-xl border-r border-gray-200/60 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)] transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-full flex flex-col">
                    {/* Logo Area */}
                    <div className="h-20 flex items-center px-8 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                <span className="font-bold text-lg">P</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900 tracking-tight heading-font">
                                Student Portal
                            </span>
                        </div>
                    </div>

                    {/* User Info Card */}
                    <div className="mx-4 mt-6 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="h-12 w-12 rounded-full ring-2 ring-white shadow-md bg-gray-200 overflow-hidden shrink-0">
                                {user?.student_photo ? (
                                    <img src={user.student_photo} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <User size={20} />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'Student'}</p>
                                <p className="text-xs font-medium text-gray-500 truncate">{user?.admission_number}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-[10px] font-semibold text-green-600 tracking-wide uppercase">Online</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
                        <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Menu</p>
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
            <main className="flex-1 lg:ml-72 h-screen overflow-y-auto p-4 lg:p-8">
                <div className="w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default StudentLayout;

