import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, Search, Filter, ArrowRight, CheckCircle, AlertTriangle,
    Loader2, X, RefreshCw, TrendingUp
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../components/SkeletonLoader';

const CollegeTransfer = () => {
    // Source Filters (Who to transfer)
    const [filters, setFilters] = useState({
        batch: '',
        course: '',
        branch: '',
        year: '',
        semester: ''
    });

    // Destination Details (Where to transfer to)
    const [targetDetails, setTargetDetails] = useState({
        batch: '',
        course: '',
        branch: '',
        year: '',
        semester: ''
    });

    const [filterOptions, setFilterOptions] = useState({
        batches: [],
        courses: [],
        branches: [],
        years: [],
        semesters: []
    });

    const [targetOptions, setTargetOptions] = useState({
        batches: [],
        courses: [],
        branches: [],
        years: [],
        semesters: []
    });

    // State
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [totalStudents, setTotalStudents] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Selection
    const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());

    // Transfer Processing
    const [transferPlan, setTransferPlan] = useState([]);
    const [loadingTransferPlan, setLoadingTransferPlan] = useState(false);
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [transferResults, setTransferResults] = useState(null);
    const [transferSummary, setTransferSummary] = useState(null);

    // Left-out students handling (Future implementation if needed)
    // const [detectedLeftOutStudents, setDetectedLeftOutStudents] = useState([]);

    useEffect(() => {
        fetchQuickFilterOptions(setFilterOptions); // For source filters
        fetchQuickFilterOptions(setTargetOptions); // For target options
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [filters, currentPage, pageSize, searchTerm]);

    // Initial fetch helper
    const fetchQuickFilterOptions = async (setter) => {
        try {
            const response = await api.get('/students/quick-filters');
            if (response.data?.success) {
                setter(response.data.data);
            }
        } catch (error) {
            console.warn('Failed to load filter options', error);
        }
    };

    // Dynamic filter fetching for targets (Cascading)
    const loadTargetOptions = async (currentDetails) => {
        try {
            const params = new URLSearchParams();
            if (currentDetails.batch) params.append('batch', currentDetails.batch);
            if (currentDetails.course) params.append('course', currentDetails.course);

            const response = await api.get(`/students/quick-filters?${params.toString()}`);
            if (response.data?.success) {
                setTargetOptions(prev => ({
                    ...prev,
                    ...response.data.data // Update available options based on selection
                }));
            }
        } catch (e) { console.warn(e); }
    };

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const queryParams = new URLSearchParams();
            if (filters.batch) queryParams.append('filter_batch', filters.batch);
            if (filters.course) queryParams.append('filter_course', filters.course);
            if (filters.branch) queryParams.append('filter_branch', filters.branch);
            if (filters.year) queryParams.append('filter_year', filters.year);
            if (filters.semester) queryParams.append('filter_semester', filters.semester);
            if (searchTerm) queryParams.append('search', searchTerm);

            queryParams.append('page', currentPage);
            queryParams.append('limit', pageSize);
            queryParams.append('filter_student_status', 'Regular');

            const response = await api.get(`/students?${queryParams.toString()}`);
            if (response.data?.success) {
                setStudents(response.data.data || []);
                setTotalStudents(response.data.pagination?.total || 0);
                setTotalPages(response.data.pagination?.pages || 0);
            }
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
        setSelectedAdmissionNumbers(new Set()); // Clear selection on filter change safety
    };

    const handleTargetChange = (key, value) => {
        setTargetDetails(prev => {
            const next = { ...prev, [key]: value };
            // Clear dependents
            if (key === 'batch') { next.course = ''; next.branch = ''; next.year = ''; next.semester = ''; }
            if (key === 'course') { next.branch = ''; next.year = ''; next.semester = ''; }

            loadTargetOptions(next);
            return next;
        });
    };

    // Selection Logic
    const toggleSelectStudent = (id) => {
        const newSelected = new Set(selectedAdmissionNumbers);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedAdmissionNumbers(newSelected);
    };

    const toggleSelectAll = (checked) => {
        if (checked) {
            const allIds = students.map(s => s.admission_number);
            setSelectedAdmissionNumbers(new Set(allIds));
        } else {
            setSelectedAdmissionNumbers(new Set());
        }
    };

    const prepareTransferPlan = async () => {
        if (selectedAdmissionNumbers.size === 0) {
            toast.error('Select students to transfer');
            return;
        }
        if (!targetDetails.year || !targetDetails.semester) {
            toast.error('Select target Year and Semester');
            return;
        }

        setLoadingTransferPlan(true);

        // Check conflicts (students already in target?) - Simplified check via matching students
        // For manual transfer, we generally trust the admin knows what they are doing, but we can warn.

        // We'll proceed to show confirmation
        const plan = students
            .filter(s => selectedAdmissionNumbers.has(s.admission_number))
            .map(s => ({
                student: s,
                target: targetDetails,
                isCompatible: true // Assume compatible for manual override
            }));

        setTransferPlan(plan);
        setLoadingTransferPlan(false);
        setConfirmationOpen(true);
    };

    const executeTransfer = async () => {
        setSubmitting(true);
        try {
            const payload = {
                students: transferPlan.map(p => ({ admissionNumber: p.student.admission_number })),
                targetBatch: targetDetails.batch,
                targetCourse: targetDetails.course,
                targetBranch: targetDetails.branch,
                targetYear: targetDetails.year,
                targetSemester: targetDetails.semester,
                leftOutStudents: [] // If we implement left-out logic primarily for the filter matches not selected
            };

            const response = await api.post('/students/transfers/bulk', payload);
            if (response.data?.success) {
                setTransferResults(response.data.results);
                setTransferSummary(response.data.summary);
                toast.success('Transfer successful');
                setConfirmationOpen(false);
                fetchStudents(); // Refresh list
                setSelectedAdmissionNumbers(new Set());
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" /> College Transfer / Manual Promotion
                </h1>
                <p className="text-gray-600">Select students and transfer them to a specific academic stage manually.</p>
            </div>

            {/* Main Grid: Source & Target */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Source Selection */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                        <Filter size={18} /> Source Criteria (Find Students)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Batch</label>
                            <select
                                className="w-full mt-1 p-2 border rounded-lg text-sm"
                                value={filters.batch} onChange={e => handleFilterChange('batch', e.target.value)}
                            >
                                <option value="">All Batches</option>
                                {filterOptions.batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Course</label>
                            <select
                                className="w-full mt-1 p-2 border rounded-lg text-sm"
                                value={filters.course} onChange={e => handleFilterChange('course', e.target.value)}
                            >
                                <option value="">All Courses</option>
                                {filterOptions.courses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Branch</label>
                            <select
                                className="w-full mt-1 p-2 border rounded-lg text-sm"
                                value={filters.branch} onChange={e => handleFilterChange('branch', e.target.value)}
                            >
                                <option value="">All Branches</option>
                                {filterOptions.branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Current Year</label>
                            <select
                                className="w-full mt-1 p-2 border rounded-lg text-sm"
                                value={filters.year} onChange={e => handleFilterChange('year', e.target.value)}
                            >
                                <option value="">All Years</option>
                                {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Target Selection */}
                <div className="bg-indigo-50 p-5 rounded-xl shadow-sm border border-indigo-100 space-y-4">
                    <h3 className="font-semibold text-indigo-800 flex items-center gap-2 border-b border-indigo-200 pb-2">
                        <ArrowRight size={18} /> Target Destination (Transfer To)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-indigo-500 uppercase">Target Batch</label>
                            <select
                                className="w-full mt-1 p-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                value={targetDetails.batch} onChange={e => handleTargetChange('batch', e.target.value)}
                            >
                                <option value="">Select Batch</option>
                                {targetOptions.batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-indigo-500 uppercase">Target Course</label>
                            <select
                                className="w-full mt-1 p-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                value={targetDetails.course} onChange={e => handleTargetChange('course', e.target.value)}
                            >
                                <option value="">Select Course</option>
                                {targetOptions.courses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-indigo-500 uppercase">Target Branch</label>
                            <select
                                className="w-full mt-1 p-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                value={targetDetails.branch} onChange={e => handleTargetChange('branch', e.target.value)}
                            >
                                <option value="">Select Branch</option>
                                {targetOptions.branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-semibold text-indigo-500 uppercase">Target Year <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full mt-1 p-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    value={targetDetails.year} onChange={e => handleTargetChange('year', e.target.value)}
                                >
                                    <option value="">Select</option>
                                    {targetOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-indigo-500 uppercase">Target Sem <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full mt-1 p-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    value={targetDetails.semester} onChange={e => handleTargetChange('semester', e.target.value)}
                                >
                                    <option value="">Select</option>
                                    {targetOptions.semesters.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                    Selected <span className="font-bold text-gray-900">{selectedAdmissionNumbers.size}</span> students for transfer
                </div>
                <button
                    onClick={prepareTransferPlan}
                    disabled={selectedAdmissionNumbers.size === 0 || !targetDetails.year || !targetDetails.semester}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    Review & Transfer <ArrowRight size={16} />
                </button>
            </div>

            {/* Students Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loadingStudents ? (
                    <div className="p-8"><SkeletonTable rows={5} cols={6} /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                                <tr>
                                    <th className="p-4 w-10">
                                        <input type="checkbox"
                                            checked={students.length > 0 && selectedAdmissionNumbers.size >= students.length}
                                            onChange={e => toggleSelectAll(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="p-4">Admission No</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Current Batch/Course</th>
                                    <th className="p-4">Present Stage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.length === 0 ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-500">No students found. Adjust filters to search.</td></tr>
                                ) : students.map(student => (
                                    <tr key={student.admission_number} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <input type="checkbox"
                                                checked={selectedAdmissionNumbers.has(student.admission_number)}
                                                onChange={() => toggleSelectStudent(student.admission_number)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="p-4 font-medium">{student.admission_number}</td>
                                        <td className="p-4">{student.student_name}</td>
                                        <td className="p-4 text-gray-600">
                                            {student.batch} • {student.course} <br />
                                            <span className="text-xs text-gray-400">{student.branch}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                Year {student.current_year || 1} - Sem {student.current_semester || 1}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmationOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Confirm Transfer</h2>
                            <button onClick={() => setConfirmationOpen(false)}><X size={20} className="text-gray-500" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                <h4 className="font-semibold text-indigo-900 mb-2">Transfer Destination</h4>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <span className="text-indigo-600">Target Year/Sem:</span>
                                    <span className="font-medium">Year {targetDetails.year}, Semester {targetDetails.semester}</span>

                                    {targetDetails.course && (
                                        <>
                                            <span className="text-indigo-600">Course/Branch:</span>
                                            <span className="font-medium">{targetDetails.course} {targetDetails.branch ? `- ${targetDetails.branch}` : ''}</span>
                                        </>
                                    )}
                                    {targetDetails.batch && (
                                        <>
                                            <span className="text-indigo-600">Batch:</span>
                                            <span className="font-medium">{targetDetails.batch}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Students ({transferPlan.length})</h4>
                                <ul className="divide-y border rounded-lg max-h-40 overflow-y-auto">
                                    {transferPlan.map((item, idx) => (
                                        <li key={idx} className="p-3 text-sm flex justify-between">
                                            <span>{item.student.student_name}</span>
                                            <span className="text-gray-500">{item.student.admission_number}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmationOpen(false)}
                                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeTransfer}
                                disabled={submitting}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                            >
                                {submitting && <Loader2 size={16} className="animate-spin" />}
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
