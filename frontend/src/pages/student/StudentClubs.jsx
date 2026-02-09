import React, { useState, useEffect, useRef } from 'react';
import { Users, BookOpen, CheckCircle, Clock, AlertCircle, MessageSquare, Send, ChevronLeft, Sparkles } from 'lucide-react';

const formatChatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    if (isToday) return 'Today';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const formatMessageTime = (dateStr) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
import { SkeletonBox } from '../../components/SkeletonLoader';
import clubService from '../../services/clubService';
import chatService from '../../services/chatService';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';

const StudentClubs = () => {
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClub, setSelectedClub] = useState(null); // For join modal
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'details'
    const [activeClub, setActiveClub] = useState(null); // The club currently being viewed in detail
    const [listSegment, setListSegment] = useState('all'); // 'joined' | 'all' - for list view
    const [detailTab, setDetailTab] = useState('about'); // 'about' | 'activities' | 'chat' - for detail view

    // Eligibility
    const { user } = useAuthStore();
    const [studentData, setStudentData] = useState(null);

    // Club Communication (Chat)
    const [clubChannel, setClubChannel] = useState(null);
    const [clubMessages, setClubMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [studentsCanSend, setStudentsCanSend] = useState(true); // from channel settings; hide input when false
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const loadSafe = async () => {
            setLoading(true);
            try {
                // Parallel fetch
                const [clubsRes, studentRes] = await Promise.all([
                    clubService.getClubs(),
                    user?.admission_number ? api.get(`/students/${user.admission_number}`) : Promise.resolve({ data: { success: false } })
                ]);

                if (studentRes.data?.success) {
                    setStudentData(studentRes.data.data);
                }

                if (clubsRes.success) {
                    setClubs(clubsRes.data);
                    // Auto-select the first joined club ONLY if payment is not due
                    const joinedClub = clubsRes.data.find(c => c.userStatus === 'approved' && c.payment_status !== 'payment_due');
                    if (joinedClub) {
                        setActiveClub(joinedClub);
                        setViewMode('details');
                    }
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load clubs');
            } finally {
                setLoading(false);
            }
        };
        loadSafe();
    }, [user]);

    // Load club chat channel when viewing club details (only for approved members without payment due)
    useEffect(() => {
        if (!activeClub?.id || activeClub.userStatus !== 'approved' || activeClub.payment_status === 'payment_due') {
            setClubChannel(null);
            setClubMessages([]);
            setStudentsCanSend(true);
            return;
        }
        const load = async () => {
            try {
                const res = await chatService.listChannels();
                if (res.success && res.data) {
                    const chan = res.data.find((c) => c.club_id === activeClub.id || c.club_id === Number(activeClub.id));
                    if (chan) {
                        setClubChannel(chan);
                        setMessagesLoading(true);
                        const [msgRes, settingsRes] = await Promise.all([
                            chatService.getMessages(chan.id),
                            chatService.getChannelSettings(chan.id),
                        ]);
                        if (msgRes.success && msgRes.data) setClubMessages(msgRes.data);
                        if (settingsRes.success && settingsRes.data && settingsRes.data.students_can_send === false) {
                            setStudentsCanSend(false);
                        } else {
                            setStudentsCanSend(true);
                        }
                    } else {
                        setClubChannel(null);
                        setStudentsCanSend(true);
                    }
                }
            } catch {
                setClubChannel(null);
                setStudentsCanSend(true);
            } finally {
                setMessagesLoading(false);
            }
        };
        load();
    }, [activeClub?.id, activeClub?.userStatus, activeClub?.payment_status]);

    const handlePostClubMessage = async (e) => {
        e.preventDefault();
        if (!clubChannel?.id || !newMessage?.trim()) return;
        try {
            await chatService.postMessage(clubChannel.id, newMessage.trim());
            setNewMessage('');
            const res = await chatService.getMessages(clubChannel.id);
            if (res.success && res.data) setClubMessages(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send message');
        }
    };

    const handleVotePoll = async (msgId, optionIndex) => {
        try {
            await chatService.votePoll(msgId, optionIndex);
            const res = await chatService.getMessages(clubChannel.id);
            if (res.success && res.data) setClubMessages(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to vote');
        }
    };

    useEffect(() => {
        if (clubMessages.length && clubChannel?.id) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [clubMessages.length, clubChannel?.id]);

    const isEligible = (club) => {
        if (!studentData) return { eligible: true }; // Fallback if load fails or during load
        if (!club.target_audience) return { eligible: true };

        let audience = club.target_audience;
        if (typeof audience === 'string') {
            try { audience = JSON.parse(audience); } catch (e) { return { eligible: true }; }
        }

        const { colleges, courses, branches, years, semesters } = audience;

        if (colleges?.length > 0 && !colleges.includes(studentData.college)) return { eligible: false, reason: 'Restricted' };
        if (courses?.length > 0 && !courses.includes(studentData.course)) return { eligible: false, reason: 'Program Restricted' };
        if (branches?.length > 0 && !branches.includes(studentData.branch)) return { eligible: false, reason: 'Branch Restricted' };
        if (years?.length > 0 && !years.some(y => y == studentData.current_year)) return { eligible: false, reason: `Year ${studentData.current_year} Ineligible` };
        if (semesters?.length > 0 && !semesters.some(s => s == studentData.current_semester)) return { eligible: false, reason: `Semester ${studentData.current_semester} Ineligible` };

        return { eligible: true };
    };

    const handleJoinClick = (club) => {
        setSelectedClub(club);
    };

    const handleViewClub = (club) => {
        setActiveClub(club);
        setDetailTab('about');
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
            toast.success('Join request sent successfully!');
            setSelectedClub(null);
            // Refresh clubs to show updated status
            const clubsRes = await clubService.getClubs();
            if (clubsRes.success) {
                setClubs(clubsRes.data);
            }
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

    const joinedClubs = clubs.filter(c => c.userStatus === 'approved' || c.userStatus === 'pending');
    const displayClubs = listSegment === 'joined' ? joinedClubs : clubs;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
            <div className={`p-4 sm:p-6 mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[80rem] flex-1 flex flex-col min-h-0 ${viewMode === 'list' ? 'space-y-6' : 'max-h-[calc(100vh-2rem)]'}`}>
                {viewMode === 'list' ? (
                    <>
                        {/* Hero */}
                        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-6 py-8 sm:py-10 text-white shadow-xl">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
                            <div className="relative flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                                    <Users size={28} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clubs & Communities</h1>
                                    <p className="text-indigo-100 text-sm sm:text-base mt-1">Discover clubs, join activities, and connect with peers.</p>
                                </div>
                            </div>
                        </div>

                        {/* Segment tabs: My Clubs | Discover */}
                        {joinedClubs.length > 0 && (
                            <div className="flex rounded-xl bg-white p-1 shadow-sm border border-gray-100">
                                <button
                                    onClick={() => setListSegment('joined')}
                                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${listSegment === 'joined' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <CheckCircle size={18} /> My Clubs ({joinedClubs.length})
                                </button>
                                <button
                                    onClick={() => setListSegment('all')}
                                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${listSegment === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <Sparkles size={18} /> Discover
                                </button>
                            </div>
                        )}

                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-72">
                                        <SkeletonBox height="h-36" width="w-full" />
                                        <div className="p-5 flex-1 flex flex-col justify-between">
                                            <div className="space-y-2">
                                                <SkeletonBox height="h-6" width="w-3/4" />
                                                <SkeletonBox height="h-4" width="w-full" />
                                                <SkeletonBox height="h-4" width="w-2/3" />
                                            </div>
                                            <SkeletonBox height="h-11" width="w-full" className="rounded-xl" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {displayClubs.length === 0 ? (
                                    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                                        <Users size={48} className="mx-auto text-gray-300 mb-4" />
                                        <p className="text-gray-600 font-medium">{listSegment === 'joined' ? 'You haven’t joined any clubs yet' : 'No clubs available'}</p>
                                        <p className="text-sm text-gray-500 mt-1">{listSegment === 'joined' ? 'Switch to Discover to browse and join.' : 'Check back later for new clubs.'}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                        {displayClubs.map(club => (
                                            <div key={club.id} className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-indigo-100 transition-all duration-300 flex flex-col">
                                                <div className="h-40 sm:h-44 relative bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                                                    {club.image_url ? (
                                                        <img src={club.image_url} alt={club.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    ) : (
                                                        <div className="text-slate-400"><Users size={48} /></div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                                                    {club.userStatus && (
                                                        <div className="absolute top-3 right-3">{renderStatusBadge(club.userStatus)}</div>
                                                    )}
                                                    {club.membership_fee > 0 && (
                                                        <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/95 backdrop-blur rounded-lg text-xs font-bold text-gray-800 shadow">
                                                            ₹{club.membership_fee}<span className="text-gray-400">/{club.fee_type === 'Semesterly' ? 'Sem' : 'Year'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-5 flex-1 flex flex-col">
                                                    <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">{club.name}</h3>
                                                    <p className="text-gray-600 text-sm line-clamp-3 flex-1">{club.description}</p>
                                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                                        {club.userStatus === 'approved' ? (
                                                            club.payment_status === 'payment_due' ? (
                                                                <button
                                                                    onClick={() => toast.info(`Please go to Fee Management to pay the remaining ₹${club.balance_due || club.membership_fee}`)}
                                                                    className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    Pay {club.paid_amount > 0 ? `₹${club.balance_due} remaining` : `₹${club.membership_fee}`}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleViewClub(club)}
                                                                    className="w-full py-3 rounded-xl border-2 border-indigo-500 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                                                                >
                                                                    Open club
                                                                </button>
                                                            )
                                                        ) : club.userStatus === 'pending' ? (
                                                            <button disabled className="w-full py-3 rounded-xl bg-gray-100 text-gray-500 font-medium cursor-not-allowed flex items-center justify-center gap-2">
                                                                <Clock size={18} /> Pending approval
                                                            </button>
                                                        ) : club.userStatus === 'rejected' ? (
                                                            <button disabled className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-medium cursor-not-allowed">
                                                                Request rejected
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleJoinClick(club)}
                                                                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm hover:shadow"
                                                            >
                                                                Join club
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                /* DETAILS VIEW - fills height on large screens; only chat messages scroll */
                <div className="animate-in fade-in duration-300 flex-1 flex flex-col min-h-0 overflow-hidden">
                    {activeClub && (
                        <>
                            {/* Sticky back + club header (mobile friendly) */}
                            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 sm:py-4">
                                <div className="flex items-center gap-3 max-w-6xl mx-auto">
                                    <button onClick={handleBackToList} className="shrink-0 p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5 font-medium text-sm touch-manipulation" aria-label="Back to clubs">
                                        <ChevronLeft size={20} /> <span className="hidden sm:inline">Clubs</span>
                                    </button>
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                                            {activeClub.image_url ? <img src={activeClub.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={24} /></div>}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold text-gray-900 truncate">{activeClub.name}</h2>
                                            <div className="flex items-center gap-2 mt-0.5">{renderStatusBadge(activeClub.userStatus)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tab bar: About | Activities | Chat (scroll on small) */}
                            <div className="border-b border-gray-100 bg-white overflow-x-auto scrollbar-hide">
                                <div className="flex gap-0 min-w-max sm:min-w-0 sm:justify-center px-2 sm:px-0">
                                    {[
                                        { id: 'about', label: 'About', icon: Users },
                                        { id: 'activities', label: 'Activities', icon: BookOpen },
                                        { id: 'chat', label: 'Chat', icon: MessageSquare },
                                    ].map(({ id, label, icon: Icon }) => (
                                        <button
                                            key={id}
                                            onClick={() => setDetailTab(id)}
                                            className={`shrink-0 py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 touch-manipulation ${detailTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <Icon size={18} /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={`py-6 w-full flex-1 flex flex-col min-h-0 ${detailTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                                {detailTab === 'about' && (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:p-8 shadow-sm w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-full">
                                        <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] xl:gap-8 xl:items-start">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6 xl:mb-0 xl:flex-col xl:items-center xl:min-w-[200px]">
                                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gray-100 overflow-hidden border-2 border-white shadow-lg shrink-0 mx-auto sm:mx-0">
                                                    {activeClub.image_url ? <img src={activeClub.image_url} alt={activeClub.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={40} /></div>}
                                                </div>
                                                <div className="text-center sm:text-left xl:text-center">
                                                    <h3 className="text-xl font-bold text-gray-900">{activeClub.name}</h3>
                                                    {activeClub.membership_fee > 0 && (
                                                        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold">
                                                            ₹{activeClub.membership_fee} / {activeClub.fee_type === 'Semesterly' ? 'Sem' : 'Year'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 text-sm lg:text-base leading-relaxed whitespace-pre-wrap">{activeClub.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {detailTab === 'activities' && (
                                    <div className="space-y-6 w-full">
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <BookOpen className="text-indigo-600" /> Activities
                                        </h3>
                                        {(!activeClub.activities || activeClub.activities.length === 0) ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
                                                <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
                                                <p>No activities posted yet.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {[...activeClub.activities].reverse().map((activity, idx) => (
                                                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                    {activity.image_url && (
                                                        <div className="h-48 sm:h-56 bg-gray-100">
                                                            <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="p-5 sm:p-6">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden shrink-0">
                                                                {activeClub.image_url ? <img src={activeClub.image_url} alt="" className="w-full h-full object-cover" /> : activeClub.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-900">{activeClub.name}</p>
                                                                <p className="text-xs text-gray-500">{new Date(activity.posted_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <h4 className="text-lg font-bold text-gray-900 mb-2">{activity.title}</h4>
                                                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detailTab === 'chat' && (
                                    <div className={`w-full flex-1 flex flex-col min-h-0 ${clubChannel ? 'min-h-0' : 'space-y-4'}`}>
                                        {activeClub.userStatus !== 'approved' || activeClub.payment_status === 'payment_due' ? (
                                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-800">
                                                <MessageSquare size={32} className="mx-auto mb-2 text-amber-500" />
                                                <p className="font-medium">Chat is available after you’re approved and fee is paid.</p>
                                            </div>
                                        ) : !clubChannel ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
                                                <MessageSquare size={40} className="mx-auto mb-3 text-gray-300" />
                                                <p>No chat channel for this club yet.</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                                <div className="py-3 px-4 bg-[#075e54] text-white flex items-center gap-2 shrink-0">
                                                    <MessageSquare size={22} className="text-white/90" />
                                                    <span className="font-semibold">{clubChannel.name || 'Club Chat'}</span>
                                                </div>
                                                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 bg-[#efeae2] flex flex-col gap-1">
                                                    {messagesLoading ? (
                                                        <div className="text-center text-gray-500 py-8">Loading messages...</div>
                                                    ) : clubMessages.filter((m) => !m.is_hidden).length === 0 ? (
                                                        <div className="text-center text-gray-500 py-8">No messages yet. Say hello!</div>
                                                    ) : (
                                                        (() => {
                                                            const items = [];
                                                            let lastDate = null;
                                                            clubMessages.filter((m) => !m.is_hidden).forEach((msg) => {
                                                                const d = formatChatTime(msg.created_at);
                                                                if (d !== lastDate) { items.push({ type: 'date', key: `d-${msg.id}`, label: d }); lastDate = d; }
                                                                items.push({ type: 'msg', key: msg.id, msg });
                                                            });
                                                            return items.map((item) => {
                                                                if (item.type === 'date') return <div key={item.key} className="flex justify-center my-2"><span className="text-xs text-gray-600 bg-white/80 px-3 py-1 rounded-full shadow-sm">{item.label}</span></div>;
                                                                const msg = item.msg;
                                                                const isOwn = msg.is_own;
                                                                return (
                                                                    <div key={item.key} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-md ${msg.is_deleted ? 'bg-gray-200' : isOwn ? 'bg-[#dcf8c6] rounded-br-md' : 'bg-white rounded-bl-md'}`}>
                                                                            {!isOwn && <p className="text-xs font-semibold text-[#075e54] mb-0.5">{msg.sender_name || 'Unknown'}</p>}
                                                                            {msg.is_deleted ? (
                                                                                <p className="text-sm text-gray-600 italic">This message was deleted{msg.deleted_by_name ? ` by ${msg.deleted_by_name}` : ''}.</p>
                                                                            ) : msg.message_type === 'poll' ? (
                                                                                <div className="space-y-1.5">
                                                                                    <p className="text-sm font-medium text-gray-900">{msg.message}</p>
                                                                                    <div className="flex flex-col gap-2 mt-1">
                                                                                        {(msg.poll_options || ['Yes', 'No']).map((optLabel, idx) => {
                                                                                            const count = (msg.poll_option_counts && msg.poll_option_counts[idx]) != null ? msg.poll_option_counts[idx] : (idx === 0 ? msg.poll_yes_count : msg.poll_no_count);
                                                                                            const voters = (msg.voters_by_option && msg.voters_by_option[idx]) || [];
                                                                                            const totalVoters = (msg.voters_count_by_option && msg.voters_count_by_option[idx]) != null ? msg.voters_count_by_option[idx] : voters.length;
                                                                                            const isSelected = msg.current_user_option_index === idx || (msg.current_user_vote === 'yes' && idx === 0) || (msg.current_user_vote === 'no' && idx === 1);
                                                                                            const moreCount = totalVoters > voters.length ? totalVoters - voters.length : 0;
                                                                                            const voterLabel = voters.length > 0 ? (voters.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '')) : '';
                                                                                            return (
                                                                                                <div key={idx} className="flex flex-col gap-0.5 min-w-0">
                                                                                                    <button type="button" onClick={() => handleVotePoll(msg.id, idx)} disabled={msg.current_user_vote != null || msg.current_user_option_index != null} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium ${isSelected ? 'bg-[#075e54] text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>{optLabel} {count != null ? `(${count})` : ''}</button>
                                                                                                    {voterLabel && <span className="text-[10px] text-gray-500 pl-1 truncate" title={voterLabel}>— {voterLabel}</span>}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                    {(msg.current_user_vote != null || msg.current_user_option_index != null) && <span className="text-[10px] text-gray-500 block mt-0.5">You voted: {(msg.poll_options || ['Yes', 'No'])[msg.current_user_option_index ?? (msg.current_user_vote === 'yes' ? 0 : 1)]}</span>}
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    {msg.attachment_url && (msg.attachment_type === 'image' ? <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mb-1"><img src={msg.attachment_url} alt="" className="max-w-[220px] max-h-36 rounded-lg object-cover" /></a> : <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#075e54] hover:underline block mb-1">View attachment</a>)}
                                                                                    {(msg.message && msg.message.trim()) && <p className="text-sm text-gray-900">{msg.message}</p>}
                                                                                </>
                                                                            )}
                                                                            <div className="flex items-center justify-end gap-1 mt-0.5">
                                                                                {msg.edited_at && <span className="text-[10px] text-gray-500">(edited)</span>}
                                                                                <span className="text-[10px] text-gray-500">{formatMessageTime(msg.created_at)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()
                                                    )}
                                                    <div ref={messagesEndRef} className="h-0" />
                                                </div>
                                                {studentsCanSend ? (
                                                    <form onSubmit={handlePostClubMessage} className="shrink-0 p-2 bg-white border-t border-gray-200 flex items-center gap-2">
                                                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message" className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-[#075e54]/30 focus:border-[#075e54] outline-none text-sm" />
                                                        <button type="submit" className="shrink-0 w-10 h-10 rounded-full bg-[#075e54] text-white flex items-center justify-center hover:bg-[#064e47] transition-colors" title="Send">
                                                            <Send size={18} className="ml-0.5" />
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <div className="shrink-0 py-3 px-4 bg-gray-100 border-t border-gray-200 text-center text-sm text-gray-500">
                                                        Only admins can send messages in this chat.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
            {selectedClub && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                        <div className="p-6 sm:p-8">
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                                        {selectedClub.image_url ? <img src={selectedClub.image_url} alt="" className="w-full h-full object-cover" /> : <Users size={28} className="text-indigo-600" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-bold text-gray-900">Join {selectedClub.name}</h2>
                                        <p className="text-sm text-gray-500 mt-0.5">Request membership</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedClub(null)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close">×</button>
                            </div>

                            {selectedClub.membership_fee > 0 && (
                                <div className="bg-emerald-50 p-4 rounded-xl flex items-center justify-between text-emerald-800 border border-emerald-100 mb-4">
                                    <span className="font-semibold text-sm">Membership fee</span>
                                    <div className="text-right">
                                        <p className="text-xl font-bold">₹{selectedClub.membership_fee}</p>
                                        <p className="text-xs opacity-80">{selectedClub.fee_type}</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-indigo-50 p-4 rounded-xl flex gap-3 text-indigo-900 border border-indigo-100">
                                <div className="flex-shrink-0 mt-0.5"><AlertCircle size={20} className="text-indigo-600" /></div>
                                <div>
                                    <p className="font-semibold text-sm">Confirm request</p>
                                    <p className="text-sm mt-1 text-indigo-800/90">
                                        Your profile will be shared with the club. {selectedClub.membership_fee > 0 && <>Fee of <strong>₹{selectedClub.membership_fee}</strong> is due after approval.</>}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setSelectedClub(null)} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button onClick={handleSubmitJoin} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                                    Send request
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default StudentClubs;
