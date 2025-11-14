import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
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
import HolidayCalendarModal from '../components/Attendance/HolidayCalendarModal';
import useAuthStore from '../store/authStore';

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

const computeSundaysForMonthKey = (monthKey) => {
  if (typeof monthKey !== 'string') return [];
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (Number.isNaN(year) || Number.isNaN(month)) return [];

  const sundays = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  while (cursor <= end) {
    if (cursor.getUTCDay() === 0) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cursor.getUTCDate()).padStart(2, '0');
      sundays.push(`${y}-${m}-${d}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return sundays;
};

const formatFriendlyDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const createEmptyCalendarData = (monthKey) => ({
  month: monthKey,
  countryCode: 'IN',
  regionCode: null,
  sundays: computeSundaysForMonthKey(monthKey),
  publicHolidays: [],
  customHolidays: [],
  attendanceStatus: {},
  fetchedAt: new Date().toISOString(),
  fromCache: false
});

const getMonthKeyFromDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  return dateString.slice(0, 7);
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
  const [calendarInfo, setCalendarInfo] = useState({
    month: '',
    countryCode: 'IN',
    sundays: [],
    publicHolidays: [],
    customHolidays: [],
    fetchedAt: null,
    fromCache: false,
    attendanceStatus: {}
  });
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarViewMonthKey, setCalendarViewMonthKey] = useState(null);
  const [calendarViewData, setCalendarViewData] = useState(null);
  const [calendarViewLoading, setCalendarViewLoading] = useState(false);
  const [calendarViewError, setCalendarViewError] = useState(null);
  const [calendarMutationLoading, setCalendarMutationLoading] = useState(false);
  const [selectedDateHolidayInfo, setSelectedDateHolidayInfo] = useState(null);
  const calendarCacheRef = useRef(new Map());
  const searchEffectInitialized = useRef(false);

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const setCachedCalendarData = (monthKey, updater) => {
    if (!monthKey) return null;
    const previous = calendarCacheRef.current.get(monthKey) || createEmptyCalendarData(monthKey);
    const nextValue = typeof updater === 'function' ? updater(previous) : updater;
    calendarCacheRef.current.set(monthKey, nextValue);
    setCalendarInfo((prev) => (prev.month === monthKey ? nextValue : prev));
    setCalendarViewData((prev) => (prev?.month === monthKey ? nextValue : prev));
    return nextValue;
  };

  const fetchCalendarMonth = async (monthKey, options = {}) => {
    if (!monthKey) return null;
    const { force = false, applyToHeader = false, applyToModal = false } = options;

    if (!force && calendarCacheRef.current.has(monthKey)) {
      const cached = calendarCacheRef.current.get(monthKey);
      if (applyToHeader) {
        setCalendarInfo(cached);
      }
      if (applyToModal) {
        setCalendarViewData(cached);
      }
      return cached;
    }

    const loadingSetter = applyToHeader
      ? setCalendarLoading
      : applyToModal
      ? setCalendarViewLoading
      : null;
    const errorSetter = applyToHeader
      ? setCalendarError
      : applyToModal
      ? setCalendarViewError
      : null;

    if (loadingSetter) loadingSetter(true);
    if (errorSetter) errorSetter(null);

    try {
      const response = await api.get('/calendar/non-working-days', {
        params: {
          month: monthKey,
          countryCode: 'IN'
        }
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to load calendar data');
      }

      const payload = response.data.data || {};
      const normalized = {
        month: payload.month || monthKey,
        countryCode: payload.countryCode || 'IN',
        regionCode: payload.regionCode || null,
        sundays:
          Array.isArray(payload.sundays) && payload.sundays.length > 0
            ? payload.sundays
            : computeSundaysForMonthKey(monthKey),
        publicHolidays: Array.isArray(payload.publicHolidays) ? payload.publicHolidays : [],
        customHolidays: Array.isArray(payload.customHolidays) ? payload.customHolidays : [],
        attendanceStatus:
          payload.attendanceStatus && typeof payload.attendanceStatus === 'object'
            ? payload.attendanceStatus
            : {},
        fetchedAt: payload.fetchedAt || new Date().toISOString(),
        fromCache: Boolean(payload.fromCache)
      };

      calendarCacheRef.current.set(normalized.month, normalized);
      if (applyToHeader) {
        setCalendarInfo(normalized);
      }
      if (applyToModal) {
        setCalendarViewData(normalized);
      }
      return normalized;
    } catch (error) {
      if (errorSetter) {
        errorSetter(error.response?.data?.message || error.message || 'Unable to load calendar information');
      }
      throw error;
    } finally {
      if (loadingSetter) loadingSetter(false);
    }
  };

  const ensureCalendarFallback = (monthKey) => {
    if (!monthKey) return null;
    const fallback = createEmptyCalendarData(monthKey);
    calendarCacheRef.current.set(monthKey, fallback);
    setCalendarInfo((prev) => (prev.month === monthKey ? fallback : prev));
    setCalendarViewData((prev) => (prev?.month === monthKey ? fallback : prev));
    return fallback;
  };

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

  const calendarMonthKey = useMemo(() => {
    if (!attendanceDate || typeof attendanceDate !== 'string') return null;
    return attendanceDate.slice(0, 7);
  }, [attendanceDate]);

  const selectedDateIsSunday = useMemo(() => {
    if (!attendanceDate) return false;
    if (selectedDateHolidayInfo?.isSunday) return true;
    if (Array.isArray(calendarInfo.sundays) && calendarInfo.sundays.includes(attendanceDate)) {
      return true;
    }
    const selectedDate = new Date(`${attendanceDate}T00:00:00`);
    return selectedDate.getDay() === 0;
  }, [attendanceDate, calendarInfo.sundays, selectedDateHolidayInfo]);

  const publicHolidayMatches = useMemo(() => {
    if (!attendanceDate) {
      return [];
    }
    const calendarMatches = Array.isArray(calendarInfo.publicHolidays)
      ? calendarInfo.publicHolidays.filter((holiday) => holiday.date === attendanceDate)
      : [];

    if (calendarMatches.length > 0) {
      return calendarMatches;
    }

    if (selectedDateHolidayInfo?.publicHoliday) {
      return [selectedDateHolidayInfo.publicHoliday];
    }

    return [];
  }, [attendanceDate, calendarInfo.publicHolidays, selectedDateHolidayInfo]);

  const customHolidayForDate = useMemo(() => {
    if (!attendanceDate) {
      return null;
    }
    const calendarMatch = Array.isArray(calendarInfo.customHolidays)
      ? calendarInfo.customHolidays.find((holiday) => holiday.date === attendanceDate)
      : null;

    if (calendarMatch) {
      return calendarMatch;
    }

    return selectedDateHolidayInfo?.customHoliday || null;
  }, [attendanceDate, calendarInfo.customHolidays, selectedDateHolidayInfo]);

  const nonWorkingDayDetails = useMemo(() => {
    const reasons = [];

    if (selectedDateIsSunday) {
      reasons.push('Sunday');
    }

    if (publicHolidayMatches.length > 0) {
      const labels = publicHolidayMatches
        .map((holiday) => holiday.localName || holiday.name)
        .filter(Boolean);
      const labelText =
        labels.length > 0
          ? `Public holiday${labels.length > 1 ? 's' : ''}: ${labels.join(', ')}`
          : 'Public holiday';
      reasons.push(labelText);
    }

    if (customHolidayForDate) {
      reasons.push(
        customHolidayForDate.title
          ? `Institute holiday: ${customHolidayForDate.title}`
          : 'Institute holiday'
      );
    }

    if (Array.isArray(selectedDateHolidayInfo?.reasons)) {
      selectedDateHolidayInfo.reasons.forEach((reason) => {
        if (reason && !reasons.includes(reason)) {
          reasons.push(reason);
        }
      });
    }

    return {
      isNonWorkingDay:
        selectedDateIsSunday || publicHolidayMatches.length > 0 || !!customHolidayForDate,
      reasons,
      holidays: publicHolidayMatches,
      customHoliday: customHolidayForDate,
      backend: selectedDateHolidayInfo
    };
  }, [selectedDateIsSunday, publicHolidayMatches, customHolidayForDate, selectedDateHolidayInfo]);

  const upcomingHolidays = useMemo(() => {
    const todayKey = attendanceDate || formatDateInput(new Date());

    const combined = [
      ...(Array.isArray(calendarInfo.publicHolidays)
        ? calendarInfo.publicHolidays.map((holiday) => ({
            date: holiday.date,
            label: holiday.localName || holiday.name,
            type: 'public',
            details: holiday
          }))
        : []),
      ...(Array.isArray(calendarInfo.customHolidays)
        ? calendarInfo.customHolidays.map((holiday) => ({
            date: holiday.date,
            label: holiday.title || 'Institute Holiday',
            type: 'custom',
            details: holiday
          }))
        : [])
    ].filter((entry) => entry.date >= todayKey);

    combined.sort((a, b) => a.date.localeCompare(b.date));

    return combined.slice(0, 4);
  }, [calendarInfo.publicHolidays, calendarInfo.customHolidays, attendanceDate]);

  const todayKey = useMemo(() => formatDateInput(new Date()), []);
  const calendarMonthLoaded = calendarInfo.month === calendarMonthKey;
  const attendanceDateLabel = useMemo(() => {
    if (!attendanceDate) return 'Select date';
    const date = new Date(`${attendanceDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return attendanceDate;
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [attendanceDate]);
  const selectedDateStatus = useMemo(
    () => calendarInfo.attendanceStatus?.[attendanceDate] || null,
    [calendarInfo.attendanceStatus, attendanceDate]
  );
  const isToday = attendanceDate === todayKey;
  const editingLocked =
    nonWorkingDayDetails.isNonWorkingDay || !isToday;
  const editingLockReason = nonWorkingDayDetails.isNonWorkingDay
    ? 'Attendance is disabled on holidays.'
    : !isToday
    ? 'Attendance can only be recorded for today.'
    : null;
  const statusSummaryMeta = {
    submitted: {
      message: 'Attendance already submitted for this date.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    },
    not_marked: {
      message: 'Attendance was not marked on this date.',
      className: 'border-rose-200 bg-rose-50 text-rose-700'
    },
    pending: {
      message: 'Attendance is pending submission today.',
      className: 'border-amber-200 bg-amber-50 text-amber-700'
    },
    upcoming: {
      message: 'This is an upcoming day. Attendance opens on the selected date.',
      className: 'border-blue-200 bg-blue-50 text-blue-700'
    }
  };

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
    setSelectedDateHolidayInfo(null);
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

      if (response.data?.data?.holiday) {
        setSelectedDateHolidayInfo(response.data.data.holiday);
      }
    } catch (error) {
      console.error('Attendance fetch failed:', error);
      toast.error(error.response?.data?.message || 'Unable to load attendance');
      setStudents([]);
      setStatusMap({});
      setInitialStatusMap({});
      setSelectedDateHolidayInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!calendarMonthKey) return;
    fetchCalendarMonth(calendarMonthKey, { applyToHeader: true }).catch(() => {
      ensureCalendarFallback(calendarMonthKey);
    });
  }, [calendarMonthKey]);

  useEffect(() => {
    if (!calendarModalOpen) return;
    if (!calendarViewMonthKey) return;
    fetchCalendarMonth(calendarViewMonthKey, { applyToModal: true }).catch(() => {
      ensureCalendarFallback(calendarViewMonthKey);
    });
  }, [calendarModalOpen, calendarViewMonthKey]);

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
    if (editingLocked) {
      toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
      return;
    }
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

  const handleRetryCalendarFetch = () => {
    if (!calendarMonthKey) return;
    fetchCalendarMonth(calendarMonthKey, { applyToHeader: true, force: true }).catch(() => {
      ensureCalendarFallback(calendarMonthKey);
    });
  };

  const handleOpenCalendarModal = async () => {
    const monthKey = calendarMonthKey || getMonthKeyFromDate(formatDateInput(new Date()));
    setCalendarModalOpen(true);
    setCalendarViewError(null);
    setCalendarViewMonthKey(monthKey);
    try {
      await fetchCalendarMonth(monthKey, { applyToModal: true });
    } catch (error) {
      ensureCalendarFallback(monthKey);
    }
  };

  const handleCloseCalendarModal = () => {
    setCalendarModalOpen(false);
    setCalendarViewError(null);
  };

  const handleCalendarMonthChange = (newMonthKey) => {
    if (!newMonthKey) return;
    setCalendarViewError(null);
    setCalendarViewMonthKey(newMonthKey);
  };

  const handleCalendarDateSelect = (date) => {
    if (!date) return;
    setAttendanceDate(date);
    const nextMonthKey = getMonthKeyFromDate(date);
    if (nextMonthKey && nextMonthKey !== calendarViewMonthKey) {
      setCalendarViewMonthKey(nextMonthKey);
    }
  };

  const handleCreateInstituteHoliday = async ({ date, title, description }) => {
    if (!date) return;
    setCalendarMutationLoading(true);
    try {
      const response = await api.post('/calendar/custom-holidays', {
        date,
        title,
        description
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to save holiday');
      }

      const savedHoliday = response.data.data;
      const monthKey = getMonthKeyFromDate(savedHoliday?.date || date);

      await fetchCalendarMonth(monthKey, {
        applyToHeader: monthKey === calendarMonthKey,
        applyToModal: calendarModalOpen && monthKey === (calendarViewMonthKey || monthKey),
        force: true
      });

      toast.success('Institute holiday saved');

      if (attendanceDate === savedHoliday?.date) {
        const reasons = [];
        if (selectedDateIsSunday) {
          reasons.push('Sunday');
        }
        if (selectedDateHolidayInfo?.publicHoliday) {
          reasons.push(
            selectedDateHolidayInfo.publicHoliday.localName ||
              selectedDateHolidayInfo.publicHoliday.name ||
              'Public holiday'
          );
        }
        reasons.push(
          savedHoliday.title ? `Institute holiday: ${savedHoliday.title}` : 'Institute holiday'
        );

        setSelectedDateHolidayInfo({
          date: savedHoliday.date,
          isNonWorkingDay: true,
          isSunday: selectedDateIsSunday,
          publicHoliday: selectedDateHolidayInfo?.publicHoliday || null,
          customHoliday: savedHoliday,
          reasons
        });
      }
    } catch (error) {
      console.error('Failed to save custom holiday:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to save holiday');
    } finally {
      setCalendarMutationLoading(false);
    }
  };

  const handleRemoveInstituteHoliday = async (date) => {
    if (!date) return;
    setCalendarMutationLoading(true);
    try {
      const response = await api.delete(`/calendar/custom-holidays/${date}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to remove holiday');
      }

      const monthKey = getMonthKeyFromDate(date);

      await fetchCalendarMonth(monthKey, {
        applyToHeader: monthKey === calendarMonthKey,
        applyToModal: calendarModalOpen && monthKey === (calendarViewMonthKey || monthKey),
        force: true
      });

      toast.success('Institute holiday removed');

      if (attendanceDate === date) {
        const reasons = [];
        if (selectedDateIsSunday) {
          reasons.push('Sunday');
        }
        if (selectedDateHolidayInfo?.publicHoliday) {
          reasons.push(
            selectedDateHolidayInfo.publicHoliday.localName ||
              selectedDateHolidayInfo.publicHoliday.name ||
              'Public holiday'
          );
        }

        const isStillHoliday = reasons.length > 0;

        setSelectedDateHolidayInfo(
          isStillHoliday
            ? {
                date,
                isNonWorkingDay: true,
                isSunday: selectedDateIsSunday,
                publicHoliday: selectedDateHolidayInfo?.publicHoliday || null,
                customHoliday: null,
                reasons
              }
            : null
        );
      }
    } catch (error) {
      console.error('Failed to delete custom holiday:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to delete holiday');
    } finally {
      setCalendarMutationLoading(false);
    }
  };

  const handleCalendarModalRetry = () => {
    if (!calendarViewMonthKey) return;
    fetchCalendarMonth(calendarViewMonthKey, { applyToModal: true, force: true }).catch(() => {
      ensureCalendarFallback(calendarViewMonthKey);
    });
  };

  const handleSave = async () => {
    if (editingLocked) {
      toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
      return;
    }
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
    rows.push(
      [csvValue('Present'), csvValue('Absent'), csvValue('Unmarked'), csvValue('Holidays')].join(',')
    );
    rows.push(
      [
        csvValue(weeklyTotals.present || 0),
        csvValue(weeklyTotals.absent || 0),
        csvValue(weeklyTotals.unmarked || 0),
        csvValue(weeklyTotals.holidays || 0)
      ].join(',')
    );
    rows.push('');

    rows.push(csvValue('Monthly Summary'));
    rows.push(
      [csvValue('Present'), csvValue('Absent'), csvValue('Unmarked'), csvValue('Holidays')].join(',')
    );
    rows.push(
      [
        csvValue(monthlyTotals.present || 0),
        csvValue(monthlyTotals.absent || 0),
        csvValue(monthlyTotals.unmarked || 0),
        csvValue(monthlyTotals.holidays || 0)
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
      unmarked: entry.status === 'unmarked' ? 1 : 0,
      holiday: entry.status === 'holiday' ? 1 : 0
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
        <div className="flex flex-col gap-2 text-sm text-gray-600 lg:text-right max-w-sm">
          <div className="flex flex-col gap-2 text-left lg:text-right">
            <span className="text-gray-700 font-medium">Date</span>
            <button
              type="button"
              onClick={handleOpenCalendarModal}
              className={`relative flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                nonWorkingDayDetails.isNonWorkingDay
                  ? 'border-amber-400 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full p-2 ${
                    nonWorkingDayDetails.isNonWorkingDay ? 'bg-amber-200 text-amber-700' : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  <CalendarDays size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{attendanceDateLabel}</span>
                  <span className="text-xs text-gray-500">
                    {nonWorkingDayDetails.isNonWorkingDay
                      ? 'Holiday — attendance disabled'
                      : 'Tap to open academic calendar'}
                  </span>
                </div>
              </div>
              {calendarLoading && (
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin text-blue-500" />
              )}
            </button>
          </div>
          {nonWorkingDayDetails.isNonWorkingDay && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 text-left lg:text-right">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                <div className="font-semibold uppercase tracking-wide text-amber-800">
                  Non-working day
                </div>
                <div>{nonWorkingDayDetails.reasons.join('. ')}</div>
              </div>
            </div>
          )}
          {calendarError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 text-left lg:text-right">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="font-semibold uppercase tracking-wide text-red-800">
                  Calendar sync unavailable
                </div>
                <div>{calendarError}</div>
                <button
                  type="button"
                  onClick={handleRetryCalendarFetch}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 underline decoration-dotted"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {!calendarError && calendarMonthLoaded && upcomingHolidays.length > 0 && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700 text-left lg:text-right">
              <div className="font-semibold uppercase tracking-wide text-blue-800">Upcoming holidays</div>
              <div className="mt-1 space-y-1">
                {upcomingHolidays.map((holiday) => (
                  <div key={`${holiday.type}-${holiday.date}`} className="flex items-center justify-between gap-3">
                    <span>{formatFriendlyDate(holiday.date)}</span>
                    <span className="flex items-center gap-2 font-medium">
                      {holiday.label}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          holiday.type === 'public'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-purple-100 text-purple-600'
                        }`}
                      >
                        {holiday.type === 'public' ? 'Public' : 'Institute'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!nonWorkingDayDetails.isNonWorkingDay && editingLockReason && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
              {editingLockReason}
            </div>
          )}
          {selectedDateStatus &&
            selectedDateStatus !== 'holiday' &&
            statusSummaryMeta[selectedDateStatus] && (
              <div
                className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusSummaryMeta[selectedDateStatus].className}`}
              >
                {statusSummaryMeta[selectedDateStatus].message}
              </div>
            )}
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
            disabled={!hasChanges || saving || editingLocked}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              hasChanges && !saving && !editingLocked
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
        {editingLocked && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm text-gray-600">
            {editingLockReason || 'Attendance is read-only for this date.'}
          </div>
        )}

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
                            disabled={editingLocked}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              editingLocked
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                : status === 'present'
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
                            disabled={editingLocked}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              editingLocked
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                : status === 'absent'
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
      <HolidayCalendarModal
        isOpen={calendarModalOpen}
        onClose={handleCloseCalendarModal}
        monthKey={calendarViewMonthKey || calendarMonthKey || getMonthKeyFromDate(attendanceDate)}
        onMonthChange={handleCalendarMonthChange}
        selectedDate={attendanceDate}
        onSelectDate={handleCalendarDateSelect}
        calendarData={calendarViewData}
        loading={calendarViewLoading}
        error={calendarViewError}
        onRetry={handleCalendarModalRetry}
        onCreateHoliday={handleCreateInstituteHoliday}
        onRemoveHoliday={handleRemoveInstituteHoliday}
        mutationLoading={calendarMutationLoading}
        isAdmin={isAdmin}
      />
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
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
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
                      <div>
                        <p className="text-xs text-gray-500">Holidays</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {historyData.weekly?.totals?.holidays ?? 0}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Range: {historyData.weekly?.startDate} → {historyData.weekly?.endDate}
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-purple-700 uppercase">Monthly Summary</h3>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
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
                      <div>
                        <p className="text-xs text-gray-500">Holidays</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {historyData.monthly?.totals?.holidays ?? 0}
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
                          <Bar dataKey="holiday" stackId="status" fill="#f59e0b" name="Holiday" />
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
                          <Bar dataKey="holiday" stackId="status" fill="#f59e0b" name="Holiday" />
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
                            : entry.status === 'holiday'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        <p className="text-xs font-semibold">{entry.date}</p>
                        <p className="text-xs capitalize">
                          {entry.status === 'holiday' ? 'Holiday' : entry.status}
                        </p>
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

