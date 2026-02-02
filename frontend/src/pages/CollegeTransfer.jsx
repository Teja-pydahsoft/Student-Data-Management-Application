import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, Search, Filter, ArrowRight, CheckCircle, AlertTriangle,
    Loader2, X, RefreshCw, TrendingUp
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../components/SkeletonLoader';

const CollegeTransfer = () => {
    // --- State ---

    // 1. Source Filters
    const [filters, setFilters] = useState({
        college: '',
        batch: '',
        course: '',
        branch: '',
        year: '',
        semester: ''
    });

    // 2. Target Details
    const [targetDetails, setTargetDetails] = useState({
        college: '',
        batch: '',
        course: '',
        branch: '',
        year: '',
        semester: ''
    });

    // 3. Raw Metadata Options (All available options from API)
    const [rawMetadata, setRawMetadata] = useState({
        colleges: [],
        batches: [],
        courses: [],
        branches: [],
        years: [],
        semesters: []
    });

    // 4. Students Data
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [totalStudents, setTotalStudents] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);

    // 5. Selection & Processing
    const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [transferPlan, setTransferPlan] = useState([]);


    // --- Helper: Option Lists with Cascading Logic ---

    // Fetch initial metadata on mount
    useEffect(() => {
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

                setRawMetadata({
                    colleges: colRes.data.success ? colRes.data.data.map(c => ({ label: c.name, value: c.name, id: c.id })) : [],
                    batches: batchRes.data.success ? batchRes.data.data.map(b => ({ label: b.name, value: b.name, id: b.id })) : [],
                    courses: courRes.data.success ? courRes.data.data.map(c => ({ label: c.name, value: c.name, id: c.id, collegeId: c.collegeId || c.college_id })) : [],
                    branches: branchRes.data.success ? branchRes.data.data.map(b => ({ label: b.name, value: b.name, id: b.id, courseId: b.courseId || b.course_id })) : [],
                    years: yearRes.data.success ? yearRes.data.data.map(y => ({ label: y.name, value: y.name, id: y.id, batchId: y.batch_id })) : [],
                    semesters: semRes.data.success ? semRes.data.data.map(s => ({ label: s.name, value: s.name, id: s.id, batchId: s.batch_id })) : []
                });
            } catch (error) {
                console.error("Metadata load error", error);
            }
        };
        fetchMetadata();
    }, []);

    // --- Derived Options for Source ---
    const sourceOptions = useMemo(() => {
        // Filter Courses based on College
        let courses = rawMetadata.courses;
        if (filters.college) {
            const selectedCollege = rawMetadata.colleges.find(c => c.value === filters.college);
            if (selectedCollege) {
                // Use loose equality to handle string/number collegeId mismatch
                courses = courses.filter(c => c.collegeId == selectedCollege.id);
            }
        }

        // Filter Branches based on Course
        let branches = rawMetadata.branches;
        if (filters.course) {
            const selectedCourse = rawMetadata.courses.find(c => c.value === filters.course);
            if (selectedCourse) {
                // API returns 'course_id' as the course NAME for branches, so we filter by selectedCourse.value (the name)
                branches = branches.filter(b => b.courseId === selectedCourse.value);
            }
        } else if (filters.college) {
            // If course not selected but college is, show branches only for the valid courses of that college
            const validCourseNames = courses.map(c => c.value);
            branches = branches.filter(b => validCourseNames.includes(b.courseId));
        }

        // Filter and Deduplicate Years
        let years = rawMetadata.years;
        if (filters.batch) {
            years = years.filter(y => y.batchId === filters.batch);
        }
        years = [...new Map(years.map(item => [item.value, item])).values()];

        // Filter and Deduplicate Semesters
        let semesters = rawMetadata.semesters;
        if (filters.batch) {
            semesters = semesters.filter(s => s.batchId === filters.batch);
        }
        semesters = [...new Map(semesters.map(item => [item.value, item])).values()];

        return {
            colleges: rawMetadata.colleges,
            batches: rawMetadata.batches,
            courses,
            branches,
            years,
            semesters
        };
    }, [filters, rawMetadata]);


    // --- Derived Options for Target ---
    const targetOptions = useMemo(() => {
        // Filter Courses based on College
        let courses = rawMetadata.courses;
        if (targetDetails.college) {
            const selectedCollege = rawMetadata.colleges.find(c => c.value === targetDetails.college);
            if (selectedCollege) {
                courses = courses.filter(c => c.collegeId == selectedCollege.id);
            }
        }

        // Filter Branches based on Course
        let branches = rawMetadata.branches;
        if (targetDetails.course) {
            const selectedCourse = rawMetadata.courses.find(c => c.value === targetDetails.course);
            if (selectedCourse) {
                branches = branches.filter(b => b.courseId === selectedCourse.value);
            }
        } else if (targetDetails.college) {
            const validCourseNames = courses.map(c => c.value);
            branches = branches.filter(b => validCourseNames.includes(b.courseId));
        }

        // Filter and Deduplicate Years
        let years = rawMetadata.years;
        if (targetDetails.batch) {
            years = years.filter(y => y.batchId === targetDetails.batch);
        }
        years = [...new Map(years.map(item => [item.value, item])).values()];

        // Filter and Deduplicate Semesters
        let semesters = rawMetadata.semesters;
        if (targetDetails.batch) {
            semesters = semesters.filter(s => s.batchId === targetDetails.batch);
        }
        semesters = [...new Map(semesters.map(item => [item.value, item])).values()];

        return {
            colleges: rawMetadata.colleges,
            batches: rawMetadata.batches,
            courses,
            branches,
            years,
            semesters
        };
    }, [targetDetails, rawMetadata]);


    // --- Handlers ---

    const handleFilterChange = (key, value) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            // Reset Logic
            if (key === 'college') { next.course = ''; next.branch = ''; }
            if (key === 'course') { next.branch = ''; }
            return next;
        });
        setCurrentPage(1);
        setSelectedAdmissionNumbers(new Set());
    };

    const handleTargetChange = (key, value) => {
        setTargetDetails(prev => {
            const next = { ...prev, [key]: value };
            // Reset Logic to force next selection
            if (key === 'college') { next.course = ''; next.branch = ''; }
            if (key === 'course') { next.branch = ''; }
            return next;
        });
    };

    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedAdmissionNumbers(new Set(students.map(s => s.admission_number)));
        } else {
            setSelectedAdmissionNumbers(new Set());
        }
    };

    const toggleSelectStudent = (id) => {
        const newSet = new Set(selectedAdmissionNumbers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedAdmissionNumbers(newSet);
    };


    // --- API Calls ---

    useEffect(() => {
        const fetchStudents = async () => {
            setLoadingStudents(true);
            try {
                const params = new URLSearchParams();
                if (filters.college) params.append('filter_college', filters.college);
                if (filters.batch) params.append('filter_batch', filters.batch);
                if (filters.course) params.append('filter_course', filters.course);
                if (filters.branch) params.append('filter_branch', filters.branch);
                if (filters.year) params.append('filter_year', filters.year);
                if (filters.semester) params.append('filter_semester', filters.semester);
                params.append('page', currentPage);
                params.append('limit', pageSize);
                params.append('filter_student_status', 'Regular');

                const response = await api.get(`/students?${params.toString()}`);
                if (response.data?.success) {
                    setStudents(response.data.data || []);
                    setTotalStudents(response.data.pagination?.total || 0);
                }
            } catch (error) { toast.error('Failed to load students'); }
            finally { setLoadingStudents(false); }
        };

        fetchStudents();
    }, [filters, currentPage, pageSize]);

    const prepareTransfer = () => {
        // Validate
        if (selectedAdmissionNumbers.size === 0) return toast.error('Select at least one student');
        if (!targetDetails.year || !targetDetails.semester || !targetDetails.batch || !targetDetails.course || !targetDetails.college) {
            return toast.error('Please complete all Target Details (College, Batch, Course, Year, Semester)');
        }

        setTransferPlan(students.filter(s => selectedAdmissionNumbers.has(s.admission_number)));
        setConfirmationOpen(true);
    };

    const executeTransfer = async () => {
        setSubmitting(true);
        try {
            const payload = {
                students: transferPlan.map(s => ({ admissionNumber: s.admission_number })),
                targetCollege: targetDetails.college,
                targetBatch: targetDetails.batch,
                targetCourse: targetDetails.course,
                targetBranch: targetDetails.branch,
                targetYear: targetDetails.year,
                targetSemester: targetDetails.semester
            };

            const response = await api.post('/students/transfers/bulk', payload);
            if (response.data.success) {
                toast.success('Transfer Successful');
                setConfirmationOpen(false);
                setSelectedAdmissionNumbers(new Set());
                // Refresh list
                handleFilterChange('college', filters.college); // Trigger re-fetch
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transfer Failed');
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" /> College Transfer / Manual Promotion
                </h1>
                <p className="text-gray-500">Select students and transfer them to a specific academic stage manually.</p>
            </div>

            {/* Grid for Filter & Target panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Panel 1: Source */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-3">
                        <Filter size={18} className="text-gray-500" /> Source Criteria (Find Students)
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">College</label>
                            <select className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={filters.college} onChange={e => handleFilterChange('college', e.target.value)}>
                                <option value="">All Colleges</option>
                                {sourceOptions.colleges.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Batch</label>
                            <select className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={filters.batch} onChange={e => handleFilterChange('batch', e.target.value)}>
                                <option value="">All Batches</option>
                                {sourceOptions.batches.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Course</label>
                            <select className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={filters.course} onChange={e => handleFilterChange('course', e.target.value)}>
                                <option value="">All Courses</option>
                                {sourceOptions.courses.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Branch</label>
                            <select className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={filters.branch} onChange={e => handleFilterChange('branch', e.target.value)}>
                                <option value="">All Branches</option>
                                {sourceOptions.branches.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Current Year</label>
                            <select className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={filters.year} onChange={e => handleFilterChange('year', e.target.value)}>
                                <option value="">All Years</option>
                                {sourceOptions.years.map(o => <option key={o.id} value={o.value}>{o.label} Year</option>)}
                            </select>
                        </div>
                        {/* Ensure columns align nicely */}
                        <div className="hidden lg:block"></div>
                    </div>
                </div>

                {/* Panel 2: Target */}
                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl shadow-sm border border-indigo-100 p-5 flex flex-col gap-4">
                    <h3 className="font-semibold text-indigo-900 flex items-center gap-2 border-b border-indigo-100 pb-3">
                        <ArrowRight size={18} className="text-indigo-500" /> Target Destination (Transfer To)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Target College <span className="text-red-500">*</span></label>
                            <select className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={targetDetails.college} onChange={e => handleTargetChange('college', e.target.value)}>
                                <option value="">Select College</option>
                                {targetOptions.colleges.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Target Batch <span className="text-red-500">*</span></label>
                            <select className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={targetDetails.batch} onChange={e => handleTargetChange('batch', e.target.value)}>
                                <option value="">Select Batch</option>
                                {targetOptions.batches.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Target Course <span className="text-red-500">*</span></label>
                            <select className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={targetDetails.course} onChange={e => handleTargetChange('course', e.target.value)}>
                                <option value="">Select Course</option>
                                {targetOptions.courses.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Target Branch</label>
                            <select className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={targetDetails.branch} onChange={e => handleTargetChange('branch', e.target.value)}>
                                <option value="">Select Branch</option>
                                {targetOptions.branches.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Target Year <span className="text-red-500">*</span></label>
                            <select className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={targetDetails.year} onChange={e => handleTargetChange('year', e.target.value)}>
                                <option value="">Select Year</option>
                                {targetOptions.years.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Target Sem <span className="text-red-500">*</span></label>
                            <select className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={targetDetails.semester} onChange={e => handleTargetChange('semester', e.target.value)}>
                                <option value="">Select Sem</option>
                                {targetOptions.semesters.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                    Selected <span className="font-bold text-indigo-600 text-lg">{selectedAdmissionNumbers.size}</span> students for transfer
                </div>
                <button
                    onClick={prepareTransfer}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-2"
                >
                    Review & Transfer <ArrowRight size={18} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loadingStudents ? (
                    <div className="p-8"><SkeletonTable rows={5} cols={6} /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-bold border-b h-12">
                                <tr>
                                    <th className="px-6 w-12 text-center">
                                        <input type="checkbox"
                                            checked={students.length > 0 && selectedAdmissionNumbers.size >= students.length}
                                            onChange={e => toggleSelectAll(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-3">Admission No</th>
                                    <th className="px-6 py-3">Student Name</th>
                                    <th className="px-6 py-3">Current Details</th>
                                    <th className="px-6 py-3">Current Stage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.length === 0 ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-gray-500 flex flex-col items-center gap-2">
                                        <Search size={32} className="text-gray-300" />
                                        No students found matching criteria.
                                    </td></tr>
                                ) : students.map(student => (
                                    <tr key={student.admission_number} className={`hover:bg-slate-50 transition-colors ${selectedAdmissionNumbers.has(student.admission_number) ? 'bg-indigo-50/50' : ''}`}>
                                        <td className="px-6 py-4 text-center">
                                            <input type="checkbox"
                                                checked={selectedAdmissionNumbers.has(student.admission_number)}
                                                onChange={() => toggleSelectStudent(student.admission_number)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{student.admission_number}</td>
                                        <td className="px-6 py-4 font-medium text-gray-800">{student.student_name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-gray-500 uppercase">{student.college}</span>
                                                <span className="">{student.course} - {student.branch}</span>
                                                <span className="text-xs text-gray-400 bg-gray-100 px-1 py-0.5 rounded w-fit mt-1">{student.batch}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
                                                Year {student.current_year} • Sem {student.current_semester}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {confirmationOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <CheckCircle className="text-green-600" size={20} />
                                Confirm Transfer
                            </h2>
                            <button onClick={() => setConfirmationOpen(false)} className="hover:bg-gray-200 p-2 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><RefreshCw size={100} /></div>
                                <h4 className="font-bold text-indigo-900 mb-3 text-sm uppercase tracking-wide">Destination Details</h4>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm relative z-10">
                                    <div>
                                        <span className="block text-xs font-semibold text-indigo-400 uppercase">College</span>
                                        <span className="font-bold text-indigo-900">{targetDetails.college}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-semibold text-indigo-400 uppercase">Batch</span>
                                        <span className="font-bold text-indigo-900">{targetDetails.batch}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-semibold text-indigo-400 uppercase">Course / Branch</span>
                                        <span className="font-bold text-indigo-900">{targetDetails.course} • {targetDetails.branch || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-semibold text-indigo-400 uppercase">Academic Year</span>
                                        <span className="font-bold text-indigo-900">Year {targetDetails.year} • Sem {targetDetails.semester}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2 flex justify-between items-center">
                                    <span>Students to Transfer</span>
                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{transferPlan.length} Selected</span>
                                </h4>
                                <div className="border rounded-lg max-h-48 overflow-y-auto bg-gray-50/50">
                                    {transferPlan.map((s, idx) => (
                                        <div key={idx} className="p-3 border-b last:border-0 text-sm flex justify-between items-center px-4 hover:bg-white transition-colors">
                                            <span className="font-medium text-gray-800">{s.student_name}</span>
                                            <span className="text-gray-500 font-mono text-xs">{s.admission_number}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-100">
                                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                                <p>This action will move the selected students to the new college/batch/course structure. Only academic details (College, Batch, Course, Branch, Year, Semester) will be updated. Fee status and registration status will remain unchanged.</p>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmationOpen(false)}
                                className="px-5 py-2.5 text-gray-700 font-semibold hover:bg-gray-200 rounded-lg transition-colors"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeTransfer}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
                            >
                                {submitting && <Loader2 size={18} className="animate-spin" />}
                                Confirm Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CollegeTransfer;
