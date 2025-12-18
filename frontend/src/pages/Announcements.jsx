
import React, { useState, useEffect, useRef } from 'react';
import {
    Megaphone,
    Send,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Loader2,
    Users,
    Check,
    ChevronDown,
    X,
    Pencil,
    BarChart2,
    PlusCircle,
    MinusCircle,
    Calendar,
    Clock,
    Plus
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

const MultiSelect = ({ label, options, selected, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value) => {
        const safeSelected = Array.isArray(selected) ? selected : [];
        const newSelected = safeSelected.includes(value)
            ? safeSelected.filter(item => item !== value)
            : [...safeSelected, value];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
            <button
                type="button"
                className={`w-full p-2 text-left border rounded-lg flex justify-between items-center text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-blue-400'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className={`truncate ${Array.isArray(selected) && selected.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                    {Array.isArray(selected) && selected.length === 0 ? placeholder : `${Array.isArray(selected) ? selected.length : 0} selected`}
                </span>
                <ChevronDown size={14} className="text-gray-400" />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {options.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">No options available</div>
                    ) : (
                        options.map(option => (
                            <div
                                key={option.value}
                                className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm"
                                onClick={() => toggleOption(option.value)}
                            >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${selected.includes(option.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                    {selected.includes(option.value) && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-gray-700">{option.label}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {Array.isArray(selected) && selected.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {selected.slice(0, 5).map(val => (
                        <span key={val} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100 flex items-center gap-1">
                            {options.find(o => o.value === val)?.label || val}
                            <button type="button" onClick={() => toggleOption(val)} className="hover:text-blue-900"><X size={10} /></button>
                        </span>
                    ))}
                    {selected.length > 5 && <span className="text-xs text-gray-500 py-0.5">+{selected.length - 5} more</span>}
                </div>
            )}
        </div>
    );
};

const TargetSelector = ({ formData, setFormData }) => {
    const [colleges, setColleges] = useState([]);
    const [batches, setBatches] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [years, setYears] = useState([]);
    const [semesters, setSemesters] = useState([]);

    const [availableCourses, setAvailableCourses] = useState([]);
    const [availableBranches, setAvailableBranches] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [availableSemesters, setAvailableSemesters] = useState([]);
    const [recipientCount, setRecipientCount] = useState(0);

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [colRes, batchRes, courRes, branchRes, yearRes, semRes] = await Promise.all([
                api.get('/colleges'),
                api.get('/announcements/batches').catch(() => ({ data: { success: false, data: [] } })),
                api.get('/courses'),
                api.get('/announcements/branches').catch(() => ({ data: { success: false, data: [] } })),
                api.get('/announcements/years').catch(() => ({ data: { success: false, data: [] } })),
                api.get('/announcements/semesters').catch(() => ({ data: { success: false, data: [] } }))
            ]);

            if (colRes.data.success) setColleges(colRes.data.data.map(c => ({ value: c.name, label: c.name, id: c.id })));
            if (batchRes.data.success) setBatches(batchRes.data.data.map(b => ({ value: b.name, label: b.name, id: b.id })));
            if (courRes.data.success) setCourses(courRes.data.data.map(c => ({ value: c.name, label: c.name, collegeId: c.college_id, id: c.id })));
            if (branchRes.data.success) setBranches(branchRes.data.data.map(b => ({ value: b.name, label: b.name, courseId: b.course_id, id: b.id })));
            if (yearRes.data.success) setYears(yearRes.data.data.map(y => ({ value: y.name, label: `${y.name} Year`, batchId: y.batch_id })));
            if (semRes.data.success) setSemesters(semRes.data.data.map(s => ({ value: s.name, label: `Semester ${s.name}`, batchId: s.batch_id })));
        } catch (error) {
            console.error('Metadata fetch failed', error);
        }
    };

    useEffect(() => {
        if (formData.target_college.length === 0) {
            setAvailableCourses(courses);
        } else {
            const selectedCollegeIds = colleges.filter(c => formData.target_college.includes(c.value)).map(c => c.id);
            const filtered = courses.filter(c => selectedCollegeIds.includes(c.collegeId));
            setAvailableCourses(filtered.length > 0 || selectedCollegeIds.length === 0 ? filtered : courses);
        }
    }, [formData.target_college, courses, colleges]);

    useEffect(() => {
        if (formData.target_course.length === 0) {
            setAvailableBranches(branches);
        } else {
            const selectedCourseNames = formData.target_course;
            const filtered = branches.filter(b => selectedCourseNames.includes(b.courseId));
            setAvailableBranches(filtered.length > 0 ? filtered : branches);
        }
    }, [formData.target_course, courses, branches]);

    useEffect(() => {
        if (formData.target_batch.length === 0) {
            const distinctYears = [...new Map(years.map(item => [item.value, item])).values()];
            const distinctSems = [...new Map(semesters.map(item => [item.value, item])).values()];
            setAvailableYears(distinctYears);
            setAvailableSemesters(distinctSems);
        } else {
            const selectedBatches = formData.target_batch;
            const filteredYears = years.filter(y => selectedBatches.includes(y.batchId));
            setAvailableYears([...new Map(filteredYears.map(item => [item.value, item])).values()]);
            const filteredSems = semesters.filter(s => selectedBatches.includes(s.batchId));
            setAvailableSemesters([...new Map(filteredSems.map(item => [item.value, item])).values()]);
        }
    }, [formData.target_batch, years, semesters]);

    useEffect(() => {
        const calculateCount = async () => {
            try {
                const response = await api.post('/announcements/count', {
                    target_college: formData.target_college,
                    target_batch: formData.target_batch,
                    target_course: formData.target_course,
                    target_branch: formData.target_branch,
                    target_year: formData.target_year,
                    target_semester: formData.target_semester
                });
                if (response.data.success) setRecipientCount(response.data.count);
            } catch (error) { console.error("Failed to calculate count", error); }
        };
        const timer = setTimeout(calculateCount, 500);
        return () => clearTimeout(timer);
    }, [formData]);

    return (
        <div className="space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-100 h-full">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Users size={16} /> Target Audience
                </h3>
                <div className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Est. Recipients: {recipientCount}
                </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">Leave fields empty to target everyone.</p>

            <div className="space-y-4">
                <MultiSelect
                    label="Colleges"
                    placeholder="All Colleges"
                    options={colleges}
                    selected={formData.target_college}
                    onChange={vals => setFormData({ ...formData, target_college: vals })}
                />
                <MultiSelect
                    label="Batches"
                    placeholder="All Batches"
                    options={batches}
                    selected={formData.target_batch}
                    onChange={vals => setFormData({ ...formData, target_batch: vals })}
                />
            </div>
            <MultiSelect
                label="Courses"
                placeholder="All Courses"
                options={availableCourses}
                selected={formData.target_course}
                onChange={vals => setFormData({ ...formData, target_course: vals })}
            />
            <MultiSelect
                label="Branches"
                placeholder="All Branches"
                options={availableBranches}
                selected={formData.target_branch}
                onChange={vals => setFormData({ ...formData, target_branch: vals })}
            />
            <div className="grid grid-cols-2 gap-4">
                <MultiSelect
                    label="Years"
                    placeholder="All Years"
                    options={availableYears}
                    selected={formData.target_year}
                    onChange={vals => setFormData({ ...formData, target_year: vals })}
                />
                <MultiSelect
                    label="Semesters"
                    placeholder="All Semesters"
                    options={availableSemesters}
                    selected={formData.target_semester}
                    onChange={vals => setFormData({ ...formData, target_semester: vals })}
                />
            </div>
        </div>
    );
};

const Announcements = () => {
    const [activeTab, setActiveTab] = useState('announcements');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Data States
    const [announcements, setAnnouncements] = useState([]);
    const [polls, setPolls] = useState([]);

    // UI States
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);

    // Initial Form State
    const initialFormState = {
        title: '',
        content: '',
        // Poll specific
        question: '',
        options: ['', ''],
        start_time: '',
        end_time: '',
        // Shared Targets
        target_college: [],
        target_batch: [],
        target_course: [],
        target_branch: [],
        target_year: [],
        target_semester: [],
        image: null,
        existing_image_url: null
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (activeTab === 'announcements') fetchAnnouncements();
        else fetchPolls();
    }, [activeTab]);

    const fetchAnnouncements = async () => {
        try {
            const response = await api.get('/announcements/admin');
            if (response.data.success) setAnnouncements(response.data.data || []);
        } catch (error) { toast.error('Failed to load announcements'); }
    };

    const fetchPolls = async () => {
        try {
            const response = await api.get('/polls/admin');
            if (response.data.success) setPolls(response.data.data || []);
        } catch (error) { toast.error('Failed to load polls'); }
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) setFormData({ ...formData, image: e.target.files[0] });
    };

    const openCreateModal = (type = 'announcements') => {
        setFormData(initialFormState);
        setEditId(null);
        setActiveTab(type); // Ensure tab matches what we are creating
        setIsCreateModalOpen(true);
    };

    const openEditModal = (item, type) => {
        setEditId(item.id);
        setActiveTab(type);

        const parseField = (val) => {
            if (!val) return [];
            return Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : []);
        };

        if (type === 'announcements') {
            setFormData({
                ...initialFormState,
                title: item.title,
                content: item.content,
                target_college: parseField(item.target_college),
                target_batch: parseField(item.target_batch),
                target_course: parseField(item.target_course),
                target_branch: parseField(item.target_branch),
                target_year: parseField(item.target_year),
                target_semester: parseField(item.target_semester),
                existing_image_url: item.image_url
            });
        } else {
            // Poll
            // Handle dates for inputs (YYYY-MM-DDTHH:mm)
            const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().slice(0, 16) : '';

            setFormData({
                ...initialFormState,
                question: item.question,
                options: Array.isArray(item.options) ? item.options : JSON.parse(item.options),
                start_time: formatDate(item.start_time),
                end_time: formatDate(item.end_time),
                target_college: parseField(item.target_college),
                target_batch: parseField(item.target_batch),
                target_course: parseField(item.target_course),
                target_branch: parseField(item.target_branch),
                target_year: parseField(item.target_year),
                target_semester: parseField(item.target_semester),
            });
        }
        setIsCreateModalOpen(true);
    };

    const handleCancel = () => {
        setIsCreateModalOpen(false);
        setEditId(null);
        setFormData(initialFormState);
    };

    const handleSubmitAnnouncement = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.content) return toast.error('Title and Content required');

        setLoading(true);
        const data = new FormData();
        data.append('title', formData.title);
        data.append('content', formData.content);
        if (formData.image) data.append('image', formData.image);
        if (editId && formData.existing_image_url && !formData.image) data.append('existing_image_url', formData.existing_image_url);

        ['target_college', 'target_batch', 'target_course', 'target_branch', 'target_year', 'target_semester'].forEach(key => {
            if (formData[key].length) data.append(key, JSON.stringify(formData[key]));
        });

        try {
            const url = editId ? `/announcements/${editId}` : '/announcements';
            const method = editId ? api.put : api.post;
            await method(url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(editId ? 'Updated' : 'Posted');
            handleCancel();
            fetchAnnouncements();
        } catch (error) { console.error(error); toast.error('Failed'); }
        finally { setLoading(false); }
    };

    const handleSubmitPoll = async (e) => {
        e.preventDefault();
        if (!formData.question || formData.options.filter(o => o.trim()).length < 2) return toast.error('Question and at least 2 options required');

        setLoading(true);
        const payload = {
            question: formData.question,
            options: formData.options.filter(o => o.trim()),
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
            target_college: formData.target_college,
            target_batch: formData.target_batch,
            target_course: formData.target_course,
            target_branch: formData.target_branch,
            target_year: formData.target_year,
            target_semester: formData.target_semester
        };

        try {
            if (editId) {
                await api.put(`/polls/${editId}`, payload);
                toast.success('Poll updated successfully');
            } else {
                await api.post('/polls', payload);
                toast.success('Poll created successfully');
            }
            handleCancel();
            fetchPolls();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save poll');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, type) => {
        if (!window.confirm('Delete this item?')) return;
        try {
            await api.delete(`/${type}/${id}`);
            toast.success('Deleted');
            if (type === 'announcements') fetchAnnouncements(); else fetchPolls();
        } catch (e) { toast.error('Failed to delete'); }
    };

    const toggleStatus = async (id, currentStatus, type) => {
        try {
            await api.patch(`/${type}/${id}/status`, { is_active: !currentStatus });
            toast.success('Status updated');
            if (type === 'announcements') fetchAnnouncements(); else fetchPolls();
        } catch (e) { toast.error('Failed update'); }
    };

    // Poll Option Helpers
    const addOption = () => {
        if (formData.options.length < 6) setFormData({ ...formData, options: [...formData.options, ''] });
    };
    const removeOption = (idx) => {
        if (formData.options.length > 2) {
            const newOpts = [...formData.options];
            newOpts.splice(idx, 1);
            setFormData({ ...formData, options: newOpts });
        }
    };
    const updateOption = (idx, val) => {
        const newOpts = [...formData.options];
        newOpts[idx] = val;
        setFormData({ ...formData, options: newOpts });
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-6 animate-fade-in relative">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 heading-font">Announcements & Polls</h1>
                    <p className="text-gray-500">Manage communication with students.</p>
                </div>
                <button
                    onClick={() => openCreateModal(activeTab)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                >
                    <Plus size={20} />
                    Create New
                </button>
            </div>

            {/* Quick Stats or Filters can go here later */}

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white px-4 rounded-t-xl shadow-sm">
                <button
                    onClick={() => { setActiveTab('announcements'); fetchAnnouncements(); }}
                    className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'announcements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Announcements
                </button>
                <button
                    onClick={() => { setActiveTab('polls'); fetchPolls(); }}
                    className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'polls' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Polls
                </button>
            </div>

            {/* List View */}
            <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0 p-6 min-h-[400px]">
                {loading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-blue-600" />
                    </div>
                )}

                {activeTab === 'announcements' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {announcements.map(ann => (
                            <div key={ann.id} className={`bg-white rounded-xl shadow-sm border p-4 group hover:shadow-md transition-all ${!ann.is_active ? 'opacity-75 grayscale' : ''}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-gray-900 line-clamp-1">{ann.title}</h4>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => toggleStatus(ann.id, ann.is_active, 'announcements')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                                            {ann.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button onClick={() => openEditModal(ann, 'announcements')} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded"><Pencil size={16} /></button>
                                        <button onClick={() => handleDelete(ann.id, 'announcements')} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                {ann.image_url && (
                                    <div className="mb-3 h-32 overflow-hidden rounded-lg bg-gray-100">
                                        <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ann.content}</p>
                            </div>
                        ))}
                        {announcements.length === 0 && !loading && (
                            <div className="col-span-full text-center py-10 text-gray-500">No announcements found.</div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {polls.map(poll => (
                            <div key={poll.id} className={`bg-white rounded-xl shadow-sm border p-6 group hover:shadow-md transition-all ${!poll.is_active ? 'opacity-75' : ''}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-bold text-gray-900 text-lg line-clamp-2">{poll.question}</h4>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleStatus(poll.id, poll.is_active, 'polls')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                                            {poll.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button onClick={() => openEditModal(poll, 'polls')} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded"><Pencil size={16} /></button>
                                        <button onClick={() => handleDelete(poll.id, 'polls')} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={16} /></button>
                                    </div>
                                </div>

                                <div className="mb-4 space-y-2">
                                    {(poll.options || []).map((opt, i) => {
                                        const count = poll.vote_counts?.[i] || 0;
                                        const total = poll.stats?.votes || 1;
                                        const percent = Math.round((count / total) * 100);
                                        return (
                                            <div key={i} className="text-sm">
                                                <div className="flex justify-between mb-1">
                                                    <span>{opt}</span>
                                                    <span className="text-gray-500">{count} votes ({percent}%)</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Stats Footer */}
                                <div className="pt-4 border-t flex items-center justify-between text-xs text-gray-500 bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-xl">
                                    <div className="flex gap-4">
                                        <span title="Assigned Students">👥 Assigned: {poll.stats?.assigned || 0}</span>
                                        <span title="Pending Votes">⏳ Pending: {poll.stats?.pending || 0}</span>
                                        <span title="Total Votes">📊 Votes: {poll.stats?.votes || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {poll.end_time ? `Ends: ${new Date(poll.end_time).toLocaleDateString()}` : 'No deadline'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {polls.length === 0 && !loading && (
                            <div className="col-span-full text-center py-10 text-gray-500">No polls found.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden animate-scale-in">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {editId ? <Pencil className="text-blue-600" size={24} /> : <PlusCircle className="text-blue-600" size={24} />}
                                {editId ? 'Edit Item' : (activeTab === 'announcements' ? 'New Announcement' : 'New Poll')}
                            </h2>
                            <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[80vh] overflow-y-auto">
                            <form onSubmit={activeTab === 'announcements' ? handleSubmitAnnouncement : handleSubmitPoll} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {activeTab === 'announcements' ? (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter title"
                                                        value={formData.title}
                                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                                    <textarea
                                                        className="w-full p-2 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Enter details..."
                                                        value={formData.content}
                                                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Image (Optional)</label>
                                                    {formData.existing_image_url && !formData.image && (
                                                        <div className="mb-2 h-20 w-32 relative group">
                                                            <img src={formData.existing_image_url} alt="Current" className="h-full w-full object-cover rounded border" />
                                                            <button type="button" onClick={() => setFormData({ ...formData, existing_image_url: null })} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
                                                        </div>
                                                    )}
                                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors relative">
                                                        <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                                        <div className="flex flex-col items-center gap-2 text-gray-500">
                                                            <ImageIcon size={24} />
                                                            <span className="text-sm">{formData.image ? formData.image.name : 'Click to update image'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Poll Question</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Ask something..."
                                                        value={formData.question}
                                                        onChange={e => setFormData({ ...formData, question: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
                                                        <input
                                                            type="datetime-local"
                                                            className="w-full p-2 border rounded-lg text-sm"
                                                            value={formData.start_time || ''}
                                                            onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-700 mb-1">End Time</label>
                                                        <input
                                                            type="datetime-local"
                                                            className="w-full p-2 border rounded-lg text-sm"
                                                            value={formData.end_time || ''}
                                                            onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                                                    <div className="space-y-2">
                                                        {formData.options.map((opt, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                                    placeholder={`Option ${idx + 1}`}
                                                                    value={opt}
                                                                    onChange={e => updateOption(idx, e.target.value)}
                                                                />
                                                                {formData.options.length > 2 && (
                                                                    <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded"><MinusCircle size={20} /></button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {formData.options.length < 6 && (
                                                            <button type="button" onClick={addOption} className="text-blue-600 text-sm font-semibold flex items-center gap-1 mt-2">
                                                                <PlusCircle size={16} /> Add Option
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <TargetSelector formData={formData} setFormData={setFormData} />
                                </div>

                                <div className="flex justify-end pt-4 border-t gap-3">
                                    <button type="button" onClick={handleCancel} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                        {editId ? 'Update' : (activeTab === 'announcements' ? 'Post' : 'Create Poll')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Announcements;
