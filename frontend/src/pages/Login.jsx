import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { LogIn, Loader2, Eye, EyeOff, Users } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import api, { CRM_BACKEND_URL, CRM_FRONTEND_URL } from '../config/api';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, loginFromSSO, isAuthenticated, userType } = useAuthStore();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // SSO state
  const [isVerifying, setIsVerifying] = useState(false);
  const [ssoError, setSsoError] = useState(null);
  const [showLoginForm, setShowLoginForm] = useState(false);

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [userTypeReset, setUserTypeReset] = useState('student');

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotMobile) return;

    setForgotLoading(true);
    try {
      // Determine endpoint based on selection or context
      const targetUserType = isStudentLogin ? 'student' : userTypeReset;
      const endpoint = targetUserType === 'staff' ? '/auth/rbac/forgot-password' : '/students/forgot-password';

      const response = await api.post(endpoint, { mobileNumber: forgotMobile });
      if (response.data.success) {
        toast.success(response.data.message);
        setShowForgotModal(false);
        setForgotMobile('');
      } else {
        toast.error(response.data.message || 'Failed to clean password');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send password. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Determine if this is a student login based on route
  const isStudentLogin = location.pathname.startsWith('/student/login');

  const handleSSOLogin = useCallback(async (encryptedToken) => {
    setIsVerifying(true);
    setSsoError(null);
    try {
      const verifyRes = await fetch(`${CRM_BACKEND_URL}/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedToken }),
      });
      const text = await verifyRes.text();
      if (!text || !text.trim()) {
        throw new Error(`CRM verify-token returned empty response (status ${verifyRes.status}). Is the CRM backend running?`);
      }
      let verifyResult;
      try {
        verifyResult = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`CRM verify-token returned invalid JSON (status ${verifyRes.status}). Check CRM /auth/verify-token.`);
      }

      if (!verifyResult.success || !verifyResult.valid) {
        throw new Error(verifyResult.message || 'Token validation failed');
      }

      const { userId, role, portalId, expiresAt } = verifyResult.data || {};
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        throw new Error('Token has expired');
      }

      const sessionRes = await api.post('/auth/sso-session', {
        userId,
        role,
        portalId,
        ssoToken: encryptedToken,
      });

      if (!sessionRes.data?.success || !sessionRes.data?.token || !sessionRes.data?.user) {
        throw new Error('Failed to create local session');
      }

      const { token, user } = sessionRes.data;
      const result = loginFromSSO(token, user);
      toast.success('Login successful!');
      navigate(result.redirectPath, { replace: true });
    } catch (err) {
      console.error('SSO login error:', err);
      const msg = err.response?.data?.message || err.message || 'SSO login failed';
      setSsoError(msg);
      setShowLoginForm(true);
      toast.error(msg);
      setSearchParams({});
    } finally {
      setIsVerifying(false);
    }
  }, [navigate, loginFromSSO, setSearchParams]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      handleSSOLogin(token);
    } else {
      setShowLoginForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; token from URL
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isVerifying) {
      if (userType === 'student' || isStudentLogin) {
        navigate('/student/dashboard');
      } else {
        navigate('/');
      }
    }
  }, [isAuthenticated, navigate, userType, isStudentLogin, isVerifying]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    const result = await login(formData.username, formData.password);

    setLoading(false);

    if (result.success) {
      toast.success('Login successful!');
      navigate(result.redirectPath);
    } else {
      toast.error(result.message);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!showLoginForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-gray-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative background accents */}
      <div className="absolute inset-0">
        <div className="absolute top-[-5%] left-[10%] w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[5%] w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-70 animate-pulse" />
      </div>

      {/* SSO error banner */}
      {ssoError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md w-full mx-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 z-20">
          <p className="text-sm text-amber-800">{ssoError}</p>
          <a
            href={CRM_FRONTEND_URL}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
          >
            Return to CRM Portal
          </a>
        </div>
      )}

      {/* Login card */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-border-light shadow-xl rounded-2xl sm:rounded-3xl relative z-10 p-6 sm:p-8 transition-transform duration-500">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <img
            src="/logo.png"
            alt="Pydah DB Logo"
            className="h-12 sm:h-14 w-auto max-w-full object-contain mx-auto mb-3 sm:mb-4"
            loading="lazy"
          />
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary mb-1 tracking-tight">
            Portal Login
          </h1>
          <p className="text-muted-text text-xs sm:text-sm">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 text-base sm:text-sm border border-gray-200 rounded-lg sm:rounded-xl bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 touch-manipulation min-h-[44px]"
                placeholder="Enter Username or Admission No"
                disabled={loading}
              />
              <Users
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 text-base sm:text-sm border border-gray-200 rounded-lg sm:rounded-xl bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 pr-12 touch-manipulation min-h-[44px]"
                placeholder="Enter your password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-text hover:text-text-secondary active:text-text-primary transition touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-lg sm:rounded-xl text-white font-medium text-base sm:text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 focus:ring-4 focus:ring-blue-300 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] relative overflow-hidden group touch-manipulation min-h-[44px]"
          >
            {/* Button Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {loading ? (
              <>
                <Loader2 className="animate-spin text-white" size={18} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Access Dashboard
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Forgot Password?
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-text mt-6 space-y-1">
          <p>© {new Date().getFullYear()} Student Management System</p>
          <a
            href={CRM_FRONTEND_URL}
            className="text-blue-600 hover:text-blue-800 font-medium inline-block"
          >
            Return to CRM Portal
          </a>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <EyeOff size={20} className="hidden" /> {/* Dummy icon usage to prevent unused err if I removed imports? No, I'll use X if available or text */}
              <span className="text-xl font-bold">&times;</span>
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-2">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">Enter your registered mobile number. We'll send you a new password via SMS.</p>

            {/* User Type Selection */}
            {!isStudentLogin && (
              <div className="flex gap-4 mb-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="userTypeReset"
                    checked={userTypeReset === 'student'}
                    onChange={() => setUserTypeReset('student')}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Student</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="userTypeReset"
                    checked={userTypeReset === 'staff'}
                    onChange={() => setUserTypeReset('staff')}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Staff / Admin</span>
                </label>
              </div>
            )}

            <form onSubmit={handleForgotSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={forgotMobile}
                  onChange={(e) => setForgotMobile(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter mobile number"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {forgotLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                {forgotLoading ? 'Sending...' : 'Send New Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div >
  );
};

export default Login;
