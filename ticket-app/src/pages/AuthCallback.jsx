import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const AuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    useEffect(() => {
        const token = searchParams.get('token');
        const userStr = searchParams.get('user');
        const redirectPath = searchParams.get('redirect') || '/tickets'; // Default to admin tickets if undefined

        if (token && userStr) {
            try {
                const user = JSON.parse(decodeURIComponent(userStr));

                // Manually set local storage first to ensure persistence
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));

                // Update store
                useAuthStore.setState({
                    user: user,
                    token: token,
                    isAuthenticated: true,
                    userType: user.role // Approximating userType from role if needed
                });

                // Students must land on student routes; /dashboard is admin-only
                const isStudent = user?.role === 'student' || user?.admission_number;
                const resolvedPath =
                    isStudent && (redirectPath === '/dashboard' || redirectPath === '/')
                        ? '/student/my-tickets'
                        : redirectPath;

                // Navigate to the target path
                navigate(resolvedPath, { replace: true });
            } catch (error) {
                console.error("Failed to parse user data during auth callback", error);
                // Fallback to main app login
                const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173';
                window.location.href = `${mainAppUrl}/login`;
            }
        } else {
            // Missing credentials, go back to main app login
            const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173';
            window.location.href = `${mainAppUrl}/login`;
        }
    }, [searchParams, navigate, login]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-700">Authenticating...</h2>
                <p className="text-gray-500">Please wait while we redirect you.</p>
            </div>
        </div>
    );
};

export default AuthCallback;
