import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, User, CheckCircle, Smartphone, MapPin, BarChart3, Clock, Vote } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Additional Data States
    const [attendanceHistory, setAttendanceHistory] = useState(null);
    const [polls, setPolls] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    // UI States
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    const [currentAnnouncement, setCurrentAnnouncement] = useState(null);

    // Initial Data Fetch
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                if (!user?.admission_number) return;

                // 1. Fetch Student Profile
                const profilePromise = api.get(`/students/${user.admission_number}`);

                // 2. Fetch Announcements
                const announcementsPromise = api.get('/announcements/student');

                // 3. Fetch Polls
                const pollsPromise = api.get('/polls/student');

                // 4. Fetch Attendance History (for robust stats & today's status)
                const attendancePromise = api.get('/attendance/student');

                const [profileRes, announcementsRes, pollsRes, attendanceRes] = await Promise.allSettled([
                    profilePromise,
                    announcementsPromise,
                    pollsPromise,
                    attendancePromise
                ]);

                // Handle Profile
                if (profileRes.status === 'fulfilled' && profileRes.value.data.success) {
                    setStudentData(profileRes.value.data.data);
                }

                // Handle Announcements
                if (announcementsRes.status === 'fulfilled' && announcementsRes.value.data.success) {
                    const allAnnouncements = announcementsRes.value.data.data;
                    setAnnouncements(allAnnouncements);

                    // Show latest unseen announcement popup
                    const seenIds = JSON.parse(localStorage.getItem('seen_announcements') || '[]');
                    const unseen = allAnnouncements.filter(a => !seenIds.includes(a.id));
                    if (unseen.length > 0) {
                        setCurrentAnnouncement(unseen[0]);
                        setShowAnnouncement(true);
                    }
                }

                // Handle Polls
                if (pollsRes.status === 'fulfilled' && pollsRes.value.data.success) {
                    setPolls(pollsRes.value.data.data);
                }

                // Handle Attendance
                if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data.success) {
                    setAttendanceHistory(attendanceRes.value.data.data);
                }

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [user]);

    // Derived Attendance Stats
    const attendanceStats = useMemo(() => {
        if (!attendanceHistory?.semester?.series) return null;

        const series = attendanceHistory.semester.series;
        let present = 0;
        let absent = 0;
        let activeDays = 0; // Working days (excluding holidays)

        // Find Today's status from history if available
        // Note: History fetch usually targets "current month" by default or robust range. 
        // If the endpoint returns semester/monthly data, we check the series.
        const todayStr = new Date().toISOString().split('T')[0];
        let todayStatus = 'not marked';

        // Check series for today
        const todayEntry = series.find(d => d.date.startsWith(todayStr));
        if (todayEntry) {
            todayStatus = todayEntry.status === 'present' ? 'present' :
                todayEntry.status === 'absent' ? 'absent' :
                    todayEntry.isHoliday ? 'holiday' : 'not marked';
        }

        // Calculate Overview
        series.forEach(day => {
            if (!day.isHoliday) {
                activeDays++;
                if (day.status === 'present') present++;
                else if (day.status === 'absent') absent++;
            }
        });

        const percentage = activeDays > 0 ? ((present / activeDays) * 100).toFixed(1) : '0.0';

        return {
            todayStatus,
            present,
            absent,
            percentage
        };
    }, [attendanceHistory]);


    // Combined Feed (Announcements + Active Polls)
    const feedItems = useMemo(() => {
        const items = [];

        // Add Active Polls
        polls.forEach(poll => {
            // Check if poll is active (already handled by backend mostly, but double check)
            // Backend `getStudentPolls` returns active polls.
            // We can check `end_time` just in case UI wants to be strict
            items.push({
                type: 'poll',
                date: new Date(poll.created_at),
                data: poll
            });
        });

        // Add Announcements
        announcements.forEach(ann => {
            items.push({
                type: 'announcement',
                date: new Date(ann.created_at),
                data: ann
            });
        });

        // Sort by date desc
        return items.sort((a, b) => b.date - a.date);
    }, [polls, announcements]);


    // Helpers
    const displayData = studentData || user;
    const get = (path, fallback = 'N/A') => displayData?.[path] || fallback;

    const normalizeFeeStatus = () => {
        const rawSource = displayData?.fee_status
            || (displayData?.student_data ? (displayData.student_data['Fee Status'] || displayData.student_data.fee_status) : '')
            || '';
        const raw = String(rawSource).trim().toLowerCase();
        const normalized = raw.replace(/\s+/g, '_');
        const isCompleted = normalized === 'completed' || normalized === 'no_due' || normalized === 'nodue' || raw.includes('complete') || raw.includes('paid');
        const isPartial = normalized === 'partially_completed' || normalized === 'permitted' || raw.includes('partial');
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
        <div className="space-y-8 animate-fade-in relative z-0">
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
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                Close & Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 heading-font">
                    Welcome back, {displayData?.student_name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'} 👋
                </h1>
                <p className="text-gray-500 mt-2">
                    {displayData?.course || user?.course} | {displayData?.branch || user?.branch} | Year {displayData?.current_year || user?.current_year}
                </p>
            </div>

            {/* Attendance Overview Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Today's Status */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Today's Attendance</h3>
                    <div className="flex items-center gap-4">
                        {(() => {
                            // Priority: Calculated entry from history > displayData.today_attendance_status
                            let status = (attendanceStats?.todayStatus || displayData.today_attendance_status || 'not marked').toLowerCase();

                            // Safe fallback
                            if (status === 'not marked yet') status = 'not marked';

                            let colorClass = 'bg-gray-100 text-gray-600';
                            let icon = <Clock size={24} className="text-gray-400" />;
                            let label = 'Not Marked Yet';

                            if (status === 'present') {
                                colorClass = 'bg-green-100 text-green-700';
                                icon = <CheckCircle size={24} />;
                                label = 'Present';
                            } else if (status === 'absent') {
                                colorClass = 'bg-red-100 text-red-700';
                                icon = <MapPin size={24} />;
                                label = 'Absent';
                            } else if (status === 'holiday' || status === 'no class work') {
                                colorClass = 'bg-amber-100 text-amber-700';
                                icon = <BookOpen size={24} />;
                                label = status === 'holiday' ? 'Holiday' : 'No Class Work';
                            }

                            return (
                                <>
                                    <div className={`p-3 rounded-full ${colorClass}`}>
                                        {icon}
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{label}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Semester Summary */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Attendance Overview</h3>
                        <Link to="/student/attendance" className="text-xs text-blue-600 hover:underline font-medium">View History</Link>
                    </div>
                    {attendanceStats ? (
                        <div className="flex items-end gap-2">
                            <div>
                                <p className="text-4xl font-bold text-indigo-700">{attendanceStats.percentage}%</p>
                                <p className="text-xs text-gray-500 mt-1">Overall Semester</p>
                            </div>
                            <div className="flex-1 flex justify-end gap-3 text-right">
                                <div>
                                    <p className="text-sm font-bold text-green-600">{attendanceStats.present}</p>
                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Present</p>
                                </div>
                                <div className="w-px bg-gray-200 h-8"></div>
                                <div>
                                    <p className="text-sm font-bold text-red-500">{attendanceStats.absent}</p>
                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Absent</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-16 text-gray-400 text-sm">
                            Loading stats...
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions / Registration Banner */}
            {isRegistrationCompleted ? (
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-8 text-white shadow-lg shadow-green-200 overflow-hidden relative">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                <CheckCircle className="text-white" /> Registration Completed
                            </h2>
                            <p className="text-green-100 max-w-lg">
                                You are all set for this semester! Access your academic resources.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/student/profile')}
                            className="bg-white text-green-700 px-6 py-3 rounded-lg font-bold hover:bg-green-50 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                        >
                            View Profile
                        </button>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            ) : (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg shadow-blue-200 overflow-hidden relative">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Semester Registration Open</h2>
                            <p className="text-blue-100 max-w-lg">
                                {feeStatusLabel === 'Pending' ? 'Fees are pending. Complete fee payment to proceed with registration.' : 'Registration is open. Please complete your registration.'}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/student/semester-registration')}
                                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                            >
                                Register Now
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Feed Section (Announcements & Polls) */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <span role="img" aria-label="feed">📰</span>
                            </div>
                            Recent Updates & Polls
                        </h3>
                        {/* Link to all announcements maybe? */}
                    </div>

                    <div className="space-y-4 flex-1">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Loading updates...</div>
                        ) : feedItems.length > 0 ? (
                            feedItems.slice(0, 5).map((item, index) => {
                                if (item.type === 'poll') {
                                    const poll = item.data;
                                    return (
                                        <div key={`poll-${poll.id}`} className="p-5 rounded-xl bg-purple-50 border border-purple-100 hover:border-purple-200 transition-colors relative">
                                            <div className="absolute top-4 right-4 text-purple-200">
                                                <Vote size={48} className="opacity-20" />
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wide">Active Poll</span>
                                                <span className="text-xs text-gray-500">{new Date(poll.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="font-bold text-gray-900 mb-2">{poll.question}</h4>
                                            <p className="text-sm text-gray-600 mb-4">{poll.total_votes} students have voted</p>

                                            {/* Show Vote Status or Action */}
                                            {poll.has_voted ? (
                                                <div className="flex items-center gap-2 text-sm text-purple-700 font-medium bg-purple-100 px-3 py-2 rounded-lg inline-flex">
                                                    <CheckCircle size={16} /> Voted
                                                </div>
                                            ) : (
                                                <Link
                                                    to="/student/announcements" // Polls are usually in Announcements tab or separate. Assuming Announcements page handles polls? Or maybe create a Polls page.
                                                    // Let's assume announcements page or just a "Take Poll" button that navigates/opens modal.
                                                    // Since User Guide didn't specify Polls Page, I'll link to Announcements or where polls are.
                                                    // Actually User likely wants to see them. I'll just link to 'Announcements' page if polls are there, or maybe 'Services'?
                                                    // Wait, there is no "/student/polls" page usually.
                                                    // I will assume polls are shown in "Announcements" page or I should create one?
                                                    // For now, I won't create a new page, but the feed is useful.
                                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 inline-block"
                                                >
                                                    Participate Now
                                                </Link>
                                            )}
                                        </div>
                                    );
                                } else {
                                    const ann = item.data;
                                    return (
                                        <div key={`ann-${ann.id}`} className="p-5 rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-200 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-base">{ann.title}</h4>
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
                                    );
                                }
                            })
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-gray-500 text-sm">No new updates</p>
                            </div>
                        )}

                        <div className="text-center pt-2">
                            <Link to="/student/announcements" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
                                View All Announcements & Polls
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Profile Details (Sidebar) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-fit">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Your Details</h3>
                            <p className="text-sm text-gray-500">{get('admission_number')}</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
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

                    <Link
                        to="/student/profile"
                        className="flex items-center justify-between w-full p-4 rounded-lg border border-gray-200 hover:border-purple-200 hover:bg-purple-50 transition-colors group cursor-pointer"
                    >
                        <span className="font-medium text-gray-700 group-hover:text-purple-700">View Full Profile</span>
                        <CheckCircle size={18} className="text-gray-400 group-hover:text-purple-600" />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
