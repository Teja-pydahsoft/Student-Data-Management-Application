import { create } from 'zustand';
import api from '../config/api';

const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    page: 1,
    hasMore: true,
    hasShownLoginToast: false,

    setHasShownLoginToast: (value) => set({ hasShownLoginToast: value }),

    fetchNotifications: async (page = 1) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/web-notifications?page=${page}&limit=10`);

            const { notifications, unreadCount, pagination } = response.data;

            set(state => ({
                notifications: page === 1 ? notifications : [...state.notifications, ...notifications],
                unreadCount,
                page,
                hasMore: page < pagination.totalPages,
                isLoading: false
            }));
        } catch (error) {
            set({
                error: error.response?.data?.message || 'Failed to fetch notifications',
                isLoading: false
            });
        }
    },

    markAsRead: async (id) => {
        try {
            // Optimistic update
            set(state => ({
                notifications: state.notifications.map(n =>
                    n.id === id ? { ...n, is_read: 1 } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1)
            }));

            await api.patch(`/web-notifications/${id}/read`);
        } catch (error) {
            console.error('Failed to mark as read', error);
            // Ideally revert state here on error
        }
    },

    markAllAsRead: async () => {
        try {
            set(state => ({
                notifications: state.notifications.map(n => ({ ...n, is_read: 1 })),
                unreadCount: 0
            }));

            await api.patch(`/web-notifications/read-all`);
        } catch (error) {
            console.error('Failed to mark all as read', error);
        }
    },

    deleteNotification: async (id) => {
        try {
            // Optimistic update
            set(state => ({
                notifications: state.notifications.filter(n => n.id !== id),
                // If we deleted an unread one, decrement count
                unreadCount: state.notifications.find(n => n.id === id)?.is_read
                    ? state.unreadCount
                    : Math.max(0, state.unreadCount - 1)
            }));

            await api.delete(`/web-notifications/${id}`);
        } catch (error) {
            console.error('Failed to delete notification', error);
        }
    },

    clearAllNotifications: async () => {
        try {
            set({ notifications: [], unreadCount: 0 });

            await api.delete(`/web-notifications/clear-all`);
        } catch (error) {
            console.error('Failed to clear notifications', error);
        }
    }
}));

export default useNotificationStore;
