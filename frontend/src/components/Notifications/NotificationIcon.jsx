import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import useNotificationStore from '../../store/notificationStore';
import NotificationDropdown from './NotificationDropdown';

const NotificationIcon = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { unreadCount, fetchNotifications } = useNotificationStore();

    // Initial fetch to get count
    useEffect(() => {
        fetchNotifications(1);

        // Optional: Poll for new notifications every minute
        const interval = setInterval(() => {
            fetchNotifications(1);
        }, 60000);

        return () => clearInterval(interval);
    }, [fetchNotifications]);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    p-3 rounded-full transition-all duration-300 relative group shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 backdrop-blur-sm
                    ${isOpen ? 'bg-blue-600 text-white rotate-180' : 'bg-white text-blue-600 hover:text-blue-700 hover:scale-110'}
                `}
                title="Notifications"
            >
                <Bell size={28} className={`transition-transform duration-300 ${isOpen ? 'scale-110' : 'group-hover:scale-110'}`} />

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white transform translate-x-1/2 -translate-y-1/2 shadow-sm animate-pulse"></span>
                )}
            </button>

            {/* Dropdown */}
            <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
    );
};

export default NotificationIcon;
