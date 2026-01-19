import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';
import StudentLayout from './components/Layout/StudentLayout';

// Pages
// Pages
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import TicketConfiguration from './pages/admin/TicketConfiguration';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import TaskManagement from './pages/admin/TaskManagement';
import SubAdminCreation from './pages/admin/SubAdminCreation';
import RoleManagement from './pages/admin/RoleManagement';

// Student Pages
import Dashboard from './pages/student/Dashboard';
import RaiseTicket from './pages/student/RaiseTicket';
import MyTickets from './pages/student/MyTickets';

// Store & Components
import useAuthStore from './store/authStore';
import LoadingAnimation from './components/LoadingAnimation';

// RBAC
import { FRONTEND_MODULES } from './constants/rbac';

const ProtectedRoute = ({ children, allowedRoles, requiredPermission }) => {
  const { isAuthenticated, user, hasPermission, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <LoadingAnimation message="Verifying access..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to Main App Login
    const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173';
    window.location.href = `${mainAppUrl}/login`;
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Check if role is sub_admin which might not be in allowedRoles if checking specifically for others
    // But usually allowedRoles should include sub_admin if they are allowed
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const App = () => {
  const { verifyToken, isLoading } = useAuthStore();

  useEffect(() => {
    // Verify token on mount to ensure session validity
    // Skip verification on auth-callback page to verify race condition with SSO
    if (!window.location.pathname.includes('/auth-callback')) {
      verifyToken();
    }
  }, [verifyToken]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <LoadingAnimation message="Initializing Application..." size="lg" />
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

      <Routes>
        <Route path="/auth-callback" element={<AuthCallback />} />
        {/* Redirect Login routes to Main App */}
        <Route path="/login" element={<AuthCallback />} />
        <Route path="/student/login" element={<AuthCallback />} />

        {/* Admin Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'staff', 'sub_admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />

          <Route path="/configuration" element={<TicketConfiguration />} />
          <Route path="/employees" element={<EmployeeManagement />} />
          <Route path="/task-management" element={<TaskManagement />} />
          <Route path="/sub-admins" element={<SubAdminCreation />} />
          <Route path="/roles" element={<RoleManagement />} />

          {/* Legacy redirects */}
          <Route path="/tickets" element={<Navigate to="/task-management" replace />} />
        </Route>

        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="" element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="my-tickets" element={<MyTickets />} />
          <Route path="raise-ticket" element={<RaiseTicket />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
};

export default App;
