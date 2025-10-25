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

// For production, ensure we use the same domain for static files
export const getStaticFileUrl = (filename) => {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;

  // In production, use the same domain as the API but without /api
  const baseUrl = rawApiUrl ? rawApiUrl.replace(/\/api$/, '') : 'http://localhost:5000';

  // Handle cross-domain static file serving
  return `${baseUrl}/uploads/${filename}`;
};

// Alternative function for direct static file access (bypass CORS issues)
export const getStaticFileUrlDirect = (filename) => {
  if (!filename) return '';

  // If it's already a data URL (base64), return as-is
  if (filename.startsWith('data:')) return filename;

  // If it's already a full HTTP URL, return as-is
  if (filename.startsWith('http')) return filename;

  // For file paths, construct the URL
  // Use proxy approach for production
  if (rawApiUrl && rawApiUrl.includes('onrender.com')) {
    // For Render backend, use direct URL construction
    return `https://pydahsdbms.onrender.com/uploads/${filename}`;
  }

  return `${rawApiUrl ? rawApiUrl.replace(/\/api$/, '') : 'http://localhost:5000'}/uploads/${filename}`;
};


const api = axios.create({
  baseURL: API_BASE_URL,
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
