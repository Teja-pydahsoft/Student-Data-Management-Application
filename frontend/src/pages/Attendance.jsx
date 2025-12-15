import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  Calendar,
  Clock,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  BarChart3,
  History as HistoryIcon,
  Download,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Mail
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
import { SkeletonTable, SkeletonAttendanceTable } from '../components/SkeletonLoader';
import HolidayCalendarModal from '../components/Attendance/HolidayCalendarModal';
import useAuthStore from '../store/authStore';
import { isFullAccessRole } from '../constants/rbac';

const EXCLUDED_COURSES = new Set(['M.Tech', 'MBA', 'MCA', 'M Sc Aqua', 'MSC Aqua', 'MCS', 'M.Pharma', 'M Pharma']);

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
const StatPill = ({ label, value, color }) => {
  const colorMap = {
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
    green: 'bg-green-50 border-green-100 text-green-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    red: 'bg-red-50 border-red-100 text-red-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800'
  };
  const safeValue = Number.isFinite(value) ? value : Number(value) || 0;
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color] || colorMap.gray}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-bold">{safeValue}</p>
    </div>
  );
};

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
  const [coursesWithBranches, setCoursesWithBranches] = useState([]);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [columnOrder, setColumnOrder] = useState([
    'student', 'pin', 'registrationStatus', 'batch', 'course', 'branch', 'year', 'semester', 'parentContact', 'attendance', 'smsStatus', 'insights'
  ]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMap, setStatusMap] = useState({});
  const [initialStatusMap, setInitialStatusMap] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalStudents, setTotalStudents] = useState(0);
  const [attendanceStatistics, setAttendanceStatistics] = useState({
    total: 0,
    present: 0,
    absent: 0,
    marked: 0,
    unmarked: 0
  });
  const pageSizeOptions = [10, 25, 50, 100];
  const [smsResults, setSmsResults] = useState([]);
  const [smsStatusMap, setSmsStatusMap] = useState({}); // Map studentId to SMS status
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsCurrentPage, setSmsCurrentPage] = useState(1);
  const [smsPageSize] = useState(10);
  const [retryingSmsFor, setRetryingSmsFor] = useState(null); // Track which student SMS is being retried
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const attendanceCache = useRef(new Map());
  const CACHE_TTL_MS = 90 * 1000; // 90 seconds cache for faster re-renders
  const pendingRequestRef = useRef(null);
