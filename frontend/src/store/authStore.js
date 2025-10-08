import { create } from 'zustand';
import api from '../config/api';

const useAuthStore = create((set) => ({
  admin: JSON.parse(localStorage.getItem('admin')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, admin } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('admin', JSON.stringify(admin));
      
      set({ admin, token, isAuthenticated: true });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    set({ admin: null, token: null, isAuthenticated: false });
  },
  
  verifyToken: async () => {
    try {
      const response = await api.get('/auth/verify');
      set({ admin: response.data.admin, isAuthenticated: true });
      return true;
    } catch (error) {
      set({ admin: null, token: null, isAuthenticated: false });
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      return false;
    }
  },
}));

export default useAuthStore;
