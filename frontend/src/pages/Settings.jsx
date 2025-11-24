import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Plus,
  Layers,
  RefreshCcw,
  ToggleLeft,
  ToggleRight,
  Settings2,
  Landmark,
  BookOpen,
  Pencil,
  Trash2,
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
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

// Calendar helper functions
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_META = {
  submitted: { label: 'Submitted', badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  not_marked: { label: 'Not marked', badgeClass: 'bg-rose-100 text-rose-700 border border-rose-200' },
  pending: { label: 'Pending', badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200' },
  upcoming: { label: 'Upcoming', badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200' }
};

const parseMonthKey = (monthKey) => {
  if (!monthKey) return null;
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return { year, month };
};

const buildCalendarMatrix = (monthKey) => {
  const parts = parseMonthKey(monthKey);
  if (!parts) return [];
  const { year, month } = parts;
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = firstDay.getUTCDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cells = [];
  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - startWeekday + 1;
    const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
    const isCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
    const isoDate = `${cellDate.getUTCFullYear()}-${String(cellDate.getUTCMonth() + 1).padStart(2, '0')}-${String(cellDate.getUTCDate()).padStart(2, '0')}`;
    cells.push({ index, isCurrentMonth, isoDate, day: cellDate.getUTCDate(), weekday: cellDate.getUTCDay() });
  }
  return cells;
};

const formatIsoDate = (isoDate, formatOptions = {}) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, formatOptions);
};

const defaultCourseForm = {
  name: '',
  totalYears: 4,
  semestersPerYear: 2,
  isActive: true
};