const filterOptionsCacheRef = useRef(new Map());
const FILTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for filter options
  const [dayEndReportOpen, setDayEndReportOpen] = useState(false);
  const [dayEndReportLoading, setDayEndReportLoading] = useState(false);
  const [dayEndReportData, setDayEndReportData] = useState(null);
  const [dayEndGrouped, setDayEndGrouped] = useState([]);
  const [dayEndPreviewFilter, setDayEndPreviewFilter] = useState('all'); // all | marked | unmarked
  const [dayEndSortBy, setDayEndSortBy] = useState('none'); // none | branch | yearSem | course
  const [sendingReports, setSendingReports] = useState(false);
  const [markHolidayLoading, setMarkHolidayLoading] = useState(false);
  const [holidayReasonModalOpen, setHolidayReasonModalOpen] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [pendingHolidayRecords, setPendingHolidayRecords] = useState([]);
  const [pendingFilter, setPendingFilter] = useState('all'); // all | pending | marked
  const [showPendingStudents, setShowPendingStudents] = useState(false);
  const [allBatchesMarkedModalOpen, setAllBatchesMarkedModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [gettingDeleteCount, setGettingDeleteCount] = useState(false);
  const dayEndGroupedDisplay = useMemo(() => {
    let rows = Array.isArray(dayEndGrouped) ? [...dayEndGrouped] : [];
    rows = rows.filter((row) => {
      if (dayEndPreviewFilter === 'marked') return (row.markedToday || 0) > 0;
      if (dayEndPreviewFilter === 'unmarked') return (row.pendingToday || 0) > 0;
      return true;
    });

    const compareNumber = (a, b) => (a || 0) - (b || 0);
    if (dayEndSortBy === 'branch') {
      rows.sort((a, b) => (a.branch || '').localeCompare(b.branch || '') || compareNumber(a.year, b.year) || compareNumber(a.semester, b.semester));
    } else if (dayEndSortBy === 'yearSem') {
      rows.sort((a, b) => compareNumber(a.year, b.year) || compareNumber(a.semester, b.semester) || (a.branch || '').localeCompare(b.branch || ''));
    } else if (dayEndSortBy === 'course') {
      rows.sort((a, b) => (a.course || '').localeCompare(b.course || '') || compareNumber(a.year, b.year) || compareNumber(a.semester, b.semester));
    }
    return rows;
  }, [dayEndGrouped, dayEndPreviewFilter, dayEndSortBy]);
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
  const [holidayAlertShown, setHolidayAlertShown] = useState(false);
  const [showHolidayAlert, setShowHolidayAlert] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [attendanceReport, setAttendanceReport] = useState(null);
  const calendarCacheRef = useRef(new Map());
  const searchEffectInitialized = useRef(false);

  const user = useAuthStore((state) => state.user);
  const isAdmin = isFullAccessRole(user?.role);

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
    // Default to 'present' if no status is set
    return status ? status.toLowerCase() : 'present';
  };

  // Use statistics from API (based on total students, not just current page)
  const presentCount = useMemo(() => {
    return attendanceStatistics.present || 0;
  }, [attendanceStatistics.present]);

  const absentCount = useMemo(() => {
    return attendanceStatistics.absent || 0;
  }, [attendanceStatistics.absent]);

  const unmarkedCount = useMemo(() => {
    return attendanceStatistics.unmarked || 0;
  }, [attendanceStatistics.unmarked]);

  // Calculate marked count (students with attendance status in DB) - from API
  const markedCount = useMemo(() => {
    return attendanceStatistics.marked || 0;
  }, [attendanceStatistics.marked]);

  // Pending Marked = Total unmarked students (students that need to be marked)
  // This should be based on total students, not just current page
  const pendingCount = useMemo(() => {
    return attendanceStatistics.unmarked || 0;
  }, [attendanceStatistics.unmarked]);

  // Filter branches based on selected course
  const availableBranches = useMemo(() => {
    if (!filters.course) {
      return filterOptions.branches;
    }
    const selectedCourse = coursesWithBranches.find(c => c.name === filters.course);
    if (!selectedCourse || !selectedCourse.branches) {
      return [];
    }
    // Get unique branch names from the course's branches
    const branchNames = [...new Set(selectedCourse.branches.map(b => b.name))];
    // Filter to only show branches that exist in filterOptions.branches (to respect user scope)
    return branchNames.filter(name => filterOptions.branches.includes(name));
  }, [filters.course, coursesWithBranches, filterOptions.branches]);

  // Pagination calculations
  const safePageSize = pageSize || 1;
  const totalPages = totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / safePageSize)) : 1;
  const showingFromRaw = totalStudents === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const showingFrom = totalStudents === 0 ? 0 : Math.min(showingFromRaw, totalStudents);
  const showingTo = totalStudents === 0 ? 0 : Math.min(totalStudents, showingFrom + Math.max(students.length - 1, 0));
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const hasChanges = useMemo(() => {
    // Allow saving if there are students, even if no changes detected
    // This ensures attendance can be saved even when all students are present
    if (students.length === 0) return false;
    
    // Check if there are any changes
    const hasStatusChanges = students.some((student) => {
      const current = effectiveStatus(student.id);
      const initial = initialStatusMap[student.id] || 'present';
      return current !== initial;
    });
    
    // Also check if there are students that need to be saved (not yet marked)
    // A student needs to be saved if they don't have an initial status (not yet marked in DB)
    const hasUnmarkedStudents = students.some((student) => {
      return initialStatusMap[student.id] === undefined;
    });
    
    return hasStatusChanges || hasUnmarkedStudents;
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

  // Show holiday alert when date is a holiday (show every time page loads on a holiday)
  useEffect(() => {
    if (!isAdmin || !attendanceDate) {
      setShowHolidayAlert(false);
      return;
    }

    // Check multiple sources for holiday status
    // Priority: selectedDateHolidayInfo (from attendance API) > nonWorkingDayDetails > calendarInfo
    const isHoliday = 
      selectedDateHolidayInfo?.isNonWorkingDay ||
      !!selectedDateHolidayInfo?.customHoliday ||
      !!selectedDateHolidayInfo?.publicHoliday ||
      nonWorkingDayDetails.isNonWorkingDay || 
      selectedDateIsSunday ||
      !!customHolidayForDate ||
      publicHolidayMatches.length > 0;

    // Show alert if it's a holiday and attendance data has loaded
    // Don't wait for calendar data if we have holiday info from attendance API
    const hasHolidayInfoFromAPI = !!selectedDateHolidayInfo?.isNonWorkingDay || 
                                   !!selectedDateHolidayInfo?.customHoliday ||
                                   !!selectedDateHolidayInfo?.publicHoliday;
    const calendarReady = hasHolidayInfoFromAPI || calendarMonthLoaded || calendarInfo.month === calendarMonthKey;
    
    if (isHoliday && !loading && calendarReady) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        if (!holidayAlertShown) {
          setShowHolidayAlert(true);
          setHolidayAlertShown(true);
        }
      }, 800);
      
      return () => clearTimeout(timer);
    } else {
      setShowHolidayAlert(false);
    }
  }, [
    isAdmin, 
    nonWorkingDayDetails.isNonWorkingDay, 
    selectedDateHolidayInfo,
    selectedDateIsSunday,
    customHolidayForDate,
    publicHolidayMatches,
    attendanceDate, 
    holidayAlertShown,
    loading,
    calendarMonthLoaded,
    calendarInfo.month,
    calendarMonthKey
  ]);

  // Reset holiday alert when date changes
  useEffect(() => {
    setHolidayAlertShown(false);
    setShowHolidayAlert(false);
  }, [attendanceDate]);

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

  const loadFilterOptions = async (filtersOverride = null, excludeField = null) => {
    try {
      // Use override filters if provided, otherwise use current filters
      const filtersToUse = filtersOverride || filters;
      
      const cacheKey = JSON.stringify({
        batch: filtersToUse.batch,
        course: filtersToUse.course,
        branch: filtersToUse.branch,
        excludeField: excludeField
      });
      const cached = filterOptionsCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < FILTER_CACHE_TTL_MS) {
        setFilterOptions(cached.filterOptions);
        setCoursesWithBranches(cached.coursesWithBranches || []);
        return;
      }

      // Build query params based on filters for cascading
      // Exclude the field being changed to show all available options
      const params = new URLSearchParams();
      if (filtersToUse.batch && excludeField !== 'batch') params.append('batch', filtersToUse.batch);
      if (filtersToUse.course && excludeField !== 'course' && excludeField !== 'branch') params.append('course', filtersToUse.course);
      if (filtersToUse.branch && excludeField !== 'branch') params.append('branch', filtersToUse.branch);
      // Note: year and semester are not included so they cascade properly
      
      const [filtersResponse, coursesResponse] = await Promise.all([
        api.get(`/attendance/filters?${params.toString()}`),
        api.get('/courses', { params: { includeInactive: false } })
      ]);
      
      if (filtersResponse.data?.success) {
        const data = filtersResponse.data.data || {};
        const nextOptions = {
          batches: data.batches || [],
          courses: data.courses || [],
          branches: data.branches || [],
          years: data.years || [],
          semesters: data.semesters || []
        };
        setFilterOptions(nextOptions);

        filterOptionsCacheRef.current.set(cacheKey, {
          filterOptions: nextOptions,
          coursesWithBranches: coursesResponse.data?.success ? (coursesResponse.data.data || []) : [],
          timestamp: Date.now()
        });
      }

      if (coursesResponse.data?.success) {
        setCoursesWithBranches(coursesResponse.data.data || []);
      }
      
      // Keep cache bounded
      if (filterOptionsCacheRef.current.size > 30) {
        const firstKey = filterOptionsCacheRef.current.keys().next().value;
        filterOptionsCacheRef.current.delete(firstKey);
      }
    } catch (error) {
      console.warn('Unable to load attendance filter options', error);
    }
  };

  const buildCacheKey = (pageToUse) => {
    const keyObj = {
      attendanceDate,
      page: pageToUse,
      pageSize,
      filters
    };
    return JSON.stringify(keyObj);
  };

  const hydrateFromCache = (cacheEntry) => {
    setStudents(cacheEntry.students || []);
    setStatusMap(cacheEntry.statusMap || {});
    setInitialStatusMap(cacheEntry.initialStatusMap || {});
    setTotalStudents(cacheEntry.totalStudents || 0);
    setAttendanceStatistics(cacheEntry.attendanceStatistics || {
      total: 0,
      present: 0,
      absent: 0,
      marked: 0,
      unmarked: 0
    });
    setSmsResults([]); // keep workflow same
    setSmsStatusMap(cacheEntry.smsStatusMap || {});
    setLastUpdatedAt(null);
    setSelectedDateHolidayInfo(cacheEntry.holidayInfo || null);
  };

  const handleDayEndReport = async () => {
    // If modal is already open, just return (prevent multiple opens)
    if (dayEndReportOpen) return;
    
    setDayEndReportLoading(true);
    try {
      const params = {
        date: attendanceDate,
        student_status: 'Regular'
      };
      if (filters.batch) params.batch = filters.batch;
      if (filters.course) params.course = filters.course;
      if (filters.branch) params.branch = filters.branch;
      if (filters.currentYear) params.year = filters.currentYear;
      if (filters.currentSemester) params.semester = filters.currentSemester;

      const response = await api.get('/attendance/summary', { params });
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to fetch day-end report');
      }

      const summary = response.data?.data || {};
      const totalStudents = summary.totalStudents || 0;
      const dailyArray = Array.isArray(summary.daily) ? summary.daily : Object.values(summary.daily || {});
      const safeDaily = (dailyArray || []).filter((d) => d && typeof d === 'object');
      const presentToday = Number(
        safeDaily.find((d) => d.status === 'present')?.count ?? summary.daily?.present ?? 0
      ) || 0;
      const absentToday = Number(
        safeDaily.find((d) => d.status === 'absent')?.count ?? summary.daily?.absent ?? 0
      ) || 0;
      const holidayToday = Number(
        safeDaily.find((d) => d.status === 'holiday')?.count ?? summary.daily?.holiday ?? 0
      ) || 0;
      const markedToday = presentToday + absentToday + holidayToday;
      const unmarkedToday = Math.max(0, totalStudents - markedToday);

      setDayEndReportData({
        totalStudents,
        presentToday,
        absentToday,
        holidayToday,
        markedToday,
        unmarkedToday,
        filtersSnapshot: { ...filters },
        date: attendanceDate
      });
      setDayEndGrouped(summary.groupedSummary || []);
      setDayEndReportOpen(true);
    } catch (error) {
      console.error('Day-end report error:', error);
      toast.error(error.response?.data?.message || 'Unable to fetch day-end report');
    } finally {
      setDayEndReportLoading(false);
    }
  };

  const handleDayEndDownload = async (format = 'xlsx') => {
    try {
      const params = new URLSearchParams();
      params.append('fromDate', attendanceDate);
      params.append('toDate', attendanceDate);
      params.append('format', format);
      params.append('student_status', 'Regular');
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.currentYear) params.append('year', filters.currentYear);
      if (filters.currentSemester) params.append('semester', filters.currentSemester);

      const response = await api.get(`/attendance/download?${params.toString()}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_report_${attendanceDate}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download report error:', error);
      toast.error('Unable to download report');
    }
  };

  const handleSendDayEndReports = async () => {
    if (!attendanceDate) {
      toast.error('Please select a date');
      return;
    }

    setSendingReports(true);
    try {
      const response = await api.post('/attendance/send-day-end-reports', {
        date: attendanceDate
      });

      if (response.data?.success) {
        const { totalSent, totalFailed, totalRecipients } = response.data.data || {};
        if (totalSent > 0) {
          toast.success(`Reports sent successfully to ${totalSent} recipient(s)`);
        } else {
          toast.info('No reports were sent. Please check if there are any recipients configured.');
        }
        if (totalFailed > 0) {
          toast.error(`${totalFailed} report(s) failed to send`);
        }
      } else {
        throw new Error(response.data?.message || 'Failed to send reports');
      }
    } catch (error) {
      console.error('Send reports error:', error);
      toast.error(error.response?.data?.message || 'Unable to send reports');
    } finally {
      setSendingReports(false);
    }
  };

  const handleMarkHolidayForFiltered = async () => {
    if (!filters.currentYear || !filters.currentSemester) {
      toast.error('Select year and semester to mark no class work');
      return;
    }
    const records = students
      .filter((s) => Number.isInteger(s.id))
      .map((s) => ({ studentId: s.id, status: 'holiday' }));
    if (records.length === 0) {
      toast.error('No students found to mark as holiday');
      return;
    }
    // Show modal to enter holiday reason
    setPendingHolidayRecords(records);
    setHolidayReason('');
    setHolidayReasonModalOpen(true);
  };

  const handleConfirmHolidayMarking = async () => {
    if (!holidayReason.trim()) {
      toast.error('Please enter a reason for no class work');
      return;
    }
    setHolidayReasonModalOpen(false);
    setMarkHolidayLoading(true);
    try {
      const records = pendingHolidayRecords.map((r) => ({
        ...r,
        holidayReason: holidayReason.trim()
      }));
      await api.post('/attendance', {
        attendanceDate,
        records
      });
      toast.success('Marked as no class work for selected filters');
      await loadAttendance();
      setHolidayReason('');
      setPendingHolidayRecords([]);
    } catch (error) {
      console.error('Mark holiday failed:', error);
      toast.error(error.response?.data?.message || 'Unable to mark as no class work');
    } finally {
      setMarkHolidayLoading(false);
    }
  };

  const handleGetDeleteCount = async () => {
    setGettingDeleteCount(true);
    try {
      const params = new URLSearchParams({
        date: attendanceDate,
        countOnly: 'true'
      });

      // Add filter parameters if they exist
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.currentYear) params.append('currentYear', filters.currentYear);
      if (filters.currentSemester) params.append('currentSemester', filters.currentSemester);
      if (filters.studentName) params.append('studentName', filters.studentName);
      if (filters.parentMobile) params.append('parentMobile', filters.parentMobile);

      // Use DELETE endpoint with countOnly=true to get the count (it won't actually delete)
      const response = await api.delete(`/attendance?${params.toString()}`);
      setDeleteCount(response.data.data.count || 0);
      setDeleteConfirmModalOpen(true);
    } catch (error) {
      console.error('Failed to get delete count:', error);
      toast.error(error.response?.data?.message || 'Failed to get count of records');
    } finally {
      setGettingDeleteCount(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteConfirmModalOpen(false);
    setDeleteLoading(true);
    try {
      const params = new URLSearchParams({
        date: attendanceDate
      });

      // Add filter parameters if they exist
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.currentYear) params.append('currentYear', filters.currentYear);
      if (filters.currentSemester) params.append('currentSemester', filters.currentSemester);
      if (filters.studentName) params.append('studentName', filters.studentName);
      if (filters.parentMobile) params.append('parentMobile', filters.parentMobile);

      const response = await api.delete(`/attendance?${params.toString()}`);
      toast.success(response.data.message || `Deleted ${response.data.data.deletedCount} attendance record(s)`);
      await loadAttendance(1);
    } catch (error) {
      console.error('Failed to delete attendance:', error);
      toast.error(error.response?.data?.message || 'Failed to delete attendance records');
    } finally {
      setDeleteLoading(false);
      setDeleteCount(0);
    }
  };

  const loadAttendance = async (pageOverride = null) => {
    setLoading(true);
    setSelectedDateHolidayInfo(null);
    // Clear statistics and total students when loading starts to show loading state
    setAttendanceStatistics({
      total: 0,
      present: 0,
      absent: 0,
      marked: 0,
      unmarked: 0
    });
    setTotalStudents(0); // Clear total students count to show loading state
    try {
      // Cancel any in-flight attendance request to avoid queueing when filters change rapidly
      if (pendingRequestRef.current) {
        pendingRequestRef.current.abort();
        pendingRequestRef.current = null;
      }

      const controller = new AbortController();
      pendingRequestRef.current = controller;

      const pageToUse = pageOverride !== null ? pageOverride : currentPage;
      const cacheKey = buildCacheKey(pageToUse);

      // Check cache and use it immediately if fresh, otherwise continue with fetch
      const cached = attendanceCache.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        hydrateFromCache(cached);
        setCurrentPage(pageToUse);
        setLoading(false);
        return cached.attendanceStatistics || {
          total: 0,
          present: 0,
          absent: 0,
          marked: 0,
          unmarked: 0
        };
      }

      const params = new URLSearchParams();
      params.append('date', attendanceDate);

      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.currentYear) params.append('currentYear', filters.currentYear);
      if (filters.currentSemester) params.append('currentSemester', filters.currentSemester);
      if (filters.studentName) params.append('studentName', filters.studentName.trim());
      if (filters.parentMobile) params.append('parentMobile', filters.parentMobile.trim());

      // Check if any filters are applied (batch, course, branch, year, semester)
      // If filters are applied, load ALL students without pagination
      const hasFilters = !!(filters.batch || filters.course || filters.branch || filters.currentYear || filters.currentSemester);
      
      if (hasFilters) {
        // Load all students when filters are applied - use a very large limit
        params.append('limit', '10000'); // Large enough to get all students
        params.append('offset', '0');
      } else {
        // Use pagination when no filters are applied
        params.append('limit', pageSize.toString());
        params.append('offset', ((pageToUse - 1) * pageSize).toString());
      }

      const response = await api.get(`/attendance?${params.toString()}`, { signal: controller.signal });
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch attendance');
      }

      const fetchedStudents = (response.data.data?.students || []).map((student) => {
        // If student has attendanceStatus, use it; otherwise default to 'present' for display
        const status = student.attendanceStatus ? student.attendanceStatus.toLowerCase() : 'present';
        return {
          ...student,
          attendanceStatus: status,
          // Normalize admission number field for downstream handlers
          admissionNumber: student.admissionNumber || student.admission_number || student.admissionNo || null,
          // Keep track of whether student was actually marked in DB
          hasAttendanceRecord: !!student.attendanceStatus
        };
      });

      const statusSnapshot = {};
      fetchedStudents.forEach((student) => {
        // Only set initial status if student was actually marked in database
        // If not marked, leave undefined so we know it needs to be saved
        if (student.hasAttendanceRecord) {
          statusSnapshot[student.id] = student.attendanceStatus || 'present';
        }
        // If not marked, don't set initial status - this allows saving even when all are present
      });

      // Build SMS status map from API response
      const newSmsStatusMap = {};
      fetchedStudents.forEach((student) => {
        // Only show SMS status for absent students who have SMS sent status
        if (student.attendanceStatus === 'absent' && student.smsSent) {
          newSmsStatusMap[student.id] = {
            success: true,
            mocked: false,
            skipped: false,
            reason: null,
            sentTo: student.parentMobile1 || student.parentMobile2 || null,
            studentName: student.studentName,
            admissionNumber: student.admissionNumber || null
          };
        }
      });

      // Get pagination data
      const paginationData = response.data?.pagination || {};
      const total = paginationData.total ?? fetchedStudents.length ?? 0;

      // Get statistics from API response (based on total students, not just current page)
      const statistics = response.data?.data?.statistics;
      
      // If statistics not provided, calculate defaults
      let finalStatistics;
      if (!statistics) {
        finalStatistics = {
          total: total,
          present: 0,
          absent: 0,
          marked: 0,
          unmarked: total
        };
      } else {
        // Ensure unmarked is calculated correctly
        const calculatedUnmarked = Math.max(0, (statistics.total || total) - (statistics.marked || 0));
        finalStatistics = {
          ...statistics,
          total: statistics.total || total,
          unmarked: statistics.unmarked !== undefined ? statistics.unmarked : calculatedUnmarked
        };
      }

      setStudents(fetchedStudents);
      setStatusMap(statusSnapshot);
      setInitialStatusMap({ ...statusSnapshot });
      setTotalStudents(total);
      setAttendanceStatistics(finalStatistics);
      
      // When filters are applied, reset to page 1 since we're loading all students
      // Reuse hasFilters variable declared earlier in the function
      if (hasFilters) {
        setCurrentPage(1);
      } else {
        setCurrentPage(pageToUse);
      }
      setSmsResults([]);
      setSmsStatusMap(newSmsStatusMap); // Populate SMS status from API response
      setLastUpdatedAt(null); // Clear last updated when loading new data

      if (response.data?.data?.holiday) {
        setSelectedDateHolidayInfo(response.data.data.holiday);
      }

      // Cache the result for fast subsequent renders with same filters/date/page
      attendanceCache.current.set(cacheKey, {
        students: fetchedStudents,
        statusMap: statusSnapshot,
        initialStatusMap: { ...statusSnapshot },
        totalStudents: total,
        attendanceStatistics: finalStatistics,
        smsStatusMap: newSmsStatusMap,
        holidayInfo: response.data?.data?.holiday || null,
        timestamp: Date.now()
      });
      // Keep cache size bounded
      if (attendanceCache.current.size > 50) {
        const firstKey = attendanceCache.current.keys().next().value;
        attendanceCache.current.delete(firstKey);
      }
      
      // Reset pending filter when loading new data if no pending students
      if (pendingFilter !== 'all' && finalStatistics.unmarked === 0) {
        setPendingFilter('all');
      }
      
      // Return statistics so we can check if all batches are marked after save
      return finalStatistics;
    } catch (error) {
      if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
        // Request was aborted; let the next request handle UI updates
        return;
      }
      console.error('Attendance fetch failed:', error);
      toast.error(error.response?.data?.message || 'Unable to load attendance');
      setStudents([]);
      setStatusMap({});
      setInitialStatusMap({});
      setTotalStudents(0);
      setSelectedDateHolidayInfo(null);
      // Keep statistics cleared on error to show loading state
      setAttendanceStatistics({
        total: 0,
        present: 0,
        absent: 0,
        marked: 0,
        unmarked: 0
      });
    } finally {
      // Only clear loading if this is the latest request
      pendingRequestRef.current = null;
      setLoading(false);
    }
    
    // Return default statistics if function completes without returning
    return {
      total: 0,
      present: 0,
      absent: 0,
      marked: 0,
      unmarked: 0
    };
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

  const filtersLoadedRef = useRef(false);

  useEffect(() => {
    const initializeAttendance = async () => {
      await loadFilterOptions();
      filtersLoadedRef.current = true;
      // Load attendance immediately after filters are loaded
      setCurrentPage(1);
      loadAttendance(1);
    };
    initializeAttendance();
  }, []);

  // Reload filter options when batch, course, or branch changes (for cascading)
  // This ensures child filters show correct options when parent filters change
  useEffect(() => {
    if (filtersLoadedRef.current) {
      loadFilterOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.batch, filters.course, filters.branch]);

  // Load attendance immediately when filters change (only after initial load)
  useEffect(() => {
    if (filtersLoadedRef.current) {
      setCurrentPage(1);
      loadAttendance(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attendanceDate,
    filters.batch,
    filters.course,
    filters.branch,
    filters.currentYear,
    filters.currentSemester,
    pageSize
  ]);

  useEffect(() => {
    if (!searchEffectInitialized.current) {
      searchEffectInitialized.current = true;
      return;
    }

    setCurrentPage(1);
    const handle = setTimeout(() => {
      loadAttendance(1);
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.studentName, filters.parentMobile]);

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
      if (field === 'course') {
        // When course changes, clear branch
        delete newFilters.branch;
      } else if (field === 'batch') {
        // When batch changes, clear year and semester
        delete newFilters.currentYear;
        delete newFilters.currentSemester;
      } else if (field === 'currentYear') {
        // When year changes, clear semester
        delete newFilters.currentSemester;
      }
      
      return newFilters;
    });
  };

  // Sorting handler
  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { field, direction: 'asc' };
    });
  };

  // Column reordering handlers
  const moveColumn = (columnKey, direction) => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(columnKey);
      if (index === -1) return prev;
      
      const newOrder = [...prev];
      if (direction === 'left' && index > 0) {
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      } else if (direction === 'right' && index < newOrder.length - 1) {
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      }
      return newOrder;
    });
  };

  // Helper function to extract numeric part from PIN (last 4-5 digits)
  const extractPinNumeric = (pinString) => {
    if (!pinString) return 0;
    const pin = String(pinString);
    // Extract the last 4-5 consecutive digits from the end
    // Match digits at the end of the string (greedy, up to 5 digits)
    const match = pin.match(/(\d{4,5})$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    // Fallback: try to extract any numeric part
    const allDigits = pin.match(/\d+/g);
    if (allDigits && allDigits.length > 0) {
      // Take the last group of digits
      return parseInt(allDigits[allDigits.length - 1], 10);
    }
    // If no digits found, try parsing the whole string
    const parsed = parseFloat(pin);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to extract series prefix from PIN
  const extractPinSeries = (pinString) => {
    if (!pinString) return '';
    const pin = String(pinString);
    // Remove the last 4-5 digits to get the series prefix
    const numericMatch = pin.match(/(\d{4,5})$/);
    if (numericMatch) {
      return pin.substring(0, pin.length - numericMatch[1].length);
    }
    // Fallback: return everything except the last numeric part
    const allDigits = pin.match(/\d+/g);
    if (allDigits && allDigits.length > 0) {
      const lastDigits = allDigits[allDigits.length - 1];
      const lastIndex = pin.lastIndexOf(lastDigits);
      return pin.substring(0, lastIndex);
    }
    return pin;
  };

  // Filter students based on pending filter
  const filteredStudents = useMemo(() => {
    if (pendingFilter === 'all') {
      return students;
    }
    if (pendingFilter === 'pending') {
      return students.filter(student => {
        const status = initialStatusMap[student.id];
        return status === undefined; // Not yet marked
      });
    }
    if (pendingFilter === 'marked') {
      return students.filter(student => {
        const status = initialStatusMap[student.id];
        return status !== undefined; // Already marked
      });
    }
    return students;
  }, [students, pendingFilter, initialStatusMap]);

  // Sort students based on sortConfig
  const sortedStudents = useMemo(() => {
    if (!sortConfig.field) return filteredStudents;
    
    return [...students].sort((a, b) => {
      let aValue, bValue;
      let isNumeric = false; // Flag to determine if we should sort numerically
      
      switch (sortConfig.field) {
        case 'student':
          // Name: string sorting (alphabetical)
          aValue = (a.studentName || '').toLowerCase();
          bValue = (b.studentName || '').toLowerCase();
          isNumeric = false;
          break;
        case 'pin':
          // PIN/Roll Number: extract numeric part from the end (last 4-5 digits)
          // First compare by series, then by numeric part
          const aPin = String(a.pinNumber || '');
          const bPin = String(b.pinNumber || '');
          const aSeries = extractPinSeries(aPin);
          const bSeries = extractPinSeries(bPin);
          
          // If series are different, sort by series first
          if (aSeries !== bSeries) {
            const seriesComparison = aSeries.localeCompare(bSeries);
            return sortConfig.direction === 'asc' ? seriesComparison : -seriesComparison;
          }
          
          // Same series, sort by numeric part
          aValue = extractPinNumeric(aPin);
          bValue = extractPinNumeric(bPin);
          isNumeric = true;
          break;
        case 'batch':
          // Batch: try numeric first, fallback to string
          aValue = a.batch || '';
          bValue = b.batch || '';
          const aBatchNum = parseFloat(aValue);
          const bBatchNum = parseFloat(bValue);
          if (!isNaN(aBatchNum) && !isNaN(bBatchNum)) {
            aValue = aBatchNum;
            bValue = bBatchNum;
            isNumeric = true;
          } else {
            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();
            isNumeric = false;
          }
          break;
        case 'course':
          // Course: string sorting
          aValue = (a.course || '').toLowerCase();
          bValue = (b.course || '').toLowerCase();
          isNumeric = false;
          break;
        case 'branch':
          // Branch: string sorting
          aValue = (a.branch || '').toLowerCase();
          bValue = (b.branch || '').toLowerCase();
          isNumeric = false;
          break;
        case 'year':
          // Year: numeric sorting
          aValue = parseFloat(a.currentYear) || 0;
          bValue = parseFloat(b.currentYear) || 0;
          isNumeric = true;
          break;
        case 'semester':
          // Semester: numeric sorting
          aValue = parseFloat(a.currentSemester) || 0;
          bValue = parseFloat(b.currentSemester) || 0;
          isNumeric = true;
          break;
        case 'parentContact':
          // Parent Contact: string sorting (phone numbers as strings)
          aValue = (a.parentMobile1 || a.parentMobile2 || '').toLowerCase();
          bValue = (b.parentMobile1 || b.parentMobile2 || '').toLowerCase();
          isNumeric = false;
          break;
        case 'attendance':
          // Attendance: string sorting (present/absent)
          aValue = (effectiveStatus(a.id) || '').toLowerCase();
          bValue = (effectiveStatus(b.id) || '').toLowerCase();
          isNumeric = false;
          break;
        default:
          return 0;
      }
      
      // Handle numeric sorting
      if (isNumeric) {
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      
      // Handle string sorting
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredStudents, sortConfig, statusMap]);

  // Handle student row click to show report
  const handleStudentClick = async (student) => {
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
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (loading) {
      return;
    }

    const safePageSize = pageSize || 1;
    const totalPages = totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / safePageSize)) : 1;

    if (newPage === currentPage || newPage < 1 || newPage > totalPages) {
      return;
    }

    loadAttendance(newPage);
  };

  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value, 10);

    if (loading) {
      return;
    }

    if (Number.isNaN(newSize) || newSize <= 0 || newSize === pageSize) {
      return;
    }

    setCurrentPage(1);
    setPageSize(newSize);
    // loadAttendance will be called by useEffect when pageSize changes
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
      const holidayMonthKey = getMonthKeyFromDate(savedHoliday?.date || date);
      const modalMonthKey = calendarViewMonthKey || (calendarModalOpen ? getMonthKeyFromDate(attendanceDate) : null);

      // Refresh the month where the holiday was saved
      await fetchCalendarMonth(holidayMonthKey, {
        applyToHeader: holidayMonthKey === calendarMonthKey,
        applyToModal: calendarModalOpen && holidayMonthKey === modalMonthKey,
        force: true
      });

      // If modal is viewing a different month, refresh that month too
      if (calendarModalOpen && modalMonthKey && modalMonthKey !== holidayMonthKey) {
        await fetchCalendarMonth(modalMonthKey, {
          applyToHeader: false,
          applyToModal: true,
          force: true
        });
      }

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

  const prepareAttendanceReport = () => {
    const presentStudents = [];
    const absentStudents = [];

    students.forEach((student) => {
      const current = effectiveStatus(student.id);
      if (current === 'present') {
        presentStudents.push(student);
      } else if (current === 'absent') {
        absentStudents.push(student);
      }
    });

    return {
      totalStudents: totalStudents, // Use total from pagination
      presentCount: presentStudents.length,
      absentCount: absentStudents.length,
      presentStudents,
      absentStudents,
      absentPinNumbers: absentStudents
        .map(s => s.pinNumber || s.pin_no || 'N/A')
        .filter(pin => pin !== 'N/A')
    };
  };

  const handleSaveClick = () => {
    if (editingLocked) {
      toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
      return;
    }

    const report = prepareAttendanceReport();
    
    // Check if there are any changes or unmarked students
    const hasChanges = students.some((student) => {
      const current = effectiveStatus(student.id);
      const initial = initialStatusMap[student.id];
      // If student doesn't have initial status, they need to be saved
      if (initial === undefined) return true;
      return current !== initial;
    });

    // Allow saving if there are students, even if all are present
    // Only prevent if there are truly no students to save
    if (!hasChanges && students.length === 0) {
      toast('Nothing to save');
      return;
    }

    setAttendanceReport(report);
    setShowReportModal(true);
  };

  const handleConfirmSave = async () => {
    if (editingLocked) {
      toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
      return;
    }
    const records = students
      .map((student) => {
        const current = effectiveStatus(student.id);
        const initial = initialStatusMap[student.id];
        
        // Save if:
        // 1. Status has changed from initial, OR
        // 2. Student doesn't have an initial status (not yet marked in database)
        // This allows saving even when all students are present
        if (initial !== undefined && current === initial) {
          return null; // No change, skip
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
      setShowReportModal(false);
      return;
    }

    setSaving(true);
    setShowReportModal(false);
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
          attendanceStatus: statusMap[student.id] || 'present'
        }))
      );

      // Reload attendance to get updated statistics
      const updatedStats = await loadAttendance(currentPage);
      
      // Check if all batches are marked - if unmarked count is 0, show day-end report popup
      if (updatedStats && updatedStats.unmarked === 0 && updatedStats.total > 0 && !allBatchesMarkedModalOpen) {
        // Show day-end report popup after a short delay to let the user see the success message
        setTimeout(() => {
          handleDayEndReport();
          setAllBatchesMarkedModalOpen(true);
        }, 1000);
      }

      const results = response.data.data?.smsResults || [];
      setSmsResults(results);
      
      // Build SMS status map for quick lookup
      const newSmsStatusMap = {};
      results.forEach(result => {
        newSmsStatusMap[result.studentId] = {
          success: result.success,
          mocked: result.mocked,
          skipped: result.skipped,
          reason: result.reason,
          sentTo: result.sentTo || result.parentMobile,
          studentName: result.studentName,
          admissionNumber: result.admissionNumber
        };
      });
      setSmsStatusMap(newSmsStatusMap);
      
      setSmsCurrentPage(1);
      if (results.length > 0) {
        setSmsModalOpen(true);
      }
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

  const handleSave = handleSaveClick;

  // Retry SMS for a specific student
  const handleRetrySms = async (student) => {
    if (!student || retryingSmsFor) return;
    
    setRetryingSmsFor(student.id);
    try {
      const response = await api.post('/attendance/retry-sms', {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        attendanceDate: attendanceDate,
        parentMobile: student.parentMobile1 || student.parentMobile2
      });
      
      if (response.data?.success) {
        const result = response.data.data;
        
        // Update SMS status map
        setSmsStatusMap(prev => ({
          ...prev,
          [student.id]: {
            success: result.success,
            mocked: result.mocked,
            skipped: result.skipped,
            reason: result.reason,
            sentTo: result.sentTo,
            studentName: student.studentName,
            admissionNumber: student.admissionNumber
          }
        }));
        
        // Update smsResults array
        setSmsResults(prev => prev.map(r => 
          r.studentId === student.id 
            ? { ...r, ...result }
            : r
        ));
        
        if (result.success) {
          toast.success(`SMS ${result.mocked ? 'simulated' : 'sent'} to ${result.sentTo || student.parentMobile1}`);
        } else {
          toast.error(`SMS failed: ${result.reason || 'Unknown error'}`);
        }
      } else {
        toast.error(response.data?.message || 'Failed to retry SMS');
      }
    } catch (error) {
      console.error('SMS retry failed:', error);
      toast.error(error.response?.data?.message || 'Failed to retry SMS');
    } finally {
      setRetryingSmsFor(null);
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
    const semesterTotals = history?.semester?.totals || { present: 0, absent: 0, unmarked: 0 };

    rows.push(csvValue('Student Name') + ',' + csvValue(student.studentName || 'Unknown'));
    rows.push(csvValue('PIN Number') + ',' + csvValue(student.pinNumber || 'N/A'));
    rows.push(csvValue('Batch') + ',' + csvValue(student.batch || 'N/A'));
    rows.push(csvValue('Course') + ',' + csvValue(student.course || 'N/A'));
    rows.push(csvValue('Branch') + ',' + csvValue(student.branch || 'N/A'));
    rows.push(csvValue('Current Year') + ',' + csvValue(student.currentYear || 'N/A'));
    rows.push(csvValue('Current Semester') + ',' + csvValue(student.currentSemester || 'N/A'));
    rows.push('');

    if (history?.semester) {
      rows.push(csvValue('Semester Summary'));
      rows.push(csvValue('Period') + ',' + csvValue(`${history.semester.startDate} → ${history.semester.endDate}`));
      rows.push(
        [csvValue('Present'), csvValue('Absent'), csvValue('Unmarked'), csvValue('Holidays')].join(',')
      );
      rows.push(
        [
          csvValue(semesterTotals.present || 0),
          csvValue(semesterTotals.absent || 0),
          csvValue(semesterTotals.unmarked || 0),
          csvValue(semesterTotals.holidays || 0)
        ].join(',')
      );
      const totalWorkingDays = (semesterTotals.present || 0) + (semesterTotals.absent || 0) + (semesterTotals.unmarked || 0);
      const presentDays = semesterTotals.present || 0;
      const percentage = totalWorkingDays > 0 ? ((presentDays / totalWorkingDays) * 100).toFixed(2) : '0.00';
      rows.push(csvValue('Attendance Percentage') + ',' + csvValue(`${percentage}%`));
      rows.push('');
    }

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
    const seriesToUse = history?.semester?.series || history?.monthly?.series || [];
    seriesToUse.forEach((entry) => {
      const status = entry.status
        ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1)
        : entry.isHoliday ? 'Holiday' : 'Unmarked';
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
  const semesterChartSeries = historyData ? buildChartSeries(historyData.semester?.series) : [];

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full bg-blue-100 p-2 sm:p-3 text-blue-600 flex-shrink-0">
            <CalendarCheck size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 heading-font">Attendance</h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Filter students and mark daily attendance. Absent students trigger an SMS alert to parents.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="flex-1 sm:flex-none rounded-md border border-gray-300 px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
          />
          <button
            type="button"
            onClick={handleOpenCalendarModal}
            className="rounded-md border border-gray-300 px-3 py-2.5 sm:py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Open calendar"
          >
            <CalendarDays size={18} />
          </button>
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4">
        <div className="space-y-3">
          {/* Filter Header */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-600 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          </div>
          
          {/* Dropdown Filters - Grid Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            <select
              value={filters.batch}
              onChange={(event) => handleFilterChange('batch', event.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Batches</option>
              {filterOptions.batches.map((batchOption) => (
                <option key={batchOption} value={batchOption}>
                  {batchOption}
                </option>
              ))}
            </select>
            <select
              value={filters.course || ''}
              onChange={(event) => handleFilterChange('course', event.target.value)}
              onFocus={() => {
                // When user focuses on course dropdown, refresh options excluding current course
                // This shows all courses for the selected batch, allowing direct selection
                const filtersForFetch = { ...filters };
                if (filtersForFetch.course) {
                  delete filtersForFetch.course;
                }
                loadFilterOptions(filtersForFetch, 'course');
              }}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Courses</option>
               {filterOptions.courses
                 .filter((courseOption) => !EXCLUDED_COURSES.has(courseOption))
                 .map((courseOption) => (
                   <option key={courseOption} value={courseOption}>
                     {courseOption}
                   </option>
                 ))}
            </select>
            <select
              value={filters.branch || ''}
              onChange={(event) => handleFilterChange('branch', event.target.value)}
              onFocus={() => {
                // When user focuses on branch dropdown, refresh options excluding current branch
                // This shows all branches for the selected course, allowing direct selection
                const filtersForFetch = { ...filters };
                if (filtersForFetch.branch) {
                  delete filtersForFetch.branch;
                }
                loadFilterOptions(filtersForFetch, 'branch');
              }}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px] disabled:opacity-50 col-span-2 sm:col-span-1"
              disabled={filters.course && availableBranches.length === 0}
            >
              <option value="">All Branches</option>
              {availableBranches.map((branchOption) => (
                <option key={branchOption} value={branchOption}>
                  {branchOption}
                </option>
              ))}
            </select>
            <select
              value={filters.currentYear}
              onChange={(event) => handleFilterChange('currentYear', event.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Years</option>
              {filterOptions.years.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  Year {yearOption}
                </option>
              ))}
            </select>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                value={filters.currentSemester}
                onChange={(event) => handleFilterChange('currentSemester', event.target.value)}
                className="w-full sm:w-auto flex-1 rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              >
                <option value="">All Semesters</option>
                {filterOptions.semesters.map((semesterOption) => (
                  <option key={semesterOption} value={semesterOption}>
                    Sem {semesterOption}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDayEndReport}
                disabled={dayEndReportLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] sm:min-w-[132px] whitespace-nowrap"
              >
                <Download size={14} />
                {dayEndReportLoading ? 'Loading...' : 'Day End Report'}
              </button>
            </div>
          </div>
          
          {/* Search Inputs - Full Width on Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Student name or PIN"
                value={filters.studentName}
                onChange={(event) => handleFilterChange('studentName', event.target.value)}
                className="w-full rounded-md border border-gray-300 pl-8 sm:pl-10 pr-2 sm:pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              />
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Parent mobile"
                value={filters.parentMobile}
                onChange={(event) => handleFilterChange('parentMobile', event.target.value)}
                className="w-full rounded-md border border-gray-300 pl-8 sm:pl-10 pr-2 sm:pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              />
            </div>
          </div>
          
          {/* Action Buttons and Results Count */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors touch-manipulation min-h-[44px]"
            >
              <RefreshCw size={14} />
              Clear Filters
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 justify-end">
              {filters.currentYear && filters.currentSemester && (
                <button
                  type="button"
                  onClick={handleMarkHolidayForFiltered}
                  disabled={markHolidayLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-md hover:bg-amber-700 active:bg-amber-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                >
                  {markHolidayLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                  Mark Holiday (Year {filters.currentYear}, Sem {filters.currentSemester})
                </button>
              )}
              <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-right">
                {loading && totalStudents === 0 ? (
                  <div className="flex items-center justify-end gap-2">
                    <div className="animate-pulse bg-gray-200 rounded h-4 w-12" />
                    <span>students found</span>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold">{totalStudents.toLocaleString()}</span> students found
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Day End Report Modal */}
      {dayEndReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Day End Report</h3>
                <p className="text-xs text-gray-500">{dayEndReportData?.date || attendanceDate}</p>
              </div>
              <button
                onClick={() => setDayEndReportOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
                <StatPill label="Total Students" value={dayEndReportData?.totalStudents ?? 0} color="gray" />
                <StatPill label="Marked Today" value={dayEndReportData?.markedToday ?? 0} color="green" />
                <StatPill label="Absent Today" value={dayEndReportData?.absentToday ?? 0} color="red" />
                <StatPill label="Present Today" value={dayEndReportData?.presentToday ?? 0} color="blue" />
                <StatPill label="Holiday Today" value={dayEndReportData?.holidayToday ?? 0} color="green" />
                <StatPill label="Unmarked Today" value={dayEndReportData?.unmarkedToday ?? 0} color="amber" />
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-800">Filters</p>
                <div className="flex flex-wrap gap-1.5">
                  {dayEndReportData?.filtersSnapshot?.batch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      Batch: {dayEndReportData.filtersSnapshot.batch}
                    </span>
                  )}
                  {dayEndReportData?.filtersSnapshot?.course && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      Course: {dayEndReportData.filtersSnapshot.course}
                    </span>
                  )}
                  {dayEndReportData?.filtersSnapshot?.branch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      Branch: {dayEndReportData.filtersSnapshot.branch}
                    </span>
                  )}
                  {dayEndReportData?.filtersSnapshot?.currentYear && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      Year: {dayEndReportData.filtersSnapshot.currentYear}
                    </span>
                  )}
                  {dayEndReportData?.filtersSnapshot?.currentSemester && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      Sem: {dayEndReportData.filtersSnapshot.currentSemester}
                    </span>
                  )}
                  {!dayEndReportData?.filtersSnapshot?.batch &&
                    !dayEndReportData?.filtersSnapshot?.course &&
                    !dayEndReportData?.filtersSnapshot?.branch &&
                    !dayEndReportData?.filtersSnapshot?.currentYear &&
                    !dayEndReportData?.filtersSnapshot?.currentSemester && (
                      <span className="text-gray-500">No filters applied (all students)</span>
                    )}
                </div>
              </div>
              {dayEndGrouped.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
                    <span>Preview</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDayEndPreviewFilter('all')}
                        className={`px-2 py-0.5 rounded border text-[11px] ${
                          dayEndPreviewFilter === 'all'
                            ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setDayEndPreviewFilter('marked')}
                        className={`px-2 py-0.5 rounded border text-[11px] ${
                          dayEndPreviewFilter === 'marked'
                            ? 'bg-green-100 border-green-200 text-green-700'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        Marked
                      </button>
                      <button
                        onClick={() => setDayEndPreviewFilter('unmarked')}
                        className={`px-2 py-0.5 rounded border text-[11px] ${
                          dayEndPreviewFilter === 'unmarked'
                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        Unmarked
                      </button>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-[11px] font-normal">
                      <span className="text-gray-600">Sort</span>
                      <select
                        value={dayEndSortBy}
                        onChange={(e) => setDayEndSortBy(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-[11px] bg-white"
                      >
                        <option value="none">None</option>
                        <option value="yearSem">Year / Sem</option>
                        <option value="branch">Branch</option>
                        <option value="course">Course</option>
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[50vh]">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 text-gray-700 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">College</th>
                          <th className="px-3 py-2 text-left">Batch</th>
                          <th className="px-3 py-2 text-left">Course</th>
                          <th className="px-3 py-2 text-left">Branch</th>
                          <th className="px-3 py-2 text-center">Year</th>
                          <th className="px-3 py-2 text-center">Sem</th>
                          <th className="px-3 py-2 text-right">Students</th>
                          <th className="px-3 py-2 text-right">Marked</th>
                          <th className="px-3 py-2 text-right">Pending</th>
                          <th className="px-3 py-2 text-right">Absent</th>
                          <th className="px-3 py-2 text-right">Holiday</th>
                          <th className="px-3 py-2 text-right">Present</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dayEndGroupedDisplay
                          .filter((row) => {
                            if (dayEndPreviewFilter === 'marked') return (row.markedToday || 0) > 0;
                            if (dayEndPreviewFilter === 'unmarked') return (row.pendingToday || 0) > 0;
                            return true;
                          })
                          .map((row, idx) => (
                          <tr key={`${row.college || 'N/A'}-${idx}`} className="bg-white">
                            <td className="px-3 py-2 text-gray-800">{row.college || '—'}</td>
                            <td className="px-3 py-2 text-gray-800">{row.batch || '—'}</td>
                            <td className="px-3 py-2 text-gray-800">{row.course || '—'}</td>
                            <td className="px-3 py-2 text-gray-800">{row.branch || '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-800">{row.year || '—'}</td>
                            <td className="px-3 py-2 text-center text-gray-800">{row.semester || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{row.totalStudents ?? 0}</td>
                          <td className="px-3 py-2 text-right text-green-700 font-semibold">{row.markedToday ?? 0}</td>
                          <td className="px-3 py-2 text-right text-amber-700 font-semibold">{row.pendingToday ?? 0}</td>
                          <td className="px-3 py-2 text-right text-red-700 font-semibold">{row.absentToday ?? 0}</td>
                            <td className="px-3 py-2 text-right text-green-700 font-semibold">
                              {row.holidayToday ?? 0}
                              {row.holidayReasons && (
                                <div className="text-[10px] text-gray-600 mt-1 font-normal italic">
                                  {row.holidayReasons}
                                </div>
                              )}
                            </td>
                          <td className="px-3 py-2 text-right text-blue-700 font-semibold">{row.presentToday ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <div className="flex items-center gap-2 mr-auto">
                  <button
                    onClick={() => handleDayEndDownload('xlsx')}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
                  >
                    <Download size={12} />
                    Excel
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendDayEndReports}
                    disabled={sendingReports}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sendingReports ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Send Reports
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDayEndReportOpen(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Reason Modal */}
      {holidayReasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Mark as No Class Work</h3>
                <p className="text-xs text-gray-500">Enter reason for marking {pendingHolidayRecords.length} students as no class work</p>
              </div>
              <button
                onClick={() => {
                  setHolidayReasonModalOpen(false);
                  setHolidayReason('');
                  setPendingHolidayRecords([]);
                }}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  No Class Work Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="e.g., Festival holiday, College function, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={4}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setHolidayReasonModalOpen(false);
                    setHolidayReason('');
                    setPendingHolidayRecords([]);
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmHolidayMarking}
                  disabled={markHolidayLoading || !holidayReason.trim()}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markHolidayLoading ? 'Marking...' : 'Mark as No Class Work'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Clear Today's Attendance</h3>
                <p className="text-xs text-gray-500 mt-1">
                  This will delete attendance records for {attendanceDate} matching your current filters
                </p>
              </div>
              <button
                onClick={() => {
                  setDeleteConfirmModalOpen(false);
                  setDeleteCount(0);
                }}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                disabled={deleteLoading}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 p-2">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">
                      {deleteCount} attendance record{deleteCount !== 1 ? 's' : ''} will be deleted
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      This action cannot be undone. Make sure you want to delete these records.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setDeleteConfirmModalOpen(false);
                    setDeleteCount(0);
                  }}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Statistics */}
      <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <Check size={20} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Total Present</p>
              {loading && attendanceStatistics.total === 0 ? (
                <div className="animate-pulse bg-gray-200 rounded h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-green-700">{presentCount}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <CalendarCheck size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Total Marked</p>
              {loading && attendanceStatistics.total === 0 ? (
                <div className="animate-pulse bg-gray-200 rounded h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-blue-700">{markedCount}</p>
              )}
            </div>
          </div>
        </div>
        <div 
          className={`bg-white border ${pendingCount > 0 && !loading ? 'border-amber-300' : 'border-gray-200'} rounded-xl shadow-sm p-4 ${pendingCount > 0 && !loading ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
          onClick={() => {
            if (pendingCount > 0 && !loading) {
              setPendingFilter(pendingFilter === 'pending' ? 'all' : 'pending');
              setShowPendingStudents(true);
            }
          }}
          title={pendingCount > 0 && !loading ? "Click to view pending students" : ""}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Pending Marked</p>
              {loading && attendanceStatistics.total === 0 ? (
                <div className="animate-pulse bg-gray-200 rounded h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2">
              <X size={20} className="text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Total Absent</p>
              {loading && attendanceStatistics.total === 0 ? (
                <div className="animate-pulse bg-gray-200 rounded h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-red-700">{absentCount}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <CalendarCheck size={18} />
            <span>Daily Attendance</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {isAdmin && isToday && (
              <button
                type="button"
                onClick={handleGetDeleteCount}
                disabled={gettingDeleteCount || deleteLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gettingDeleteCount || deleteLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {gettingDeleteCount ? 'Counting...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <X size={16} />
                    Clear Today's Data
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving || editingLocked}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-md text-sm font-semibold transition-colors touch-manipulation min-h-[44px] ${
                hasChanges && !saving && !editingLocked
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
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
        </div>
        {editingLocked && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm text-gray-600">
            {editingLockReason || 'Attendance is read-only for this date.'}
          </div>
        )}

        {loading || saving ? (
          <div className="p-4">
            <SkeletonAttendanceTable rows={pageSize || 10} />
          </div>
        ) : sortedStudents.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
            <AlertTriangle size={32} />
            <p>
              {pendingFilter === 'pending' 
                ? 'No pending students found. All students are marked.' 
                : pendingFilter === 'marked'
                ? 'No marked students found.'
                : 'No students found for the selected filters.'}
            </p>
            {pendingFilter !== 'all' && (
              <button
                onClick={() => setPendingFilter('all')}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Show All Students
              </button>
            )}
          </div>
        ) : (
          <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {columnOrder.map((columnKey) => {
                    const columnConfig = {
                      student: { label: 'Student', sortable: true },
                      pin: { label: 'PIN', sortable: true },
                      registrationStatus: { label: 'Registration Status', sortable: true },
                      batch: { label: 'Batch', sortable: true },
                      course: { label: 'Course', sortable: true },
                      branch: { label: 'Branch', sortable: true },
                      year: { label: 'Year', sortable: true },
                      semester: { label: 'Semester', sortable: true },
                      parentContact: { label: 'Parent Contact', sortable: true },
                      attendance: { label: 'Attendance', sortable: true },
                      smsStatus: { label: 'SMS Status', sortable: false },
                      insights: { label: 'Insights', sortable: false, align: 'right' }
                    };
                    const config = columnConfig[columnKey];
                    if (!config) return null;
                    
                    return (
                      <th key={columnKey} className={`px-4 py-3 ${config.align === 'right' ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-2 ${config.align === 'right' ? 'justify-end' : ''}`}>
                          <div className={`flex items-center gap-1 ${config.align === 'right' ? '' : 'flex-1'}`}>
                            {config.sortable ? (
                              <button
                                onClick={() => handleSort(columnKey)}
                                className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                              >
                                <span>{config.label}</span>
                                {sortConfig.field === columnKey && (
                                  <ArrowUpDown size={14} className={sortConfig.direction === 'asc' ? 'rotate-180' : ''} />
                                )}
                              </button>
                            ) : (
                              <span>{config.label}</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveColumn(columnKey, 'left')}
                              disabled={columnOrder.indexOf(columnKey) === 0}
                              className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move left"
                            >
                              <ChevronLeft size={12} />
                            </button>
                            <button
                              onClick={() => moveColumn(columnKey, 'right')}
                              disabled={columnOrder.indexOf(columnKey) === columnOrder.length - 1}
                              className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move right"
                            >
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedStudents.map((student) => {
                  const status = effectiveStatus(student.id);
                  const parentContact = student.parentMobile1 || student.parentMobile2 || 'Not available';
                  return (
                    <tr 
                      key={student.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleStudentClick(student)}
                    >
                      {columnOrder.map((columnKey) => {
                        if (columnKey === 'student') {
                          return (
                            <td key={columnKey} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-3">
                                {renderPhoto(student)}
                                <div className="font-semibold text-gray-900">
                                  {student.studentName || 'Unknown Student'}
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (columnKey === 'pin') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {student.pinNumber || 'N/A'}
                            </td>
                          );
                        }
                        if (columnKey === 'registrationStatus') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const raw = (student.registration_status || '').toLowerCase();
                                const isCompleted = raw === 'completed' || raw === 'registered' || raw === 'done';
                                const label = isCompleted ? 'Completed' : 'Pending';
                                const cls = isCompleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                                const handleDoubleClick = async () => {
                                  if (isCompleted) return; // Already completed
                                  const admissionNumber = student.admissionNumber || student.admission_number;
                                  if (!admissionNumber) {
                                    toast.error('Missing admission number for update');
                                    return;
                                  }
                                  try {
                                    const response = await api.put(`/students/${admissionNumber}/registration-status`, {
                                      registration_status: 'completed'
                                    });
                                    if (response.data?.success) {
                                      setStudents((prev) => prev.map((s) =>
                                        s.id === student.id ? { ...s, registration_status: 'completed' } : s
                                      ));
                                      toast.success('Registration marked as completed');
                                    } else {
                                      throw new Error(response.data?.message || 'Failed to update status');
                                    }
                                  } catch (error) {
                                    // Fallback to generic student update (JSON student_data)
                                    try {
                                      const fallback = await api.put(`/students/${admissionNumber}`, {
                                        studentData: {
                                          'Registration Status': 'completed',
                                          registration_status: 'completed'
                                        }
                                      });
                                      if (fallback.data?.success) {
                                        setStudents((prev) => prev.map((s) =>
                                          s.id === student.id ? { ...s, registration_status: 'completed' } : s
                                        ));
                                        toast.success('Registration marked as completed');
                                      } else {
                                        toast.error(fallback.data?.message || (error.response?.data?.message || 'Update failed'));
                                      }
                                    } catch (fallbackError) {
                                      toast.error(fallbackError.response?.data?.message || (error.response?.data?.message || 'Update failed'));
                                    }
                                  }
                                };
                                return (
                                  <span
                                    onDoubleClick={handleDoubleClick}
                                    title={!isCompleted ? 'Double-click to mark as completed' : undefined}
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cls} select-none cursor-pointer`}
                                  >
                                    {label}
                                  </span>
                                );
                              })()}
                            </td>
                          );
                        }
                        if (columnKey === 'batch') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {student.batch || 'N/A'}
                            </td>
                          );
                        }
                        if (columnKey === 'course') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {student.course || 'N/A'}
                            </td>
                          );
                        }
                        if (columnKey === 'branch') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {student.branch || 'N/A'}
                            </td>
                          );
                        }
                        if (columnKey === 'year') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {student.currentYear ? `Year ${student.currentYear}` : 'N/A'}
                            </td>
                          );
                        }
                        if (columnKey === 'semester') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {student.currentSemester ? `Semester ${student.currentSemester}` : 'N/A'}
                            </td>
                          );
                        }
                        if (columnKey === 'parentContact') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                              <div>{parentContact}</div>
                            </td>
                          );
                        }
                        if (columnKey === 'attendance') {
                          return (
                            <td key={columnKey} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              {/* Attendance status logic:
                            - hasDbRecord: student.attendanceStatus is not null (record exists in DB for this date)
                            - statusChanged: current status differs from initial loaded status
                            - justSaved: attendance was saved in this session
                            
                            Show "Marked" only if:
                            1. There's a DB record AND status hasn't been changed locally
                            2. OR attendance was just saved in this session
                        */}
                        {(() => {
                          const hasDbRecord = student.attendanceStatus !== null;
                          const statusChanged = statusMap[student.id] !== initialStatusMap[student.id];
                          const justSaved = lastUpdatedAt !== null;
                          
                          // Show marked state if saved or has existing record that wasn't changed
                          const isHoliday = status === 'holiday';
                          const showMarked = justSaved || (hasDbRecord && !statusChanged);
                          
                          if (showMarked && !statusChanged) {
                            return (
                              <div className="flex items-center gap-3">
                                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                                  isHoliday
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : status === 'present' 
                                    ? 'bg-green-100 text-green-700 border border-green-200' 
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                  {isHoliday ? <AlertTriangle size={16} /> : <Check size={16} />}
                                  {isHoliday
                                    ? 'No Class Work (Marked)'
                                    : status === 'present'
                                    ? 'Present (Marked)'
                                    : 'Absent (Marked)'}
                                </div>
                                {/* Still allow changing even if marked */}
                                {!isHoliday && (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={status === 'absent'}
                                      onChange={(e) => {
                                        if (editingLocked) {
                                          toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
                                          return;
                                        }
                                        handleStatusChange(student.id, e.target.checked ? 'absent' : 'present');
                                      }}
                                      disabled={editingLocked}
                                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className={`text-sm ${editingLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                                      Change
                                    </span>
                                  </label>
                                )}
                              </div>
                            );
                          }
                          
                          // Not marked yet - show toggle controls
                          return (
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                                status === 'holiday'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : status === 'present' 
                                  ? 'bg-green-50 text-green-600 border border-green-100' 
                                  : 'bg-red-50 text-red-600 border border-red-100'
                              }`}>
                                {status === 'holiday' ? (
                                  <>
                                    <AlertTriangle size={16} />
                                    Holiday
                                  </>
                                ) : status === 'present' ? (
                                  <>
                                    <Check size={16} />
                                    Present
                                  </>
                                ) : (
                                  <>
                                    <X size={16} />
                                    Absent
                                  </>
                                )}
                              </div>
                              {status !== 'holiday' && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={status === 'absent'}
                                    onChange={(e) => {
                                      if (editingLocked) {
                                        toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
                                        return;
                                      }
                                      handleStatusChange(student.id, e.target.checked ? 'absent' : 'present');
                                    }}
                                    disabled={editingLocked}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span className={`text-sm ${editingLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                                    Mark as Absent
                                  </span>
                                </label>
                              )}
                            </div>
                          );
                        })()}
                            </td>
                          );
                        }
                        if (columnKey === 'smsStatus') {
                          return (
                            <td key={columnKey} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const smsStatus = smsStatusMap[student.id];
                                if (!smsStatus) {
                                  if (status === 'absent') {
                                    return (
                                      <button
                                        onClick={() => handleRetrySms(student)}
                                        disabled={retryingSmsFor === student.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                                        title="Click to send SMS notification"
                                      >
                                        {retryingSmsFor === student.id ? (
                                          <>
                                            <RefreshCw size={12} className="animate-spin" />
                                            Sending...
                                          </>
                                        ) : (
                                          <>
                                            <AlertTriangle size={12} />
                                            Pending - Send
                                          </>
                                        )}
                                      </button>
                                    );
                                  }
                                  return <span className="text-xs text-gray-400">-</span>;
                                }
                                
                                if (smsStatus.success) {
                                  return smsStatus.mocked ? (
                                    <button
                                      onClick={() => handleRetrySms(student)}
                                      disabled={retryingSmsFor === student.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Test mode - Click to send again"
                                    >
                                      {retryingSmsFor === student.id ? (
                                        <>
                                          <RefreshCw size={12} className="animate-spin" />
                                          Sending...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw size={12} />
                                          Test - Send Again
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRetrySms(student)}
                                      disabled={retryingSmsFor === student.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors cursor-pointer disabled:opacity-50"
                                      title="SMS sent - Click to send again"
                                    >
                                      {retryingSmsFor === student.id ? (
                                        <>
                                          <RefreshCw size={12} className="animate-spin" />
                                          Sending...
                                        </>
                                      ) : (
                                        <>
                                          <Check size={12} />
                                          Sent - Send Again
                                        </>
                                      )}
                                    </button>
                                  );
                                }
                                
                                if (smsStatus.skipped) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700" title={smsStatus.reason}>
                                      <AlertTriangle size={12} />
                                      {smsStatus.reason === 'missing_parent_mobile' ? 'No Mobile' : 'Skipped'}
                                    </span>
                                  );
                                }
                                
                                return (
                                  <button
                                    onClick={() => handleRetrySms(student)}
                                    disabled={retryingSmsFor === student.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer disabled:opacity-50"
                                    title={`Failed: ${smsStatus.reason || 'Unknown error'}. Click to retry.`}
                                  >
                                    {retryingSmsFor === student.id ? (
                                      <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        Retrying...
                                      </>
                                    ) : (
                                      <>
                                        <X size={12} />
                                        Failed - Retry
                                      </>
                                    )}
                                  </button>
                                );
                              })()}
                            </td>
                          );
                        }
                        if (columnKey === 'insights') {
                          return (
                            <td key={columnKey} className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStudentClick(student);
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                  <BarChart3 size={16} />
                                  View Report
                                </button>
                              </div>
                            </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3 p-3 sm:p-4">
            {sortedStudents.map((student) => {
              const status = effectiveStatus(student.id);
              const parentContact = student.parentMobile1 || student.parentMobile2 || 'Not available';
              const hasDbRecord = student.attendanceStatus !== null;
              const statusChanged = statusMap[student.id] !== initialStatusMap[student.id];
              const justSaved = lastUpdatedAt !== null;
              const showMarked = justSaved || (hasDbRecord && !statusChanged);
              
              return (
                <div
                  key={student.id}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4 space-y-3">
                    {/* Header with Photo and Name */}
                    <div className="flex items-start gap-3" onClick={() => handleStudentClick(student)}>
                      {renderPhoto(student)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-base truncate">{student.studentName || 'Unknown Student'}</h3>
                        <p className="text-sm text-gray-600 mt-1">{student.pinNumber || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {/* Key Information */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500">Batch</p>
                        <p className="text-sm font-medium text-gray-900">{student.batch || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Course</p>
                        <p className="text-sm font-medium text-gray-900 truncate" title={student.course || ''}>{student.course || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Branch</p>
                        <p className="text-sm font-medium text-gray-900 truncate" title={student.branch || ''}>{student.branch || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Year/Sem</p>
                        <p className="text-sm font-medium text-gray-900">
                          {student.currentYear ? `Y${student.currentYear}` : 'N/A'}/{student.currentSemester ? `S${student.currentSemester}` : 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Parent Contact</p>
                        <p className="text-sm font-medium text-gray-900">{parentContact}</p>
                      </div>
                    </div>
                    
                    {/* Attendance Status */}
                    <div className="pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      {showMarked && !statusChanged ? (
                        <div className="flex flex-col gap-2">
                          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                            status === 'present' 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {status === 'present' ? <Check size={16} /> : <X size={16} />}
                            {status === 'present' ? 'Present (Marked)' : 'Absent (Marked)'}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={status === 'absent'}
                              onChange={(e) => {
                                if (editingLocked) {
                                  toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
                                  return;
                                }
                                handleStatusChange(student.id, e.target.checked ? 'absent' : 'present');
                              }}
                              disabled={editingLocked}
                              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50"
                            />
                            <span className={`text-sm ${editingLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                              Change Status
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                            status === 'present' 
                              ? 'bg-green-50 text-green-600 border border-green-100' 
                              : 'bg-red-50 text-red-600 border border-red-100'
                          }`}>
                            {status === 'present' ? <Check size={16} /> : <X size={16} />}
                            {status === 'present' ? 'Present' : 'Absent'}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={status === 'absent'}
                              onChange={(e) => {
                                if (editingLocked) {
                                  toast.error(editingLockReason || 'Attendance editing is disabled for this date.');
                                  return;
                                }
                                handleStatusChange(student.id, e.target.checked ? 'absent' : 'present');
                              }}
                              disabled={editingLocked}
                              className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50"
                            />
                            <span className={`text-sm ${editingLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                              Mark as Absent
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Button */}
                    <button
                      onClick={() => handleStudentClick(student)}
                      className="w-full mt-2 py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation font-medium text-sm min-h-[44px]"
                    >
                      View Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              {totalStudents === 0
                ? 'No students to display'
                : (() => {
                    // Check if filters are applied
                    const hasFilters = !!(filters.batch || filters.course || filters.branch || filters.currentYear || filters.currentSemester);
                    if (hasFilters) {
                      // When filters are applied, show all students loaded
                      return `Showing all ${totalStudents.toLocaleString()} student${totalStudents !== 1 ? 's' : ''}`;
                    } else {
                      // When no filters, show pagination info
                      return `Showing ${showingFrom.toLocaleString()}-${showingTo.toLocaleString()} of ${totalStudents.toLocaleString()}`;
                    }
                  })()}
            </div>
            {(() => {
              // Check if filters are applied - hide pagination controls when filters are active
              const hasFilters = !!(filters.batch || filters.course || filters.branch || filters.currentYear || filters.currentSemester);
              if (hasFilters) {
                return null; // Don't show pagination controls when filters are applied
              }
              return (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <span className="hidden sm:inline">Rows per page</span>
                    <span className="sm:hidden">Per page</span>
                    <select
                      value={pageSize}
                      onChange={handlePageSizeChange}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm touch-manipulation min-h-[44px]"
                      disabled={loading}
                    >
                      {pageSizeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={isFirstPage || loading || totalStudents === 0}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px] font-medium"
                    >
                      Previous
                    </button>
                    <span className="text-xs sm:text-sm text-gray-600 px-2 text-center whitespace-nowrap">
                      Page {Math.min(currentPage, totalPages).toLocaleString()} of {totalPages.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={isLastPage || loading || totalStudents === 0}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px] font-medium"
                    >
                      Next
                    </button>
                  </div>
            </div>
              );
            })()}
          </div>
          </>
        )}
      </section>

      {/* SMS Results Summary Button - Shows when there are results */}
      {smsResults.length > 0 && (
        <button
          onClick={() => setSmsModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <CalendarCheck size={20} />
          <span className="font-medium">SMS Report</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {smsResults.length}
          </span>
        </button>
      )}

      {/* SMS Dispatch Summary Modal */}
      {smsModalOpen && smsResults.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <CalendarCheck size={24} className="text-white" />
                <div>
                  <h3 className="font-bold text-white text-lg">SMS Dispatch Summary</h3>
                  <p className="text-blue-100 text-sm">{attendanceDate} • {smsResults.length} students</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const headers = ['Student Name', 'PIN Number', 'Admission Number', 'College', 'Course', 'Branch', 'Year', 'Semester', 'Parent Mobile', 'Status', 'Reason'];
                    const rows = smsResults.map(result => [
                      result.studentName || '-',
                      result.pinNumber || '-',
                      result.admissionNumber || '-',
                      result.college || '-',
                      result.course || '-',
                      result.branch || '-',
                      result.year || '-',
                      result.semester || '-',
                      result.sentTo || result.parentMobile || '-',
                      result.success ? (result.mocked ? 'Simulated (Test)' : 'Sent') : (result.skipped ? 'Skipped' : 'Failed'),
                      result.reason || '-'
                    ]);
                    const csvContent = [
                      headers.join(','),
                      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                    ].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `sms-dispatch-report-${attendanceDate}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                    toast.success('SMS report downloaded');
                  }}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Download CSV
                </button>
                <button
                  onClick={() => setSmsModalOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2 bg-green-100 border border-green-200 rounded-lg px-3 py-2">
                <Check size={16} className="text-green-600" />
                <div>
                  <div className="text-xs text-green-700 font-medium">Sent</div>
                  <div className="text-lg font-bold text-green-800">
                    {smsResults.filter(r => r.success && !r.mocked).length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-lg px-3 py-2">
                <RefreshCw size={16} className="text-blue-600" />
                <div>
                  <div className="text-xs text-blue-700 font-medium">Test Mode</div>
                  <div className="text-lg font-bold text-blue-800">
                    {smsResults.filter(r => r.success && r.mocked).length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <div>
                  <div className="text-xs text-amber-700 font-medium">Skipped</div>
                  <div className="text-lg font-bold text-amber-800">
                    {smsResults.filter(r => r.skipped).length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
                <X size={16} className="text-red-600" />
                <div>
                  <div className="text-xs text-red-700 font-medium">Failed</div>
                  <div className="text-lg font-bold text-red-800">
                    {smsResults.filter(r => !r.success && !r.skipped).length}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Detailed Table with Scroll */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Student Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">PIN</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Admission No</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">College</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Course</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Branch</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Year</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Sem</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Parent Mobile</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {smsResults
                    .slice((smsCurrentPage - 1) * smsPageSize, smsCurrentPage * smsPageSize)
                    .map((result, index) => (
                    <tr key={result.studentId || index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{result.studentName || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{result.pinNumber || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{result.admissionNumber || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate" title={result.college}>{result.college || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{result.course || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{result.branch || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{result.year || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{result.semester || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">{result.sentTo || result.parentMobile || '-'}</td>
                      <td className="px-3 py-2">
                        {result.success ? (
                          result.mocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <RefreshCw size={12} />
                              Test Mode
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <Check size={12} />
                              Sent
                            </span>
                          )
                        ) : result.skipped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700" title={result.reason}>
                            <AlertTriangle size={12} />
                            {result.reason === 'missing_parent_mobile' ? 'No Mobile' : 'Skipped'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700" title={result.reason || result.details}>
                            <X size={12} />
                            Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Footer */}
            {smsResults.length > smsPageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="text-sm text-gray-600">
                  Showing {((smsCurrentPage - 1) * smsPageSize) + 1} to {Math.min(smsCurrentPage * smsPageSize, smsResults.length)} of {smsResults.length} students
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSmsCurrentPage(p => Math.max(1, p - 1))}
                    disabled={smsCurrentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {smsCurrentPage} of {Math.ceil(smsResults.length / smsPageSize)}
                  </span>
                  <button
                    onClick={() => setSmsCurrentPage(p => Math.min(Math.ceil(smsResults.length / smsPageSize), p + 1))}
                    disabled={smsCurrentPage >= Math.ceil(smsResults.length / smsPageSize)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Holiday Alert Modal - Shows for both Public and Institute Holidays */}
      {showHolidayAlert && (nonWorkingDayDetails.isNonWorkingDay || customHolidayForDate || publicHolidayMatches.length > 0 || selectedDateIsSunday) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-6">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-100 p-3 flex-shrink-0">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Today is a Holiday</h3>
                <div className="space-y-2">
                  {/* Institute Holiday Section - Show prominently */}
                  {(nonWorkingDayDetails.customHoliday || customHolidayForDate || selectedDateHolidayInfo?.customHoliday) && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="text-xs font-semibold uppercase tracking-wide text-purple-800 mb-1">
                        Institute Holiday
                      </div>
                      <div className="text-sm font-semibold text-purple-900">
                        {(nonWorkingDayDetails.customHoliday || customHolidayForDate || selectedDateHolidayInfo?.customHoliday)?.title || 'Institute Holiday'}
                      </div>
                      {(nonWorkingDayDetails.customHoliday || customHolidayForDate || selectedDateHolidayInfo?.customHoliday)?.description && (
                        <div className="text-xs text-purple-700 mt-1">
                          {(nonWorkingDayDetails.customHoliday || customHolidayForDate || selectedDateHolidayInfo?.customHoliday).description}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Public Holiday Section */}
                  {(() => {
                    const publicHolidays = [];
                    if (nonWorkingDayDetails.holidays && nonWorkingDayDetails.holidays.length > 0) {
                      publicHolidays.push(...nonWorkingDayDetails.holidays);
                    }
                    if (publicHolidayMatches.length > 0) {
                      publicHolidays.push(...publicHolidayMatches);
                    }
                    if (selectedDateHolidayInfo?.publicHoliday) {
                      publicHolidays.push(selectedDateHolidayInfo.publicHoliday);
                    }
                    
                    return publicHolidays.length > 0 ? (
                      <div className="space-y-2">
                        {publicHolidays.map((holiday, index) => (
                          <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="text-xs font-semibold uppercase tracking-wide text-orange-800 mb-1">
                              Public Holiday
                            </div>
                            <div className="text-sm font-semibold text-orange-900">
                              {holiday.localName || holiday.name}
                            </div>
                            {holiday.name && holiday.localName && holiday.localName !== holiday.name && (
                              <div className="text-xs text-orange-700 mt-1">
                                {holiday.name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {/* Sunday Section */}
                  {selectedDateIsSunday && !nonWorkingDayDetails.customHoliday && !customHolidayForDate && publicHolidayMatches.length === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">
                        Weekly Holiday
                      </div>
                      <div className="text-sm font-semibold text-amber-900">
                        Sunday
                      </div>
                    </div>
                  )}

                  {/* General reasons list if available */}
                  {nonWorkingDayDetails.reasons && nonWorkingDayDetails.reasons.length > 0 && (
                    <div className="space-y-1 text-sm text-gray-600">
                      {nonWorkingDayDetails.reasons.map((reason, index) => (
                        <div key={index} className="text-xs">
                          • {reason}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-sm text-amber-800">
                      <strong>Note:</strong> Attendance cannot be marked on holidays. Please select a working day to mark attendance.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowHolidayAlert(false);
                  setHolidayAlertShown(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Report Modal */}
      {showReportModal && attendanceReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Attendance Report</h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Total Students</p>
                  <p className="text-2xl font-bold text-blue-700">{attendanceReport.totalStudents.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Present</p>
                  <p className="text-2xl font-bold text-green-700">{attendanceReport.presentCount.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Absent</p>
                  <p className="text-2xl font-bold text-red-700">{attendanceReport.absentCount.toLocaleString()}</p>
                </div>
              </div>

              {attendanceReport.absentCount > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Absent Students PIN Numbers</h3>
                  <div className="flex flex-wrap gap-2">
                    {attendanceReport.absentPinNumbers.length > 0 ? (
                      attendanceReport.absentPinNumbers.map((pin, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-md bg-red-100 text-red-800 text-sm font-medium border border-red-200"
                        >
                          {pin}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No PIN numbers available for absent students</p>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Date & Filters</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium">Date:</span> {attendanceDateLabel}</p>
                  {filters.batch && <p><span className="font-medium">Batch:</span> {filters.batch}</p>}
                  {filters.course && <p><span className="font-medium">Course:</span> {filters.course}</p>}
                  {filters.branch && <p><span className="font-medium">Branch:</span> {filters.branch}</p>}
                  {filters.currentYear && <p><span className="font-medium">Year:</span> {filters.currentYear}</p>}
                  {filters.currentSemester && <p><span className="font-medium">Semester:</span> {filters.currentSemester}</p>}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
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
        upcomingHolidays={upcomingHolidays}
        nonWorkingDayDetails={nonWorkingDayDetails}
        selectedDateStatus={selectedDateStatus}
        statusSummaryMeta={statusSummaryMeta}
        presentCount={presentCount}
        absentCount={absentCount}
        unmarkedCount={unmarkedCount}
        lastUpdatedAt={lastUpdatedAt}
        editingLockReason={editingLockReason}
        calendarError={calendarError}
        onRetryCalendarFetch={handleRetryCalendarFetch}
      />
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-40 px-4 py-6 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl border border-gray-200 max-h-[90vh] flex flex-col">
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
              <div className="px-6 py-6 space-y-6 overflow-y-auto">
                {/* Semester Summary - Show prominently if available */}
                {historyData.semester && (
                  <section>
                    <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-indigo-600 uppercase">Semester Attendance</p>
                          <p className="text-lg font-bold text-gray-900">
                            {historyData.semester?.startDate} → {historyData.semester?.endDate}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Calendar size={12} /> {historyData.semester?.workingDays ?? 0} working days
                            </span>
                            {historyData.semester?.lastUpdated && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                                <Clock size={12} /> Updated {historyData.semester?.lastUpdated}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {(() => {
                            const semesterTotals = historyData.semester?.totals || {};
                            const totalDays =
                              (semesterTotals.present || 0) +
                              (semesterTotals.absent || 0) +
                              (semesterTotals.unmarked || 0) +
                              (semesterTotals.holidays || 0);
                            const presentDays = semesterTotals.present || 0;
                            const percentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0.0';
                            return (
                              <div className="inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
                                <div className="text-left">
                                  <p className="text-xs text-gray-600">Attendance %</p>
                                  <p className="text-2xl font-bold text-indigo-700">{percentage}%</p>
                                </div>
                                <div className="text-xs text-gray-500">
                                  <p>
                                    <span className="font-semibold text-green-600">{semesterTotals.present ?? 0}</span> present
                                  </p>
                                  <p>
                                    <span className="font-semibold text-red-500">{semesterTotals.absent ?? 0}</span> absent
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-3">
                        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Present</p>
                          <p className="text-xl font-bold text-green-700">
                            {historyData.semester?.totals?.present ?? 0}
                          </p>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Absent</p>
                          <p className="text-xl font-bold text-red-600">
                            {historyData.semester?.totals?.absent ?? 0}
                          </p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Unmarked</p>
                          <p className="text-xl font-bold text-gray-700">
                            {historyData.semester?.totals?.unmarked ?? 0}
                          </p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Holidays</p>
                          <p className="text-xl font-bold text-amber-700">
                            {historyData.semester?.totals?.holidays ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

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

                <section className={`grid gap-6 ${historyData.semester ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
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
                  {historyData.semester && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-800">Semester Status Timeline</h3>
                      <div className="h-64 bg-white border border-gray-200 rounded-xl p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={semesterChartSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={80} />
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
                  )}
                </section>

                {/* Monthly Breakdown - Show all months in semester */}
                {historyData.semester && historyData.semester.series && (() => {
                  // Group attendance by month
                  const monthlyData = {};
                  historyData.semester.series.forEach((entry) => {
                    const date = new Date(entry.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    
                    if (!monthlyData[monthKey]) {
                      monthlyData[monthKey] = {
                        monthName,
                        present: 0,
                        absent: 0,
                        unmarked: 0,
                        holidays: 0,
                        total: 0
                      };
                    }
                    
                    if (entry.isHoliday) {
                      monthlyData[monthKey].holidays++;
                    } else if (entry.status === 'present') {
                      monthlyData[monthKey].present++;
                    } else if (entry.status === 'absent') {
                      monthlyData[monthKey].absent++;
                    } else {
                      monthlyData[monthKey].unmarked++;
                    }
                    monthlyData[monthKey].total++;
                  });

                  const months = Object.keys(monthlyData).sort().map(key => ({
                    key,
                    ...monthlyData[key]
                  }));

                  return (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">
                        Monthly Breakdown (Semester: {historyData.semester.startDate} → {historyData.semester.endDate})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {months.map((month) => {
                          const totalWorkingDays = month.total - month.holidays;
                          const percentage = totalWorkingDays > 0 
                            ? ((month.present / totalWorkingDays) * 100).toFixed(1) 
                            : '0.0';
                          
                          return (
                            <div
                              key={month.key}
                              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                            >
                              <h4 className="text-sm font-semibold text-gray-800 mb-3">{month.monthName}</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                <div>
                                  <p className="text-xs text-gray-500">Present</p>
                                  <p className="text-base font-semibold text-green-600">{month.present}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Absent</p>
                                  <p className="text-base font-semibold text-red-500">{month.absent}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Unmarked</p>
                                  <p className="text-base font-semibold text-gray-600">{month.unmarked}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Holidays</p>
                                  <p className="text-base font-semibold text-amber-600">{month.holidays}</p>
                                </div>
                              </div>
                              <div className="pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600">Attendance:</span>
                                  <span className={`text-sm font-bold ${
                                    parseFloat(percentage) >= 75 ? 'text-green-600' :
                                    parseFloat(percentage) >= 50 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {percentage}%
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Total Days: {month.total} (Working: {totalWorkingDays})
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })()}

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

