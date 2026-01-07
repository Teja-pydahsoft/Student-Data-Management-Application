import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Users as UsersIcon,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileText,
  BookOpen,
  Zap,
  Award,
  Search,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import RegistrationDownloadModal from '../components/Reports/RegistrationDownloadModal';
import api from '../config/api';

const EXCLUDED_COURSES = new Set(['M.Tech', 'MBA', 'MCA', 'M Sc Aqua', 'MSC Aqua', 'MCS', 'M.Pharma', 'M Pharma']);

const StatusBadge = ({ status, type = 'icon' }) => {
  const isCompleted = status === 'completed' || status === 'Verified' || status === 'No Due';
  const isPermitted = status === 'Permitted';
  const isPending = status === 'pending' || status === 'Unverified' || status === 'Pending';

  if (type === 'text') {
    let colorClass = 'bg-gray-100 text-gray-700'; // Default
    if (status === 'No Due' || status === 'Verified' || status === 'completed') colorClass = 'bg-green-100 text-green-700';
    else if (status === 'Permitted') colorClass = 'bg-orange-100 text-orange-700';
    else if (status === 'Unverified' || status === 'Pending' || status === 'pending') colorClass = 'bg-red-50 text-red-600';

    // Capitalize logical statuses for display if needed, but we expect backend to send nice text now for fee/certs
    // For icon types derived from 'completed'/'pending', we might get raw strings here to display.

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
        {status === 'completed' ? 'Completed' : status === 'pending' ? 'Pending' : status}
      </span>
    );
  }

  // Icon checks (strictly for 'completed' vs others logic usually)
  const isIconCompleted = status === 'completed';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isIconCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
      }`}>
      {isIconCompleted ? <CheckCircle size={12} /> : <Clock size={12} />}
      {isIconCompleted ? 'Completed' : 'Pending'}
    </span>
  );
};

const Reports = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalPages: 0,
    totalRecords: 0
  });
  const [stats, setStats] = useState(null);

  const [filters, setFilters] = useState({
    college: '',
    batch: '',
    course: '',
    branch: '',
    year: '',
    semester: '',
    search: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    colleges: [],
    batches: [],
    courses: [],
    branches: [],
    years: [],
    semesters: []
  });
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Debounced search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadReport = useCallback(
    async (overrideFilters) => {
      const activeFilters = overrideFilters ?? filters;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeFilters.college) params.append('filter_college', activeFilters.college);
        if (activeFilters.batch) params.append('filter_batch', activeFilters.batch);
        if (activeFilters.course) params.append('filter_course', activeFilters.course);
        if (activeFilters.branch) params.append('filter_branch', activeFilters.branch);
        if (activeFilters.year) params.append('filter_year', activeFilters.year);
        if (activeFilters.semester) params.append('filter_semester', activeFilters.semester);
        if (activeFilters.search) params.append('search', activeFilters.search);
        if (activeFilters.page) params.append('page', activeFilters.page);
        if (activeFilters.limit) params.append('limit', activeFilters.limit);

        const query = params.toString();
        const response = await api.get(`/students/reports/registration${query ? `?${query}` : ''}`);

        if (response.data?.success) {
          setReportData(response.data.data || []);
          if (response.data.pagination) {
            setPagination(prev => ({
              ...prev,
              page: parseInt(response.data.pagination.page),
              totalPages: parseInt(response.data.pagination.totalPages),
              totalRecords: parseInt(response.data.pagination.total),
              limit: parseInt(response.data.pagination.limit)
            }));
          }
          if (response.data.statistics) {
            setStats(response.data.statistics);
          }
        } else {
          throw new Error(response.data?.message || 'Unable to load reports');
        }
      } catch (error) {
        console.error('Failed to load registration report:', error);
        toast.error(
          error.response?.data?.message || error.message || 'Unable to load registration report'
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );
  const fetchFilterOptions = async (currentFilters = {}, excludeField = null) => {
    try {
      const params = new URLSearchParams();
      // Exclude the field being changed to show all available options
      if (currentFilters.college && excludeField !== 'college') params.append('college', currentFilters.college);
      if (currentFilters.batch && excludeField !== 'batch') params.append('batch', currentFilters.batch);
      // Include course only if course is not being changed and branch is not being changed
      if (currentFilters.course && excludeField !== 'course' && excludeField !== 'branch') params.append('course', currentFilters.course);
      if (currentFilters.branch && excludeField !== 'branch') params.append('branch', currentFilters.branch);

      const queryString = params.toString();
      const response = await api.get(`/students/quick-filters${queryString ? `?${queryString}` : ''}`);
      if (response.data?.success) {
        const data = response.data.data || {};
        setFilterOptions({
          colleges: data.colleges || [],
          batches: data.batches || [],
          courses: data.courses || [],
          branches: data.branches || [],
          years: data.years || [],
          semesters: data.semesters || []
        });
      }
    } catch (error) {
      console.warn('Failed to fetch filter options:', error);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Refresh filter options when parent filters change (for cascading)
  useEffect(() => {
    fetchFilterOptions(filters);
  }, [filters.college, filters.batch, filters.course, filters.branch]);

  useEffect(() => {
    loadReport({ ...filters, page: 1 });
  }, [filters, loadReport]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadReport({ ...filters, page: newPage });
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [field]: value || '' // Clear filter if empty value
      };

      // Remove empty filters
      if (!newFilters[field] || newFilters[field] === '') {
        delete newFilters[field];
      }

      // Clear dependent filters when parent filter changes
      if (field === 'college') {
        delete newFilters.course;
        delete newFilters.branch;
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'batch') {
        delete newFilters.course;
        delete newFilters.branch;
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'course') {
        delete newFilters.branch;
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'branch') {
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'year') {
        delete newFilters.semester;
      }

      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({
      college: '',
      batch: '',
      course: '',
      branch: '',
      year: '',
      semester: '',
      search: ''
    });
    setSearchTerm('');
  };

  const activeFilterEntries = useMemo(() => {
    const entries = [];
    if (filters.college) entries.push({ key: 'college', label: `College: ${filters.college}` });
    if (filters.batch) entries.push({ key: 'batch', label: `Batch: ${filters.batch}` });
    if (filters.course) entries.push({ key: 'course', label: `Course: ${filters.course}` });
    if (filters.branch) entries.push({ key: 'branch', label: `Branch: ${filters.branch}` });
    if (filters.year) entries.push({ key: 'year', label: `Year: ${filters.year}` });
    if (filters.semester) entries.push({ key: 'semester', label: `Semester: ${filters.semester}` });
    return entries;
  }, [filters]);

  const availableYears = useMemo(() => {
    const list = filterOptions.years || [];
    if (list.length === 0) {
      return [1, 2, 3, 4];
    }
    return [...list].sort((a, b) => a - b);
  }, [filterOptions.years]);

  const availableSemesters = useMemo(() => {
    const list = filterOptions.semesters || [];
    if (list.length === 0) {
      return [1, 2];
    }
    return [...list].sort((a, b) => a - b);
  }, [filterOptions.semesters]);

  const hasActiveFilters = activeFilterEntries.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-3 text-blue-600">
            <FileText size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 heading-font">Registration Reports</h1>
            <p className="text-sm text-gray-600">
              Track student registration status across the 5 stages.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadReport(filters)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            {loading ? <span className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button
            onClick={() => setDownloadModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
        {/* Filters and Actions Row */}
        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 w-full">
            {/* Search */}
            <div className="md:col-span-2 lg:col-span-2 xl:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* College */}
            <select
              value={filters.college || ''}
              onChange={(e) => handleFilterChange('college', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Colleges</option>
              {filterOptions.colleges.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>

            {/* Batch */}
            <select
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {(filterOptions.batches || []).map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>

            {/* Course */}
            <select
              value={filters.course || ''}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              onFocus={() => {
                const filtersForFetch = { ...filters };
                if (filtersForFetch.course) delete filtersForFetch.course;
                fetchFilterOptions(filtersForFetch, 'course');
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courses</option>
              {(filterOptions.courses || [])
                .filter((courseOption) => !EXCLUDED_COURSES.has(courseOption))
                .map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
            </select>

            {/* Branch */}
            <select
              value={filters.branch || ''}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              onFocus={() => {
                const filtersForFetch = { ...filters };
                if (filtersForFetch.branch) delete filtersForFetch.branch;
                fetchFilterOptions(filtersForFetch, 'branch');
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {(filterOptions.branches || []).map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>

            {/* Year */}
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  Year {year}
                </option>
              ))}
            </select>

            {/* Semester */}
            <select
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sems</option>
              {availableSemesters.map((semester) => (
                <option key={semester} value={String(semester)}>
                  Sem {semester}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
            >
              <XCircle size={16} />
              Clear
            </button>
          )}
        </div>

        {/* Stats Grid */}
        {
          stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-2 border-t border-gray-100">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="text-xs text-blue-600 uppercase font-semibold">Total Students</div>
                <div className="text-xl font-bold text-blue-900">{stats.total || 0}</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                <div className="text-xs text-yellow-600 uppercase font-semibold">Verification</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-green-600">{stats.verification?.completed || 0}</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-sm font-bold text-red-500">{stats.verification?.pending || 0}</span>
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                <div className="text-xs text-purple-600 uppercase font-semibold">Certificates</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-green-600">{stats.certificates?.verified || 0}</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-sm font-bold text-red-500">{stats.certificates?.pending || 0}</span>
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                <div className="text-xs text-green-600 uppercase font-semibold">Fees</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-green-600">{stats.fees?.cleared || 0}</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-sm font-bold text-red-500">{stats.fees?.pending || 0}</span>
                </div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <div className="text-xs text-indigo-600 uppercase font-semibold">Promotion</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-green-600">{stats.promotion?.completed || 0}</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-sm font-bold text-red-500">{stats.promotion?.pending || 0}</span>
                </div>
              </div>
              <div className="bg-pink-50 p-3 rounded-lg border border-pink-100">
                <div className="text-xs text-pink-600 uppercase font-semibold">Scholarship</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-green-600">{stats.scholarship?.assigned || 0}</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-sm font-bold text-red-500">{stats.scholarship?.pending || 0}</span>
                </div>
              </div>
            </div>
          )
        }
      </section >


      {
        loading ? (
          <div className="py-24 flex flex-col items-center gap-3 text-gray-500" >
            <RefreshCw className="animate-spin" size={24} />
            Loading report data...
          </div>
        ) : reportData.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-3 text-gray-500">
            <AlertCircle size={32} />
            <p>No students found matching current filters.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Pin No</th>
                    <th className="px-4 py-3 whitespace-nowrap">Student Name</th>
                    <th className="px-4 py-3 whitespace-nowrap">Course</th>
                    <th className="px-4 py-3 whitespace-nowrap">Branch</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Year</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Sem</th>
                    <th className="px-4 py-3 whitespace-nowrap">Registration Status</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Information Verification</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Certificates</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Fees</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Promotion</th>
                    <th className="px-4 py-3 whitespace-nowrap text-center">Scholarship</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{student.pin_no}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>
                          <div className="font-medium">{student.student_name}</div>
                          <div className="text-xs text-gray-500">{student.admission_number}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{student.course}</td>
                      <td className="px-4 py-3 text-gray-600">{student.branch}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{student.current_year}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{student.current_semester}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={student.overall_status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <StatusBadge status={student.stages.verification} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <StatusBadge status={student.stages.certificates} type="text" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <StatusBadge status={student.stages.fee} type="text" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <StatusBadge status={student.stages.promotion} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <StatusBadge status={student.stages.scholarship} type="text" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalRecords)} of {pagination.totalRecords} records
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                  className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages || loading}
                  className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

      <RegistrationDownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        initialFilters={filters}
        filterOptions={filterOptions}
      />
    </div >
  );
};

export default Reports;


