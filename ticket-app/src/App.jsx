import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';
import StudentLayout from './components/Layout/StudentLayout';

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
    // Redirect to Local Login instead of Main App
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // If not allowed, check if they are trying to access a legacy route or simple mismatch
    // For now, just send to unauthorized or home
    return <Navigate to="/unauthorized" replace />;
  }

  // Optional: Check granular permissions if provided
  if (requiredPermission && hasPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const App = () => {
  const { isLoading } = useAuthStore();

  // REMOVED: Automatic verifyToken() on mount.
  // This was causing 401s on the login page by trying to validate non-existent sessions against the portal.
  // The Ticket App Login is standalone. Authentication state is persisted in localStorage and handled by authStore.

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <LoadingAnimation message="Initializing Application..." size="lg" />
      </div>
    );
  }

  // Define roles allowed to access AdminLayout
  // Extended list to ensure all potential roles can at least land on the dashboard
  const adminLayoutRoles = [
    'super_admin', 'admin', 'staff', 'sub_admin', 'worker',
    'college_principal', 'college_ao', 'college_attender',
    'branch_hod', 'office_assistant', 'cashier', 'faculty'
  ];

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
        {/* Auth callback for portal-to-app workspace integration (if needed later) */}
        <Route path="/auth-callback" element={<AuthCallback />} />

        {/* Local Login for direct access */}
        <Route path="/login" element={<Login />} />

        {/* Redirect /student/login to main login to keep it unified */}
        <Route path="/student/login" element={<Navigate to="/login" replace />} />

        {/* Admin/Manager/Worker Routes */}
        <Route element={<Navigate to="/login" replace />} path="/" />

        {/* Admin Layout Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute allowedRoles={adminLayoutRoles}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="configuration" element={<TicketConfiguration />} />
          <Route path="employees" element={<EmployeeManagement />} />
          <Route path="task-management" element={<TaskManagement />} />
          <Route path="sub-admins" element={<SubAdminCreation />} />
          <Route path="roles" element={<RoleManagement />} />
          <Route path="tickets" element={<Navigate to="/task-management" replace />} />
        </Route>

        {/* Student Routes */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="my-tickets" element={<MyTickets />} />
          <Route path="raise-ticket" element={<RaiseTicket />} />
          {/* Default redirect for /student root */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

      </Routes>
    </>
  );
};

export default App;
