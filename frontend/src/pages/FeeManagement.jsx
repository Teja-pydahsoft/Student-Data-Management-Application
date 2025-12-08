import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Settings,
  Plus,
  Edit2,
  X,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStaticFileUrlDirect } from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
import useAuthStore from '../store/authStore';
import { isFullAccessRole } from '../constants/rbac';

const FeeManagement = () => {
  const [filters, setFilters] = useState({
    batch: '',
    course: '',
    branch: '',
    college: '',
    feeHeaderId: '', // New: selected fee header filter
    studentName: '',
    parentMobile: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    batches: [],
    courses: [],
    branches: [],
    colleges: []
  });
  const [coursesWithBranches, setCoursesWithBranches] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeHeaders, setFeeHeaders] = useState([]);
  const [yearSemColumns, setYearSemColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { studentId, yearSemKey, feeHeaderId }
  const [cellValue, setCellValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalStudents, setTotalStudents] = useState(0);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editingFees, setEditingFees] = useState({});
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [feeHeadersForConfig, setFeeHeadersForConfig] = useState([]);
  const [editingHeaderId, setEditingHeaderId] = useState(null);
  const [newHeader, setNewHeader] = useState({ header_name: '', description: '', is_active: true });
  const searchEffectInitialized = useRef(false);
  
  // Cache for students data
  const studentsCache = useRef(new Map());
  const cacheKey = useRef('');

  const user = useAuthStore((state) => state.user);
  const isAdmin = isFullAccessRole(user?.role);

  // Filter branches based on selected course
  const availableBranches = useMemo(() => {
    if (!filters.course) {
      return filterOptions.branches;
    }
    const selectedCourse = coursesWithBranches.find(c => c.name === filters.course);
    if (!selectedCourse || !selectedCourse.branches) {
      return [];
    }
    const branchNames = [...new Set(selectedCourse.branches.map(b => b.name))];
    return branchNames.filter(name => filterOptions.branches.includes(name));
  }, [filters.course, coursesWithBranches, filterOptions.branches]);

  // Pagination calculations
  const safePageSize = pageSize || 1;
  const totalPages = totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / safePageSize)) : 1;
  const showingFrom = totalStudents === 0 ? 0 : Math.min((currentPage - 1) * safePageSize + 1, totalStudents);
  const showingTo = totalStudents === 0 ? 0 : Math.min(totalStudents, showingFrom + Math.max(students.length - 1, 0));
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const loadFilterOptions = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.college) params.append('college', filters.college);

      const [filtersResponse, coursesResponse] = await Promise.all([
        api.get(`/fees/filters?${params.toString()}`),
        api.get('/courses', { params: { includeInactive: false } })
      ]);

      if (filtersResponse.data?.success) {
        const data = filtersResponse.data.data || {};
        setFilterOptions({
          batches: data.batches || [],
          courses: data.courses || [],
          branches: data.branches || [],
          colleges: data.colleges || []
        });
      }

      if (coursesResponse.data?.success) {
        setCoursesWithBranches(coursesResponse.data.data || []);
      }
    } catch (error) {
      console.warn('Unable to load fee filter options', error);
    }
  };

  const loadFeeHeaders = async () => {
    try {
      const response = await api.get('/fees/headers');
      if (response.data?.success) {
        setFeeHeaders(response.data.data || []);
        setFeeHeadersForConfig(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load fee headers:', error);
      toast.error('Failed to load fee headers');
    }
  };

  const loadStudents = async (pageOverride = null, useCache = true) => {
    setLoading(true);
    try {
      const pageToUse = pageOverride !== null ? pageOverride : currentPage;
      const params = new URLSearchParams();

      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.college) params.append('college', filters.college);
      // Fee header is required - always include it if selected
      if (filters.feeHeaderId) {
        params.append('feeHeaderId', filters.feeHeaderId);
      }
      if (filters.studentName) params.append('studentName', filters.studentName.trim());
      if (filters.parentMobile) params.append('parentMobile', filters.parentMobile.trim());

      // Build cache key
      const cacheKeyStr = params.toString() + `_page_${pageToUse}_size_${pageSize}`;
      
      // Check cache first
      if (useCache && studentsCache.current.has(cacheKeyStr)) {
        const cached = studentsCache.current.get(cacheKeyStr);
        setStudents(cached.students);
        setTotalStudents(cached.totalStudents);
        setLoading(false);
        return;
      }

      // Always use pagination when fee header is selected
      // Otherwise, use pagination only when no basic filters are applied
      const hasBasicFilters = !!(filters.batch || filters.course || filters.branch || filters.college);
      
      if (filters.feeHeaderId) {
        // Always paginate when fee header is selected
        params.append('limit', pageSize.toString());
        params.append('offset', ((pageToUse - 1) * pageSize).toString());
      } else if (hasBasicFilters) {
        // Load all when basic filters are applied (but no fee header)
        params.append('limit', '10000');
        params.append('offset', '0');
      } else {
        // Use pagination when no filters
        params.append('limit', pageSize.toString());
        params.append('offset', ((pageToUse - 1) * pageSize).toString());
      }

      const response = await api.get(`/fees/students?${params.toString()}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch students');
      }

      const data = response.data.data || {};
      setStudents(data.students || []);
      setTotalStudents(data.totalStudents || 0);

      // Cache the result
      studentsCache.current.set(cacheKeyStr, {
        students: data.students || [],
        totalStudents: data.totalStudents || 0,
        timestamp: Date.now()
      });

      // Limit cache size to 50 entries
      if (studentsCache.current.size > 50) {
        const firstKey = studentsCache.current.keys().next().value;
        studentsCache.current.delete(firstKey);
      }

      // Always update fee headers from response to ensure dropdown has options
      if (data.feeHeaders && Array.isArray(data.feeHeaders)) {
        // Backend returns headerName in response
        const formattedHeaders = data.feeHeaders.map(h => ({
          id: h.id,
          header_name: h.headerName || h.header_name,
          headerName: h.headerName || h.header_name,
          description: h.description || '',
          is_active: h.is_active !== false && h.is_active !== 0 && h.is_active !== '0'
        }));
        setFeeHeaders(formattedHeaders);
      }

      // Update year-semester columns
      if (data.yearSemColumns && data.yearSemColumns.length > 0) {
        setYearSemColumns(data.yearSemColumns);
      }
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to load students');
    } finally {
      setLoading(false);
    }
  };

  // Load fee headers on mount
  useEffect(() => {
    loadFeeHeaders();
  }, []);

  // Load filter options when filters change
  useEffect(() => {
    loadFilterOptions();
  }, [filters.batch, filters.course, filters.branch, filters.college]);

  useEffect(() => {
    setCurrentPage(1);
    // Clear cache when filters change
    studentsCache.current.clear();
    loadStudents(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.batch,
    filters.course,
    filters.branch,
    filters.college,
    filters.feeHeaderId,
    pageSize
  ]);

  useEffect(() => {
    if (!searchEffectInitialized.current) {
      searchEffectInitialized.current = true;
      return;
    }

    setCurrentPage(1);
    const handle = setTimeout(() => {
      loadStudents(1);
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.studentName, filters.parentMobile]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [field]: value
      };
      if (field === 'course') {
        newFilters.branch = '';
      }
      return newFilters;
    });
  };

  const handleClearFilters = () => {
    setFilters({
      batch: '',
      course: '',
      branch: '',
      college: '',
      feeHeaderId: '',
      currentYear: '',
      currentSemester: '',
      studentName: '',
      parentMobile: ''
    });
    studentsCache.current.clear();
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (loading || newPage === currentPage || newPage < 1 || newPage > totalPages) {
      return;
    }
    setCurrentPage(newPage);
    loadStudents(newPage, true); // Use cache for pagination
  };

  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value, 10);
    if (Number.isNaN(newSize) || newSize <= 0 || newSize === pageSize) {
      return;
    }
    setCurrentPage(1);
    setPageSize(newSize);
  };

  // Inline cell editing handlers
  const handleCellClick = (studentId, yearSemKey, feeHeaderId) => {
    if (!filters.feeHeaderId) {
      toast.error('Please select a fee header first');
      return;
    }
    const student = students.find(s => s.id === studentId);
    if (!student || !student.yearSemFees) return;
    
    const yearSemData = student.yearSemFees[yearSemKey];
    if (!yearSemData) return;
    
    const fee = yearSemData.fees[feeHeaderId] || {};
    setEditingCell({ studentId, yearSemKey, feeHeaderId, year: yearSemData.year, semester: yearSemData.semester });
    setCellValue(fee.amount || '');
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;
    
    const { studentId, yearSemKey, feeHeaderId, year, semester } = editingCell;
    const newAmount = parseFloat(cellValue) || 0;
    
    // Don't save if value hasn't changed
    const student = students.find(s => s.id === studentId);
    const yearSemData = student?.yearSemFees?.[yearSemKey];
    const currentFee = yearSemData?.fees[feeHeaderId] || {};
    if (currentFee.amount === newAmount) {
      setEditingCell(null);
      setCellValue('');
      return;
    }
    
    setSaving(true);
    try {
      // Prepare fee update with year and semester
      const feesArray = [{
        feeHeaderId: feeHeaderId,
        amount: newAmount,
        paidAmount: currentFee.paidAmount || 0,
        dueDate: currentFee.dueDate || null,
        paymentDate: currentFee.paymentDate || null,
        paymentStatus: currentFee.paymentStatus || 'pending',
        remarks: currentFee.remarks || null
      }];

      const response = await api.post(`/fees/students/${studentId}`, {
        studentId,
        fees: feesArray,
        year,
        semester
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to save fee');
      }

      toast.success('Fee updated successfully');
      setEditingCell(null);
      setCellValue('');
      // Clear cache and reload
      studentsCache.current.clear();
      await loadStudents(currentPage, false);
    } catch (error) {
      console.error('Failed to save fee:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to save fee');
      setEditingCell(null);
      setCellValue('');
    } finally {
      setSaving(false);
    }
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setCellValue('');
    }
  };

  const handleOpenConfigModal = () => {
    loadFeeHeaders();
    setConfigModalOpen(true);
  };

  const handleCloseConfigModal = () => {
    setConfigModalOpen(false);
    setEditingHeaderId(null);
    setNewHeader({ header_name: '', description: '', is_active: true });
  };

  const handleCreateHeader = async () => {
    if (!newHeader.header_name.trim()) {
      toast.error('Fee header name is required');
      return;
    }

    try {
      const response = await api.post('/fees/headers', newHeader);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to create fee header');
      }

      toast.success('Fee header created successfully');
      setNewHeader({ header_name: '', description: '', is_active: true });
      await loadFeeHeaders();
      await loadStudents(currentPage);
    } catch (error) {
      console.error('Failed to create fee header:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to create fee header');
    }
  };

  const handleEditHeader = (header) => {
    setEditingHeaderId(header.id);
    setNewHeader({
      header_name: header.header_name,
      description: header.description || '',
      is_active: header.is_active !== false
    });
  };

  const handleUpdateHeader = async () => {
    if (!newHeader.header_name.trim()) {
      toast.error('Fee header name is required');
      return;
    }

    try {
      const response = await api.put(`/fees/headers/${editingHeaderId}`, newHeader);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update fee header');
      }

      toast.success('Fee header updated successfully');
      setEditingHeaderId(null);
      setNewHeader({ header_name: '', description: '', is_active: true });
      await loadFeeHeaders();
      await loadStudents(currentPage);
    } catch (error) {
      console.error('Failed to update fee header:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to update fee header');
    }
  };

  const handleDeleteHeader = async (headerId) => {
    if (!window.confirm('Are you sure you want to delete this fee header? This action cannot be undone if there are associated student fees.')) {
      return;
    }

    try {
      const response = await api.delete(`/fees/headers/${headerId}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to delete fee header');
      }

      toast.success('Fee header deleted successfully');
      await loadFeeHeaders();
      await loadStudents(currentPage);
    } catch (error) {
      console.error('Failed to delete fee header:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to delete fee header');
    }
  };

  const renderPhoto = (student) => {
    if (student.studentPhoto) {
      const src = student.studentPhoto.startsWith('data:')
        ? student.studentPhoto
        : getStaticFileUrlDirect(student.studentPhoto);
      return (
        <img
          src={src}
          alt={student.studentName || 'Student'}
          className="w-10 h-10 rounded-full object-cover border border-gray-200"
        />
      );
    }

    const initials = (student.studentName || 'NA')
      .split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
        {initials || 'NA'}
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full bg-green-100 p-2 sm:p-3 text-green-600 flex-shrink-0">
            <DollarSign size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 heading-font">Fee Management</h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Manage student fees by college, course, branch, year, and semester.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenConfigModal}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <Settings size={16} />
            Configure
          </button>
          <button
            type="button"
            onClick={() => loadStudents(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Filters Section */}
      <section className="bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-600 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {/* Fee Header - First Position (Required) */}
            <select
              value={filters.feeHeaderId}
              onChange={(e) => handleFilterChange('feeHeaderId', e.target.value)}
              className="w-full rounded-md border-2 border-blue-400 bg-blue-50 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px] font-semibold text-blue-900"
              required
            >
              <option value="">Select Fee Header *</option>
              {feeHeaders && feeHeaders.length > 0 ? (
                feeHeaders
                  .filter(h => h.is_active !== false && h.is_active !== 0 && h.is_active !== '0')
                  .map((header) => (
                    <option key={header.id} value={String(header.id)}>
                      {header.header_name || header.headerName || `Header ${header.id}`}
                    </option>
                  ))
              ) : (
                <option value="" disabled>Loading fee headers...</option>
              )}
            </select>
            {filterOptions.colleges.length > 0 && (
              <select
                value={filters.college}
                onChange={(e) => handleFilterChange('college', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              >
                <option value="">All Colleges</option>
                {filterOptions.colleges.map((college) => (
                  <option key={college} value={college}>
                    {college}
                  </option>
                ))}
              </select>
            )}
            <select
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Batches</option>
              {filterOptions.batches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
            <select
              value={filters.course}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Courses</option>
              {filterOptions.courses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px] disabled:opacity-50"
              disabled={filters.course && availableBranches.length === 0}
            >
              <option value="">All Branches</option>
              {availableBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name..."
                value={filters.studentName}
                onChange={(e) => handleFilterChange('studentName', e.target.value)}
                className="w-full pl-10 rounded-md border border-gray-300 px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              />
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by parent mobile..."
                value={filters.parentMobile}
                onChange={(e) => handleFilterChange('parentMobile', e.target.value)}
                className="w-full pl-10 rounded-md border border-gray-300 px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        </div>
      </section>

      {/* Students Table */}
      <section className="bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <LoadingAnimation />
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
            <p>No students found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      PIN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Branch
                    </th>
                    {!filters.feeHeaderId ? (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-red-600 uppercase tracking-wider bg-red-50" colSpan={yearSemColumns.length}>
                        Please select a fee header to view fees
                      </th>
                    ) : (
                      yearSemColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-50 border border-blue-200 min-w-[100px]"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">{col.label}</span>
                            <span className="text-[10px] font-normal text-gray-600 mt-0.5">
                              {feeHeaders.find(h => h.id === parseInt(filters.feeHeaderId))?.header_name || feeHeaders.find(h => h.id === parseInt(filters.feeHeaderId))?.headerName || 'Fee'}
                            </span>
                          </div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {renderPhoto(student)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{student.studentName}</div>
                            <div className="text-xs text-gray-500">
                              {student.parentMobile1 || student.parentMobile2 || 'No contact'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.pinNumber || 'N/A'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.batch || 'N/A'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.course || 'N/A'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.branch || 'N/A'}</td>
                      {!filters.feeHeaderId ? (
                        <td className="px-4 py-3 text-center text-sm text-gray-500" colSpan={yearSemColumns.length}>
                          Select a fee header to view and edit fees
                        </td>
                      ) : (
                        yearSemColumns.map((col) => {
                          const yearSemData = student.yearSemFees?.[col.key];
                          const fee = yearSemData?.fees[parseInt(filters.feeHeaderId)] || {};
                          const isEditing = editingCell?.studentId === student.id && 
                                           editingCell?.yearSemKey === col.key && 
                                           editingCell?.feeHeaderId === parseInt(filters.feeHeaderId);
                          
                          return (
                            <td
                              key={col.key}
                              className="px-2 py-2 text-center border border-gray-200 hover:bg-blue-50 transition-colors cursor-pointer"
                              onClick={() => handleCellClick(student.id, col.key, parseInt(filters.feeHeaderId))}
                            >
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={cellValue}
                                  onChange={(e) => setCellValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  className="w-full px-2 py-1 text-sm text-center border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  disabled={saving}
                                />
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(fee.amount || 0)}
                                  </div>
                                  {fee.paidAmount > 0 && (
                                    <div className="text-xs text-green-600">
                                      Paid: {formatCurrency(fee.paidAmount)}
                                    </div>
                                  )}
                                  {fee.amount > 0 && fee.paidAmount < fee.amount && (
                                    <div className="text-xs text-red-600 font-medium">
                                      Due: {formatCurrency((fee.amount || 0) - (fee.paidAmount || 0))}
                                    </div>
                                  )}
                                  {fee.amount === 0 && (
                                    <div className="text-xs text-gray-400 italic">Click to add</div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(filters.feeHeaderId || (!filters.batch && !filters.course && !filters.branch && !filters.college)) && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Showing {showingFrom} to {showingTo} of {totalStudents} students
                  </span>
                  <select
                    value={pageSize}
                    onChange={handlePageSizeChange}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={isFirstPage || loading}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={isLastPage || loading}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Edit Student Fees Modal */}
      {editingStudentId && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelEdit();
            }
          }}
        >
          <div
            className="w-full max-w-4xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Fees - {students.find(s => s.id === editingStudentId)?.studentName}
              </h3>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {feeHeaders.map((header) => {
                const fee = editingFees[header.id] || {};
                return (
                  <div key={header.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900">{header.header_name || header.headerName}</h4>
                    {header.description && (
                      <p className="text-sm text-gray-600">{header.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={fee.amount || 0}
                          onChange={(e) => handleFeeChange(header.id, 'amount', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={fee.paidAmount || 0}
                          onChange={(e) => handleFeeChange(header.id, 'paidAmount', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={fee.dueDate || ''}
                          onChange={(e) => handleFeeChange(header.id, 'dueDate', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={fee.paymentDate || ''}
                          onChange={(e) => handleFeeChange(header.id, 'paymentDate', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
                        <select
                          value={fee.paymentStatus || 'pending'}
                          onChange={(e) => handleFeeChange(header.id, 'paymentStatus', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={fee.remarks || ''}
                          onChange={(e) => handleFeeChange(header.id, 'remarks', e.target.value)}
                          placeholder="Optional remarks"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveStudentFees(editingStudentId)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Fees'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fee Headers Configuration Modal */}
      {configModalOpen && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseConfigModal();
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Configure Fee Headers</h3>
              <button
                onClick={handleCloseConfigModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Add/Edit Header Form */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-gray-900">
                  {editingHeaderId ? 'Edit Fee Header' : 'Add New Fee Header'}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Header Name *</label>
                    <input
                      type="text"
                      value={newHeader.header_name}
                      onChange={(e) => setNewHeader({ ...newHeader, header_name: e.target.value })}
                      placeholder="e.g., Tuition Fee, Bus Fee"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newHeader.description}
                      onChange={(e) => setNewHeader({ ...newHeader, description: e.target.value })}
                      placeholder="Optional description"
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={newHeader.is_active}
                      onChange={(e) => setNewHeader({ ...newHeader, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingHeaderId && (
                      <button
                        onClick={() => {
                          setEditingHeaderId(null);
                          setNewHeader({ header_name: '', description: '', is_active: true });
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={editingHeaderId ? handleUpdateHeader : handleCreateHeader}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      {editingHeaderId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Headers List */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Existing Fee Headers</h4>
                <div className="space-y-2">
                  {feeHeadersForConfig.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No fee headers configured</p>
                  ) : (
                    feeHeadersForConfig.map((header) => (
                      <div
                        key={header.id}
                        className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{header.header_name || header.headerName}</span>
                            {!header.is_active && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          {header.description && (
                            <p className="text-sm text-gray-600 mt-1">{header.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditHeader(header)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteHeader(header.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FeeManagement;
