import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, User, CheckCircle, Smartphone, MapPin } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch full student data
    useEffect(() => {
        const fetchStudentDetails = async () => {
            try {
                if (!user?.admission_number) return;

                const response = await api.get(`/students/${user.admission_number}`);

                if (response.data.success) {
                    setStudentData(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                // Don't toast error here to avoid spamming if profile also fetches
            } finally {
                setLoading(false);
            }
        };

        fetchStudentDetails();
    }, [user]);

    // Use fetched data or fallback to auth user
    const displayData = studentData || user;
    const get = (path, fallback = 'N/A') => displayData?.[path] || fallback;

    // Normalize status helpers
    const normalizeFeeStatus = () => {
        const rawSource = displayData?.fee_status
            || (displayData?.student_data ? (displayData.student_data['Fee Status'] || displayData.student_data.fee_status) : '')
            || '';
        const raw = String(rawSource).trim().toLowerCase();
        const isCompleted = raw === 'completed' || raw.includes('complete') || raw.includes('paid');
        const isPartial = raw === 'partially_completed' || raw.includes('partial');
        const label = isCompleted ? 'Completed' : isPartial ? 'Partially Completed' : 'Pending';
        return label;
    };
    const normalizeRegistrationStatus = () => {
        const rawSource = displayData?.registration_status
            || (displayData?.student_data ? (displayData.student_data['Registration Status'] || displayData.student_data.registration_status) : '')
            || '';
        const raw = String(rawSource).trim().toLowerCase();
        return raw === 'completed' ? 'Completed' : 'Pending';
    };

    const feeStatusLabel = normalizeFeeStatus();
    const registrationLabel = normalizeRegistrationStatus();
    const isRegistrationCompleted = registrationLabel === 'Completed' && feeStatusLabel === 'Completed';

    // Attendance overview removed: avoid showing any placeholder or false stats

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome Section */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 heading-font">
                    Welcome back, {displayData?.student_name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'} 👋
                </h1>
                <p className="text-gray-500 mt-2">
                    {displayData?.course || user?.course} | {displayData?.branch || user?.branch} | Year {displayData?.current_year || user?.current_year}
                </p>
            </div>

            {/* Quick Actions Card / Completed Banner */}
            {isRegistrationCompleted ? (
                <div className="bg-green-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                            <CheckCircle className="text-white" /> Registration Completed
                        </h2>
                        <p className="text-green-100 mb-6 max-w-lg">
                            Your semester registration is complete. You can view your profile or return later to make changes if fees update.
                        </p>
                        <button
                            onClick={() => navigate('/student/profile')}
                            className="bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors shadow-sm cursor-pointer"
                        >
                            Go to Profile
                        </button>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            ) : (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2">Semester Registration Open</h2>
                        <p className="text-blue-100 mb-6 max-w-lg">
                            {feeStatusLabel === 'Pending' ? 'Fees are pending. Complete or partially complete fees to proceed.' : 'Registration is open. You may proceed.'}
                        </p>
                        <button
                            onClick={() => navigate('/student/semester-registration')}
                            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-sm cursor-pointer"
                        >
                            Register Now
                        </button>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">

                {/* Profile Quick Details */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Your Details</h3>
                            <p className="text-sm text-gray-500">{get('admission_number')}</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6 flex-1">
                        <div className="flex items-center gap-3 text-sm">
                            <User size={16} className="text-gray-400" />
                            <span className="text-gray-700 truncate">{get('student_name', user?.name)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <CheckCircle size={16} className={isRegistrationCompleted ? 'text-green-500' : 'text-yellow-500'} />
                            <span className="text-gray-700">Registration: {registrationLabel}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <BookOpen size={16} className={feeStatusLabel === 'Completed' ? 'text-green-500' : (feeStatusLabel === 'Partially Completed' ? 'text-yellow-500' : 'text-red-500')} />
                            <span className="text-gray-700">Fees: {feeStatusLabel}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Smartphone size={16} className="text-gray-400" />
                            <span className="text-gray-700">{get('student_mobile', 'No mobile')}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <MapPin size={16} className="text-gray-400" />
                            <span className="text-gray-700 truncate">{get('college', 'Pydah Group')}</span>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <Link
                            to="/student/profile"
                            className="flex items-center justify-between w-full p-4 rounded-lg border border-gray-200 hover:border-purple-200 hover:bg-purple-50 transition-colors group"
                        >
                            <span className="font-medium text-gray-700 group-hover:text-purple-700">View Full Profile</span>
                            <CheckCircle size={18} className="text-gray-400 group-hover:text-purple-600" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

