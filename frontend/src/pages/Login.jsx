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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-cyan-50/30 flex items-center justify-center p-4">
      {/* Simple Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Wider Login Card */}
      <div className="w-full max-w-lg relative z-10">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative inline-flex mb-6">
              <div className="relative bg-gradient-to-br from-white to-slate-50 p-4 rounded-2xl shadow-inner border border-white/80">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl shadow-md">
                  <Users className="text-white" size={28} />
                </div>
              </div>
            </div>
            
            <h1 className="text-2xl font-semibold text-slate-800 mb-2">
              Administrator Access
            </h1>
            <p className="text-slate-600 text-sm">
              Student Management System
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="group">
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"
              >
                <Users size={16} className="text-cyan-500" />
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-300 font-normal text-sm shadow-sm group-hover:shadow-md group-hover:border-cyan-300 group-focus-within:border-cyan-400 group-focus-within:ring-2 group-focus-within:ring-cyan-100 group-focus-within:shadow-lg"
                  placeholder="Enter admin username"
                  disabled={loading}
                />
                {/* Glow effect on focus */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 to-blue-500/0 group-focus-within:from-cyan-500/10 group-focus-within:to-blue-500/10 transition-all duration-300 -z-10" />
              </div>
            </div>

            {/* Password Field */}
            <div className="group">
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"
              >
                <Shield size={16} className="text-blue-500" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-300 font-normal text-sm shadow-sm group-hover:shadow-md group-hover:border-blue-300 group-focus-within:border-blue-400 group-focus-within:ring-2 group-focus-within:ring-blue-100 group-focus-within:shadow-lg pr-12"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200 p-2 hover:bg-slate-100 rounded-lg"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {/* Glow effect on focus */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-focus-within:from-blue-500/10 group-focus-within:to-cyan-500/10 transition-all duration-300 -z-10" />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white py-3.5 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 focus:ring-2 focus:ring-cyan-100 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 group relative overflow-hidden shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.99]"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              
              {loading ? (
                <>
                  <LoadingAnimation
                    width={18}
                    height={18}
                    variant="inline"
                    showMessage={false}
                  />
                  <span className="text-sm">Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} className="transform group-hover:translate-x-0.5 transition-transform duration-300" />
                  <span className="text-sm">Access Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;