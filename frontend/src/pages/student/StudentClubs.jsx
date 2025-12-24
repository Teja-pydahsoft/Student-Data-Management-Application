import React, { useState, useEffect } from 'react';
import { Users, BookOpen, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import clubService from '../../services/clubService';
import toast from 'react-hot-toast';

const StudentClubs = () => {
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClub, setSelectedClub] = useState(null); // For join modal
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'details'
    const [activeClub, setActiveClub] = useState(null); // The club currently being viewed in detail

    useEffect(() => {
        fetchClubs();
    }, []);

    const fetchClubs = async () => {
        try {
            const response = await clubService.getClubs();
            if (response.success) {
                setClubs(response.data);
                // Auto-select the first joined club
                const joinedClub = response.data.find(c => c.userStatus === 'approved');
                if (joinedClub) {
                    setActiveClub(joinedClub);
                    setViewMode('details');
                }
            }
        } catch (error) {
            toast.error('Failed to fetch clubs');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinClick = (club) => {
        setSelectedClub(club);
    };

    const handleViewClub = (club) => {
        setActiveClub(club);
        setViewMode('details');
        window.scrollTo(0, 0);
    };

    const handleBackToList = () => {
        setViewMode('list');
        setActiveClub(null);
    };

    const handleSubmitJoin = async (e) => {
        e.preventDefault();
        try {
            await clubService.joinClub(selectedClub.id);
            toast.success('Request sent successfully');
            setSelectedClub(null);
            fetchClubs(); // Refresh status
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to join');
        }
    };


    const renderStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle size={12} /> Member</span>;
            case 'pending': return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Clock size={12} /> Pending</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><AlertCircle size={12} /> Rejected</span>;
            default: return null;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Student Clubs</h1>


            {viewMode === 'list' ? (
                loading ? (
                    <div className="text-center py-10">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clubs.map(club => (
                            <div key={club.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                                <div className="h-32 bg-gray-100 flex items-center justify-center relative">
                                    {club.image_url ? (
                                        <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Users size={40} className="text-gray-400" />
                                    )}
                                    {club.userStatus && (
                                        <div className="absolute top-2 right-2 shadow-sm">
                                            {renderStatusBadge(club.userStatus)}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className="text-xl font-semibold mb-2">{club.name}</h3>
                                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{club.description}</p>

                                    <div className="mt-auto">
                                        {club.userStatus === 'approved' ? (
                                            <button
                                                onClick={() => handleViewClub(club)}
                                                className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium"
                                            >
                                                View Activities
                                            </button>
                                        ) : club.userStatus === 'pending' ? (
                                            <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
                                                Request Sent
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleJoinClick(club)}
                                                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                            >
                                                Join Club
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* DETAILS VIEW (Inline) */
                <div className="animate-in fade-in slide-in-from-right duration-300">
                    <button onClick={handleBackToList} className="mb-6 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center gap-2 text-gray-700 hover:text-indigo-600 hover:border-indigo-200 transition-all font-medium">
                        &larr; Browse All Clubs
                    </button>

                    {activeClub && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Club Profile Sidebar */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                                    <div className="w-32 h-32 mx-auto bg-gray-100 rounded-full overflow-hidden mb-4 border-4 border-white shadow-lg">
                                        {activeClub.image_url ?
                                            <img src={activeClub.image_url} alt={activeClub.name} className="w-full h-full object-cover" /> :
                                            <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={40} /></div>
                                        }
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900">{activeClub.name}</h2>
                                    <div className="mt-4 flex justify-center">
                                        {renderStatusBadge(activeClub.userStatus)}
                                    </div>
                                    <p className="text-gray-600 mt-6 text-sm leading-relaxed text-left">
                                        {activeClub.description}
                                    </p>
                                </div>
                            </div>

                            {/* Activities Feed */}
                            <div className="lg:col-span-2 space-y-6">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <BookOpen className="text-indigo-600" /> Club Activities
                                </h3>

                                {(!activeClub.activities || activeClub.activities.length === 0) ? (
                                    <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
                                        <p>No activities posted yet.</p>
                                    </div>
                                ) : (
                                    [...activeClub.activities].reverse().map((activity, idx) => (
                                        <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                            {activity.image_url && (
                                                <div className="h-64 bg-gray-100 w-full">
                                                    <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden">
                                                        {activeClub.image_url ? (
                                                            <img src={activeClub.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            activeClub.name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{activeClub.name}</p>
                                                        <p className="text-xs text-gray-500">{new Date(activity.posted_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <h4 className="text-xl font-bold text-gray-900 mb-2">{activity.title}</h4>
                                                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {selectedClub && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        {/* Join Confirmation Only */}
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Join {selectedClub.name}</h2>
                            <button onClick={() => setSelectedClub(null)} className="text-gray-500 hover:text-gray-700">Close</button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-blue-800">
                                <div className="flex-shrink-0 mt-1"><AlertCircle size={20} /></div>
                                <div>
                                    <p className="font-semibold">Confirm Membership Request</p>
                                    <p className="text-sm mt-1">
                                        By joining <strong>{selectedClub.name}</strong>, your academic details (Name, Batch, Branch, Year/Sem) will be automatically shared with the club admin for approval.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setSelectedClub(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                                <button
                                    onClick={handleSubmitJoin}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                >
                                    Confirm & Join
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentClubs;
