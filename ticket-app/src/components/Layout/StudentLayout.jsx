import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    RiHome4Line,
    RiHome4Fill,
    RiMegaphoneLine,
    RiMegaphoneFill,
    RiGroupLine,
    RiGroupFill,
    RiCalendarEventLine,
    RiCalendarEventFill,
    RiCheckboxCircleLine,
    RiCheckboxCircleFill,
    RiFileList3Line,
    RiFileList3Fill,
    RiServiceLine,
    RiServiceFill,
    RiWallet3Line,
    RiWallet3Fill,
    RiMenuLine,
    RiCloseLine,
    RiLogoutBoxRLine,
    RiUser3Line,
    RiUser3Fill,
    RiMore2Fill,
    RiTicketLine,
    RiTicketFill
} from 'react-icons/ri';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

// Main App URL for redirection
const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:3000';

const StudentLayout = ({ children }) => {
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const navItems = [
        { icon: RiHome4Line, activeIcon: RiHome4Fill, label: 'Dashboard', path: '/student/dashboard', isExternal: false },
        { icon: RiTicketLine, activeIcon: RiTicketFill, label: 'Ticket History', path: '/student/my-tickets', isExternal: false },
        { icon: RiUser3Line, activeIcon: RiUser3Fill, label: 'Profile', path: '/student/profile', isExternal: true },
        { icon: RiLogoutBoxRLine, activeIcon: RiLogoutBoxRLine, label: 'Back to Portal', path: '/', isExternal: true },
    ];

    const handleNavigation = (e, item) => {
        if (item.isExternal) {
            e.preventDefault();
            window.location.href = `${MAIN_APP_URL}${item.path}`;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
            {/* Background Pattern - Matched with Portal */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40"
                style={{
                    backgroundImage: `radial-gradient(#CBD5E1 1.5px, transparent 1.5px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Desktop Sidebar Toggle Button */}
            {!desktopSidebarOpen && (
                <button
                    className="hidden lg:flex fixed top-6 left-6 z-50 p-2 bg-white/80 backdrop-blur-md rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-gray-900 transition-all hover:scale-105 active:scale-95"
                    onClick={() => setDesktopSidebarOpen(true)}
                    title="Expand Sidebar"
                >
                    <RiMenuLine size={20} />
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
                                <span className="font-bold text-lg">T</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900 tracking-tight heading-font">
                                Ticket Support
                            </span>
                        </div>
                        <button
                            onClick={() => setDesktopSidebarOpen(false)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <RiMenuLine size={20} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-8 space-y-2.5 overflow-y-auto custom-scrollbar">
                        {navItems.map((item) => (
                            item.isExternal ? (
                                <a
                                    key={item.path}
                                    href={`${MAIN_APP_URL}${item.path}`}
                                    className={`
                                      relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group
                                      text-gray-600 hover:bg-blue-50 hover:text-blue-700
                                    `}
                                >
                                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-blue-600 transition-all duration-300 opacity-0 scale-y-0`}></span>
                                    <item.icon size={20} className={`transition-transform duration-300 group-hover:scale-110`} />
                                    <span className="tracking-wide">{item.label}</span>
                                </a>
                            ) : (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `
                                      relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group
                                      ${isActive
                                            ? 'bg-blue-50/80 text-blue-700 shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                    `}
                                >
                                    {({ isActive }) => {
                                        const Icon = isActive ? item.activeIcon : item.icon;
                                        return (
                                            <>
                                                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-blue-600 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 scale-y-0'}`}></span>
                                                <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                                <span className="tracking-wide">{item.label}</span>
                                                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-lg shadow-blue-400"></div>}
                                            </>
                                        );
                                    }}
                                </NavLink>
                            )
                        ))}
                    </nav>

                    {/* User Info Card */}
                    <div
                        onClick={() => window.location.href = `${MAIN_APP_URL}/student/profile`}
                        className="mx-4 mb-2 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-md transition-all"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="h-10 w-10 rounded-full ring-2 ring-white shadow-md bg-gray-200 overflow-hidden shrink-0">
                                {user?.student_photo ? (
                                    <img src={user.student_photo} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <RiUser3Fill size={18} />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-gray-900 truncate">{user?.student_name || user?.name || 'Student'}</p>
                                </div>
                                <p className="text-xs font-medium text-gray-500 truncate">{user?.admission_number || user?.admissionNumber}</p>
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/30">
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2.5 px-4 py-3.5 w-full rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 group"
                        >
                            <RiLogoutBoxRLine size={18} className="group-hover:-translate-x-1 transition-transform" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`
                flex-1 h-screen overflow-y-auto p-4 lg:p-8 relative z-10 transition-all duration-300 ease-in-out
                ${desktopSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}
                pb-24 lg:pb-8
            `}>
                <div className="w-full">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation - Docked & Premium (No "More" Menu needed for 4 items) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl z-50 pb-safe">
                <div className="flex items-center justify-around px-2 pt-3 pb-2">
                    {navItems.map((item) => (
                        item.isExternal ? (
                            <a
                                key={item.path}
                                href={`${MAIN_APP_URL}${item.path}`}
                                className="flex-1 flex flex-col items-center justify-center gap-1.5 p-1 transition-all duration-300 group text-gray-400 hover:text-blue-600"
                            >
                                <div className="relative p-1">
                                    <item.icon
                                        size={24}
                                        className="transition-all duration-300 group-active:scale-90"
                                    />
                                </div>
                                <span className="text-[10px] font-bold tracking-wide truncate w-full text-center leading-none text-gray-500 font-medium">
                                    {item.label}
                                </span>
                            </a>
                        ) : (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `
                                    flex-1 flex flex-col items-center justify-center gap-1.5 p-1 transition-all duration-300 group
                                    ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}
                                `}
                            >
                                {({ isActive }) => {
                                    const Icon = isActive ? item.activeIcon : item.icon;
                                    return (
                                        <>
                                            <div className="relative p-1">
                                                <Icon
                                                    size={24}
                                                    className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-sm' : 'group-active:scale-90'}`}
                                                />
                                                {isActive && (
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold tracking-wide truncate w-full text-center leading-none ${isActive ? 'text-blue-600' : 'text-gray-500 font-medium'}`}>
                                                {item.label}
                                            </span>
                                        </>
                                    );
                                }}
                            </NavLink>
                        )
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudentLayout;
