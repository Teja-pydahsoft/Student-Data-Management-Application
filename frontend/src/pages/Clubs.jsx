import React, { useState, useEffect } from 'react';
import {
    Plus, Users, Calendar, X, Trash2, Check, XCircle,
    Edit2, Layout, UserPlus, FileText, ArrowRight,
    TrendingUp, Award, Zap, Heart, Camera, Search, Filter,
    MoreHorizontal, Shield, Wallet
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import clubService from '../services/clubService';
import toast from 'react-hot-toast';

const ClubCard = ({ club, onSelect }) => (
    <div
        onClick={() => onSelect(club)}
        className="group bg-white rounded-xl border border-gray-200 hover:border-blue-400 p-5 transition-all cursor-pointer hover:shadow-lg relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="text-blue-500" size={20} />
        </div>

        <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden">
                {club.image_url ? (
                    <img src={club.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Users className="text-gray-400" size={28} />
                )}
            </div>
            <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">{club.name}</h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Users size={14} /> {(club.members || []).length} Members</span>
                    {club.membership_fee > 0 && (
                        <span className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-md">
                            <Wallet size={12} /> ₹{club.membership_fee}
                        </span>
                    )}
                </div>
            </div>
        </div>
        <p className="mt-4 text-gray-600 text-sm line-clamp-2">{club.description}</p>
    </div>
);

const Modal = ({ show, onClose, title, children }) => (
    <AnimatePresence>
        {show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8"
                >
                    <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 max-h-[80vh] overflow-y-auto">
                        {children}
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

const Clubs = () => {
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userType, setUserType] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'details'
    const [selectedClub, setSelectedClub] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'members' | 'activities'

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image: null,
        membership_fee: '',
        fee_type: 'Yearly',

    });

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
            }
        } catch (error) {
            toast.error('Failed to fetch clubs');
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = ['admin', 'super_admin'].includes(userType);

    // --- Actions ---
    const handleCreateClub = async (e) => {
        e.preventDefault();
        try {
            if (!formData.name) return toast.error('Club name is required');
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            data.append('membership_fee', formData.membership_fee);
            data.append('fee_type', formData.fee_type);

            const target_audience = {
                colleges: formData.target_college,
                batches: formData.target_batch,
                courses: formData.target_course,
                branches: formData.target_branch,
                years: formData.target_year,
                semesters: formData.target_semester
            };
            data.append('target_audience', JSON.stringify(target_audience));

            if (formData.image) data.append('image', formData.image);

            await clubService.createClub(data);
            toast.success('Club created successfully');
            setShowCreateModal(false);
            resetForm();
            fetchClubs();
        } catch (error) {
            toast.error('Failed to create club');
        }
    };

    const handleUpdateClub = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            data.append('membership_fee', formData.membership_fee);
            data.append('fee_type', formData.fee_type);

            const target_audience = {
                colleges: formData.target_college,
                batches: formData.target_batch,
                courses: formData.target_course,
                branches: formData.target_branch,
                years: formData.target_year,
                semesters: formData.target_semester
            };
            data.append('target_audience', JSON.stringify(target_audience));

            if (formData.image) data.append('image', formData.image);

            await clubService.updateClub(selectedClub.id, data);
            toast.success('Club updated');
            setShowEditModal(false);
            fetchClubs();
            // Update selected club locally
            setSelectedClub(prev => ({ ...prev, ...formData, target_audience }));
        } catch (error) {
            toast.error('Failed to update club');
        }
    };

    const handleDeleteClub = async (id) => {
        if (!window.confirm('Delete this club completely? This cannot be undone.')) return;
        try {
            await clubService.deleteClub(id);
            toast.success('Club deleted');
            if (selectedClub?.id === id) {
                setSelectedClub(null);
                setViewMode('list');
            }
            fetchClubs();
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    const handleMemberAction = async (studentId, action) => {
        try {
            await clubService.updateMembershipStatus(selectedClub.id, studentId, action);
            toast.success(`Member ${action === 'approved' ? 'approved' : 'rejected'} successfully`);
            // Refresh club details to show updated status
            const response = await clubService.getClubDetails(selectedClub.id);
            if (response.success) {
                setSelectedClub(response.data);
            }
        } catch (error) {
            toast.error(`Failed to ${action} member`);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            image: null,
            membership_fee: '',
            fee_type: 'Yearly',

        });
    };

    const prepareEdit = (club) => {
        setFormData({
            name: club.name,
            description: club.description,
            image: null,
            membership_fee: club.membership_fee || '',
            fee_type: club.fee_type || 'Yearly'
        });
        setSelectedClub(club);
        setShowEditModal(true);
    };


    const handleViewDetails = async (club) => {
        // Set basic info immediately
        setSelectedClub(club);
        setViewMode('details');
        setActiveTab('overview');

        // Fetch full details
        try {
            const response = await clubService.getClubDetails(club.id);
            if (response.success) {
                setSelectedClub(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch club details", error);
            toast.error("Failed to load full club details");
        }
    };

    // --- Render Components ---



    return (
        <div className="p-6 w-full mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clubs & Communities</h1>
                    <p className="text-gray-500">Manage student organizations, memberships, and activities.</p>
                </div>
                <div className="flex gap-3">
                    {/* Add Filter/Search here if needed in future */}
                    {viewMode === 'list' && (
                        <button
                            onClick={() => { resetForm(); setShowCreateModal(true); }}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={18} strokeWidth={2.5} /> Create New Club
                        </button>
                    )}
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="space-y-6">
                    {/* Stats Row (Optional, placeholder for future) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Clubs</p>
                                <h3 className="text-2xl font-bold text-gray-900">{clubs.length}</h3>
                            </div>
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                <Shield size={20} />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Members</p>
                                <h3 className="text-2xl font-bold text-gray-900">
                                    {clubs.reduce((acc, c) => acc + (c.members?.length || 0), 0)}
                                </h3>
                            </div>
                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                                <Users size={20} />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Monthly Active</p>
                                <h3 className="text-2xl font-bold text-gray-900">
                                    {clubs.reduce((acc, c) => acc + (c.activities?.length || 0), 0)}
                                </h3>
                            </div>
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                                <Zap size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Clubs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clubs.map(club => (
                            <ClubCard key={club.id} club={club} onSelect={handleViewDetails} />
                        ))}
                        {clubs.length === 0 && !loading && (
                            <div className="col-span-full py-20 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                                <Shield size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium text-gray-500">No clubs found</p>
                                <p className="text-sm">Create a new club to get started</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Club Detail View */
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[80vh] flex flex-col">
                    {/* Detail Header */}
                    <div className="border-b border-gray-100 p-6 flex items-start justify-between bg-gray-50/30">
                        <div className="flex items-center gap-5">
                            <button onClick={() => setViewMode('list')} className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors">
                                <ArrowRight className="rotate-180" size={20} />
                            </button>
                            <div className="w-16 h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                                {selectedClub.image_url ? (
                                    <img src={selectedClub.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Users className="text-gray-300" size={32} />
                                )}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{selectedClub.name}</h1>
                                <p className="text-gray-500 text-sm max-w-2xl line-clamp-1">{selectedClub.description}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => prepareEdit(selectedClub)}
                                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold flex items-center gap-2"
                            >
                                <Edit2 size={16} /> Edit Club
                            </button>
                            <button
                                onClick={() => handleDeleteClub(selectedClub.id)}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-bold flex items-center gap-2"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-gray-100 px-6 gap-6">
                        {['overview', 'members', 'requests', 'activities'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 text-sm font-bold border-b-2 transition-colors capitalized ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'requests' && (selectedClub.members?.filter(m => m.status === 'pending').length > 0) && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">
                                        {selectedClub.members.filter(m => m.status === 'pending').length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex-1 bg-gray-50/30">
                        {activeTab === 'overview' && (
                            <div className="max-w-4xl space-y-6 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Membership & Fees Card */}
                                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Membership & Fees</h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                                <span className="text-gray-600">Fee Amount</span>
                                                <span className="font-bold text-gray-900">
                                                    {selectedClub.membership_fee > 0 ? `₹${selectedClub.membership_fee}` : 'Free'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                                <span className="text-gray-600">Frequency</span>
                                                <span className="font-medium text-gray-900">{selectedClub.fee_type || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2">
                                                <span className="text-gray-600">Total Revenue (Est.)</span>
                                                <span className="font-bold text-green-600">
                                                    ₹{(selectedClub.membership_fee || 0) * (selectedClub.members?.length || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Club Statistics Card */}
                                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Club Statistics</h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                                <span className="text-gray-600">Total Members</span>
                                                <span className="font-bold text-gray-900">{selectedClub.members?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                                <span className="text-gray-600">Total Activities</span>
                                                <span className="font-medium text-gray-900">{selectedClub.activities?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2">
                                                <span className="text-gray-600">Status</span>
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                                    Active
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Description Card */}
                                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Description</h3>
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedClub.description}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                                {!selectedClub.members || selectedClub.members.length === 0 ? (
                                    <div className="p-12 text-center text-gray-400">No members yet.</div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                            <tr>
                                                <th className="px-6 py-4">Student Name</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Payment</th>
                                                <th className="px-6 py-4">Joined Date</th>
                                                <th className="px-6 py-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedClub.members.map((member, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-medium text-gray-900">{member.student_name}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${member.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                            member.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {member.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-sm font-medium ${member.payment_status === 'paid' ? 'text-green-600' :
                                                            member.payment_status === 'payment_due' ? 'text-orange-600' :
                                                                'text-gray-600'
                                                            }`}>
                                                            {member.payment_status === 'payment_due' ? 'Payment Due' :
                                                                member.payment_status === 'paid' ? 'Paid' :
                                                                    member.payment_status === 'not_required' ? 'Pending Approval' : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {new Date(member.joined_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {member.status === 'pending' ? (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleMemberAction(member.student_id, 'approved')}
                                                                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-bold flex items-center gap-1"
                                                                >
                                                                    <Check size={14} /> Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMemberAction(member.student_id, 'rejected')}
                                                                    className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-bold flex items-center gap-1"
                                                                >
                                                                    <XCircle size={14} /> Reject
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {activeTab === 'requests' && (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                                {(() => {
                                    const pendingMembers = selectedClub.members?.filter(m => m.status === 'pending') || [];
                                    if (pendingMembers.length === 0) {
                                        return <div className="p-12 text-center text-gray-400">No pending requests.</div>;
                                    }
                                    return (
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                                <tr>
                                                    <th className="px-6 py-4">Student Name</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Requested Date</th>
                                                    <th className="px-6 py-4">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {pendingMembers.map((member, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 font-medium text-gray-900">{member.student_name}</td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                                                                PENDING
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">
                                                            {new Date(member.joined_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleMemberAction(member.student_id, 'approved')}
                                                                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-bold flex items-center gap-1"
                                                                >
                                                                    <Check size={14} /> Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMemberAction(member.student_id, 'rejected')}
                                                                    className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-bold flex items-center gap-1"
                                                                >
                                                                    <XCircle size={14} /> Reject
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>
                        )}

                        {activeTab === 'activities' && (
                            <div className="space-y-6 max-w-3xl animate-in fade-in duration-300">
                                {/* Example Placeholder for Activities */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 text-center py-12">
                                    <Zap size={32} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-gray-500">Activity management coming soon to this view.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                show={showCreateModal || showEditModal}
                onClose={() => { setShowCreateModal(false); setShowEditModal(false); }}
                title={showEditModal ? 'Edit Club Configuration' : 'Create New Club'}
            >
                <form onSubmit={showEditModal ? handleUpdateClub : handleCreateClub} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-full">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Club Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                placeholder="e.g. Robotics Club"
                                required
                            />
                        </div>

                        <div className="col-span-full">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                                placeholder="Describe the club's mission and activities..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Membership Fee (₹)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                                <input
                                    type="number"
                                    value={formData.membership_fee}
                                    onChange={e => setFormData({ ...formData, membership_fee: e.target.value })}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Fee Frequency</label>
                            <select
                                value={formData.fee_type}
                                onChange={e => setFormData({ ...formData, fee_type: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                            >
                                <option value="Yearly">Yearly</option>
                                <option value="Semesterly">Semesterly</option>
                            </select>
                        </div>

                        <div className="col-span-full">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Club Logo</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative">
                                <div className="space-y-1 text-center">
                                    <Camera className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="flex text-sm text-gray-600">
                                        <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                            <span>Upload a file</span>
                                            <input
                                                type="file"
                                                className="sr-only"
                                                accept="image/*"
                                                onChange={e => setFormData({ ...formData, image: e.target.files[0] })}
                                            />
                                        </label>
                                        <p className="pl-1">or drag and drop</p>
                                    </div>
                                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                                    {formData.image && (
                                        <p className="text-sm font-bold text-green-600 mt-2">{formData.image.name}</p>
                                    )}
                                </div>
                            </div>
                        </div>


                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-all"
                        >
                            {showEditModal ? 'Save Changes' : 'Create Club'} <ArrowRight size={16} />
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Clubs;
