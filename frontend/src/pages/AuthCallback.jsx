import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const AuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const verifyToken = useAuthStore((state) => state.verifyToken);

    useEffect(() => {
        const processAuth = async () => {
            const token = searchParams.get('token');
            const role = searchParams.get('role');

            if (token) {
                try {
                    // Set token to allow API request
                    localStorage.setItem('token', token);

                    // Verify and fetch user details
                    const isValid = await verifyToken();

                    if (isValid) {
                        toast.success('Session restored');
                        if (role === 'student' || searchParams.get('from') === 'ticket_app') {
                            navigate('/student/dashboard', { replace: true });
                        } else {
                            navigate('/', { replace: true });
                        }
                    } else {
                        throw new Error('Token verification failed');
                    }
                } catch (error) {
                    console.error("SSO Error:", error);
                    toast.error("Session invalid");
                    navigate('/login', { replace: true });
                }
            } else {
                navigate('/login', { replace: true });
            }
        };

        processAuth();
    }, [searchParams, navigate, verifyToken]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-700">Verifying Session...</h2>
            </div>
        </div>
    );
};

export default AuthCallback;
