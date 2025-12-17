
import React, { useState, useEffect, useRef } from 'react';
import {
    Megaphone,
    Send,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Loader2,
    Calendar,
    Users,
    Check,
    ChevronDown,
    X,
    Pencil
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

            {/* Selected Tags Preview */}
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

const Announcements = () => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [announcements, setAnnouncements] = useState([]);
    const [editId, setEditId] = useState(null);
    const [recipientCount, setRecipientCount] = useState(0);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        target_college: [],
        target_batch: [],
        target_course: [],
        target_branch: [],
        target_year: [],
        target_semester: [],
        image: null,
        existing_image_url: null // For edit mode
    });

    // Metadata
    const [colleges, setColleges] = useState([]);
    const [batches, setBatches] = useState([]);
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [years, setYears] = useState([]);
    const [semesters, setSemesters] = useState([]);

    // Derived Options based on selection
    const [availableCourses, setAvailableCourses] = useState([]);
    const [availableBranches, setAvailableBranches] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [availableSemesters, setAvailableSemesters] = useState([]);

    useEffect(() => {
        fetchMetadata();
        fetchAnnouncements();
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

            if (colRes.data.success) {
                setColleges(colRes.data.data.map(c => ({ value: c.name, label: c.name, id: c.id })));
            }
            if (batchRes.data.success) {
                setBatches(batchRes.data.data.map(b => ({ value: b.name, label: b.name, id: b.id })));
            }
            if (courRes.data.success) {
                setCourses(courRes.data.data.map(c => ({
                    value: c.name,
                    label: c.name,
                    collegeId: c.college_id,
                    id: c.id
                })));
            }
            if (branchRes.data.success) {
                setBranches(branchRes.data.data.map(b => ({
                    value: b.name,
                    label: b.name,
                    courseId: b.course_id,
                    id: b.id
                })));
            }
            if (yearRes.data.success) {
                // Use Set to uniqueness if duplicates exist across batches
                setYears(yearRes.data.data.map(y => ({ value: y.name, label: `${y.name} Year`, batchId: y.batch_id })));
            }
            if (semRes.data.success) {
                setSemesters(semRes.data.data.map(s => ({ value: s.name, label: `Semester ${s.name}`, batchId: s.batch_id })));
            }
        } catch (error) {
            console.error('Metadata fetch failed', error);
        }
    };

    // Filter Logic
    // 1. College -> Course
    useEffect(() => {
        if (formData.target_college.length === 0) {
            setAvailableCourses(courses);
        } else {
            const selectedCollegeIds = colleges
                .filter(c => formData.target_college.includes(c.value))
                .map(c => c.id);
            const filtered = courses.filter(c => selectedCollegeIds.includes(c.collegeId));
            setAvailableCourses(filtered.length > 0 || selectedCollegeIds.length === 0 ? filtered : courses);
        }
    }, [formData.target_college, courses, colleges]);

    // 2. Course -> Branch
    useEffect(() => {
        if (formData.target_course.length === 0) {
            setAvailableBranches(branches);
        } else {
            const selectedCourseNames = formData.target_course;
            const filtered = branches.filter(b => selectedCourseNames.includes(b.courseId));
            setAvailableBranches(filtered.length > 0 ? filtered : branches);
        }
    }, [formData.target_course, courses, branches]);

    // 3. Batch -> Year / Semester
    useEffect(() => {
        if (formData.target_batch.length === 0) {
            // Map uniqueness
            const distinctYears = [...new Map(years.map(item => [item.value, item])).values()];
            const distinctSems = [...new Map(semesters.map(item => [item.value, item])).values()];
            setAvailableYears(distinctYears);
            setAvailableSemesters(distinctSems);
        } else {
            // Filter years/semesters that belong to selected batches
            const selectedBatches = formData.target_batch;

            const filteredYears = years.filter(y => selectedBatches.includes(y.batchId));
            // Remove duplicates by value
            const uniqueYears = [...new Map(filteredYears.map(item => [item.value, item])).values()];
            setAvailableYears(uniqueYears);

            const filteredSems = semesters.filter(s => selectedBatches.includes(s.batchId));
            const uniqueSems = [...new Map(filteredSems.map(item => [item.value, item])).values()];
            setAvailableSemesters(uniqueSems);
        }
    }, [formData.target_batch, years, semesters]);

    // Recipient Count Calculation
    useEffect(() => {
        const calculateCount = async () => {
            try {
                // If any field has values, call API. If all empty, it assumes all students?
                // Or maybe we should debounce this.
                const response = await api.post('/announcements/count', {
                    target_college: formData.target_college,
                    target_batch: formData.target_batch,
                    target_course: formData.target_course,
                    target_branch: formData.target_branch,
                    target_year: formData.target_year,
                    target_semester: formData.target_semester
                });
                if (response.data.success) {
                    setRecipientCount(response.data.count);
                }
            } catch (error) {
                console.error("Failed to calculate count", error);
            }
        };

        const timer = setTimeout(calculateCount, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [formData.target_college, formData.target_batch, formData.target_course, formData.target_branch, formData.target_year, formData.target_semester]);


    const fetchAnnouncements = async () => {
        try {
            setFetching(true);
            const response = await api.get('/announcements/admin');
            if (response.data.success) {
                setAnnouncements(response.data.data || []);
            }
        } catch (error) {
            toast.error('Failed to load announcements');
        } finally {
            setFetching(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFormData({ ...formData, image: e.target.files[0] });
        }
    };

    const handleEdit = (ann) => {
        setEditId(ann.id);

        const parseField = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) { return []; }
        };

        setFormData({
            title: ann.title,
            content: ann.content,
            target_college: parseField(ann.target_college),
            target_batch: parseField(ann.target_batch),
            target_course: parseField(ann.target_course),
            target_branch: parseField(ann.target_branch),
            target_year: parseField(ann.target_year),
            target_semester: parseField(ann.target_semester),
            image: null,
            existing_image_url: ann.image_url
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditId(null);
        setFormData({
            title: '',
            content: '',
            target_college: [],
            target_batch: [],
            target_course: [],
            target_branch: [],
            target_year: [],
            target_semester: [],
            image: null,
            existing_image_url: null
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.content) {
            toast.error('Title and Content are required');
            return;
        }

        setLoading(true);
        const data = new FormData();
        data.append('title', formData.title);
        data.append('content', formData.content);
        if (formData.image) data.append('image', formData.image);
        if (editId && formData.existing_image_url && !formData.image) {
            data.append('existing_image_url', formData.existing_image_url);
        }

        // Logic for backend: it expects array or strings. If using JSON.stringify for everything, keep consistent.
        // My backend handles both but frontend sending JSON string is safer for FormData
        if (formData.target_college.length) data.append('target_college', JSON.stringify(formData.target_college));
        if (formData.target_batch.length) data.append('target_batch', JSON.stringify(formData.target_batch));
        if (formData.target_course.length) data.append('target_course', JSON.stringify(formData.target_course));
        if (formData.target_branch.length) data.append('target_branch', JSON.stringify(formData.target_branch));
        if (formData.target_year.length) data.append('target_year', JSON.stringify(formData.target_year));
        if (formData.target_semester.length) data.append('target_semester', JSON.stringify(formData.target_semester));

        try {
            let response;
            if (editId) {
                response = await api.put(`/announcements/${editId}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                response = await api.post('/announcements', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            if (response.data.success) {
                toast.success(editId ? 'Announcement updated!' : 'Announcement posted successfully!');
                handleCancelEdit();
                fetchAnnouncements();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save announcement');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            await api.delete(`/announcements/${id}`);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            toast.success('Deleted');
        } catch (e) { toast.error('Failed to delete'); }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            await api.patch(`/announcements/${id}/status`, { is_active: !currentStatus });
            setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
            toast.success('Status updated');
        } catch (e) { toast.error('Failed update'); }
    };

    return (
        <div className="space-y-6 animate-fade-in p-2">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 heading-font">Announcements</h1>
                <p className="text-gray-500">Manage announcements for students.</p>
            </div>

            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${editId ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        {editId ? <Pencil className="text-blue-600" size={20} /> : <Megaphone className="text-blue-600" size={20} />}
                        {editId ? 'Edit Announcement' : 'New Announcement'}
                    </h2>
                    {editId && (
                        <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 text-sm">
                            Cancel Edit
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
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
                                {/* Show existing image if editing */}
                                {formData.existing_image_url && !formData.image && (
                                    <div className="mb-2 h-20 w-32 relative group">
                                        <img src={formData.existing_image_url} alt="Current" className="h-full w-full object-cover rounded border" />
                                        <button type="button" onClick={() => setFormData({ ...formData, existing_image_url: null })} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
                                        <span className="text-xs text-gray-500">Current Image</span>
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
                        </div>

                        <div className="space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-100">
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
                    </div>

                    <div className="flex justify-end pt-4 border-t gap-3">
                        {editId && (
                            <button type="button" onClick={handleCancelEdit} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : (editId ? <Pencil size={18} /> : <Send size={18} />)}
                            {editId ? 'Update Announcement' : 'Post Announcement'}
                        </button>
                    </div>
                </form>
            </div>

            {/* History grid */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold">Recent Announcements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {announcements.map(ann => (
                        <div key={ann.id} className={`bg-white rounded-xl shadow-sm border p-4 group hover:shadow-md transition-all ${!ann.is_active ? 'opacity-75 grayscale' : ''}`}>
                            <div className="flex justify-between items-start mb-3">
                                <h4 className="font-bold text-gray-900 line-clamp-1">{ann.title}</h4>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => toggleStatus(ann.id, ann.is_active)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                                        {ann.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button onClick={() => handleEdit(ann)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded"><Pencil size={16} /></button>
                                    <button onClick={() => handleDelete(ann.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            {ann.image_url && (
                                <div className="mb-3 h-32 overflow-hidden rounded-lg bg-gray-100">
                                    <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ann.content}</p>
                            <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                                {ann.target_college ? 'Targeted' : 'Global Announcement'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Announcements;
