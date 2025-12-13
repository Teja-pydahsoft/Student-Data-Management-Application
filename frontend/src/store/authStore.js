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

const resolveDefaultRoute = (user) => {
  if (!user) return '/login';
  
  // Super admin and legacy admin have full access - go to dashboard
  if (isFullAccessRole(user.role)) return '/';
  
  // For RBAC users, check permissions and find first allowed route
  if (user.permissions) {
    const allowedModules = getAllowedFrontendModules(user.permissions);
    
    // If user has dashboard access or no specific permissions, go to dashboard
    if (allowedModules.includes(FRONTEND_MODULES.DASHBOARD) || allowedModules.length === 0) {
      return '/';
    }
    
    // Find first allowed module's route
    for (const moduleKey of allowedModules) {
      const route = MODULE_ROUTE_MAP[moduleKey];
      if (route) {
        return route;
      }
    }
  }
  
  // Legacy staff users with modules array
  const modules = Array.isArray(user.modules) ? user.modules : [];
  for (const moduleKey of modules) {
    const route = MODULE_ROUTE_MAP[moduleKey];
    if (route) {
      return route;
    }
  }
  
  return '/';
};

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.removeItem('admin');
      
      set({ user, token, isAuthenticated: true });
      return { success: true, redirectPath: resolveDefaultRoute(user) };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  },
  
  logout: () => {
    // Clear all React Query cache immediately
    queryClient.clear();
    
    // Clear all localStorage items (comprehensive cleanup)
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    
    // Clear any other potential cache/data items
    // Clear all localStorage items that might contain cached data
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
      // Ignore errors during cleanup
      console.warn('Error during localStorage cleanup:', error);
    }
    
    // Clear state
    set({ user: null, token: null, isAuthenticated: false });
  },
  
  verifyToken: async () => {
    try {
      const response = await api.get('/auth/verify');
      const { user } = response.data || {};
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.removeItem('admin');
        set({ user, isAuthenticated: true });
        return true;
      }
      throw new Error('Invalid response');
    } catch (error) {
      set({ user: null, token: null, isAuthenticated: false });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return false;
    }
  },
}));

export default useAuthStore;
