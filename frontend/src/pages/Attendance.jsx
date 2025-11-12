import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  RefreshCw,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
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
    </div>
  );
};

export default Attendance;

