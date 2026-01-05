import React, { useState, useEffect } from 'react';
import {
    Plus, Users, Calendar, X, Trash2, Check, XCircle,
    Edit2, Layout, UserPlus, FileText, ArrowRight,
    TrendingUp, Award, Zap, Heart, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clubService from '../services/clubService';
import toast from 'react-hot-toast';

const Clubs = () => {
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userType, setUserType] = useState('');
    const [activeClubId, setActiveClubId] = useState(null);

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Admin Tab State
    const [adminViewTab, setAdminViewTab] = useState('profile'); // 'profile' | 'members' | 'requests' | 'activities'

    // Form Data
    const [formData, setFormData] = useState({ name: '', description: '', image: null });
    const [newActivity, setNewActivity] = useState({ title: '', description: '', image_url: '' });
    const [editingActivityId, setEditingActivityId] = useState(null);

    useEffect(() => {
        const type = localStorage.getItem('userType');
        setUserType(type || '');
        fetchClubs();
    }, []);

    const fetchClubs = async () => {
        setLoading(true);
        try {
            const response = await clubService.getClubs();
            if (response.success && response.data) {
                setClubs(response.data);
                if (response.data.length > 0 && !activeClubId) {
                    setActiveClubId(response.data[0].id);
                }
            }
        } catch (error) {
            toast.error('Failed to fetch clubs');
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = ['admin', 'super_admin'].includes(userType);
    const selectedClub = clubs.find(c => c.id === activeClubId);

    // --- Actions ---
    const handleCreateClub = async (e) => {
        e.preventDefault();
        try {
            if (!formData.name) return toast.error('Club name is required');
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            if (formData.image) data.append('image', formData.image);

            await clubService.createClub(data);
            toast.success('Club created successfully');
            setShowCreateModal(false);
            setFormData({ name: '', description: '', image: null });
            fetchClubs();
        } catch (error) {
            toast.error('Failed to create club');
        }
    };

    const handleUpdateClub = async (e) => {
        e.preventDefault();
        if (!selectedClub) return;
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            if (formData.image) data.append('image', formData.image);

            await clubService.updateClub(selectedClub.id, data);
            toast.success('Club updated');
            setShowEditModal(false);
            fetchClubs();
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const handleDeleteClub = async () => {
        if (!selectedClub || !window.confirm(`Delete ${selectedClub.name}? This cannot be undone.`)) return;
        try {
            await clubService.deleteClub(selectedClub.id);
            toast.success('Club deleted');
            const remaining = clubs.filter(c => c.id !== selectedClub.id);
            setClubs(remaining);
            setActiveClubId(remaining.length > 0 ? remaining[0].id : null);
        } catch (error) {
            toast.error('Failed to delete club');
        }
    };

    const handleJoinRequest = async () => {
        if (!selectedClub) return;
        try {
            await clubService.joinClub(selectedClub.id);
            toast.success('Join request sent successfully!');
            fetchClubs();
        } catch (error) {
            toast.error('Failed to send join request');
        }
    };

    const handleStatusUpdate = async (studentId, status) => {
        try {
            await clubService.updateMembershipStatus(selectedClub.id, studentId, status);
            toast.success(`Member request ${status}`);
            fetchClubs();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handlePostActivity = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('title', newActivity.title);
            data.append('description', newActivity.description);
            if (newActivity.image_url instanceof File) {
                data.append('image', newActivity.image_url);
            }

            if (editingActivityId) {
                await clubService.updateActivity(selectedClub.id, editingActivityId, data);
                toast.success('Activity updated');
                setEditingActivityId(null);
            } else {
                await clubService.createActivity(selectedClub.id, data);
                toast.success('Activity posted');
            }

            setNewActivity({ title: '', description: '', image_url: '' });
            fetchClubs();
        } catch (error) {
            toast.error(editingActivityId ? 'Failed to update activity' : 'Failed to post activity');
        }
    };

    const handleEditActivity = (activity) => {
        setNewActivity({
            title: activity.title,
            description: activity.description,
            image_url: activity.image_url
        });
        setEditingActivityId(activity.id);
        setAdminViewTab('activities');
    };

    const handleDeleteActivity = async (activityId) => {
        if (!window.confirm('Are you sure you want to delete this activity?')) return;
        try {
            await clubService.deleteActivity(selectedClub.id, activityId);
            toast.success('Activity deleted');
            fetchClubs();
        } catch (error) {
            toast.error('Failed to delete activity');
        }
    };

    const cancelEditActivity = () => {
        setNewActivity({ title: '', description: '', image_url: '' });
        setEditingActivityId(null);
    };

    const prepareEdit = () => {
        if (selectedClub) {
            setFormData({
                name: selectedClub.name,
                description: selectedClub.description,
                image: null
            });
            setShowEditModal(true);
        }
    };

    // --- Animations ---
    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const cardVariants = {
        hover: { y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }
    };

    // --- Render Helpers ---
    const getNavTabClass = (tabName) => `
        relative flex items-center gap-2 px-8 py-4 text-sm font-semibold transition-all duration-300
        ${adminViewTab === tabName
            ? 'text-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        }
    `;

    const pendingCount = (selectedClub?.members || []).filter(m => m.status === 'pending').length;

    if (loading && clubs.length === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Loading Clubs Experience...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full flex flex-col bg-slate-50 font-sans">
            {/* Header Area */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-30 shadow-sm flex-shrink-0 -mx-2 sm:-mx-2 lg:-mx-3 -mt-2 sm:-mt-2 lg:-mt-3 mb-4 transition-all duration-300">
                <div className="px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 ring-2 ring-blue-50">
                            <Users size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">University Clubs</h1>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5">Community & Projects</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { setFormData({ name: '', description: '', image: null }); setShowCreateModal(true); }}
                            className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all shadow-xl shadow-gray-200"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">New Community</span><span className="sm:hidden">New</span>
                        </motion.button>
                    )}
                </div>

                {/* Club Picker Navigation */}
                <div className="flex overflow-x-auto no-scrollbar scroll-smooth px-6 bg-white/50 border-t border-gray-100/50">
                    <div className="flex gap-2 py-2">
                        {clubs.map(club => (
                            <button
                                key={club.id}
                                onClick={() => setActiveClubId(club.id)}
                                className={`relative group px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap
                                    ${activeClubId === club.id
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/60 shadow-sm'
                                    }`}
                            >
                                {club.id === activeClubId && (
                                    <motion.div layoutId="pill" className="absolute inset-0 bg-blue-600 rounded-lg -z-10" />
                                )}
                                <div className={`w-1.5 h-1.5 rounded-full ${activeClubId === club.id ? 'bg-white animate-pulse' : 'bg-green-400 opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                                {club.name}
                            </button>
                        ))}
                    </div>
                    {clubs.length === 0 && <div className="py-4 text-gray-400 text-sm font-medium italic">No clubs have been established yet.</div>}
                </div>
            </div>

            {/* Main Content Viewport */}
            <div className="flex-1 p-2 sm:p-4 lg:p-6 space-y-6">
                <AnimatePresence mode="wait">
                    {selectedClub ? (
                        <motion.div
                            key={selectedClub.id}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={containerVariants}
                            className="max-w-7xl mx-auto space-y-6"
                        >
                            {isAdmin ? (
                                // ================= ADMIN WORKSPACE =================
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
                                    {/* Admin Content Tabs */}
                                    <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
                                        {[
                                            { id: 'profile', label: 'Dashboard', icon: Layout },
                                            { id: 'members', label: 'Community', icon: Users },
                                            { id: 'requests', label: 'Requests', icon: UserPlus, badge: pendingCount },
                                            { id: 'activities', label: 'Feed & Posts', icon: Calendar }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setAdminViewTab(tab.id)}
                                                className={getNavTabClass(tab.id)}
                                            >
                                                <tab.icon size={16} className={adminViewTab === tab.id ? 'text-blue-600' : 'text-gray-400'} />
                                                {tab.label}
                                                {tab.badge > 0 && (
                                                    <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                        {tab.badge}
                                                    </span>
                                                )}
                                                {adminViewTab === tab.id && (
                                                    <motion.div
                                                        layoutId="adminTabUnderline"
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                                                    />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab Content Display */}
                                    <div className="p-4 flex-1">
                                        {adminViewTab === 'profile' && (
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                                {/* Hero & Identity (Left/Center) */}
                                                <div className="lg:col-span-8 flex flex-col gap-4">
                                                    <div className="relative rounded-xl overflow-hidden min-h-[200px] bg-white border border-gray-200 p-6 shadow-sm">
                                                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
                                                            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shadow-sm flex-shrink-0 flex items-center justify-center p-1 group relative">
                                                                {selectedClub.image_url ?
                                                                    <img src={selectedClub.image_url} alt={selectedClub.name} className="w-full h-full object-cover rounded-md" /> :
                                                                    <Users size={32} className="text-gray-300" />
                                                                }
                                                                <button onClick={prepareEdit} className="absolute inset-0 bg-black/5 flex items-center justify-center text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            </div>

                                                            <div className="text-center md:text-left space-y-2 flex-1">
                                                                <div>
                                                                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 leading-tight">{selectedClub.name}</h2>
                                                                    <p className="text-blue-600 text-[10px] font-bold mt-1 tracking-widest uppercase">Certified Organization</p>
                                                                </div>
                                                                <p className="text-sm text-gray-600 font-medium leading-relaxed line-clamp-2">
                                                                    {selectedClub.description || "Building a community for innovation and growth."}
                                                                </p>
                                                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                                                                    <button onClick={prepareEdit} className="px-4 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold text-xs hover:bg-gray-100 transition-all flex items-center gap-2">
                                                                        <Edit2 size={12} /> Edit Profile
                                                                    </button>
                                                                    <button onClick={handleDeleteClub} className="px-4 py-1.5 bg-white text-red-600 border border-red-100 rounded-lg font-bold text-xs hover:bg-red-50 transition-all flex items-center gap-2">
                                                                        <Trash2 size={12} /> Dissolve
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                                                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                                            <FileText size={16} className="text-gray-400" /> Executive Summary
                                                        </h3>
                                                        <div className="prose prose-sm max-w-none text-gray-600 text-xs leading-relaxed">
                                                            {selectedClub.description ? (
                                                                <p className="whitespace-pre-wrap">{selectedClub.description}</p>
                                                            ) : (
                                                                <div className="italic text-gray-400 py-2 text-center text-xs">
                                                                    No description added.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Insights Column (Right) */}
                                                <div className="lg:col-span-4 flex flex-col gap-3">
                                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Overview</h3>

                                                    <div className="grid grid-cols-1 gap-2">
                                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <p className="text-gray-500 text-[10px] font-bold uppercase">Members</p>
                                                                <p className="text-xl font-bold text-gray-900">{(selectedClub.members || []).filter(m => m.status === 'approved').length}</p>
                                                            </div>
                                                            <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
                                                                <Users size={16} />
                                                            </div>
                                                        </div>

                                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <p className="text-gray-500 text-[10px] font-bold uppercase">Pending</p>
                                                                <p className="text-xl font-bold text-gray-900">{pendingCount}</p>
                                                            </div>
                                                            <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
                                                                <UserPlus size={16} />
                                                            </div>
                                                        </div>

                                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <p className="text-gray-500 text-[10px] font-bold uppercase">Posts</p>
                                                                <p className="text-xl font-bold text-gray-900">{(selectedClub.activities || []).length}</p>
                                                            </div>
                                                            <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
                                                                <Calendar size={16} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                                        <div className="space-y-3">
                                                            <div>
                                                                <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-1">Engage</p>
                                                                <h4 className="text-sm font-bold text-gray-900">Post a new update</h4>
                                                            </div>
                                                            <button
                                                                onClick={() => setAdminViewTab('activities')}
                                                                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                Create Post <ArrowRight size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {adminViewTab === 'members' && (
                                            <div className="space-y-6">
                                                <div className="flex justify-between items-end">
                                                    <div className="space-y-1">
                                                        <h3 className="text-2xl font-black text-gray-900">Community Directory</h3>
                                                        <p className="text-sm text-gray-500 font-medium font-mono lowercase">verified active student members</p>
                                                    </div>
                                                    <div className="bg-blue-50 px-4 py-2 rounded-xl text-blue-700 text-sm font-bold border border-blue-100">
                                                        {(selectedClub.members || []).filter(m => m.status === 'approved').length} Total
                                                    </div>
                                                </div>

                                                <div className="overflow-hidden bg-white border border-gray-100 rounded-3xl shadow-sm">
                                                    <table className="min-w-full divide-y divide-gray-100">
                                                        <thead className="bg-gray-50/70">
                                                            <tr>
                                                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Student Profile</th>
                                                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Academic Track</th>
                                                                <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Affiliation</th>
                                                                <th className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Admin</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {(selectedClub.members || []).filter(m => m.status === 'approved').length === 0 ? (
                                                                <tr><td colSpan="4" className="text-center py-24 text-gray-400 font-medium italic">Empty community. Start recruiting!</td></tr>
                                                            ) : (
                                                                (selectedClub.members || []).filter(m => m.status === 'approved').map(member => (
                                                                    <tr key={member.student_id} className="hover:bg-blue-50/30 transition-colors group">
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center font-black text-slate-500 border border-slate-200 shadow-sm">
                                                                                    {member.student_name.charAt(0)}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{member.student_name}</p>
                                                                                    <p className="text-[10px] font-mono text-gray-400 uppercase">{member.admission_number}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <p className="text-sm font-bold text-gray-700">{member.course}</p>
                                                                            <p className="text-xs text-gray-500">{member.branch}</p>
                                                                        </td>
                                                                        <td className="px-6 py-5">
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md inline-flex self-start">Y{member.year} • S{member.semester}</span>
                                                                                <span className="text-[10px] text-gray-400 font-medium italic">Joined on {new Date(member.joined_at).toLocaleDateString()}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-5 text-right">
                                                                            <button
                                                                                onClick={() => handleStatusUpdate(member.student_id, 'rejected')}
                                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2.5 text-red-400 hover:text-white hover:bg-red-500 rounded-xl shadow-sm"
                                                                                title="Remove Member"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {adminViewTab === 'requests' && (
                                            <div className="space-y-8 max-w-4xl mx-auto">
                                                <div className="text-center space-y-2">
                                                    <h3 className="text-3xl font-black text-gray-900">Admissions Queue</h3>
                                                    <p className="text-gray-500 font-medium">Review pending requests to join your community</p>
                                                </div>

                                                {pendingCount === 0 ? (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-gray-200 shadow-sm"
                                                    >
                                                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6 shadow-inner">
                                                            <Check size={48} strokeWidth={3} />
                                                        </div>
                                                        <p className="text-lg font-bold text-gray-900">Inbox Zero!</p>
                                                        <p className="text-gray-400 font-medium">No pending requests at the moment.</p>
                                                    </motion.div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {(selectedClub.members || []).filter(m => m.status === 'pending').map((member, i) => (
                                                            <motion.div
                                                                key={member.student_id}
                                                                variants={itemVariants}
                                                                custom={i}
                                                                className="bg-white border border-gray-100 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-default group"
                                                            >
                                                                <div className="flex items-center gap-5">
                                                                    <div className="w-16 h-16 rounded-[1.5rem] bg-amber-500 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-amber-200">
                                                                        {member.student_name.charAt(0)}
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <h4 className="font-black text-xl text-gray-900 group-hover:text-blue-600 transition-colors">{member.student_name}</h4>
                                                                        <p className="text-sm font-bold text-gray-500 flex items-center gap-2">
                                                                            <FileText size={14} className="text-amber-500 text-sm" /> {member.admission_number}
                                                                        </p>
                                                                        <div className="flex gap-2">
                                                                            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{member.branch}</span>
                                                                            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-md">Year {member.year}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(member.student_id, 'approved')}
                                                                        className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                                    >
                                                                        <Check size={18} /> Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(member.student_id, 'rejected')}
                                                                        className="flex-1 sm:flex-none px-8 py-3 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-sm hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                                    >
                                                                        <XCircle size={18} /> Decline
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {adminViewTab === 'activities' && (
                                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                                                {/* Left: Compose Form */}
                                                <div className="xl:col-span-4">
                                                    <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-gray-200/60 sticky top-8 shadow-inner">
                                                        <div className="flex items-center gap-3 mb-8">
                                                            <div className={`p-3 rounded-2xl ${editingActivityId ? 'bg-amber-100 text-amber-600' : 'bg-blue-600 text-white shadow-lg shadow-blue-200'}`}>
                                                                {editingActivityId ? <Edit2 size={24} /> : <Plus size={24} />}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-xl font-black text-gray-900">{editingActivityId ? 'Modify Update' : 'New Broadcast'}</h3>
                                                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Community Channel</p>
                                                            </div>
                                                        </div>

                                                        <form onSubmit={handlePostActivity} className="space-y-6">
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Headline</label>
                                                                <input
                                                                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                                    placeholder="e.g. Annual Design Workshop 2024"
                                                                    value={newActivity.title}
                                                                    onChange={e => setNewActivity({ ...newActivity, title: e.target.value })}
                                                                    required
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Content Details</label>
                                                                <textarea
                                                                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-medium placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                                                                    rows="6"
                                                                    placeholder="Describe the activity, date, and importance..."
                                                                    value={newActivity.description}
                                                                    onChange={e => setNewActivity({ ...newActivity, description: e.target.value })}
                                                                />
                                                            </div>

                                                            <div className="space-y-3">
                                                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Visual Attachment</label>
                                                                <div className="relative group">
                                                                    {newActivity.image_url && typeof newActivity.image_url === 'string' && (
                                                                        <div className="relative w-full h-40 bg-gray-100 rounded-3xl overflow-hidden border border-gray-200 mb-2">
                                                                            <img src={newActivity.image_url} alt="Current" className="w-full h-full object-cover" />
                                                                            <button type="button" onClick={() => setNewActivity({ ...newActivity, image_url: '' })} className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-full text-red-500 shadow-lg group-hover:scale-110 transition-transform"><X size={16} /></button>
                                                                        </div>
                                                                    )}
                                                                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer relative overflow-hidden group">
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            onChange={e => setNewActivity({ ...newActivity, image_url: e.target.files[0] })}
                                                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                                        />
                                                                        <div className="space-y-2 relative z-0">
                                                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto group-hover:scale-110 transition-transform">
                                                                                <Camera size={24} />
                                                                            </div>
                                                                            <p className="text-xs font-bold text-gray-600">
                                                                                {newActivity.image_url instanceof File ? newActivity.image_url.name : 'Select or drop image'}
                                                                            </p>
                                                                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">JPG, PNG up to 5MB</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-4 pt-2">
                                                                {editingActivityId && (
                                                                    <button type="button" onClick={cancelEditActivity} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-colors">Discard</button>
                                                                )}
                                                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95">
                                                                    {editingActivityId ? 'Update Feed' : 'Launch Post'}
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>

                                                {/* Right: Broadcast Feed */}
                                                <div className="xl:col-span-8 space-y-8">
                                                    {(selectedClub.activities || []).length === 0 ? (
                                                        <div className="text-center py-32 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200 shadow-inner">
                                                            <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-gray-200 mx-auto mb-6 shadow-sm">
                                                                <Zap size={40} />
                                                            </div>
                                                            <p className="text-lg font-bold text-gray-900">Feed is silent.</p>
                                                            <p className="text-gray-400 font-medium">Be the first to share an update with the community!</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-10">
                                                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] pl-1">Audience View Feed</h3>
                                                            {[...selectedClub.activities].reverse().map((activity, idx) => (
                                                                <motion.div
                                                                    key={idx}
                                                                    variants={itemVariants}
                                                                    className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-2xl transition-all group"
                                                                >
                                                                    <div className="flex flex-col lg:flex-row">
                                                                        {activity.image_url && (
                                                                            <div className="lg:w-80 h-64 lg:h-auto overflow-hidden bg-slate-50 flex-shrink-0">
                                                                                <img src={activity.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                                            </div>
                                                                        )}
                                                                        <div className="p-10 flex-1 relative">
                                                                            <div className="flex justify-between items-start mb-6">
                                                                                <div className="space-y-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-3 py-1 rounded-full">Official update</span>
                                                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Post #{activity.id}</span>
                                                                                    </div>
                                                                                    <h4 className="text-3xl font-black text-gray-900 leading-[1.1] tracking-tight group-hover:text-blue-600 transition-colors">{activity.title}</h4>
                                                                                </div>
                                                                                <div className="flex flex-col items-end gap-3 translate-x-4 lg:translate-x-0 group-hover:translate-x-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                                                                                    <button onClick={() => handleEditActivity(activity)} className="p-3 bg-white text-gray-400 hover:text-blue-600 hover:shadow-lg rounded-2xl border border-gray-100 transition-all shadow-sm"><Edit2 size={18} /></button>
                                                                                    <button onClick={() => handleDeleteActivity(activity.id)} className="p-3 bg-white text-gray-400 hover:text-red-500 hover:shadow-lg rounded-2xl border border-gray-100 transition-all shadow-sm"><Trash2 size={18} /></button>
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-wrap font-medium">{activity.description}</p>
                                                                            <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">A</div>
                                                                                    <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">Admin Portal</div>
                                                                                </div>
                                                                                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{new Date(activity.posted_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    {/* ================= STUDENT EXPERIENCE ================= */}
                                    {/* Brand Sidebar */}
                                    <div className="lg:col-span-4 space-y-4">
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-center relative overflow-hidden">
                                            <div className="w-20 h-20 mx-auto rounded-lg p-1 bg-white border border-gray-100 mb-3 relative">
                                                <div className="w-full h-full rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                                                    {selectedClub.image_url ?
                                                        <img src={selectedClub.image_url} alt={selectedClub.name} className="w-full h-full object-cover" /> :
                                                        <Users size={32} className="text-gray-300" />
                                                    }
                                                </div>
                                            </div>

                                            <h2 className="text-lg font-bold text-gray-900 tracking-tight leading-tight">{selectedClub.name}</h2>
                                            <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Organization</p>
                                            </div>

                                            <p className="text-gray-500 mt-3 text-sm font-medium leading-relaxed line-clamp-3">
                                                {selectedClub.description || "Join us to be part of something amazing and shape the future of campus culture."}
                                            </p>

                                            <div className="mt-5 flex justify-center">
                                                {(() => {
                                                    const status = selectedClub.userStatus;
                                                    if (status === 'approved') {
                                                        return (
                                                            <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold flex items-center gap-2 border border-green-100">
                                                                <Check size={14} /> Verified Member
                                                            </div>
                                                        );
                                                    } else if (status === 'pending') {
                                                        return (
                                                            <div className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-2 border border-amber-100">
                                                                <Zap size={14} /> Request Pending
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <button
                                                                onClick={handleJoinRequest}
                                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold tracking-wide text-xs hover:bg-blue-700 transition-all flex items-center gap-2"
                                                            >
                                                                Apply to Join <ArrowRight size={14} />
                                                            </button>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
                                            <h3 className="font-bold text-gray-900 border-b border-gray-50 pb-2 flex items-center gap-2 text-xs uppercase tracking-widest">
                                                <TrendingUp size={14} className="text-blue-600" /> Stats & Metrics
                                            </h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center group">
                                                    <span className="text-gray-500 text-xs font-medium group-hover:text-gray-900 transition-colors">Verified Members</span>
                                                    <span className="bg-gray-50 text-gray-700 font-bold px-2 py-0.5 rounded text-[10px]">{(selectedClub.members || []).filter(m => m.status === 'approved').length}</span>
                                                </div>
                                                <div className="flex justify-between items-center group">
                                                    <span className="text-gray-500 text-xs font-medium group-hover:text-gray-900 transition-colors">Total Broadcasts</span>
                                                    <span className="bg-gray-50 text-gray-700 font-bold px-2 py-0.5 rounded text-[10px]">{(selectedClub.activities || []).length}</span>
                                                </div>
                                                <div className="flex justify-between items-center group pt-1">
                                                    <span className="text-gray-500 text-xs font-medium group-hover:text-gray-900 transition-colors">Founded</span>
                                                    <span className="text-gray-400 font-mono text-[10px] uppercase">{new Date(selectedClub.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Social Content Feed */}
                                    <div className="lg:col-span-8 space-y-4">
                                        <div className="flex items-end justify-between border-b border-slate-200 pb-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">Activity Feed</h3>
                                                <p className="text-xs text-gray-500">Latest updates from the team</p>
                                            </div>
                                            <div className="flex -space-x-1.5">
                                                {(selectedClub.members || []).filter(m => m.status === 'approved').slice(0, 5).map((m, i) => (
                                                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500" title={m.student_name}>
                                                        {m.student_name.charAt(0)}
                                                    </div>
                                                ))}
                                                {(selectedClub.members || []).filter(m => m.status === 'approved').length > 5 && (
                                                    <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                        +{(selectedClub.members || []).filter(m => m.status === 'approved').length - 5}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {(selectedClub.activities || []).length === 0 ? (
                                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                                                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 mx-auto mb-2">
                                                    <Zap size={20} />
                                                </div>
                                                <p className="text-gray-900 font-medium text-sm">No updates yet</p>
                                                <p className="text-gray-400 text-xs">Check back later for announcements.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {[...selectedClub.activities].reverse().map((activity, idx) => (
                                                    <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                                        <div className="flex flex-col md:flex-row">
                                                            {activity.image_url && (
                                                                <div className="md:w-56 h-40 md:h-auto overflow-hidden bg-gray-50 flex-shrink-0 relative">
                                                                    <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="p-5 flex-1 flex flex-col">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Update</span>
                                                                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{new Date(activity.posted_at).toLocaleDateString()}</span>
                                                                        </div>
                                                                        <h4 className="text-lg font-bold text-gray-900 leading-tight">{activity.title}</h4>
                                                                    </div>
                                                                </div>

                                                                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap flex-1 mb-4">{activity.description}</p>

                                                                <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-[10px] font-black">A</div>
                                                                        <span className="text-[10px] text-gray-400 font-medium">Posted by Admin</span>
                                                                    </div>
                                                                    <button className="text-gray-400 hover:text-red-500 transition-colors">
                                                                        <Heart size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 min-h-[50vh]">
                            <div className="w-24 h-24 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm mb-6">
                                <Users size={48} className="text-gray-300" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Explore the Community</h2>
                            <p className="text-gray-500 mt-3 max-w-sm text-sm">Select an organization from the directory above to view its profile, members, and latest broadcasts.</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Premium Modals */}
            <AnimatePresence>
                {(showCreateModal || showEditModal) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200"
                        >
                            <div className="bg-white border-b border-gray-100 p-6 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{showEditModal ? 'Edit Connection' : 'Register New Club'}</h2>
                                    <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mt-1">Foundation Workspace</p>
                                </div>
                                <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"><X size={18} /></button>
                            </div>

                            <form onSubmit={showEditModal ? handleUpdateClub : handleCreateClub} className="p-6 space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Identity Designation</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:font-medium"
                                        required
                                        placeholder="Enter club name..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Foundation Narrative</label>
                                    <textarea
                                        rows="3"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:font-medium resize-none"
                                        placeholder="What mission does this club represent?"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Visual Branding</label>
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setFormData({ ...formData, image: e.target.files[0] })}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center group-hover:bg-gray-50 group-hover:border-blue-200 transition-all flex flex-col items-center gap-2 bg-white relative overflow-hidden">
                                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-105 transition-transform">
                                                <Camera size={20} />
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-sm font-bold text-gray-800 tracking-tight">
                                                    {formData.image ? formData.image.name : 'Upload Brand Logo'}
                                                </span>
                                                <p className="text-[10px] text-gray-400 font-medium tracking-tight">High-resolution PNG or JPG recommended</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="flex-1 px-5 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 transition-all">Cancel</button>
                                    <button type="submit" className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm">
                                        {showEditModal ? 'Update Credentials' : 'Commit Registration'} <ArrowRight size={14} />
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Clubs;
