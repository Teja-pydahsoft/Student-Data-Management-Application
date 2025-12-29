
import React, { useState, useEffect } from 'react';
import { Loader2, Megaphone, Calendar, BarChart2, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import api from '../../config/api';
import toast from 'react-hot-toast';

const StudentAnnouncements = () => {
    const [activeTab, setActiveTab] = useState('announcements');
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState([]);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [polls, setPolls] = useState([]);
    const [votingId, setVotingId] = useState(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'announcements') {
                const response = await api.get('/announcements/student');
                if (response.data.success) setAnnouncements(response.data.data || []);
            } else {
                const response = await api.get('/polls/student');
                if (response.data.success) setPolls(response.data.data || []);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load content');
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (pollId, optionIndex) => {
        setVotingId(pollId);
        try {
            const response = await api.post(`/polls/${pollId}/vote`, { option_index: optionIndex });
            if (response.data.success) {
                toast.success('Vote recorded!');
                const pollRes = await api.get('/polls/student');
                if (pollRes.data.success) setPolls(pollRes.data.data || []);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Vote failed');
        } finally {
            setVotingId(null);
        }
    };

    if (loading && announcements.length === 0 && polls.length === 0) {
        return (
            <div className="space-y-6 animate-pulse p-2 md:p-6 min-h-screen">
                <div className="flex gap-1 mx-auto md:mx-0">
                    <SkeletonBox height="h-10" width="w-32" className="rounded-xl" />
                    <SkeletonBox height="h-10" width="w-32" className="rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-96">
                            <SkeletonBox height="h-52" width="w-full" />
                            <div className="p-6 space-y-4">
                                <SkeletonBox height="h-4" width="w-32" />
                                <SkeletonBox height="h-6" width="w-full" />
                                <SkeletonBox height="h-4" width="w-full" />
                                <SkeletonBox height="h-4" width="w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-6 bg-gray-50/30 min-h-screen">
            {/* Header / Tabs */}
            <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 inline-flex gap-1 mx-auto md:mx-0">
                <button
                    onClick={() => setActiveTab('announcements')}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'announcements' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Megaphone size={18} /> Announcements
                </button>
                <button
                    onClick={() => setActiveTab('polls')}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'polls' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <BarChart2 size={18} /> Polls
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'announcements' ? (
                <div>
                    {announcements.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                            <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-400 mb-6">
                                <Megaphone size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Announcements</h3>
                            <p className="text-gray-500">You're all caught up! Check back later.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {announcements.map((ann) => (
                                <div
                                    key={ann.id}
                                    onClick={() => setSelectedAnnouncement(ann)}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                                >
                                    {ann.image_url ? (
                                        <div className="h-52 w-full bg-gray-100 overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10 opacity-60 group-hover:opacity-40 transition-opacity" />
                                            <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                            <div className="absolute bottom-4 left-4 z-20">
                                                <span className="bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                                                    {ann.target_college || 'General'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-24 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex items-center justify-center relative overflow-hidden">
                                            <div className="absolute -right-4 -top-4 text-blue-100/50">
                                                <Megaphone size={100} />
                                            </div>
                                            <Megaphone className="text-blue-400 relative z-10" size={32} />
                                        </div>
                                    )}
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mb-3">
                                            <Calendar size={14} /> {new Date(ann.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">{ann.title}</h3>
                                        <p className="text-gray-600 text-sm line-clamp-4 leading-relaxed">{ann.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    {polls.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                            <div className="mx-auto w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center text-purple-400 mb-6">
                                <BarChart2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Polls</h3>
                            <p className="text-gray-500">There are no polls available right now.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                            {polls.map((poll) => {
                                const timeLeft = poll.end_time ? new Date(poll.end_time) - new Date() : null;
                                const isUrgent = timeLeft && timeLeft < 86400000; // Less than 24h

                                return (
                                    <div key={poll.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg transition-all relative overflow-hidden">
                                        {/* Status Badge */}
                                        <div className="absolute top-0 right-0 p-4">
                                            {poll.has_voted ? (
                                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <CheckCircle size={12} /> Voted
                                                </span>
                                            ) : (
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {isUrgent ? <Clock size={12} /> : <AlertCircle size={12} />}
                                                    {isUrgent ? 'Ending Soon' : 'Active'}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mb-6 pr-16">
                                            <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{poll.question}</h3>
                                            <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                                <span>Posted {new Date(poll.created_at).toLocaleDateString()}</span>
                                                {poll.end_time && (
                                                    <span className="flex items-center gap-1 text-orange-400">
                                                        <Clock size={12} /> Ends {new Date(poll.end_time).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {poll.has_voted ? (
                                            <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in bg-gray-50/50 rounded-xl border border-gray-100/50">
                                                <div className="w-16 h-16 bg-gradient-to-tr from-green-400 to-green-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 mb-4 transform hover:scale-105 transition-transform duration-300">
                                                    <CheckCircle size={32} strokeWidth={2.5} />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-800 mb-2">Participated</h3>
                                                <p className="text-gray-500 font-medium">
                                                    You have successfully voted in this poll.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {poll.options.map((opt, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleVote(poll.id, idx)}
                                                        disabled={votingId === poll.id}
                                                        className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-md transition-all text-gray-700 font-semibold group relative overflow-hidden active:scale-[0.99]"
                                                    >
                                                        <div className="flex items-center justify-between relative z-10">
                                                            <span>{opt}</span>
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-blue-500 group-hover:bg-blue-500 transition-colors"></div>
                                                        </div>
                                                        {votingId === poll.id && (
                                                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                                                                <Loader2 className="animate-spin text-blue-600" size={20} />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                                <p className="text-xs text-center text-gray-400 mt-4">Select an option to see results</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            {/* Announcement Details Modal */}
            {selectedAnnouncement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedAnnouncement(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 right-0 p-4 bg-white/80 backdrop-blur-md flex justify-between items-start z-10 border-b">
                            <h2 className="text-xl font-bold text-gray-900 pr-8">{selectedAnnouncement.title}</h2>
                            <button
                                onClick={() => setSelectedAnnouncement(null)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={24} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {selectedAnnouncement.image_url && (
                                <div className="mb-6 rounded-xl overflow-hidden bg-gray-100 shadow-inner">
                                    <img
                                        src={selectedAnnouncement.image_url}
                                        alt={selectedAnnouncement.title}
                                        className="w-full h-auto object-contain max-h-[400px]"
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-4">
                                <Calendar size={16} />
                                {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>

                            <div className="prose prose-blue max-w-none">
                                <p className="whitespace-pre-wrap text-gray-700 leading-relaxed text-lg">
                                    {selectedAnnouncement.content}
                                </p>
                            </div>

                            {selectedAnnouncement.target_college && (
                                <div className="mt-8 pt-6 border-t flex flex-wrap gap-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Targeted to:</span>
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">{selectedAnnouncement.target_college}</span>
                                    {selectedAnnouncement.target_course && <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">{selectedAnnouncement.target_course}</span>}
                                    {selectedAnnouncement.target_branch && <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">{selectedAnnouncement.target_branch}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAnnouncements;
