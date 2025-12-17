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
        const normalized = raw.replace(/\s+/g, '_');
        const isCompleted =
            normalized === 'completed' ||
            normalized === 'no_due' ||
            normalized === 'nodue' ||
            raw.includes('complete') ||
            raw.includes('paid');
        const isPartial =
            normalized === 'partially_completed' ||
            normalized === 'permitted' ||
            raw.includes('partial');
        if (isCompleted) return 'Completed';
        if (isPartial) return 'Partially Completed';
        return 'Pending';
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

    // Announcement State
    const [announcements, setAnnouncements] = useState([]);
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    const [currentAnnouncement, setCurrentAnnouncement] = useState(null);

    // Fetch announcements
    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const response = await api.get('/announcements/student');
                if (response.data.success && response.data.data.length > 0) {
                    const allAnnouncements = response.data.data;
                    const seenIds = JSON.parse(localStorage.getItem('seen_announcements') || '[]');

                    // Filter unseen announcements
                    const unseen = allAnnouncements.filter(a => !seenIds.includes(a.id));

                    if (unseen.length > 0) {
                        setCurrentAnnouncement(unseen[0]); // Show the latest unseen
                        setShowAnnouncement(true);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch announcements', error);
            }
        };
        fetchAnnouncements();
    }, []);

    const closeAnnouncement = () => {
        if (currentAnnouncement) {
            const seenIds = JSON.parse(localStorage.getItem('seen_announcements') || '[]');
            if (!seenIds.includes(currentAnnouncement.id)) {
                seenIds.push(currentAnnouncement.id);
                localStorage.setItem('seen_announcements', JSON.stringify(seenIds));
            }
        }
        setShowAnnouncement(false);
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            {/* Announcement Popup */}
            {showAnnouncement && currentAnnouncement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        {currentAnnouncement.image_url && (
                            <div className="h-48 w-full bg-gray-100">
                                <img src={currentAnnouncement.image_url} alt="Announcement" className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{currentAnnouncement.title}</h3>
                            <p className="text-gray-600 mb-6 text-sm leading-relaxed max-h-60 overflow-y-auto">
                                {currentAnnouncement.content}
                            </p>
                            <button
                                onClick={closeAnnouncement}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Close & Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome Section */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 heading-font">
                    Welcome back, {displayData?.student_name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'} 👋
                </h1>
                <p className="text-gray-500 mt-2">
                    {displayData?.course || user?.course} | {displayData?.branch || user?.branch} | Year {displayData?.current_year || user?.current_year}
                </p>
            </div>

            {/* Attendance Status Widget */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Today's Attendance</h3>
                    <div className="mt-1 flex items-center gap-3">
                        {(() => {
                            const status = (displayData.today_attendance_status || 'not marked').toLowerCase();
                            let colorClass = 'bg-gray-100 text-gray-600';
                            let icon = <CheckCircle size={20} className="opacity-0" />; // Placeholder

                            if (status === 'present') {
                                colorClass = 'bg-green-100 text-green-700';
                                icon = <CheckCircle size={20} />;
                            } else if (status === 'absent') {
                                colorClass = 'bg-red-100 text-red-700';
                                icon = <MapPin size={20} />;
                            } else if (status === 'holiday') {
                                colorClass = 'bg-purple-100 text-purple-700';
                                icon = <BookOpen size={20} />;
                            }

                            return (
                                <div className={`px-4 py-1.5 rounded-full font-bold flex items-center gap-2 capitalize ${colorClass}`}>
                                    {icon}
                                    {status === 'not marked' ? 'Not Marked Yet' : status}
                                </div>
                            );
                        })()}
                        <span className="text-xs text-gray-400">
                            ({new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })})
                        </span>
                    </div>
                </div>
                <Link to="/student/announcements" className="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    View Announcements &rarr;
                </Link>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Announcements Feed */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <span role="img" aria-label="announcement">📢</span>
                            </div>
                            Recent Announcements
                        </h3>
                        <Link to="/student/announcements" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                            View All
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Loading announcements...</div>
                        ) : announcements.length > 0 ? (
                            announcements.slice(0, 3).map((ann) => (
                                <div key={ann.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-200 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{ann.title}</h4>
                                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-100 whitespace-nowrap">
                                            {new Date(ann.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                                        {ann.content}
                                    </p>
                                    <button
                                        onClick={() => {
                                            setCurrentAnnouncement(ann);
                                            setShowAnnouncement(true);
                                        }}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        Read More &rarr;
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-500 text-sm">No new announcements</p>
                            </div>
                        )}
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

