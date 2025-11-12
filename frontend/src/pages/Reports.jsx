import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Clock,
  RefreshCw,
  Users as UsersIcon,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import api from '../config/api';

const formatPercentage = (value) => {
  if (Number.isNaN(value) || value === null || value === undefined) {
    return '0%';
  }
  return `${value}%`;
};

const Reports = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
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

  const loadSummary = useCallback(
    async (overrideFilters) => {
      const activeFilters = overrideFilters ?? filters;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeFilters.batch) params.append('batch', activeFilters.batch);
        if (activeFilters.course) params.append('course', activeFilters.course);
        if (activeFilters.branch) params.append('branch', activeFilters.branch);
        if (activeFilters.year) params.append('year', activeFilters.year);
        if (activeFilters.semester) params.append('semester', activeFilters.semester);

        const query = params.toString();
        const response = await api.get(`/attendance/summary${query ? `?${query}` : ''}`);
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Unable to load reports');
        }
        setSummary(response.data.data);
      } catch (error) {
        console.error('Failed to load attendance summary:', error);
        toast.error(
          error.response?.data?.message || error.message || 'Unable to load attendance summary'
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await api.get('/attendance/filters');
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions({
            batches: data.batches || [],
            courses: data.courses || [],
            branches: data.branches || [],
            years: data.years || [],
            semesters: data.semesters || []
          });
        }
      } catch (error) {
        console.warn('Failed to fetch attendance filter options:', error);
      }
    };

    fetchFilterOptions();
  }, []);

  useEffect(() => {
    loadSummary(filters);
  }, [filters, loadSummary]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      batch: '',
      course: '',
      branch: '',
      year: '',
      semester: ''
    });
  };

  const activeFilterEntries = useMemo(() => {
    const entries = [];
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

  const dailyStats = useMemo(() => summary?.daily || { present: 0, absent: 0, pending: 0, percentage: 0 }, [summary]);

  const weeklySeries = useMemo(() => summary?.weekly?.series || [], [summary]);
  const monthlySeries = useMemo(() => summary?.monthly?.series || [], [summary]);

  const weeklyTotals = summary?.weekly?.totals || { present: 0, absent: 0, total: 0 };
  const monthlyTotals = summary?.monthly?.totals || { present: 0, absent: 0, total: 0 };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-3 text-blue-600">
            <BarChart3 size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 heading-font">Attendance Reports</h1>
            <p className="text-sm text-gray-600">
              Review attendance analytics across daily, weekly, and monthly intervals with visual insights.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadSummary(filters)}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
            loading
              ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {loading ? (
            <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh Data
        </button>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Batch</label>
            <select
              value={filters.batch}
              onChange={(event) => handleFilterChange('batch', event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {(filterOptions.batches || []).map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Course</label>
            <select
              value={filters.course}
              onChange={(event) => handleFilterChange('course', event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courses</option>
              {(filterOptions.courses || []).map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Branch</label>
            <select
              value={filters.branch}
              onChange={(event) => handleFilterChange('branch', event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {(filterOptions.branches || []).map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Year</label>
            <select
              value={filters.year}
              onChange={(event) => handleFilterChange('year', event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Semester</label>
            <select
              value={filters.semester}
              onChange={(event) => handleFilterChange('semester', event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Semesters</option>
              {availableSemesters.map((semester) => (
                <option key={semester} value={String(semester)}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-600">
            {hasActiveFilters
              ? `${activeFilterEntries.length} filter${activeFilterEntries.length > 1 ? 's' : ''} applied`
              : 'Showing metrics for all students'}
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
              hasActiveFilters
                ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
                : 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
            }`}
          >
            Clear Filters
          </button>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {activeFilterEntries.map((entry) => (
              <span
                key={entry.key}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700"
              >
                {entry.label}
                <button
                  type="button"
                  onClick={() => handleFilterChange(entry.key, '')}
                  className="text-blue-500 hover:text-blue-700"
                  aria-label={`Remove ${entry.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {loading ? (
        <div className="py-24 flex flex-col items-center gap-3 text-gray-500">
          <RefreshCw className="animate-spin" size={24} />
          Loading attendance analytics...
        </div>
      ) : !summary ? (
        <div className="py-24 flex flex-col items-center gap-3 text-gray-500">
          <BarChart3 size={32} />
          <p>No attendance data available yet.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">Total Students</p>
                  <p className="text-2xl font-semibold text-gray-900">{summary.totalStudents}</p>
                </div>
                <div className="rounded-full bg-blue-100 text-blue-600 p-3">
                  <UsersIcon size={22} />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Overall student strength considered for attendance metrics.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">Daily Attendance</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatPercentage(dailyStats.percentage)}</p>
                </div>
                <div className="rounded-full bg-green-100 text-green-600 p-3">
                  <CalendarDays size={22} />
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600 space-y-1">
                <p>
                  Present: <span className="font-semibold text-green-600">{dailyStats.present}</span>
                </p>
                <p>
                  Absent: <span className="font-semibold text-red-500">{dailyStats.absent}</span>
                </p>
                <p>
                  Pending: <span className="font-semibold text-gray-600">{dailyStats.pending}</span>
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">Weekly Overview</p>
                  <p className="text-2xl font-semibold text-gray-900">{weeklyTotals.total}</p>
                </div>
                <div className="rounded-full bg-purple-100 text-purple-600 p-3">
                  <Clock size={22} />
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600 space-y-1">
                <p>
                  Present:{' '}
                  <span className="font-semibold text-green-600">{weeklyTotals.present || 0}</span>
                </p>
                <p>
                  Absent: <span className="font-semibold text-red-500">{weeklyTotals.absent || 0}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Range: {summary.weekly.startDate} → {summary.weekly.endDate}
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">Monthly Overview</p>
                  <p className="text-2xl font-semibold text-gray-900">{monthlyTotals.total}</p>
                </div>
                <div className="rounded-full bg-orange-100 text-orange-600 p-3">
                  <TrendingUp size={22} />
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600 space-y-1">
                <p>
                  Present:{' '}
                  <span className="font-semibold text-green-600">{monthlyTotals.present || 0}</span>
                </p>
                <p>
                  Absent: <span className="font-semibold text-red-500">{monthlyTotals.absent || 0}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Range: {summary.monthly.startDate} → {summary.monthly.endDate}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900">Weekly Attendance Trend</h2>
              <p className="text-sm text-gray-500 mb-4">
                Track present vs absent counts for each day in the last week.
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="present" stroke="#16a34a" strokeWidth={2} name="Present" />
                    <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Absent" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900">Monthly Attendance Coverage</h2>
              <p className="text-sm text-gray-500 mb-4">
                A detailed snapshot of attendance distribution across the current month.
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="present"
                      stackId="1"
                      stroke="#16a34a"
                      fill="#86efac"
                      name="Present"
                    />
                    <Area
                      type="monotone"
                      dataKey="absent"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#fca5a5"
                      name="Absent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Reports;


