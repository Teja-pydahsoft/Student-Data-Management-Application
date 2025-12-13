import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, User, CheckCircle, Smartphone, Mail, Calendar, MapPin, Hash } from 'lucide-react';
import useAuthStore from '../store/authStore';
import axios from 'axios';
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

                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await axios.get(`${apiUrl}/api/students/${user.admission_number}`);

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

    // Placeholder stats
    const attendanceStats = {
        totalClasses: 120,
        present: 102,
        percentage: 85,
        lastUpdate: 'Today'
    };

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

            {/* Quick Actions Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2">Semester Registration Open</h2>
                    <p className="text-blue-100 mb-6 max-w-lg">
                        Registration for the upcoming semester is now live. Complete the process to secure your subjects.
                    </p>
                    <button
                        onClick={() => navigate('/semester-registration')}
                        className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-sm cursor-pointer"
                    >
                        Register Now
                    </button>
                </div>
                {/* Decorative circle */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Attendance Card - Main Focus */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Attendance Overview</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${attendanceStats.percentage >= 75 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {attendanceStats.percentage >= 75 ? 'Good Standing' : 'Needs Improvement'}
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-8">
                        {/* Circular Progress (CSS only) */}
                        <div className="relative h-32 w-32 flex-shrink-0">
                            <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                                <path
                                    className="text-gray-100"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                                <path
                                    className={`${attendanceStats.percentage >= 75 ? 'text-green-500' : 'text-yellow-500'}`}
                                    strokeDasharray={`${attendanceStats.percentage}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                            </svg>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <span className="text-2xl font-bold text-gray-900">{attendanceStats.percentage}%</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <p className="text-gray-500 text-xs uppercase tracking-wide">Total Classes</p>
                                <p className="text-xl font-bold text-gray-900">{attendanceStats.totalClasses}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                <p className="text-gray-500 text-xs uppercase tracking-wide">Present</p>
                                <p className="text-xl font-bold text-gray-900">{attendanceStats.present}</p>
                            </div>
                        </div>
                    </div>
                </div>

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
                            to="/profile"
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