const Settings = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(defaultCourseForm);
  const [courseDrafts, setCourseDrafts] = useState({});
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [savingCourseId, setSavingCourseId] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [courseBranches, setCourseBranches] = useState({});
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchForms, setBranchForms] = useState({});
  const [branchDrafts, setBranchDrafts] = useState({});
  const [editingBranch, setEditingBranch] = useState(null);
  const [savingBranchId, setSavingBranchId] = useState(null);
  const [activeSection, setActiveSection] = useState('courses'); // 'courses' or 'calendar'

  // Calendar state
  const [calendarViewMonthKey, setCalendarViewMonthKey] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarViewData, setCalendarViewData] = useState(null);
  const [calendarViewLoading, setCalendarViewLoading] = useState(false);
  const [calendarViewError, setCalendarViewError] = useState(null);
  const [calendarMutationLoading, setCalendarMutationLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [localHolidayTitle, setLocalHolidayTitle] = useState('');
  const [localHolidayDescription, setLocalHolidayDescription] = useState('');
  const calendarCacheRef = useRef(new Map());

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const fetchCourses = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await api.get('/courses?includeInactive=true');
      const courseData = response.data.data || [];
      setCourses(courseData);
      return courseData;
    } catch (error) {
      console.error('Failed to fetch courses', error);
      toast.error(error.response?.data?.message || 'Failed to fetch course configuration');
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadBranches = async (courseId) => {
    if (!courseId) {
      return [];
    }

    try {
      setBranchesLoading(true);
      const response = await api.get(`/courses/${courseId}/branches?includeInactive=true`);
      const branchData = response.data.data || [];
      setCourseBranches((prev) => ({
        ...prev,
        [courseId]: branchData
      }));
      return branchData;
    } catch (error) {
      console.error('Failed to fetch branches', error);
      toast.error(error.response?.data?.message || 'Failed to fetch branches');
      return [];
    } finally {
      setBranchesLoading(false);
    }
  };

  // Calendar functions
  const fetchCalendarMonth = async (monthKey, options = {}) => {
    if (!monthKey) return null;
    const { force = false, applyToModal = false } = options;

    if (!force && calendarCacheRef.current.has(monthKey)) {
      const cached = calendarCacheRef.current.get(monthKey);
      if (applyToModal) {
        setCalendarViewData(cached);
      }
      return cached;
    }

    const loadingSetter = applyToModal ? setCalendarViewLoading : null;
    const errorSetter = applyToModal ? setCalendarViewError : null;

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
    setCalendarViewData((prev) => (prev?.month === monthKey ? fallback : prev));
    return fallback;
  };

  const handleCalendarMonthChange = (newMonthKey) => {
    if (!newMonthKey) return;
    setCalendarViewError(null);
    setCalendarViewMonthKey(newMonthKey);
  };

  const handleCalendarDateSelect = (date) => {
    if (!date) return;
    setSelectedCalendarDate(date);
    // Load holiday details for the selected date
    const customHoliday = calendarViewData?.customHolidays?.find(h => h.date === date);
    if (customHoliday) {
      setLocalHolidayTitle(customHoliday.title || '');
      setLocalHolidayDescription(customHoliday.description || '');
    } else {
      setLocalHolidayTitle('');
      setLocalHolidayDescription('');
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

      await fetchCalendarMonth(holidayMonthKey, {
        applyToModal: activeSection === 'calendar' && holidayMonthKey === calendarViewMonthKey,
        force: true
      });

      toast.success('Institute holiday saved');
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
        applyToModal: activeSection === 'calendar' && monthKey === calendarViewMonthKey,
        force: true
      });

      toast.success('Institute holiday removed');
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

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId(null);
      return;
    }

    const hasSelected = courses.some((course) => course.id === selectedCourseId);
    if (!hasSelected) {
      const firstCourseId = courses[0].id;
      setSelectedCourseId(firstCourseId);
      loadBranches(firstCourseId);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  useEffect(() => {
    if (!selectedCourse) {
      setEditingCourseId(null);
      setEditingBranch(null);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (activeSection !== 'calendar') return;
    if (!calendarViewMonthKey) return;
    fetchCalendarMonth(calendarViewMonthKey, { applyToModal: true }).catch(() => {
      ensureCalendarFallback(calendarViewMonthKey);
    });
  }, [activeSection, calendarViewMonthKey]);

  const resetNewCourse = () => {
    setNewCourse(defaultCourseForm);
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();

    if (!newCourse.name.trim()) {
      toast.error('Course name is required');
      return;
    }

    if (!newCourse.totalYears || Number(newCourse.totalYears) <= 0) {
      toast.error('Total years must be greater than zero');
      return;
    }

    if (!newCourse.semestersPerYear || Number(newCourse.semestersPerYear) <= 0) {
      toast.error('Semesters per year must be greater than zero');
      return;
    }

    try {
      setCreatingCourse(true);
      const response = await api.post('/courses', {
        name: newCourse.name.trim(),
        totalYears: Number(newCourse.totalYears),
        semestersPerYear: Number(newCourse.semestersPerYear),
        isActive: newCourse.isActive
      });
      toast.success('Course created successfully');
      resetNewCourse();
      const createdCourse = response.data?.data;
      const updatedCourses = await fetchCourses({ silent: true });
      const nextSelectedId = createdCourse?.id || updatedCourses[0]?.id || null;
      if (nextSelectedId) {
        setSelectedCourseId(nextSelectedId);
        await loadBranches(nextSelectedId);
      }
    } catch (error) {
      console.error('Failed to create course', error);
      toast.error(error.response?.data?.message || 'Failed to create course');
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleSelectCourse = async (courseId) => {
    if (!courseId) {
      return;
    }

    if (courseId === selectedCourseId) {
      await loadBranches(courseId);
      return;
    }

    setSelectedCourseId(courseId);
    setEditingCourseId(null);
    setEditingBranch(null);
    await loadBranches(courseId);
  };

  const handleRefresh = async () => {
    const updatedCourses = await fetchCourses({ silent: true });
    if (selectedCourseId && updatedCourses.some((course) => course.id === selectedCourseId)) {
      await loadBranches(selectedCourseId);
    }
  };

  const toggleCourseActive = async (course) => {
    try {
      setSavingCourseId(course.id);
      await api.put(`/courses/${course.id}`, {
        isActive: !course.isActive
      });
      toast.success(`Course ${!course.isActive ? 'activated' : 'deactivated'}`);
      await fetchCourses({ silent: true });
      if (selectedCourseId === course.id) {
        await loadBranches(course.id);
      }
    } catch (error) {
      console.error('Failed to toggle course status', error);
      toast.error(error.response?.data?.message || 'Failed to update course status');
    } finally {
      setSavingCourseId(null);
    }
  };

  const updateCourseDraft = (courseId, field, value) => {
    setCourseDrafts((prev) => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || {}),
        [field]: value
      }
    }));
  };

  const handleEditCourse = (course) => {
    setEditingCourseId(course.id);
    setCourseDrafts((prev) => ({
      ...prev,
      [course.id]: {
        name: course.name,
        totalYears: course.totalYears,
        semestersPerYear: course.semestersPerYear
      }
    }));
  };

  const cancelEditCourse = (courseId) => {
    setEditingCourseId(null);
    setCourseDrafts((prev) => {
      const updated = { ...prev };
      delete updated[courseId];
      return updated;
    });
  };

  const saveCourseEdits = async (courseId) => {
    const draft = courseDrafts[courseId];
    if (!draft) {
      toast.error('No changes to save');
      return;
    }

    if (!draft.name || !draft.name.trim()) {
      toast.error('Course name is required');
      return;
    }

    if (!draft.totalYears || Number(draft.totalYears) <= 0) {
      toast.error('Total years must be greater than zero');
      return;
    }

    if (!draft.semestersPerYear || Number(draft.semestersPerYear) <= 0) {
      toast.error('Semesters per year must be greater than zero');
      return;
    }

    try {
      setSavingCourseId(courseId);
      await api.put(`/courses/${courseId}`, {
        name: draft.name.trim(),
        totalYears: Number(draft.totalYears),
        semestersPerYear: Number(draft.semestersPerYear)
      });
      toast.success('Course updated successfully');
      await fetchCourses({ silent: true });
      await loadBranches(courseId);
      cancelEditCourse(courseId);
    } catch (error) {
      console.error('Failed to update course', error);
      toast.error(error.response?.data?.message || 'Failed to update course');
    } finally {
      setSavingCourseId(null);
    }
  };

  const updateBranchForm = (courseId, field, value) => {
    setBranchForms((prev) => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || {}),
        [field]: value
      }
    }));
  };

  const handleAddBranch = async (course) => {
    const payload = branchForms[course.id] || {};

    if (!payload.name || !payload.name.trim()) {
      toast.error('Branch name is required');
      return;
    }

    try {
      setSavingBranchId(`new-${course.id}`);
      await api.post(`/courses/${course.id}/branches`, {
        name: payload.name.trim(),
        totalYears: Number(payload.totalYears || course.totalYears),
        semestersPerYear: Number(payload.semestersPerYear || course.semestersPerYear),
        isActive: true
      });
      toast.success('Branch added successfully');
      setBranchForms((prev) => {
        const updated = { ...prev };
        delete updated[course.id];
        return updated;
      });
      await loadBranches(course.id);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to add branch', error);
      toast.error(error.response?.data?.message || 'Failed to add branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const startEditBranch = (courseId, branch, courseDefaults) => {
    setEditingBranch({ courseId, branchId: branch.id });
    setBranchDrafts((prev) => ({
      ...prev,
      [branch.id]: {
        name: branch.name || '',
        totalYears: branch.totalYears ?? courseDefaults.totalYears,
        semestersPerYear: branch.semestersPerYear ?? courseDefaults.semestersPerYear
      }
    }));
  };

  const cancelEditBranch = () => {
    setEditingBranch(null);
  };

  const updateBranchDraft = (branchId, field, value) => {
    setBranchDrafts((prev) => ({
      ...prev,
      [branchId]: {
        ...(prev[branchId] || {}),
        [field]: value
      }
    }));
  };

  const saveBranchEdit = async (courseId, branch) => {
    const draft = branchDrafts[branch.id];

    if (!draft || !draft.name?.trim()) {
      toast.error('Branch name is required');
      return;
    }

    try {
      setSavingBranchId(branch.id);
      await api.put(`/courses/${courseId}/branches/${branch.id}`, {
        name: draft.name.trim(),
        totalYears: draft.totalYears ? Number(draft.totalYears) : undefined,
        semestersPerYear: draft.semestersPerYear ? Number(draft.semestersPerYear) : undefined
      });

      toast.success('Branch updated successfully');
      cancelEditBranch();
      await loadBranches(courseId);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to update branch', error);
      toast.error(error.response?.data?.message || 'Failed to update branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const toggleBranchActive = async (courseId, branch) => {
    try {
      setSavingBranchId(branch.id);
      await api.put(`/courses/${courseId}/branches/${branch.id}`, {
        isActive: !branch.isActive
      });
      toast.success(`Branch ${!branch.isActive ? 'activated' : 'deactivated'}`);
      await loadBranches(courseId);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to toggle branch status', error);
      toast.error(error.response?.data?.message || 'Failed to update branch status');
    } finally {
      setSavingBranchId(null);
    }
  };

  const deleteBranch = async (courseId, branch) => {
    const confirmed = window.confirm(`Delete branch "${branch.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      setSavingBranchId(branch.id);
      await api.delete(`/courses/${courseId}/branches/${branch.id}`, {
        params: { hard: true }
      });
      toast.success('Branch deleted successfully');
      cancelEditBranch();
      await loadBranches(courseId);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to delete branch', error);
      toast.error(error.response?.data?.message || 'Failed to delete branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const branchesForSelectedCourse = selectedCourse ? courseBranches[selectedCourse.id] || [] : [];

  const courseOptionsSummary = useMemo(() => {
    const courseCount = courses.filter((course) => course.isActive).length;
    const branchCount = courses.reduce(
      (acc, course) =>
        acc + (course.branches || []).filter((branch) => branch.isActive).length,
      0
    );

    return {
      courseCount,
      branchCount,
      defaultYears: 4,
      defaultSemesters: 2
    };
  }, [courses]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation
          width={32}
          height={32}
          message="Loading settings..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600">
            Manage courses, branches, and academic calendar.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xl:gap-4">
        <button
          onClick={() => setActiveSection('courses')}
          className={`rounded-lg border-2 p-4 text-left transition-all ${
            activeSection === 'courses'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${
              activeSection === 'courses' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Campuses and Courses</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Manage courses, branches, and academic configurations
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('calendar')}
          className={`rounded-lg border-2 p-4 text-left transition-all ${
            activeSection === 'calendar'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${
              activeSection === 'calendar' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Academic Calendar</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Manage public holidays, institute holidays, and view attendance status
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Content Section */}
      {activeSection === 'courses' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:gap-4">
            <StatCard icon={BookOpen} title="Active Courses" value={courseOptionsSummary.courseCount} />
            <StatCard icon={Layers} title="Active Branches" value={courseOptionsSummary.branchCount} />
            <StatCard icon={Landmark} title="Forms Using Config" value="All" />
          </div>

          {/* Courses Section */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Plus size={16} />
          Add course
        </h2>
        <form onSubmit={handleCreateCourse} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <TextField
            label="Name"
            value={newCourse.name}
            onChange={(value) => setNewCourse((prev) => ({ ...prev, name: value }))}
            placeholder="e.g., B.Tech"
            required
            className="sm:col-span-2"
          />
          <NumberField
            label="Years"
            value={newCourse.totalYears}
            onChange={(value) => setNewCourse((prev) => ({ ...prev, totalYears: value }))}
            min={1}
            max={10}
          />
          <NumberField
            label="Semesters / Year"
            value={newCourse.semestersPerYear}
            onChange={(value) =>
              setNewCourse((prev) => ({ ...prev, semestersPerYear: value }))
            }
            min={1}
            max={4}
          />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creatingCourse}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingCourse ? (
                <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
              ) : (
                <Plus size={16} />
              )}
              Save
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px,1fr] xl:grid-cols-[300px,1fr] 2xl:grid-cols-[320px,1fr]">
        <div className="space-y-3">
          {courses.length === 0 ? (
            <EmptyState />
          ) : (
            courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isSelected={selectedCourseId === course.id}
                onSelect={() => handleSelectCourse(course.id)}
              />
            ))
          )}
        </div>

        <div>
          {selectedCourse ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedCourse.name}</h2>
                    <StatusBadge isActive={selectedCourse.isActive} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedCourse.totalYears} years · {selectedCourse.semestersPerYear} semesters/year
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {(selectedCourse.branches || []).length} total branches
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleCourseActive(selectedCourse)}
                    disabled={savingCourseId === selectedCourse.id}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedCourse.isActive ? (
                      <>
                        <ToggleRight size={16} className="text-green-600" />
                        Active
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={16} className="text-gray-500" />
                        Activate
                      </>
                    )}
                  </button>
                  {editingCourseId === selectedCourse.id ? (
                    <button
                      onClick={() => cancelEditCourse(selectedCourse.id)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditCourse(selectedCourse)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editingCourseId === selectedCourse.id && (
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-200 pt-4 sm:grid-cols-3">
                  <TextField
                    label="Name"
                    value={courseDrafts[selectedCourse.id]?.name ?? selectedCourse.name}
                    onChange={(value) => updateCourseDraft(selectedCourse.id, 'name', value)}
                    required
                  />
                  <NumberField
                    label="Years"
                    value={courseDrafts[selectedCourse.id]?.totalYears ?? selectedCourse.totalYears}
                    onChange={(value) => updateCourseDraft(selectedCourse.id, 'totalYears', value)}
                    min={1}
                    max={10}
                  />
                  <NumberField
                    label="Semesters / Year"
                    value={
                      courseDrafts[selectedCourse.id]?.semestersPerYear ?? selectedCourse.semestersPerYear
                    }
                    onChange={(value) =>
                      updateCourseDraft(selectedCourse.id, 'semestersPerYear', value)
                    }
                    min={1}
                    max={4}
                  />
                  <div className="sm:col-span-3 flex gap-2">
                    <button
                      onClick={() => saveCourseEdits(selectedCourse.id)}
                      disabled={savingCourseId === selectedCourse.id}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => cancelEditCourse(selectedCourse.id)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Branches</h3>
                  <span className="text-sm text-gray-500">
                    {(branchesForSelectedCourse || []).filter((branch) => branch.isActive).length} active
                  </span>
                </div>

                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-900">Add branch</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <input
                      type="text"
                      value={branchForms[selectedCourse.id]?.name || ''}
                      onChange={(e) => updateBranchForm(selectedCourse.id, 'name', e.target.value)}
                      placeholder="Name"
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={
                        branchForms[selectedCourse.id]?.totalYears ??
                        selectedCourse.totalYears
                      }
                      onChange={(e) =>
                        updateBranchForm(selectedCourse.id, 'totalYears', e.target.value)
                      }
                      placeholder="Years"
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    />
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={
                        branchForms[selectedCourse.id]?.semestersPerYear ??
                        selectedCourse.semestersPerYear
                      }
                      onChange={(e) =>
                        updateBranchForm(selectedCourse.id, 'semestersPerYear', e.target.value)
                      }
                      placeholder="Sem / year"
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                    />
                    <button
                      onClick={() => handleAddBranch(selectedCourse)}
                      disabled={savingBranchId === `new-${selectedCourse.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingBranchId === `new-${selectedCourse.id}` ? (
                        <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                      ) : (
                        <Plus size={16} />
                      )}
                      Add
                    </button>
                  </div>
                </div>

                {branchesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <LoadingAnimation width={24} height={24} showMessage={false} />
                  </div>
                ) : branchesForSelectedCourse.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No branches yet. Add one to get started.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {branchesForSelectedCourse.map((branch) => {
                      const isEditing =
                        editingBranch &&
                        editingBranch.courseId === selectedCourse.id &&
                        editingBranch.branchId === branch.id;
                      const branchDraft = branchDrafts[branch.id] || branch;

                      return (
                        <div
                          key={branch.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={branchDraft.name}
                                    onChange={(e) =>
                                      updateBranchDraft(branch.id, 'name', e.target.value)
                                    }
                                    className="w-48 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                                  />
                                ) : (
                                  <span className="font-semibold text-gray-900">{branch.name}</span>
                                )}
                                {!branch.isActive && (
                                  <span className="rounded-full bg-yellow-100 border border-yellow-200 px-2.5 py-1 text-xs font-medium text-yellow-700">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {(branch.totalYears ?? selectedCourse.totalYears)} years ·{' '}
                                {(branch.semestersPerYear ?? selectedCourse.semestersPerYear)} semesters/year
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveBranchEdit(selectedCourse.id, branch)}
                                    disabled={savingBranchId === branch.id}
                                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditBranch}
                                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      startEditBranch(selectedCourse.id, branch, selectedCourse)
                                    }
                                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                  >
                                    <Pencil size={16} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteBranch(selectedCourse.id, branch)}
                                    disabled={savingBranchId === branch.id}
                                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Trash2 size={16} />
                                    Delete
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => toggleBranchActive(selectedCourse.id, branch)}
                                disabled={savingBranchId === branch.id}
                                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {branch.isActive ? (
                                  <>
                                    <ToggleRight size={16} className="text-green-600" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <ToggleLeft size={16} className="text-gray-500" />
                                    Activate
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-200 pt-3">
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Years</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={branchDraft.totalYears ?? selectedCourse.totalYears}
                                  onChange={(e) =>
                                    updateBranchDraft(branch.id, 'totalYears', e.target.value)
                                  }
                                  className="w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Semesters / Year</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={4}
                                  value={
                                    branchDraft.semestersPerYear ?? selectedCourse.semestersPerYear
                                  }
                                  onChange={(e) =>
                                    updateBranchDraft(branch.id, 'semestersPerYear', e.target.value)
                                  }
                                  className="w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
              Select a course to manage its details.
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {activeSection === 'calendar' && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col h-[calc(100vh-280px)] min-h-[600px] max-h-[calc(100vh-200px)] 2xl:max-h-[calc(100vh-180px)]">
          <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2.5 text-blue-600">
                <CalendarDays size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Academic Calendar</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review public holidays, institute breaks, and mark custom holidays.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
            {/* Calendar Grid */}
            <div className="flex-1 border-b border-gray-200 lg:border-b-0 lg:border-r p-4 overflow-y-auto min-h-0">
              {calendarViewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingAnimation width={32} height={32} message="Loading..." />
                </div>
              ) : calendarViewError ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-600" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-800 mb-1">
                      Calendar data unavailable
                    </div>
                    <div className="text-sm text-red-700 mb-2">{calendarViewError}</div>
                    <button
                      type="button"
                      onClick={handleCalendarModalRetry}
                      className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const parts = parseMonthKey(calendarViewMonthKey);
                        if (!parts) return;
                        const prev = new Date(Date.UTC(parts.year, parts.month - 2, 1));
                        handleCalendarMonthChange(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`);
                      }}
                      className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400"
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="text-center">
                      <div className="text-base font-semibold text-gray-900">
                        {(() => {
                          const parts = parseMonthKey(calendarViewMonthKey);
                          return parts ? `${MONTH_NAMES[parts.month - 1]} ${parts.year}` : '';
                        })()}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Tap a date to view details</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const parts = parseMonthKey(calendarViewMonthKey);
                        if (!parts) return;
                        const next = new Date(Date.UTC(parts.year, parts.month, 1));
                        handleCalendarMonthChange(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
                      }}
                      className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400"
                      aria-label="Next month"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold uppercase text-gray-600 flex-shrink-0">
                    {WEEKDAY_NAMES.map((name) => (
                      <div key={name} className="py-2">{name}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 flex-1 auto-rows-fr min-h-0">
                    {(() => {
                      const data = calendarViewData || {
                        sundays: [],
                        publicHolidays: [],
                        customHolidays: [],
                        attendanceStatus: {}
                      };
                      const calendarCells = buildCalendarMatrix(calendarViewMonthKey);
                      const publicHolidayMap = new Map();
                      (data.publicHolidays || []).forEach((holiday) => {
                        const normalizedDate = holiday.date ? holiday.date.split('T')[0] : holiday.date;
                        if (normalizedDate) publicHolidayMap.set(normalizedDate, holiday);
                      });
                      const customHolidayMap = new Map();
                      (data.customHolidays || []).forEach((holiday) => {
                        const normalizedDate = holiday.date ? holiday.date.split('T')[0] : holiday.date;
                        if (normalizedDate) customHolidayMap.set(normalizedDate, holiday);
                      });
                      const sundaySet = new Set((data.sundays || []).map(d => d.split('T')[0]));
                      const attendanceStatusMap = new Map();
                      Object.entries(data.attendanceStatus || {}).forEach(([date, status]) => {
                        attendanceStatusMap.set(date.split('T')[0], status);
                      });

                      return calendarCells.map((cell) => {
                        const status = attendanceStatusMap.get(cell.isoDate) || null;
                        const isSelected = selectedCalendarDate === cell.isoDate;
                        const isSunday = sundaySet.has(cell.isoDate);
                        const publicHoliday = publicHolidayMap.get(cell.isoDate);
                        const customHoliday = customHolidayMap.get(cell.isoDate);
                        const isHoliday = Boolean(publicHoliday || customHoliday || isSunday);
                        const statusInfo = status && STATUS_META[status];

                        let cellBgColor = 'bg-white';
                        if (isHoliday) {
                          if (publicHoliday) cellBgColor = 'bg-orange-50';
                          else if (customHoliday) cellBgColor = 'bg-purple-50';
                          else if (isSunday) cellBgColor = 'bg-amber-50';
                        } else {
                          cellBgColor = 'bg-blue-50';
                        }

                        const badgeColor = isHoliday
                          ? publicHoliday
                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                            : customHoliday
                            ? 'bg-purple-100 text-purple-700 border border-purple-300'
                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                          : 'bg-blue-100 text-blue-700 border border-blue-300';

                        const baseClasses = cell.isCurrentMonth
                          ? 'cursor-pointer hover:border-blue-500 hover:text-blue-600'
                          : 'cursor-not-allowed text-gray-300';

                        return (
                          <button
                            key={cell.index}
                            type="button"
                            onClick={() => handleCalendarDateSelect(cell.isoDate)}
                            disabled={!cell.isCurrentMonth}
                            className={`flex h-full min-h-[70px] flex-col justify-start items-center rounded-md border-2 py-2 px-1.5 text-xs transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-100 text-blue-800 shadow-md ring-2 ring-blue-300 ring-offset-1'
                                : `${cellBgColor} border-gray-200 text-gray-700 ${baseClasses}`
                            } ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}
                          >
                            <span className={`font-semibold text-sm mb-1 ${!cell.isCurrentMonth ? 'text-gray-400' : ''}`}>
                              {cell.day}
                            </span>
                            {isHoliday && (
                              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-tight ${badgeColor}`}>
                                {publicHoliday ? 'Public' : customHoliday ? 'Inst' : 'Sun'}
                              </span>
                            )}
                            {!isHoliday && statusInfo && (
                              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-tight ${statusInfo.badgeClass}`}>
                                {statusInfo.label}
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="w-full lg:w-[360px] xl:w-[380px] 2xl:w-[400px] p-4 space-y-4 overflow-y-auto flex-shrink-0 border-l border-gray-200">
              {/* Selected Date Section */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Selected Date</h3>
                  {selectedCalendarDate && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {formatIsoDate(selectedCalendarDate, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  )}
                </div>

                {!selectedCalendarDate ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    Choose a date on the calendar to view holiday details or mark an institute break.
                  </div>
                ) : (() => {
                  const data = calendarViewData || { sundays: [], publicHolidays: [], customHolidays: [] };
                  const publicHoliday = (data.publicHolidays || []).find(h => h.date?.split('T')[0] === selectedCalendarDate);
                  const customHoliday = (data.customHolidays || []).find(h => h.date?.split('T')[0] === selectedCalendarDate);
                  const isSunday = (data.sundays || []).some(d => d.split('T')[0] === selectedCalendarDate);

                  return (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="text-sm font-semibold text-blue-900 mb-1">
                        {publicHoliday
                          ? publicHoliday.localName || publicHoliday.name
                          : customHoliday
                          ? customHoliday.title || 'Institute Holiday'
                          : isSunday
                          ? 'Sunday'
                          : 'Instructional Day'}
                      </div>
                      <div className="text-xs text-blue-700">
                        {publicHoliday
                          ? publicHoliday.name
                          : customHoliday?.description
                          ? customHoliday.description
                          : isSunday
                          ? 'Weekly holiday'
                          : 'Classes are expected to be held on this date.'}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Holiday Management (Admin Only) */}
              {isAdmin && selectedCalendarDate && (() => {
                const data = calendarViewData || { customHolidays: [] };
                const customHoliday = (data.customHolidays || []).find(h => h.date?.split('T')[0] === selectedCalendarDate);
                
                return (
                  <div className="border-b border-gray-200 pb-4 space-y-3">
                    {!customHoliday ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Holiday Title
                          </label>
                          <input
                            type="text"
                            value={localHolidayTitle}
                            onChange={(e) => setLocalHolidayTitle(e.target.value)}
                            placeholder="e.g. Founders' Day"
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                            disabled={calendarMutationLoading}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Notes (visible to staff)
                          </label>
                          <textarea
                            value={localHolidayDescription}
                            onChange={(e) => setLocalHolidayDescription(e.target.value)}
                            placeholder="Optional: add a note for this holiday"
                            rows={3}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                            disabled={calendarMutationLoading}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedCalendarDate) return;
                            await handleCreateInstituteHoliday({
                              date: selectedCalendarDate,
                              title: localHolidayTitle || 'Holiday',
                              description: localHolidayDescription
                            });
                            setLocalHolidayTitle('');
                            setLocalHolidayDescription('');
                          }}
                          disabled={calendarMutationLoading}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {calendarMutationLoading ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Saving…
                            </>
                          ) : (
                            'Save Institute Holiday'
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await handleRemoveInstituteHoliday(selectedCalendarDate);
                          setLocalHolidayTitle('');
                          setLocalHolidayDescription('');
                          setSelectedCalendarDate(null);
                        }}
                        disabled={calendarMutationLoading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {calendarMutationLoading ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                            Removing…
                          </>
                        ) : (
                          'Remove Institute Holiday'
                        )}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Legend */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  Calendar Legend
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-md bg-orange-100 border-2 border-orange-300 flex-shrink-0" />
                    <span className="text-gray-700">Public Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-md bg-purple-100 border-2 border-purple-300 flex-shrink-0" />
                    <span className="text-gray-700">Institute Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-md bg-amber-100 border-2 border-amber-300 flex-shrink-0" />
                    <span className="text-gray-700">Sunday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-md bg-blue-100 border-2 border-blue-300 flex-shrink-0" />
                    <span className="text-gray-700">Working Day</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder = '', required = false, className = '' }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
    />
  </label>
);

const NumberField = ({ label, value, onChange, min, max, className = '' }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
    />
  </label>
);

const StatCard = ({ icon: Icon, title, value }) => (
  <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
      <Icon size={20} />
    </div>
    <div>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

const StatusBadge = ({ isActive }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
      isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
    }`}
  >
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const CourseCard = ({ course, isSelected, onSelect }) => {
  const activeBranches = (course.branches || []).filter((branch) => branch.isActive).length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{course.name}</span>
        <StatusBadge isActive={course.isActive} />
      </div>
      <p className="mt-1.5 text-sm text-gray-600">
        {course.totalYears} years · {course.semestersPerYear} semesters/year
      </p>
      <p className="mt-1.5 text-xs text-gray-500">{activeBranches} active branches</p>
    </button>
  );
};

const EmptyState = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
      <Settings2 size={24} className="text-gray-500" />
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-2">No courses yet</h3>
    <p className="text-sm text-gray-600">
      Add your first course above to configure its branches and academic stages.
    </p>
  </div>
);

export default Settings;

