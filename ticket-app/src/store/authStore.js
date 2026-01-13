import { create } from 'zustand';
import api from '../config/api';
import { queryClient } from '../config/queryClient';
import {
    MODULE_ROUTE_MAP,
    getModuleKeyForPath,
    getAllowedFrontendModules,
    isFullAccessRole,
    FRONTEND_MODULES
} from '../constants/rbac';

// Re-export for backward compatibility
export { MODULE_ROUTE_MAP, getModuleKeyForPath };

const resolveDefaultRoute = (user, isStudent = false) => {
    if (!user) return '/login';

    // Student users go to student dashboard OR my-tickets since this is ticket app
    if (isStudent || user.role === 'student' || user.admission_number) {
        return '/student/my-tickets'; // Redirect directly to tickets for student
    }

    // Admin users
    return '/tickets'; // Redirect directly to ticket management
};

const useAuthStore = create((set) => {
    // Initialize from localStorage
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    const storedUserType = localStorage.getItem('userType');

    return {
        user: storedUser ? JSON.parse(storedUser) : null,
        token: storedToken || null,
        isAuthenticated: !!storedToken,
        userType: storedUserType || null, // 'admin' or 'student'

        login: async (username, password) => {
            try {
                const response = await api.post('/auth/unified-login', { username, password });

                // Check if response has success flag
                if (!response.data.success) {
                    return {
                        success: false,
                        message: response.data.message || 'Login failed'
                    };
                }

                const { token, user } = response.data;

                if (!token || !user) {
                    return {
                        success: false,
                        message: 'Invalid response from server'
                    };
                }

                const userType = user.role === 'student' ? 'student' : 'admin';

                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('userType', userType);
                localStorage.removeItem('admin');

                set({ user, token, isAuthenticated: true, userType });
                return { success: true, redirectPath: resolveDefaultRoute(user, userType === 'student') };
            } catch (error) {
                console.error('Login error:', error);
                const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
                return {
                    success: false,
                    message: errorMessage
                };
            }
        },

        // Kept for backward compatibility but routes to unified login logic internally or just fails gracefully if used directly
        loginAsStudent: async (username, password) => {
            // Use the unified login instead
            return useAuthStore.getState().login(username, password);
        },

        setAuth: (user, token, userType = 'student') => {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('userType', userType);
            set({ user, token, isAuthenticated: true, userType });
        },

        updateUser: (userData) => set((state) => ({
            user: { ...state.user, ...userData }
        })),

        logout: () => {
            // Clear all React Query cache immediately
            queryClient.clear();

            // Clear all localStorage items (comprehensive cleanup)
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userType');
            localStorage.removeItem('admin');

            // Clear any other potential cache/data items
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('react-query') || key.startsWith('cache') || key.startsWith('app-'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            } catch (error) {
                console.warn('Error during localStorage cleanup:', error);
            }

            // Clear state
            set({ user: null, token: null, isAuthenticated: false, userType: null });
        },

        verifyToken: async () => {
            try {
                const response = await api.get('/auth/verify');
                const { user } = response.data || {};
                if (user) {
                    localStorage.setItem('user', JSON.stringify(user));
                    localStorage.removeItem('admin');
                    const persistedType = localStorage.getItem('userType');
                    // If persisted type is missing, infer from role
                    const type = persistedType || (user.role === 'student' ? 'student' : 'admin');

                    set({ user, isAuthenticated: true, userType: type });
                    return true;
                }
                throw new Error('Invalid response');
            } catch (error) {
                set({ user: null, token: null, isAuthenticated: false, userType: null });
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userType');
                return false;
            }
        }
    }
});

export default useAuthStore;
