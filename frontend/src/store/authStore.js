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
  
  // Student users go to student dashboard
  if (isStudent || user.admission_number) {
    return '/student/dashboard';
  }
  
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
        const response = await api.post('/auth/login', { username, password });
        
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
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userType', 'admin');
        localStorage.removeItem('admin');
        
        set({ user, token, isAuthenticated: true, userType: 'admin' });
        return { success: true, redirectPath: resolveDefaultRoute(user, false) };
      } catch (error) {
        console.error('Admin login error:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
        return { 
          success: false, 
          message: errorMessage
        };
      }
    },
  
  loginAsStudent: async (username, password) => {
    try {
      const response = await api.post('/students/login', { username, password });
      
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
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userType', 'student');
      localStorage.removeItem('admin');
      
      set({ user, token, isAuthenticated: true, userType: 'student' });
      return { success: true, redirectPath: resolveDefaultRoute(user, true) };
    } catch (error) {
      console.error('Student login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
      return { 
        success: false, 
        message: errorMessage
      };
    }
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
        set({ user, isAuthenticated: true, userType: persistedType || 'admin' });
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
