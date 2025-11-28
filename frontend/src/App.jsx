import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Forms from './pages/Forms';
import FormBuilder from './pages/FormBuilder';
import Submissions from './pages/Submissions';
import Students from './pages/Students';
import AddStudent from './pages/AddStudent';
import Settings from './pages/Settings';
import PublicForm from './pages/PublicForm';
import Attendance from './pages/Attendance';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import StudentPromotions from './pages/StudentPromotions';

// Layout
import AdminLayout from './components/Layout/AdminLayout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/form/:formId" element={<PublicForm />} />
        
        {/* Protected Admin Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="forms" element={<Forms />} />
          <Route path="forms/new" element={<FormBuilder />} />
          <Route path="forms/edit/:formId" element={<FormBuilder />} />
          <Route path="students" element={<Students />} />
          <Route path="students/add" element={<AddStudent />} />
          <Route path="students/self-registration" element={<Submissions />} />
          <Route path="promotions" element={<StudentPromotions />} />
          <Route path="courses" element={<Settings />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="reports" element={<Reports />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
