import { create } from 'zustand';
import api from '../config/api';

export const MODULE_ROUTE_MAP = {
  dashboard: '/',
  forms: '/forms',
  submissions: '/submissions',
  students: '/students',
  attendance: '/attendance',
  courses: '/courses',
  reports: '/reports',
  'user-management': '/users'
};

export const getModuleKeyForPath = (path = '/') => {
  if (path === '/' || path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/forms')) return 'forms';
  if (path.startsWith('/submissions')) return 'submissions';
  if (path.startsWith('/students')) return 'students';
  if (path.startsWith('/attendance')) return 'attendance';
  if (path.startsWith('/courses')) return 'courses';
  if (path.startsWith('/reports')) return 'reports';
  if (path.startsWith('/users')) return 'user-management';
  return null;
};

const resolveDefaultRoute = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/';
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
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
