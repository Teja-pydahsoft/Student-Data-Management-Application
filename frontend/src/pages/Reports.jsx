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
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line
} from 'recharts';
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
  const [activeTab, setActiveTab] = useState('sheet');

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
  // Fetch initial options only once on mount
  useEffect(() => {
    const fetchInitialOptions = async () => {
      try {
        const response = await api.get('/students/quick-filters');
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            colleges: data.colleges || [],
            batches: data.batches || [],
            courses: data.courses || [],
            branches: data.branches || [],
            years: data.years || [],
            semesters: data.semesters || []
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch initial filter options:', error);
      }
    };
    fetchInitialOptions();
  }, []);

  // Update Courses when College or Batch changes
  useEffect(() => {
    const updateCourseOptions = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.college) params.append('college', filters.college);
        if (filters.batch) params.append('batch', filters.batch);

        // Fetch options filtered by college/batch to update Courses and Branches
        const response = await api.get(`/students/quick-filters?${params.toString()}`);
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            courses: data.courses || [],
            // If course is not selected, show all branches for this college
            // If course IS selected, the course-specific effect will handle branches
            branches: !filters.course ? (data.branches || []) : prev.branches
          }));
        }
      } catch (error) {
        console.warn('Failed to update course options:', error);
      }
    };

    updateCourseOptions();
  }, [filters.college, filters.batch, filters.course]);
  // Added filters.course dependency so if it's cleared, we reset branches if needed, 
  // though handleFilterChange clears it, so it triggers this.

  // Update Branches when Course changes
  useEffect(() => {
    if (!filters.course) return; // Handled by the college/batch effect

    const updateBranchOptions = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.college) params.append('college', filters.college);
        if (filters.batch) params.append('batch', filters.batch);
        params.append('course', filters.course);

        const response = await api.get(`/students/quick-filters?${params.toString()}`);
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            branches: data.branches || []
          }));
        }
      } catch (error) {
        console.warn('Failed to update branch options:', error);
      }
    };

    updateBranchOptions();
  }, [filters.course]);

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

  // Transform stats for charts
  const overviewChartData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: 'Verification',
        completed: stats.verification?.completed || 0,
        pending: stats.verification?.pending || 0
      },
      {
        name: 'Certificates',
        completed: stats.certificates?.verified || 0,
        pending: stats.certificates?.pending || 0
      },
      {
        name: 'Fees',
        completed: stats.fees?.cleared || 0,
        pending: stats.fees?.pending || 0
      },
      {
        name: 'Promotion',
        completed: stats.promotion?.completed || 0,
        pending: stats.promotion?.pending || 0
      },
      {
        name: 'Scholarship',
        completed: stats.scholarship?.assigned || 0,
        pending: stats.scholarship?.pending || 0
      }
    ];
  }, [stats]);


  // Chart Data Helpers
  const renderSingleStageChart = (stageName, completed, pending, colors = ['#10B981', '#EF4444']) => {
    const data = [
      { name: 'Completed', value: completed },
      { name: 'Pending', value: pending }
    ];
    // Don't render if no data
    if (completed === 0 && pending === 0) return null;

    return (
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center h-full">
        <h3 className="text-xs font-semibold text-gray-700 mb-1">{stageName}</h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="70%"
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-2 text-[10px] mt-1">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: colors[0] }}></div>
            <span className="text-gray-600">{completed}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: colors[1] }}></div>
            <span className="text-gray-600">{pending}</span>
          </div>
        </div>
      </div>
    );
  };

  const StatsGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 flex-shrink-0">
      <div className="bg-blue-50 p-2 md:p-3 rounded-lg border border-blue-100">
        <div className="text-[10px] md:text-xs text-blue-600 uppercase font-semibold">Total</div>
        <div className="text-lg md:text-xl font-bold text-blue-900">{stats?.total || 0}</div>
      </div>
      <div className="bg-gray-50 p-2 md:p-3 rounded-lg border border-gray-100">
        <div className="text-[10px] md:text-xs text-gray-600 uppercase font-semibold">Registration</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.registration?.completed || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.registration?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-yellow-50 p-2 md:p-3 rounded-lg border border-yellow-100">
        <div className="text-[10px] md:text-xs text-yellow-600 uppercase font-semibold">Verification</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.verification?.completed || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.verification?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-purple-50 p-2 md:p-3 rounded-lg border border-purple-100">
        <div className="text-[10px] md:text-xs text-purple-600 uppercase font-semibold">Certificates</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.certificates?.verified || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.certificates?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-green-50 p-2 md:p-3 rounded-lg border border-green-100">
        <div className="text-[10px] md:text-xs text-green-600 uppercase font-semibold">Fees</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.fees?.cleared || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.fees?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-indigo-50 p-2 md:p-3 rounded-lg border border-indigo-100">
        <div className="text-[10px] md:text-xs text-indigo-600 uppercase font-semibold">Promotion</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.promotion?.completed || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.promotion?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-pink-50 p-2 md:p-3 rounded-lg border border-pink-100">
        <div className="text-[10px] md:text-xs text-pink-600 uppercase font-semibold">Scholarship</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.scholarship?.assigned || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.scholarship?.pending || 0}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full h-full overflow-hidden">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
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
          <div className='flex bg-gray-100 p-1 rounded-lg mr-2'>
            <button
              onClick={() => setActiveTab('sheet')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'sheet'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Sheets
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'analytics'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Graphs
            </button>
          </div>
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

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex-shrink-0">
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
      </section>

      {/* Analytics View */}
      {activeTab === 'analytics' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-4 animate-in fade-in duration-300">
          {stats && <StatsGrid />}

          {stats && (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              {/* Overview Charts (Bar + Line) */}
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bar Chart */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex-shrink-0">Stage-wise Overview</h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overviewChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="completed" fill="#10B981" name="Completed" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pending" fill="#EF4444" name="Pending" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex-shrink-0">Stage-wise Trends</h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="Completed" dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="pending" stroke="#EF4444" strokeWidth={2} name="Pending" dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Detailed Pie Charts Grid - Strip at bottom */}
              <div className="h-40 shrink-0 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {renderSingleStageChart('Verification', stats.verification?.completed || 0, stats.verification?.pending || 0, ['#EAB308', '#FCA5A5'])}
                {renderSingleStageChart('Certificates', stats.certificates?.verified || 0, stats.certificates?.pending || 0, ['#A855F7', '#FCA5A5'])}
                {renderSingleStageChart('Fees', stats.fees?.cleared || 0, stats.fees?.pending || 0, ['#22C55E', '#FCA5A5'])}
                {renderSingleStageChart('Promotion', stats.promotion?.completed || 0, stats.promotion?.pending || 0, ['#6366F1', '#FCA5A5'])}
                {renderSingleStageChart('Scholarship', stats.scholarship?.assigned || 0, stats.scholarship?.pending || 0, ['#EC4899', '#FCA5A5'])}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sheets View */}
      {activeTab === 'sheet' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 gap-4">

          {/* Stats Grid - Fixed at top of Sheets view */}
          <div className="flex-shrink-0">
            {stats && <StatsGrid />}
          </div>

          {/* Table Area - Grows to fill remaining space */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500" >
              <RefreshCw className="animate-spin" size={24} />
              Loading report data...
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <AlertCircle size={32} />
              <p>No students found matching current filters.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Scrollable Table Body */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Pin No</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Student Name</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Course</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Branch</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Year</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Sem</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Registration Status</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Information Verification</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Certificates</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Fees</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Promotion</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Scholarship</th>
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

              {/* Fixed Footer: Pagination */}
              <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between shadow-[0_-2px_4px_rgba(0,0,0,0.02)] z-20">
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
