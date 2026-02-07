import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, Phone, Mail, Building, Key, Edit2, Save, X, Users, CheckCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../config/api';
import toast from 'react-hot-toast';

const Profile = () => {
    const { user, updateUser } = useAuthStore(); // added updateUser

    // Profile Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        name: '',
        username: '',
        email: '',
        phone: ''
    });
    const [profileLoading, setProfileLoading] = useState(false);

    // Student Stats State
    const [studentStats, setStudentStats] = useState(null);

    // Password Change State
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordLoading, setPasswordLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || '',
                username: user.username || '',
                email: user.email || '',
                phone: user.phone || ''
            });
            fetchStudentStats();
        }
    }, [user]);

    const fetchStudentStats = async () => {
        try {
            const response = await api.get('/auth/profile/stats');
            if (response.data.success) {
                setStudentStats(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleProfileChange = (e) => {
        setProfileData({
            ...profileData,
            [e.target.name]: e.target.value
        });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({
            ...passwordData,
            [e.target.name]: e.target.value
        });
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setProfileData({
            name: user.name || '',
            username: user.username || '',
            email: user.email || '',
            phone: user.phone || ''
        });
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            const response = await api.put('/auth/profile', profileData);
            if (response.data.success) {
                toast.success(response.data.message);

                // Update global store and local storage
                const updatedUser = response.data.user;
                updateUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser)); // Ensure persistence

                setIsEditing(false);
                // Removed window.location.reload() to maintain SPA state
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const handleSubmitPassword = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error("New passwords don't match");
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setPasswordLoading(true);
        try {
            const response = await api.post('/auth/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            if (response.data.success) {
                toast.success(response.data.message);
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                document.getElementById('password_modal').close();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="w-full space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 heading-font">Profile Settings</h1>
                    <p className="text-gray-500 mt-1">Manage your account settings and security preferences</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left Column: Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <form onSubmit={handleProfileSubmit}>
                        <div className={`bg-white rounded-2xl shadow-sm border ${isEditing ? 'border-blue-200 ring-4 ring-blue-50/50' : 'border-gray-100'} overflow-hidden transition-all duration-300 relative`}>
                            {/* Header Gradient */}
                            <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
                                <div className="absolute top-4 right-4 flex gap-2">
                                    {!isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors"
                                            title="Edit Profile"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                                    <div className="relative">
                                        <div className="w-24 h-24 bg-white rounded-full p-1 shadow-xl">
                                            <div className="w-full h-full bg-gray-50 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
                                                {user.username?.charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        {!isEditing && (
                                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full" title="Active"></div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-16 pb-8 px-6 text-center">
                                {isEditing ? (
                                    <div className="space-y-4 mb-4">
                                        <input
                                            type="text"
                                            name="name"
                                            value={profileData.name}
                                            onChange={handleProfileChange}
                                            className="w-full text-center text-xl font-bold text-gray-900 border-b-2 border-blue-200 focus:border-blue-600 outline-none pb-1 bg-transparent placeholder-gray-400"
                                            placeholder="Enter Full Name"
                                            required
                                        />
                                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                                            {user.role}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-bold text-gray-900 mb-1">{user.name || user.username}</h2>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                                            {user.role}
                                        </span>
                                    </>
                                )}

                                <div className="mt-8 space-y-4 text-left">
                                    {/* Username Field */}
                                    <div className={`flex items-center gap-4 p-3 rounded-xl transition-colors group ${isEditing ? 'bg-white border border-gray-200' : 'bg-gray-50 hover:bg-blue-50/50'}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-colors ${isEditing ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-500 group-hover:text-blue-600'}`}>
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Username</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    name="username"
                                                    value={profileData.username}
                                                    onChange={handleProfileChange}
                                                    className="w-full text-sm font-medium text-gray-900 outline-none border-b border-gray-100 focus:border-blue-500 bg-transparent py-0.5"
                                                    required
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-gray-900">{user.username}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Email Field */}
                                    <div className={`flex items-center gap-4 p-3 rounded-xl transition-colors group ${isEditing ? 'bg-white border border-gray-200' : 'bg-gray-50 hover:bg-blue-50/50'}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-colors ${isEditing ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-500 group-hover:text-blue-600'}`}>
                                            <Mail className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Email</label>
                                            {isEditing ? (
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={profileData.email}
                                                    onChange={handleProfileChange}
                                                    className="w-full text-sm font-medium text-gray-900 outline-none border-b border-gray-100 focus:border-blue-500 bg-transparent py-0.5"
                                                    required
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]" title={user.email}>{user.email || 'N/A'}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Phone Field */}
                                    <div className={`flex items-center gap-4 p-3 rounded-xl transition-colors group ${isEditing ? 'bg-white border border-gray-200' : 'bg-gray-50 hover:bg-blue-50/50'}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-colors ${isEditing ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-500 group-hover:text-blue-600'}`}>
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Phone</label>
                                            {isEditing ? (
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={profileData.phone}
                                                    onChange={handleProfileChange}
                                                    className="w-full text-sm font-medium text-gray-900 outline-none border-b border-gray-100 focus:border-blue-500 bg-transparent py-0.5"
                                                    required
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-gray-900">{user.phone || 'N/A'}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    {isEditing ? (
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={profileLoading}
                                                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {profileLoading ? (
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('password_modal').showModal()}
                                            className="w-full px-4 py-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-blue-600 font-medium rounded-lg border border-gray-200 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <Lock className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                            Change Password
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Right Column: Student Access & Status */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Access Overview (Count) */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 blur-2xl"></div>
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <h3 className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-2">Students in Scope</h3>
                                <div className="flex items-baseline gap-2">
                                    <h4 className="text-5xl font-bold tracking-tight">{studentStats?.count || 0}</h4>
                                    <span className="text-blue-200 text-sm font-medium">Students</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner border border-white/10">
                                <Users className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-sm font-medium text-blue-100/90 relative z-10 bg-black/10 w-fit px-3 py-1.5 rounded-lg border border-white/10">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            Active students under your scope
                        </div>
                    </div>

                    {/* Access Scope (Hierarchy) – single unified card for all users */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <Building className="w-4 h-4 text-blue-600" />
                            Your Access Scope
                        </h3>

                        <div className="space-y-3">
                            {/* College → Program → Branch */}
                            <div className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 rounded-lg">
                                <span className="text-xs font-medium text-gray-400 w-16">College</span>
                                <span className="text-gray-900 font-medium">{studentStats?.hierarchy?.college || 'All Colleges'}</span>
                            </div>
                            <div className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 rounded-lg">
                                <span className="text-xs font-medium text-gray-400 w-16">Program</span>
                                <span className="text-gray-900 font-medium">{studentStats?.hierarchy?.course || 'All Programs'}</span>
                            </div>
                            <div className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 rounded-lg">
                                <span className="text-xs font-medium text-gray-400 w-16">Branch</span>
                                <span className="text-gray-900 font-medium">{studentStats?.hierarchy?.branch || 'All Branches'}</span>
                            </div>

                            {/* HOD: compact year/semester row – integrated, not a separate loud card */}
                            {user?.role === 'branch_hod' && studentStats?.hodProfile?.assignments?.length > 0 && (
                                <div className="flex items-start gap-3 py-2.5 px-4 bg-slate-50 rounded-lg border border-slate-200/80">
                                    <span className="text-xs font-medium text-gray-400 w-16 shrink-0">Cohorts</span>
                                    <div className="text-gray-800 text-sm space-y-1">
                                        {studentStats.hodProfile.assignments.map((a) => (
                                            <div key={a.branchId}>
                                                <span className="font-medium">{a.branchName}</span>
                                                <span className="text-gray-500 mx-1.5">·</span>
                                                <span>Years {a.years?.join(', ')}</span>
                                                <span className="text-gray-400 mx-1">·</span>
                                                <span>Sem {a.semesters?.join(', ')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security Tip */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-blue-100 text-blue-600">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-base font-bold text-blue-900 mb-1">Security Recommendation</h4>
                            <p className="text-sm text-blue-700 leading-relaxed">
                                To ensure maximum security, use a strong password combining upper & lowercase letters, numbers, and symbols.
                                Regularly updating your password helps protect student data.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Change Modal - Native HTML Dialog */}
            <dialog id="password_modal" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-0 rounded-2xl shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm w-full max-w-md bg-white m-0">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-blue-600" />
                        Change Password
                    </h3>
                    <form method="dialog">
                        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </form>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmitPassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={handlePasswordChange}
                                    className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    placeholder="Current password"
                                    required
                                />
                                <Key className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                                <div className="relative group">
                                    <input
                                        type="password"
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                        placeholder="Min 6 characters"
                                        required
                                    />
                                    <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                                <div className="relative group">
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                        placeholder="Re-enter new password"
                                        required
                                    />
                                    <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => document.getElementById('password_modal').close()}
                                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {passwordLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    );
};

export default Profile;
