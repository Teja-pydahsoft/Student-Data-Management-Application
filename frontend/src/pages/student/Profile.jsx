import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { User, Mail, Phone, MapPin, Calendar, Book, Hash, Lock, Shield, Clock } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { toast } from 'react-hot-toast';

const Profile = () => {
    const { user } = useAuthStore();
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Change Password State
    const [showChangePassModal, setShowChangePassModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [changePassLoading, setChangePassLoading] = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!newPassword) return;

        setChangePassLoading(true);
        try {
            const response = await api.post('/students/change-password', { newPassword });
            if (response.data.success) {
                toast.success('Password updated successfully');
                setShowChangePassModal(false);
                setNewPassword('');
            } else {
                toast.error(response.data.message || 'Failed to update password');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update password');
        } finally {
            setChangePassLoading(false);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get(`/students/${user.admission_number}`);

                if (response.data.success) {
                    setStudentData(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                toast.error('Failed to load profile details');
            } finally {
                setLoading(false);
            }
        };

        if (user?.admission_number) {
            fetchProfile();
        }
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Use fetched data or fallback to auth user data (which is minimal)
    const displayData = studentData || user;

    // Helper to safely get data
    const get = (path, fallback = 'N/A') => {
        if (!displayData) return fallback;
        return displayData[path] || fallback;
    };

    // Helper to get nested student_data fields safely (Case-Insensitive)
    const getStudentData = (key, fallback = 'N/A') => {
        if (!displayData || !displayData.student_data) return fallback;

        const dataKeys = Object.keys(displayData.student_data);
        const foundKey = dataKeys.find(k => k.toLowerCase() === key.toLowerCase());

        const val = foundKey ? displayData.student_data[foundKey] : undefined;
        return val !== undefined && val !== null && val !== '' ? val : fallback;
    };

    const getCertificateStatus = () => {
        const status = displayData.certificates_status || getStudentData('Certificates Status') || 'Pending';
        return status;
    };

    return (
        <div className="space-y-4 lg:space-y-6 lg:h-[calc(100vh-4rem)] lg:overflow-hidden flex flex-col p-1 w-full max-w-full overflow-x-hidden">
            {/* Premium Header Section */}
            <div className="relative mb-6 shrink-0">
                <div className="h-28 lg:h-32 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 shadow-xl overflow-hidden relative">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 lg:-mt-16 relative z-10">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-4 lg:p-5 flex flex-col md:flex-row items-center md:items-end gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Profile Image */}
                        <div className="relative group shrink-0">
                            <div className="h-28 w-28 lg:h-32 lg:w-32 rounded-full border-[5px] border-white bg-white shadow-xl overflow-hidden flex items-center justify-center relative z-10">
                                {displayData.student_photo ? (
                                    <img
                                        src={displayData.student_photo}
                                        alt={displayData.student_name}
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <User size={64} className="text-gray-300" />
                                )}
                            </div>
                            <div className="absolute bottom-2 right-2 z-20 transform translate-x-1 translate-y-1">
                                {getCertificateStatus().toLowerCase().includes('verified') ? (
                                    <div className="bg-green-500 text-white p-1.5 rounded-full border-[3px] border-white shadow-sm" title="Verified Student">
                                        <Shield size={16} fill="currentColor" />
                                    </div>
                                ) : (
                                    <div className="bg-yellow-500 text-white p-1.5 rounded-full border-[3px] border-white shadow-sm" title="Verification Pending">
                                        <Clock size={16} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Name & Details */}
                        <div className="flex-1 text-center md:text-left pb-1">
                            <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight tracking-tight">{displayData.student_name || user.name}</h1>
                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mt-1 text-gray-500">
                                <span className="font-semibold text-blue-600 tracking-wide">{displayData.admission_number || user.admission_number}</span>
                            </div>

                            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-wider shadow-sm border ${getCertificateStatus().toLowerCase().includes('verified')
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full mr-2 ${getCertificateStatus().toLowerCase().includes('verified') ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                    {getCertificateStatus()}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] lg:text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 uppercase tracking-wider shadow-sm">
                                    {displayData.stud_type || getStudentData('StudType') || 'Student'}
                                </span>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-full md:w-auto mt-2 md:mt-0">
                            <button
                                onClick={() => setShowChangePassModal(true)}
                                className="w-full md:w-auto px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 group active:scale-95"
                            >
                                <Lock size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                                <span>Change Password</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 flex-1 min-h-0 lg:grid-rows-2 xl:grid-rows-1 pb-2">
                {/* Personal Information */}
                <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 flex flex-col border-t-4 border-t-blue-500 min-w-0">
                    <div className="flex items-center gap-3 mb-4 shrink-0 border-b border-gray-50 pb-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <User size={20} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 tracking-tight">Personal Data</h3>
                    </div>

                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
                        <InfoItem label="Father's Name" value={displayData.father_name || getStudentData('Father Name')} />
                        <InfoItem label="Gender" value={displayData.gender || getStudentData('Gender')} />
                        <InfoItem label="Date of Birth" value={displayData.dob || getStudentData('DOB')} />
                        <InfoItem label="Caste/Category" value={displayData.caste || getStudentData('Caste')} />
                        <InfoItem label="Aadhar Number" value={displayData.adhar_no || getStudentData('Adhar No')} />
                    </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 flex flex-col border-t-4 border-t-green-500 min-w-0">
                    <div className="flex items-center gap-3 mb-4 shrink-0 border-b border-gray-50 pb-3">
                        <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                            <Phone size={20} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 tracking-tight">Contact Details</h3>
                    </div>

                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
                        <InfoItem label="Student Mobile" value={displayData.student_mobile || getStudentData('Student Mobile number')} />
                        <InfoItem label="Parent Mobile 1" value={displayData.parent_mobile1 || getStudentData('Parent Mobile Number 1')} />
                        <InfoItem label="Parent Mobile 2" value={displayData.parent_mobile2 || getStudentData('Parent Mobile Number 2')} />
                    </div>
                </div>

                {/* Academic Information */}
                <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 flex flex-col border-t-4 border-t-purple-500 min-w-0">
                    <div className="flex items-center gap-3 mb-4 shrink-0 border-b border-gray-50 pb-3">
                        <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                            <Book size={20} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 tracking-tight">Academic Info</h3>
                    </div>

                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
                        <InfoItem label="College" value={displayData.college || getStudentData('College')} />
                        <InfoItem label="Course" value={displayData.course || getStudentData('Course')} />
                        <InfoItem label="Branch" value={displayData.branch || getStudentData('Branch')} />
                        <div className="grid grid-cols-2 gap-3">
                            <InfoItem label="Year" value={displayData.current_year || getStudentData('Year')} />
                            <InfoItem label="Semester" value={displayData.current_semester || getStudentData('Semister')} />
                        </div>
                        <InfoItem label="Batch" value={displayData.batch || getStudentData('Batch')} />
                    </div>
                </div>

                {/* Address & Other Details */}
                <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 flex flex-col border-t-4 border-t-red-500 min-w-0">
                    <div className="flex items-center gap-3 mb-4 shrink-0 border-b border-gray-50 pb-3">
                        <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                            <MapPin size={20} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 tracking-tight">Address & Location</h3>
                    </div>

                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
                        <InfoItem label="Full Address" value={displayData.student_address || getStudentData('Student Address')} />
                        <InfoItem label="City/Village" value={displayData.city_village || getStudentData('City')} />
                        <InfoItem label="Mandal" value={displayData.mandal_name || getStudentData('Mandal')} />
                        <InfoItem label="District" value={displayData.district || getStudentData('District')} />
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {showChangePassModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in duration-200 border border-gray-100">
                        <button
                            onClick={() => setShowChangePassModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full p-1"
                        >
                            <span className="text-xl font-bold px-2">&times;</span>
                        </button>

                        <div className="mb-6 text-center">
                            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Change Password</h3>
                            <p className="text-sm text-gray-500 mt-1">Protect your account with a strong password</p>
                        </div>

                        <form onSubmit={handleChangePassword}>
                            <div className="mb-5">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all bg-gray-50 focus:bg-white text-sm"
                                    placeholder="Min. 6 characters"
                                    minLength={6}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={changePassLoading}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 transform active:scale-95 transition-all shadow-md hover:shadow-lg"
                            >
                                {changePassLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const InfoItem = ({ label, value }) => (
    <div className="flex flex-col border-b border-dashed border-gray-100 py-2 last:border-0 last:pb-0 hover:bg-gray-50 transition-colors rounded-lg px-2 -mx-2">
        <dt className="text-[10px] lg:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 min-w-0 truncate">{label}</dt>
        <dd className="text-gray-900 font-semibold text-sm truncate leading-tight min-w-0" title={value?.toString()}>
            {value || 'N/A'}
        </dd>
    </div>
);

export default Profile;


