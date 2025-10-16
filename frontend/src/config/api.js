import axios from 'axios';

// If VITE_API_URL is provided at build time, normalize it and ensure it points to the backend API root
const rawApiUrl = import.meta.env.VITE_API_URL;
let API_BASE_URL;

if (rawApiUrl) {
  // Remove trailing slash if present
  const cleanUrl = rawApiUrl.replace(/\/$/, '');
  // Ensure it includes /api
  API_BASE_URL = cleanUrl.endsWith('/api') ? cleanUrl : cleanUrl + '/api';
} else {
  API_BASE_URL = 'http://localhost:5000/api';
}

// Also create a base URL for static files (without /api)
export const STATIC_BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/api$/, '') : 'http://localhost:5000';

console.log('🚀 Frontend API Configuration:');
console.log('API Base URL:', API_BASE_URL);
console.log('Environment VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('Current origin:', window.location.origin);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data || error.message);
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
