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
import FeeManagement from './pages/FeeManagement';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import StudentPromotions from './pages/StudentPromotions';
import TicketManagement from './pages/TicketManagement';
import TaskManagement from './pages/TaskManagement';
import Announcements from './pages/Announcements';
import ServicesConfig from './pages/ServicesConfig';
import ServiceRequests from './pages/ServiceRequests';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import SemesterRegistration from './pages/student/SemesterRegistration';
import RaiseTicket from './pages/student/RaiseTicket';
import MyTickets from './pages/student/MyTickets';
import StudentAnnouncements from './pages/student/StudentAnnouncements';
import StudentAttendance from './pages/student/Attendance';
import StudentServices from './pages/student/Services';

// Layout
import AdminLayout from './components/Layout/AdminLayout';
import StudentLayout from './components/Layout/StudentLayout';

// Protected Route Component for Admin
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, userType } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (userType === 'student') return <Navigate to="/student/dashboard" />;
  return children;
};

// Protected Route Component for Student
const ProtectedStudentRoute = ({ children }) => {
  const { isAuthenticated, userType } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/student/login" />;
  if (userType === 'admin') return <Navigate to="/" />;
  return children;
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
        <Route path="/student/login" element={<Login />} />
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
          <Route path="fees" element={<FeeManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="reports" element={<Reports />} />
          <Route path="tickets" element={<TicketManagement />} />
          <Route path="task-management" element={<TaskManagement />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="services/config" element={<ServicesConfig />} />
          <Route path="services/requests" element={<ServiceRequests />} />
        </Route>

        {/* Protected Student Routes */}
        <Route
          path="/student"
          element={
            <ProtectedStudentRoute>
              <StudentLayout />
            </ProtectedStudentRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="semester-registration" element={<SemesterRegistration />} />
          <Route path="raise-ticket" element={<RaiseTicket />} />
          <Route path="my-tickets" element={<MyTickets />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="services" element={<StudentServices />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
