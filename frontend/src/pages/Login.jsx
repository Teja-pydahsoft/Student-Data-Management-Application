import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, Eye, EyeOff, Users, Shield } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

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
      navigate('/');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background accents */}
      <div className="absolute inset-0">
        <div className="absolute top-[-5%] left-[10%] w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[5%] w-96 h-96 bg-cyan-100 rounded-full blur-3xl opacity-70 animate-pulse" />
      </div>

      {/* Login card */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200/70 shadow-xl rounded-3xl relative z-10 p-8 transition-transform duration-500 hover:scale-[1.01]">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Pydah DB Logo"
            className="h-14 w-auto max-w-full object-contain mx-auto mb-4"
            loading="lazy"
          />
          <h1 className="text-2xl font-semibold text-slate-800 mb-1 tracking-tight">
            Admin Login
          </h1>
          <p className="text-slate-500 text-sm">Access your student management panel</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-700 mb-2"
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all duration-300"
                placeholder="Enter admin username"
                disabled={loading}
              />
              <Users
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-2"
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all duration-300 pr-12"
                placeholder="Enter your password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-xl text-white font-medium text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:ring-4 focus:ring-cyan-100 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] relative overflow-hidden group"
          >
            {/* Button Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
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

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} Student Management System
        </div>
      </div>
    </div>
  );
};

export default Login;
