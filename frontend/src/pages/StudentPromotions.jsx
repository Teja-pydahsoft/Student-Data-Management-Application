import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp,
  Filter,
  Users,
  CheckCircle,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowRight,
  X,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';
import { useStudents, useInvalidateStudents } from '../hooks/useStudents';

const DEFAULT_MAX_YEAR = 10;
const DEFAULT_SEMESTERS_PER_YEAR = 2;

const syncStageFields = (data = {}, year, semester) => {
  if (!year || !semester) {
    return { ...data };
  }
  return {
    ...data,
    current_year: Number(year),
    current_semester: Number(semester),
    'Current Academic Year': Number(year),
    'Current Semester': Number(semester)
  };
};

const StudentPromotions = () => {
  const [filters, setFilters] = useState({
    batch: '',
    course: '',
    branch: '',
    year: '',
    semester: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilterOptions, setQuickFilterOptions] = useState({
    batches: [],
    courses: [],
    branches: [],
    years: [],
    semesters: []
  });
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loadingPromotionPlan, setLoadingPromotionPlan] = useState(false);
  const [promotionResults, setPromotionResults] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [promotionPlan, setPromotionPlan] = useState([]);
  const [hasStageConflicts, setHasStageConflicts] = useState(false);
  const lastAutoSelectRef = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageSizeOptions = [10, 25, 50, 100];
  const invalidateStudents = useInvalidateStudents();

  const selectedCount = selectedAdmissionNumbers.size;

  useEffect(() => {
    fetchQuickFilterOptions();
  }, []);

  // Fetch filter options with cascading filters
  useEffect(() => {
    fetchQuickFilterOptions(filters);
  }, [filters.batch, filters.course]);

  const fetchQuickFilterOptions = async (currentFilters = {}) => {
    setLoadingFilters(true);
    try {
      // Build query params from current filters for cascading
      const params = new URLSearchParams();
      if (currentFilters.batch) params.append('batch', currentFilters.batch);
      if (currentFilters.course) params.append('course', currentFilters.course);
      // Don't pass branch, year, semester to get all available options
      
      const queryString = params.toString();
      const url = `/attendance/filters${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      if (response.data?.success) {
        const data = response.data.data || {};
        setQuickFilterOptions({
          batches: data.batches || [],
          courses: data.courses || [],
          branches: data.branches || [],
          years: data.years || [],
          semesters: data.semesters || []
        });
      }
    } catch (error) {
      console.warn('Failed to load filter metadata:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [key]: value
      };
      
      // Clear dependent filters when parent filter changes
      if (key === 'batch') {
        // When batch changes, clear course and branch
        newFilters.course = '';
        newFilters.branch = '';
      } else if (key === 'course') {
        // When course changes, clear branch
        newFilters.branch = '';
      }
      
      // Reset to first page when filters change
      setCurrentPage(1);
      // Reset auto-select tracking
      lastAutoSelectRef.current = '';
      
      return newFilters;
    });
  };

  // Handle search term changes
  useEffect(() => {
    if (searchTerm.trim().length > 0 || hasActiveFilters) {
      setCurrentPage(1);
      lastAutoSelectRef.current = '';
    }
  }, [searchTerm]);

  const clearFilters = () => {
    setFilters({
      batch: '',
      course: '',
      branch: '',
      year: '',
      semester: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
    setSelectedAdmissionNumbers(new Set());
    setPromotionResults(null);
    lastAutoSelectRef.current = '';
  };

  // Use React Query to fetch paginated students with filters
  const hasActiveFilters = Object.values(filters).some(value => value) || searchTerm.trim().length > 0;
  const { 
    data: studentsData, 
    isLoading: loadingStudents, 
    isFetching: isFetchingStudents,
    refetch: refetchStudents 
  } = useStudents({
    page: currentPage,
    pageSize: pageSize,
    filters: {
      batch: filters.batch,
      course: filters.course,
      branch: filters.branch,
      year: filters.year,
      semester: filters.semester,
    },
    search: searchTerm.trim(),
    enabled: hasActiveFilters // Only fetch when filters or search are applied
  });

  const students = studentsData?.students || [];
  const totalStudents = studentsData?.pagination?.total || 0;
  const totalPages = studentsData?.pagination?.totalPages || 1;
  const isAllSelected = students.length > 0 && students.every(s => selectedAdmissionNumbers.has(s.admission_number));

  // Auto-select all students on current page when filters are first applied
  useEffect(() => {
    if (students.length > 0 && hasActiveFilters && currentPage === 1) {
      const currentPageIds = students.map((s) => s.admission_number);
      const currentPageIdsString = currentPageIds.sort().join(',');
      
      if (lastAutoSelectRef.current !== currentPageIdsString) {
        // Add current page students to selection (don't clear existing selections)
        setSelectedAdmissionNumbers(prev => {
          const updated = new Set(prev);
          currentPageIds.forEach(id => updated.add(id));
          return updated;
        });
        lastAutoSelectRef.current = currentPageIdsString;
      }
    }
  }, [students, hasActiveFilters, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) {
      return;
    }
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value, 10);
    if (Number.isNaN(newSize) || newSize <= 0 || newSize === pageSize) {
      return;
    }
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Select all students matching current filters (across all pages)
  const toggleSelectAllStudents = async (checked) => {
    if (checked) {
      // Fetch all students matching current filters to select them all
      try {
        const queryParams = new URLSearchParams();
        if (filters.batch) queryParams.append('filter_batch', filters.batch);
        if (filters.course) queryParams.append('filter_course', filters.course);
        if (filters.branch) queryParams.append('filter_branch', filters.branch);
        if (filters.year) queryParams.append('filter_year', filters.year);
        if (filters.semester) queryParams.append('filter_semester', filters.semester);
        if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());
        queryParams.append('limit', 'all'); // Fetch all matching students
        
        const response = await api.get(`/students?${queryParams.toString()}`);
        const allStudents = response.data?.data || [];
        const allAdmissionNumbers = allStudents.map(s => s.admission_number);
        setSelectedAdmissionNumbers(new Set(allAdmissionNumbers));
        toast.success(`Selected all ${allAdmissionNumbers.length} students matching filters`);
      } catch (error) {
        // Fallback: select all from current page if fetch fails
        setSelectedAdmissionNumbers(prev => {
          const updated = new Set(prev);
          students.forEach(s => updated.add(s.admission_number));
          return updated;
        });
        toast.error('Failed to select all students. Selected current page only.');
      }
    } else {
      // Clear all selections
      setSelectedAdmissionNumbers(new Set());
    }
  };

  const toggleSelectStudent = (admissionNumber) => {
    setSelectedAdmissionNumbers((prev) => {
      const updated = new Set(prev);
      if (updated.has(admissionNumber)) {
        updated.delete(admissionNumber);
      } else {
        updated.add(admissionNumber);
      }
      return updated;
    });
  };

  const getStudentName = (student) => {
    const data = student.student_data;
    if (data && typeof data === 'object') {
      const nameKey = Object.keys(data).find((key) => {
        const lower = key.toLowerCase();
        return lower === 'name' || lower.includes('student name');
      });
      if (nameKey && data[nameKey]) {
        return data[nameKey];
      }
    }
    return student.student_name || '-';
  };

  const promotionSummary = useMemo(() => {
    if (!promotionResults || !Array.isArray(promotionResults)) {
      return null;
    }
    return promotionResults.reduce(
      (acc, result) => {
        if (result.status === 'success') acc.success += 1;
        else if (result.status === 'skipped') acc.skipped += 1;
        else acc.errors += 1;
        return acc;
      },
      { success: 0, skipped: 0, errors: 0 }
    );
  }, [promotionResults]);

  const getCurrentStageFromStudent = (student) => {
    if (!student) {
      return null;
    }

    const data = student.student_data || {};
    const year =
      Number(student.current_year) ||
      Number(data.current_year) ||
      Number(data['Current Academic Year']);
    const semester =
      Number(student.current_semester) ||
      Number(data.current_semester) ||
      Number(data['Current Semester']);

    if (!Number.isFinite(year) || !Number.isFinite(semester)) {
      return null;
    }

    return { year, semester };
  };

  const getNextStage = (year, semester) => {
    const normalizedYear = Number(year);
    const normalizedSemester = Number(semester);

    if (
      !Number.isInteger(normalizedYear) ||
      !Number.isInteger(normalizedSemester) ||
      normalizedYear < 1 ||
      normalizedSemester < 1
    ) {
      return null;
    }

    if (normalizedSemester < DEFAULT_SEMESTERS_PER_YEAR) {
      return {
        year: normalizedYear,
        semester: normalizedSemester + 1
      };
    }

    if (normalizedYear >= DEFAULT_MAX_YEAR) {
      return null;
    }

    return {
      year: normalizedYear + 1,
      semester: 1
    };
  };

  const handlePromoteSelected = async () => {
    if (selectedAdmissionNumbers.size === 0) {
      toast.error('Select at least one student to promote');
      return;
    }

    // Fetch student data for all selected admission numbers (they might be on different pages)
    const selectedIds = Array.from(selectedAdmissionNumbers);
    setLoadingPromotionPlan(true);
    
    try {
      // Fetch all selected students in parallel to get their current stage info
      const studentPromises = selectedIds.map(async (admissionNumber) => {
        try {
          const response = await api.get(`/students/${admissionNumber}`);
          return response.data?.data;
        } catch (error) {
          console.warn(`Failed to fetch student ${admissionNumber}:`, error);
          return null;
        }
      });

      const fetchedStudents = await Promise.all(studentPromises);
      const studentMap = new Map();
      fetchedStudents.forEach((student, index) => {
        if (student) {
          studentMap.set(selectedIds[index], student);
        }
      });

      // Create promotion plan with fetched student data
      const plan = selectedIds.map((admissionNumber) => {
        const student = studentMap.get(admissionNumber) || students.find((s) => s.admission_number === admissionNumber);
        const currentStage = student ? getCurrentStageFromStudent(student) : null;
        const nextStage = currentStage ? getNextStage(currentStage.year, currentStage.semester) : null;

        const issues = [];

        if (!student) {
          issues.push('Student record not found');
        } else if (!currentStage) {
          issues.push('Missing current academic stage');
        } else if (!nextStage) {
          issues.push('Student is already at the final configured stage');
        }

        // Check conflicts with all fetched students
        let hasConflict = false;
        if (nextStage && student) {
          hasConflict = Array.from(studentMap.values()).some(
            (candidate) =>
              candidate.admission_number !== admissionNumber &&
              Number(candidate.current_year) === Number(nextStage.year) &&
              Number(candidate.current_semester) === Number(nextStage.semester)
          );
        }

        return {
          admissionNumber,
          studentName: student ? getStudentName(student) : 'Unknown',
          currentStage,
          nextStage,
          issues,
          hasConflict
        };
      });

      setPromotionPlan(plan);
      setHasStageConflicts(plan.some((item) => item.hasConflict));
      setConfirmationOpen(true);
    } catch (error) {
      toast.error('Failed to load student data for promotion plan');
      console.error('Error fetching students for promotion:', error);
    } finally {
      setLoadingPromotionPlan(false);
    }
  };

  const executePromotion = async () => {
    const promotableStudents = promotionPlan.filter(
      (item) => item.nextStage && item.issues.length === 0
    );

    if (promotableStudents.length === 0) {
      toast.error('No eligible students to promote');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/students/promotions/bulk', {
        students: promotableStudents.map((item) => ({ admissionNumber: item.admissionNumber }))
      });

      const results = response.data?.results || [];
      setPromotionResults(results);

      const successCount = results.filter((result) => result.status === 'success').length;
      if (successCount > 0) {
        toast.success(`Successfully promoted ${successCount} student${successCount === 1 ? '' : 's'}`);
        // Invalidate cache to refetch updated student data
        invalidateStudents();
        // Clear selections after successful promotion
        setSelectedAdmissionNumbers(new Set());
        // Reset to first page
        setCurrentPage(1);
      } else {
        toast.error('No students were promoted');
      }
      setConfirmationOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to promote students');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 heading-font flex items-center gap-3">
            <TrendingUp className="text-indigo-600" size={28} />
            Student Promotions
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchQuickFilterOptions}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
            disabled={loadingFilters}
          >
            {loadingFilters ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh Options
          </button>
        </div>
      </div>

      {/* Filter Card with Inline Promotion Review */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter size={18} />
          <h2 className="text-lg font-semibold">Promotion Criteria</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Batch</label>
            <select
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Batches</option>
              {(quickFilterOptions.batches || []).map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Course</label>
            <select
              value={filters.course}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              disabled={!filters.batch}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">All Courses</option>
              {(quickFilterOptions.courses || []).map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              disabled={!filters.course}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">All Branches</option>
              {(quickFilterOptions.branches || []).map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Current Year
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Years</option>
              {(quickFilterOptions.years || []).map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Current Semester
            </label>
            <select
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Semesters</option>
              {(quickFilterOptions.semesters || []).map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Promotion Review Inline */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Promotion Review</h3>
                <p className="text-xs text-gray-600">
                  Selected {selectedCount} of {totalStudents.toLocaleString()} student{totalStudents === 1 ? '' : 's'}
                  {totalStudents > 0 && selectedCount > 0 && (
                    <span className="ml-1 text-gray-500">
                      ({students.filter(s => selectedAdmissionNumbers.has(s.admission_number)).length} visible on this page)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => toggleSelectAllStudents(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={totalStudents === 0 || loadingStudents}
                title="Select all students matching current filters (across all pages)"
              >
                Select All ({totalStudents.toLocaleString()})
              </button>
              <button
                onClick={() => setSelectedAdmissionNumbers(new Set())}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={selectedCount === 0}
              >
                Clear Selection
              </button>
              <button
                onClick={handlePromoteSelected}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-transform hover:-translate-y-0.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={selectedCount === 0 || submitting || loadingPromotionPlan}
              >
                {loadingPromotionPlan ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Loading Plan...
                  </>
                ) : submitting ? (
                  'Promoting...'
                ) : (
                  'Promote Selected'
                )}
              </button>
            </div>
          </div>

          {promotionSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2 text-sm">
                <CheckCircle size={16} />
                <span>Promoted: {promotionSummary.success}</span>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-3 py-2 text-sm">
                <RefreshCw size={16} />
                <span>Skipped: {promotionSummary.skipped}</span>
              </div>
              <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">
                <AlertTriangle size={16} />
                <span>Errors: {promotionSummary.errors}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Adjust the filters to refresh the matching students automatically.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(1);
                  }
                }}
                placeholder="Search by name or PIN number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none"
              />
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm whitespace-nowrap"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Matched Students</h2>
            <p className="text-sm text-gray-600">
              Review the students that match the current criteria and choose who to promote.
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Total: {totalStudents.toLocaleString()} student{totalStudents === 1 ? '' : 's'}
            {totalStudents > 0 && (
              <span className="ml-2 text-gray-500">
                (Showing {((currentPage - 1) * pageSize + 1).toLocaleString()}-{Math.min(currentPage * pageSize, totalStudents).toLocaleString()})
              </span>
            )}
          </div>
        </div>

        {(loadingStudents || isFetchingStudents) ? (
          <div className="py-12 flex flex-col items-center justify-center text-sm text-gray-600 gap-3">
            <LoadingAnimation width={32} height={32} showMessage={false} />
            {loadingStudents ? 'Loading student list...' : 'Refreshing...'}
          </div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg">
            Adjust the filters to find the students you want to promote.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => toggleSelectAllStudents(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Admission Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      PIN Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Student Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Semester
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => {
                    const admissionNumber = student.admission_number;
                    const isSelected = selectedAdmissionNumbers.has(admissionNumber);
                    return (
                      <tr
                        key={admissionNumber}
                        className={isSelected ? 'bg-indigo-50/40' : 'bg-white'}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStudent(admissionNumber)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-medium">{student.batch || '-'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {admissionNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.pin_no ? (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium">
                              {student.pin_no}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {getStudentName(student)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-medium">
                          {student.course || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="text-xs uppercase tracking-wide">
                            {student.branch || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.current_year || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.current_semester || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalStudents > 0 && (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-4 py-4 border-t border-gray-100 mt-4">
                <div className="text-sm text-gray-600">
                  {totalStudents === 0
                    ? 'No students to display'
                    : `Showing ${((currentPage - 1) * pageSize + 1).toLocaleString()}-${Math.min(currentPage * pageSize, totalStudents).toLocaleString()} of ${totalStudents.toLocaleString()}`}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    Rows per page
                    <select
                      value={pageSize}
                      onChange={handlePageSizeChange}
                      className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      disabled={loadingStudents || isFetchingStudents}
                    >
                      {pageSizeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || loadingStudents || isFetchingStudents || totalStudents === 0}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {Math.min(currentPage, totalPages).toLocaleString()} of {totalPages.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || loadingStudents || isFetchingStudents || totalStudents === 0}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {promotionResults && promotionResults.length > 0 && (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Latest Promotion Results</h3>
                </div>
                <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {promotionResults.map((result, index) => {
                    const isSuccess = result.status === 'success';
                    const isSkipped = result.status === 'skipped';
                    const statusColor = isSuccess
                      ? 'text-green-700'
                      : isSkipped
                        ? 'text-amber-700'
                        : 'text-red-700';
                    const statusBg = isSuccess
                      ? 'bg-green-50 border-green-100'
                      : isSkipped
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-red-50 border-red-100';
                    return (
                      <li
                        key={`${result.admissionNumber || index}-${result.status}`}
                        className={`px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-l-4 ${statusBg}`}
                      >
                        <div className="flex items-center gap-3">
                          {isSuccess ? (
                            <CheckCircle size={18} className="text-green-600" />
                          ) : isSkipped ? (
                            <RefreshCw size={18} className="text-amber-600" />
                          ) : (
                            <AlertTriangle size={18} className="text-red-600" />
                          )}
                          <div>
                            <p className={`font-semibold ${statusColor}`}>
                              {result.admissionNumber || 'Unknown admission number'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {isSuccess
                                ? `Updated to Year ${result.currentYear}, Semester ${result.currentSemester}`
                                : result.message || 'No additional details provided.'}
                            </p>
                          </div>
                        </div>
                        <div className={`text-xs font-semibold uppercase ${statusColor}`}>
                          {result.status}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {confirmationOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Confirm Promotion</h3>
                  <p className="text-sm text-indigo-100 mt-0.5">
                    Review the promotion plan before proceeding
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmationOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {hasStageConflicts && (
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Stage Conflicts Detected</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Some selected students already have peers in the target stage. Please review carefully before proceeding.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      Promotion Summary
                    </h4>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                      {promotionPlan.filter(item => item.nextStage && item.issues.length === 0).length} Eligible
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100/80 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Admission No
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Student Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Current Stage
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Next Stage
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {promotionPlan.map((item) => {
                        const isEligible = item.nextStage && item.issues.length === 0;
                        const issueText = item.issues.filter(Boolean).join(', ');
                        const conflictText = item.hasConflict
                          ? 'Target stage already contains students'
                          : '';
                        const noteText = [issueText, conflictText].filter(Boolean).join('. ');
                        return (
                          <tr 
                            key={item.admissionNumber} 
                            className={`transition-colors ${
                              isEligible 
                                ? 'hover:bg-indigo-50/50' 
                                : 'bg-red-50/30 hover:bg-red-50/50'
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                              {item.admissionNumber}
                            </td>
                            <td className="px-4 py-3 text-gray-800 font-medium">
                              {item.studentName || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {item.currentStage ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold">
                                  Year {item.currentStage.year} • Sem {item.currentStage.semester}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item.nextStage ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                  <ArrowRight size={14} className="text-indigo-600" />
                                  Year {item.nextStage.year} • Sem {item.nextStage.semester}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200 text-xs font-semibold">
                                  Not eligible
                                </span>
                              )}
                              {noteText && (
                                <p className="mt-1.5 text-xs text-gray-500 italic">{noteText}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isEligible ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                  <CheckCircle size={14} />
                                  Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                  <AlertTriangle size={14} />
                                  Issue
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <CheckCircle className="text-blue-600" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Promotion Notice</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Only students marked as eligible will be promoted. Others will remain unchanged.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setConfirmationOpen(false)}
                  className="px-5 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={executePromotion}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold shadow-lg hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Promoting...
                    </span>
                  ) : (
                    'Confirm Promotion'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPromotions;

