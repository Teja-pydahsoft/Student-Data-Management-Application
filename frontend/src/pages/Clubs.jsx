import React, { useState, useEffect } from 'react';
import { Plus, Users, Calendar, X, Trash2, Check, XCircle, Edit2, Layout, UserPlus, FileText } from 'lucide-react';
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
    const [editingActivityId, setEditingActivityId] = useState(null); // Track which activity is being edited


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
            toast.success('Club created');
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
            toast.success('Join request sent');
            fetchClubs();
        } catch (error) {
            toast.error('Failed to join');
        }
    };

    const handleStatusUpdate = async (studentId, status) => {
        try {
            await clubService.updateMembershipStatus(selectedClub.id, studentId, status);
            toast.success(`Member ${status}`);
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
            // Only append image if it's a file (new upload) or if we want to keep existing (logic might differ, usually we only send if new)
            // Ideally, for update, if no new file is selected, we don't send 'image' field or handle it in backend.
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
            image_url: activity.image_url // Keep string URL if exists, will be replaced by File if changed
        });
        setEditingActivityId(activity.id);
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

    // --- Render Helpers ---
    const getNavTabClass = (tabName) => `
        flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors
        ${adminViewTab === tabName
            ? 'border-indigo-600 text-indigo-700 bg-white'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }
    `;

    const pendingCount = (selectedClub?.members || []).filter(m => m.status === 'pending').length;

    if (loading && clubs.length === 0) return <div className="p-10 text-center text-gray-500">Loading Clubs...</div>;

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Top Level: Club Selection Tabs */}
            <div className="bg-white border-b sticky top-0 z-10 shadow-sm relative">
                <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-gray-100/50">
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Clubs</h1>
                    {isAdmin && (
                        <button
                            onClick={() => { setFormData({ name: '', description: '', image: null }); setShowCreateModal(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow"
                        >
                            <Plus size={18} /> New Club
                        </button>
                    )}
                </div>

                <div className="flex overflow-x-auto no-scrollbar px-2 bg-gray-50/30">
                    {clubs.map(club => (
                        <div
                            key={club.id}
                            onClick={() => setActiveClubId(club.id)}
                            className={`whitespace-nowrap px-6 py-3 font-medium text-sm transition-colors cursor-pointer border-b-2 ${activeClubId === club.id
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                                }`}
                        >
                            {club.name}
                        </div>
                    ))}
                    {clubs.length === 0 && <div className="px-6 py-3 text-gray-400 text-sm">No clubs created yet.</div>}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {selectedClub ? (
                    isAdmin ? (
                        // ================= ADMIN 4-TAB VIEW =================
                        <div className="w-full bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full">

                            {/* Inner Tabs */}
                            <div className="flex border-b bg-gray-50/50 overflow-x-auto">
                                <button onClick={() => setAdminViewTab('profile')} className={getNavTabClass('profile')}>
                                    <Layout size={18} /> Profile
                                </button>
                                <button onClick={() => setAdminViewTab('members')} className={getNavTabClass('members')}>
                                    <Users size={18} /> Members
                                </button>
                                <button onClick={() => setAdminViewTab('requests')} className={getNavTabClass('requests')}>
                                    <UserPlus size={18} /> Requests
                                    {pendingCount > 0 && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full text-xs">{pendingCount}</span>}
                                </button>
                                <button onClick={() => setAdminViewTab('activities')} className={getNavTabClass('activities')}>
                                    <Calendar size={18} /> Activities
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="p-8 flex-1">
                                {adminViewTab === 'profile' && (
                                    <div className="animate-in fade-in duration-300 h-full flex flex-col">
                                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">
                                            {/* Left Column: Identity & Actions (3 cols) */}
                                            <div className="xl:col-span-3 flex flex-col gap-6 border-r border-gray-100 pr-0 xl:pr-6">
                                                <div className="aspect-square w-full relative group">
                                                    <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm flex items-center justify-center">
                                                        {selectedClub.image_url ?
                                                            <img src={selectedClub.image_url} alt={selectedClub.name} className="w-full h-full object-cover text-transparent" /> :
                                                            <Users size={80} className="text-gray-300" />
                                                        }
                                                    </div>
                                                    <button onClick={prepareEdit} className="absolute bottom-4 right-4 p-2 bg-white text-gray-700 rounded-full shadow-md hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" title="Change Image">
                                                        <Edit2 size={18} />
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    <button onClick={prepareEdit} className="w-full py-2.5 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-indigo-100 transition-colors">
                                                        <Edit2 size={18} /> Edit Profile
                                                    </button>
                                                    <button onClick={handleDeleteClub} className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-red-50 transition-colors">
                                                        <Trash2 size={18} /> Delete Club
                                                    </button>
                                                </div>

                                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mt-auto">
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Club ID</p>
                                                    <p className="text-sm font-mono text-gray-600 truncate" title={selectedClub.id}>{selectedClub.id}</p>
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Created On</p>
                                                    <p className="text-sm font-medium text-gray-700">{new Date(selectedClub.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>

                                            {/* Center Column: Description & Details (6 cols) */}
                                            <div className="xl:col-span-6 flex flex-col gap-6">
                                                <div>
                                                    <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight lg:text-5xl">{selectedClub.name}</h2>
                                                    <div className="h-1 w-20 bg-indigo-600 rounded-full mt-4"></div>
                                                </div>

                                                <div className="flex-1 bg-gray-50/50 rounded-2xl border border-gray-100 p-8">
                                                    <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                                                        <FileText size={20} className="text-indigo-500" /> About the Club
                                                    </h3>
                                                    <p className="text-gray-600 leading-relaxed whitespace-pre-line text-lg">
                                                        {selectedClub.description || "No description provided."}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right Column: Key Stats (3 cols) */}
                                            <div className="xl:col-span-3 flex flex-col gap-4">
                                                <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wider mb-2">Overview</h3>

                                                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-blue-600 font-medium text-sm mb-1">Total Members</p>
                                                        <p className="text-3xl font-bold text-blue-900">{(selectedClub.members || []).filter(m => m.status === 'approved').length}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-xl text-blue-500 shadow-sm"><Users size={24} /></div>
                                                </div>

                                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 p-6 rounded-2xl border border-yellow-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-yellow-700 font-medium text-sm mb-1">Pending Requests</p>
                                                        <p className="text-3xl font-bold text-yellow-900">{pendingCount}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-xl text-yellow-600 shadow-sm"><UserPlus size={24} /></div>
                                                </div>

                                                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-6 rounded-2xl border border-purple-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-purple-700 font-medium text-sm mb-1">Total Activities</p>
                                                        <p className="text-3xl font-bold text-purple-900">{(selectedClub.activities || []).length}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-xl text-purple-500 shadow-sm"><Calendar size={24} /></div>
                                                </div>

                                                <div className="mt-auto bg-indigo-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group cursor-pointer transition-transform hover:-translate-y-1" onClick={() => setAdminViewTab('activities')}>
                                                    <div className="relative z-10">
                                                        <p className="font-medium text-indigo-200 mb-1">Quick Action</p>
                                                        <p className="font-bold text-lg">Post new activity</p>
                                                    </div>
                                                    <Plus className="absolute -bottom-4 -right-4 text-indigo-800 w-24 h-24 group-hover:text-indigo-700 transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {adminViewTab === 'members' && (
                                    <div className="animate-in fade-in duration-300">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-bold text-gray-800">Active Members</h3>
                                            <span className="text-sm text-gray-500">{(selectedClub.members || []).filter(m => m.status === 'approved').length} students</span>
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-gray-200">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50/50">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Academic</th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined Date</th>
                                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {(selectedClub.members || []).filter(m => m.status === 'approved').length === 0 ?
                                                        <tr><td colSpan="4" className="text-center py-12 text-gray-400">No active members found.</td></tr> :
                                                        (selectedClub.members || []).filter(m => m.status === 'approved').map(member => (
                                                            <tr key={member.student_id} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-medium text-gray-900">{member.student_name}</div>
                                                                    <div className="text-xs text-gray-500 font-mono">{member.admission_number}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-900">{member.course} - {member.branch}</div>
                                                                    <div className="text-xs text-gray-500">{member.year} Year, {member.semester} Sem</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                                    {new Date(member.joined_at).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(member.student_id, 'rejected')}
                                                                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                        title="Remove Member"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    }
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {adminViewTab === 'requests' && (
                                    <div className="animate-in fade-in duration-300">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-bold text-gray-800">Pending Requests</h3>
                                            <span className="text-sm text-gray-500">{pendingCount} requests</span>
                                        </div>

                                        {pendingCount === 0 ? (
                                            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                <div className="text-gray-400 mb-2"><Check size={48} className="mx-auto" /></div>
                                                <p className="text-gray-500">No pending requests. All caught up!</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4">
                                                {(selectedClub.members || []).filter(m => m.status === 'pending').map(member => (
                                                    <div key={member.student_id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold">
                                                                {member.student_name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-900">{member.student_name}</p>
                                                                <p className="text-xs text-gray-500">{member.admission_number} • {member.branch} • {member.year}/{member.semester}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={() => handleStatusUpdate(member.student_id, 'approved')}
                                                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                                                            >
                                                                <Check size={16} /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(member.student_id, 'rejected')}
                                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                            >
                                                                <XCircle size={16} /> Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {adminViewTab === 'activities' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                                        {/* Post Form */}
                                        <div className="lg:col-span-1">
                                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 sticky top-4">
                                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                    {editingActivityId ? <Edit2 size={18} /> : <Plus size={18} />}
                                                    {editingActivityId ? 'Edit Announcement' : 'New Announcement'}
                                                </h3>
                                                <form onSubmit={handlePostActivity} className="space-y-4">
                                                    <input
                                                        className="w-full p-3 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        placeholder="Title"
                                                        value={newActivity.title}
                                                        onChange={e => setNewActivity({ ...newActivity, title: e.target.value })}
                                                        required
                                                    />
                                                    <textarea
                                                        className="w-full p-3 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        rows="4"
                                                        placeholder="What's happening?"
                                                        value={newActivity.description}
                                                        onChange={e => setNewActivity({ ...newActivity, description: e.target.value })}
                                                    ></textarea>

                                                    {/* Image Preview / Input */}
                                                    <div className="space-y-2">
                                                        {newActivity.image_url && !(newActivity.image_url instanceof File) && (
                                                            <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                                                <img src={newActivity.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setNewActivity({ ...newActivity, image_url: '' })}
                                                                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-red-50 text-red-500"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={e => setNewActivity({ ...newActivity, image_url: e.target.files[0] })}
                                                            className="w-full text-xs text-gray-500"
                                                        />
                                                    </div>

                                                    <div className="flex gap-2">
                                                        {editingActivityId && (
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditActivity}
                                                                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
                                                            {editingActivityId ? 'Update' : 'Post'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>

                                        {/* Activity List */}
                                        <div className="lg:col-span-2 space-y-6">
                                            {(selectedClub.activities || []).length === 0 ?
                                                <div className="text-center py-12 bg-white border border-gray-100 rounded-xl">
                                                    <FileText size={48} className="mx-auto text-gray-200 mb-2" />
                                                    <p className="text-gray-400">No activities posted yet.</p>
                                                </div> :
                                                [...selectedClub.activities].reverse().map((activity, idx) => (
                                                    <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col md:flex-row hover:shadow-md transition-shadow">
                                                        {activity.image_url && (
                                                            <div className="md:w-56 h-48 md:h-auto bg-gray-100 flex-shrink-0">
                                                                <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                        <div className="p-6 flex-1">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-bold text-lg text-gray-900 leading-tight">{activity.title}</h4>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(activity.posted_at).toLocaleDateString()}</span>
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => handleEditActivity(activity)}
                                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                                            title="Edit"
                                                                        >
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteActivity(activity.id)}
                                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // ================= STUDENT VIEW (Unchanged) =================
                        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* LEFT SIDEBAR: PROFILE */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
                                    <div className="w-32 h-32 mx-auto bg-gray-100 rounded-full overflow-hidden mb-4 border-4 border-white shadow-lg">
                                        {selectedClub.image_url ?
                                            <img src={selectedClub.image_url} alt={selectedClub.name} className="w-full h-full object-cover" /> :
                                            <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={40} /></div>
                                        }
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedClub.name}</h2>
                                    <p className="text-gray-500 mt-2 text-sm">{selectedClub.description}</p>

                                    <div className="mt-6 flex justify-center">
                                        {(() => {
                                            const status = selectedClub.userStatus;
                                            if (status === 'approved') {
                                                return <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2"><Check size={16} /> Member</span>;
                                            } else if (status === 'pending') {
                                                return <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">Request Pending</span>;
                                            } else {
                                                return (
                                                    <button
                                                        onClick={handleJoinRequest}
                                                        className="px-6 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-shadow shadow-md hover:shadow-lg flex items-center gap-2"
                                                    >
                                                        Join Club
                                                    </button>
                                                );
                                            }
                                        })()}
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border p-5">
                                    <h3 className="font-bold text-gray-800 mb-4">About</h3>
                                    <div className="space-y-3 text-sm text-gray-600">
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span>Members</span>
                                            <span className="font-semibold text-gray-900">{(selectedClub.members || []).filter(m => m.status === 'approved').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span>Activities</span>
                                            <span className="font-semibold text-gray-900">{(selectedClub.activities || []).length}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT MAIN: ACTIVITY FEED */}
                            <div className="lg:col-span-8">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Calendar className="text-indigo-600" /> Club Activity Feed
                                </h3>

                                <div className="space-y-6">
                                    {!selectedClub.userStatus || selectedClub.userStatus !== 'approved' ? (
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center text-blue-800">
                                            <p className="font-medium">Join the club to see exclusive activities and updates!</p>
                                        </div>
                                    ) : (selectedClub.activities || []).length === 0 ? (
                                        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
                                            <p>No activities posted yet due to being new.</p>
                                        </div>
                                    ) : (
                                        [...selectedClub.activities].reverse().map((activity, idx) => (
                                            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                                {activity.image_url && (
                                                    <div className="h-64 bg-gray-100 w-full">
                                                        <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="p-6">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                            {selectedClub.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900">{selectedClub.name}</p>
                                                            <p className="text-xs text-gray-500">{new Date(activity.posted_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <h4 className="text-xl font-bold text-gray-900 mb-2">{activity.title}</h4>
                                                    <p className="text-gray-600 leading-relaxed">{activity.description}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Users size={64} className="mb-4 text-gray-200" />
                        <p className="text-lg">Select a club to view details</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">{showEditModal ? 'Edit Club' : 'Create New Club'}</h2>
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <form onSubmit={showEditModal ? handleUpdateClub : handleCreateClub} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Club Name</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required placeholder="e.g. Coding Club" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="What is this club about?"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Club Logo / Cover</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                    <input type="file" accept="image/*" onChange={e => setFormData({ ...formData, image: e.target.files[0] })} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Users size={24} /></div>
                                        <span className="text-sm font-medium">{formData.image ? formData.image.name : 'Click to upload image'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4 mt-2">
                                <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">{showEditModal ? 'Save Changes' : 'Create Club'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clubs;
