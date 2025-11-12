import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  BarChart3,
  History as HistoryIcon,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import api, { getStaticFileUrlDirect } from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';

const formatDateInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Attendance = () => {
  const [attendanceDate, setAttendanceDate] = useState(() => formatDateInput(new Date()));
  const [filters, setFilters] = useState({
    batch: '',
    course: '',
    branch: '',
    currentYear: '',
    currentSemester: '',
    studentName: '',
    parentMobile: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    batches: [],
    courses: [],
    branches: [],
    years: [],
    semesters: []
  });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMap, setStatusMap] = useState({});
  const [initialStatusMap, setInitialStatusMap] = useState({});
  const [smsResults, setSmsResults] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [downloadingStudentId, setDownloadingStudentId] = useState(null);

  const effectiveStatus = (studentId) => {
    const status = statusMap[studentId];
    return status ? status.toLowerCase() : null;
  };

  const presentCount = useMemo(() => {
    return students.reduce((count, student) => {
      return effectiveStatus(student.id) === 'present' ? count + 1 : count;
    }, 0);
  }, [students, statusMap]);

  const absentCount = useMemo(() => {
    return students.reduce((count, student) => {
      return effectiveStatus(student.id) === 'absent' ? count + 1 : count;
    }, 0);
  }, [students, statusMap]);

  const unmarkedCount = useMemo(() => {
    return students.length - presentCount - absentCount;
  }, [students.length, presentCount, absentCount]);

  const hasChanges = useMemo(() => {
    return students.some((student) => {
      const current = effectiveStatus(student.id);
      const initial = initialStatusMap[student.id] || null;
      return current !== (initial || null);
    });
  }, [students, statusMap, initialStatusMap]);

  const loadFilterOptions = async () => {
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
      console.warn('Unable to load attendance filter options', error);
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('date', attendanceDate);

      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.currentYear) params.append('currentYear', filters.currentYear);
      if (filters.currentSemester) params.append('currentSemester', filters.currentSemester);
      if (filters.studentName) params.append('studentName', filters.studentName.trim());
      if (filters.parentMobile) params.append('parentMobile', filters.parentMobile.trim());

      const response = await api.get(`/attendance?${params.toString()}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch attendance');
      }

      const fetchedStudents = (response.data.data?.students || []).map((student) => {
        const status = student.attendanceStatus ? student.attendanceStatus.toLowerCase() : null;
        return {
          ...student,
          attendanceStatus: status
        };
      });

      const statusSnapshot = {};
      fetchedStudents.forEach((student) => {
        statusSnapshot[student.id] = student.attendanceStatus || null;
      });

      setStudents(fetchedStudents);
      setStatusMap(statusSnapshot);
      setInitialStatusMap({ ...statusSnapshot });
      setSmsResults([]);
    } catch (error) {
      console.error('Attendance fetch failed:', error);
      toast.error(error.response?.data?.message || 'Unable to load attendance');
      setStudents([]);
      setStatusMap({});
      setInitialStatusMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attendanceDate,
    filters.batch,
    filters.course,
    filters.branch,
    filters.currentYear,
    filters.currentSemester
  ]);

  const searchEffectInitialized = useRef(false);

  useEffect(() => {
    if (!searchEffectInitialized.current) {
      searchEffectInitialized.current = true;
      return;
    }

    const handle = setTimeout(() => {
      loadAttendance();
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.studentName, filters.parentMobile]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStatusChange = (studentId, status) => {
    setStatusMap((prev) => {
      const current = prev[studentId] || null;
      if (current === status) {
        return prev;
      }
      return {
        ...prev,
        [studentId]: status
      };
    });
  };

  const handleClearFilters = () => {
    setFilters({
      batch: '',
      course: '',
      branch: '',
      currentYear: '',
      currentSemester: '',
      studentName: '',
      parentMobile: ''
    });
  };

  const handleSave = async () => {
    const records = students
      .map((student) => {
        const current = effectiveStatus(student.id);
        const initial = initialStatusMap[student.id] || null;
        if (!current || current === initial) {
          return null;
        }

        return {
          studentId: student.id,
          status: current,
          studentName: student.studentName,
          parentMobile: student.parentMobile1 || student.parentMobile2,
        batch: student.batch,
        course: student.course,
        branch: student.branch,
          currentYear: student.currentYear,
          currentSemester: student.currentSemester
        };
      })
      .filter(Boolean);

    if (records.length === 0) {
      toast('Nothing to save');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/attendance', {
        attendanceDate,
        records
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to save attendance');
      }

      setInitialStatusMap({ ...statusMap });
      setStudents((prev) =>
        prev.map((student) => ({
          ...student,
          attendanceStatus: statusMap[student.id] || null
        }))
      );

      const results = response.data.data?.smsResults || [];
      setSmsResults(results);
      setLastUpdatedAt(new Date().toISOString());

      const smsSent = results.filter((result) => !result.skipped && result.success).length;
      const smsSkipped = results.filter((result) => result.skipped).length;
      const smsFailed = results.filter((result) => !result.success && !result.skipped).length;

      let successMessage = 'Attendance updated successfully';
      if (smsSent || smsSkipped || smsFailed) {
        successMessage += ` (SMS: ${smsSent} sent`;
        if (smsSkipped) successMessage += `, ${smsSkipped} skipped`;
        if (smsFailed) successMessage += `, ${smsFailed} failed`;
        successMessage += ')';
      }

      toast.success(successMessage);
    } catch (error) {
      console.error('Attendance save failed:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const renderPhoto = (student) => {
    if (student.photo) {
      const src = student.photo.startsWith('data:')
        ? student.photo
        : getStaticFileUrlDirect(student.photo);
      return (
        <img
          src={src}
          alt={student.studentName || 'Student'}
          className="w-12 h-12 rounded-full object-cover border border-gray-200"
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
      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
        {initials || 'NA'}
      </div>
    );
  };

  const fetchStudentHistoryData = async (studentId) => {
    const response = await api.get(`/attendance/student/${studentId}/history`);
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to fetch attendance history');
    }
    return response.data.data;
  };

  const handleOpenHistory = async (student) => {
    setSelectedStudent(student);
    setHistoryData(null);
    setHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const data = await fetchStudentHistoryData(student.id);
      setHistoryData(data);
    } catch (error) {
      console.error('Failed to load student attendance history:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to load attendance history');
      setHistoryModalOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = () => {
    setHistoryModalOpen(false);
    setHistoryData(null);
    setSelectedStudent(null);
  };

  const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const buildStudentReportCsv = (student, history) => {
    const rows = [];
    const weeklyTotals = history?.weekly?.totals || { present: 0, absent: 0, unmarked: 0 };
    const monthlyTotals = history?.monthly?.totals || { present: 0, absent: 0, unmarked: 0 };

    rows.push(csvValue('Student Name') + ',' + csvValue(student.studentName || 'Unknown'));
    rows.push(csvValue('PIN Number') + ',' + csvValue(student.pinNumber || 'N/A'));
    rows.push(csvValue('Batch') + ',' + csvValue(student.batch || 'N/A'));
    rows.push(csvValue('Course') + ',' + csvValue(student.course || 'N/A'));
    rows.push(csvValue('Branch') + ',' + csvValue(student.branch || 'N/A'));
    rows.push(csvValue('Current Year') + ',' + csvValue(student.currentYear || 'N/A'));
    rows.push(csvValue('Current Semester') + ',' + csvValue(student.currentSemester || 'N/A'));
    rows.push('');

    rows.push(csvValue('Weekly Summary'));
    rows.push([csvValue('Present'), csvValue('Absent'), csvValue('Unmarked')].join(','));
    rows.push(
      [
        csvValue(weeklyTotals.present || 0),
        csvValue(weeklyTotals.absent || 0),
        csvValue(weeklyTotals.unmarked || 0)
      ].join(',')
    );
    rows.push('');

    rows.push(csvValue('Monthly Summary'));
    rows.push([csvValue('Present'), csvValue('Absent'), csvValue('Unmarked')].join(','));
    rows.push(
      [
        csvValue(monthlyTotals.present || 0),
        csvValue(monthlyTotals.absent || 0),
        csvValue(monthlyTotals.unmarked || 0)
      ].join(',')
    );
    rows.push('');

    rows.push([csvValue('Date'), csvValue('Status')].join(','));
    const monthlySeries = history?.monthly?.series || [];
    monthlySeries.forEach((entry) => {
      const status = entry.status
        ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1)
        : 'Unmarked';
      rows.push([csvValue(entry.date), csvValue(status)].join(','));
    });

    return rows.join('\n');
  };

  const sanitizeFileName = (name) => {
    if (!name) return 'student';
    return name.replace(/[^a-z0-9_\-]+/gi, '_').substring(0, 60) || 'student';
  };

  const handleDownloadReport = async (student) => {
    setDownloadingStudentId(student.id);
    try {
      const history =
        selectedStudent?.id === student.id && historyData
          ? historyData
          : await fetchStudentHistoryData(student.id);

      const csvContent = buildStudentReportCsv(student, history);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute(
        'download',
        `${sanitizeFileName(student.studentName || student.pinNumber || 'student')}_attendance_${today}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Attendance report downloaded');
    } catch (error) {
      console.error('Failed to download attendance report:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to download report');
    } finally {
      setDownloadingStudentId(null);
    }
  };

  const buildChartSeries = (series = []) =>
    series.map((entry) => ({
      date: entry.date,
      present: entry.status === 'present' ? 1 : 0,
      absent: entry.status === 'absent' ? 1 : 0,
      unmarked: entry.status === 'unmarked' ? 1 : 0
    }));

  const weeklyChartSeries = historyData ? buildChartSeries(historyData.weekly?.series) : [];
  const monthlyChartSeries = historyData ? buildChartSeries(historyData.monthly?.series) : [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-3 text-blue-600">
            <CalendarCheck size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 heading-font">Attendance</h1>
            <p className="text-sm text-gray-600">
              Filter students and mark daily attendance. Absent students trigger an SMS alert to parents.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-gray-600 lg:text-right">
          <label className="flex items-center gap-2 text-gray-700 font-medium">
            <span>Date</span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <div>
            <span className="font-semibold text-gray-800">Summary: </span>
            <span className="text-green-600 font-medium">{presentCount} present</span>,{' '}
            <span className="text-red-600 font-medium">{absentCount} absent</span>,{' '}
            <span className="text-gray-600 font-medium">{unmarkedCount} pending</span>
          </div>
          {lastUpdatedAt && (
            <div className="text-xs text-gray-500">
              Last updated at {new Date(lastUpdatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <Filter size={18} />
          <span>Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Batch</label>
            <select
              value={filters.batch}
              onChange={(event) => handleFilterChange('batch', event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {filterOptions.batches.map((batchOption) => (
                <option key={batchOption} value={batchOption}>
                  {batchOption}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={filters.course}
              onChange={(event) => handleFilterChange('course', event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Courses</option>
              {filterOptions.courses.map((courseOption) => (
                <option key={courseOption} value={courseOption}>
                  {courseOption}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={filters.branch}
              onChange={(event) => handleFilterChange('branch', event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {filterOptions.branches.map((branchOption) => (
                <option key={branchOption} value={branchOption}>
                  {branchOption}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Current Year</label>
            <select
              value={filters.currentYear}
              onChange={(event) => handleFilterChange('currentYear', event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {filterOptions.years.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  Year {yearOption}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Current Semester</label>
            <select
              value={filters.currentSemester}
              onChange={(event) => handleFilterChange('currentSemester', event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Semesters</option>
              {filterOptions.semesters.map((semesterOption) => (
                <option key={semesterOption} value={semesterOption}>
                  Semester {semesterOption}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Parent Mobile</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search parent mobile"
                value={filters.parentMobile}
                onChange={(event) => handleFilterChange('parentMobile', event.target.value)}
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col md:col-span-2 lg:col-span-6">
            <label className="text-sm font-medium text-gray-700 mb-1">Student Name or PIN</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search student name or PIN"
                value={filters.studentName}
                onChange={(event) => handleFilterChange('studentName', event.target.value)}
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={16} />
            Clear Filters
          </button>
          <div className="text-sm text-gray-500">
            {students.length} student{students.length === 1 ? '' : 's'} loaded
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <CalendarCheck size={18} />
            <span>Daily Attendance</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              hasChanges && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Attendance
              </>
            )}
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingAnimation message="Fetching students..." />
          </div>
        ) : students.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
            <AlertTriangle size={32} />
            <p>No students found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">PIN</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Parent Contact</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3 text-right">Insights</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {students.map((student) => {
                  const status = effectiveStatus(student.id);
                  const parentContact = student.parentMobile1 || student.parentMobile2 || 'Not available';
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {renderPhoto(student)}
                          <div className="font-semibold text-gray-900">
                            {student.studentName || 'Unknown Student'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.pinNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.batch || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.course || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.branch || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {student.currentYear ? `Year ${student.currentYear}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {student.currentSemester ? `Semester ${student.currentSemester}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div>{parentContact}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'present')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              status === 'present'
                                ? 'bg-green-100 border-green-500 text-green-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-green-50 hover:border-green-400'
                            }`}
                          >
                            <Check size={16} />
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'absent')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              status === 'absent'
                                ? 'bg-red-100 border-red-500 text-red-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400'
                            }`}
                          >
                            <X size={16} />
                            Absent
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(student)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <HistoryIcon size={16} />
                            View history
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadReport(student)}
                            disabled={downloadingStudentId === student.id}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              downloadingStudentId === student.id
                                ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {downloadingStudentId === student.id ? (
                              <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download size={16} />
                            )}
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {smsResults.length > 0 && (
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <div className="font-semibold text-blue-700">SMS Dispatch Summary</div>
          <ul className="space-y-1 text-sm text-blue-800">
            {smsResults.map((result) => (
              <li key={result.studentId} className="flex items-center gap-2">
                {result.success ? (
                  <Check size={16} className="text-green-600" />
                ) : result.skipped ? (
                  <AlertTriangle size={16} className="text-amber-500" />
                ) : (
                  <X size={16} className="text-red-600" />
                )}
                <span>
                  Student ID {result.studentId}:{' '}
                  {result.success
                    ? result.mocked
                      ? 'SMS simulated (test mode)'
                      : 'SMS sent'
                    : result.skipped
                    ? `Skipped (${result.reason || 'no reason'})`
                    : `Failed (${result.reason || 'unknown'})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 rounded-full p-2">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Attendance History</h2>
                  <p className="text-sm text-gray-500">
                    {selectedStudent?.studentName} • {selectedStudent?.pinNumber || 'No PIN'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectedStudent && handleDownloadReport(selectedStudent)}
                  disabled={!selectedStudent || downloadingStudentId === selectedStudent?.id}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    downloadingStudentId === selectedStudent?.id
                      ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {downloadingStudentId === selectedStudent?.id ? (
                    <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download report
                </button>
                <button
                  type="button"
                  onClick={handleCloseHistory}
                  className="rounded-full p-2 hover:bg-gray-100 text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div className="py-20 flex justify-center">
                <LoadingAnimation message="Fetching attendance history..." />
              </div>
            ) : !historyData ? (
              <div className="py-20 flex flex-col items-center gap-3 text-gray-500">
                <AlertTriangle size={28} />
                <p>Unable to load attendance history.</p>
              </div>
            ) : (
              <div className="px-6 py-6 space-y-6">
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-blue-700 uppercase">Weekly Summary</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Present</p>
                        <p className="text-lg font-semibold text-green-600">
                          {historyData.weekly?.totals?.present ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Absent</p>
                        <p className="text-lg font-semibold text-red-500">
                          {historyData.weekly?.totals?.absent ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Unmarked</p>
                        <p className="text-lg font-semibold text-gray-600">
                          {historyData.weekly?.totals?.unmarked ?? 0}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Range: {historyData.weekly?.startDate} → {historyData.weekly?.endDate}
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-purple-700 uppercase">Monthly Summary</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Present</p>
                        <p className="text-lg font-semibold text-green-600">
                          {historyData.monthly?.totals?.present ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Absent</p>
                        <p className="text-lg font-semibold text-red-500">
                          {historyData.monthly?.totals?.absent ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Unmarked</p>
                        <p className="text-lg font-semibold text-gray-600">
                          {historyData.monthly?.totals?.unmarked ?? 0}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Range: {historyData.monthly?.startDate} → {historyData.monthly?.endDate}
                    </p>
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800">Weekly Status Timeline</h3>
                    <div className="h-64 bg-white border border-gray-200 rounded-xl p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyChartSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="present" stackId="status" fill="#16a34a" name="Present" />
                          <Bar dataKey="absent" stackId="status" fill="#ef4444" name="Absent" />
                          <Bar dataKey="unmarked" stackId="status" fill="#a3a3a3" name="Unmarked" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800">Monthly Status Timeline</h3>
                    <div className="h-64 bg-white border border-gray-200 rounded-xl p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="present" stackId="status" fill="#16a34a" name="Present" />
                          <Bar dataKey="absent" stackId="status" fill="#ef4444" name="Absent" />
                          <Bar dataKey="unmarked" stackId="status" fill="#a3a3a3" name="Unmarked" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Daily Breakdown (Last 7 days)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {historyData.weekly?.series?.map((entry) => (
                      <div
                        key={entry.date}
                        className={`rounded-xl border px-3 py-2 text-center ${
                          entry.status === 'present'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : entry.status === 'absent'
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        <p className="text-xs font-semibold">{entry.date}</p>
                        <p className="text-xs capitalize">{entry.status}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;

