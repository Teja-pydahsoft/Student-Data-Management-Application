import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  AlertTriangle,
  GraduationCap,
  FileText,
  Calendar,
  Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
import { SkeletonBox, SkeletonList, SkeletonCard } from '../components/SkeletonLoader';
import useAuthStore from '../store/authStore';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import AcademicCalendar from '../components/AcademicCalendar';
import NotificationSettings from '../components/NotificationSettings';
import { isFullAccessRole } from '../constants/rbac';

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
  code: '',
  totalYears: 4,
  semestersPerYear: 2,
  usePerYearConfig: false, // Toggle for per-year configuration
  yearSemesterConfig: [], // Array of {year: number, semesters: number}
  isActive: true
};

const Settings = () => {
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const [editingCollegeId, setEditingCollegeId] = useState(null);
  const [savingCollegeId, setSavingCollegeId] = useState(null);
  const [creatingCollege, setCreatingCollege] = useState(false);
  const [newCollege, setNewCollege] = useState({ name: '', code: '', isActive: true });
  const [isAddCollegeModalOpen, setIsAddCollegeModalOpen] = useState(false);
  const [collegeDrafts, setCollegeDrafts] = useState({});
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(defaultCourseForm);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
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
  const [branchBatchFilter, setBranchBatchFilter] = useState(''); // Filter branches by batch
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [branchModalCourseId, setBranchModalCourseId] = useState(null);
  const [newBranch, setNewBranch] = useState({ name: '', code: '', academicYearId: '' });
  
  // Academic Years state
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYearsLoading, setAcademicYearsLoading] = useState(false);
  const [creatingAcademicYear, setCreatingAcademicYear] = useState(false);
  const [newAcademicYear, setNewAcademicYear] = useState({ yearLabel: '', startDate: '', endDate: '' });
  const [editingAcademicYearId, setEditingAcademicYearId] = useState(null);
  const [academicYearDrafts, setAcademicYearDrafts] = useState({});
  const [savingAcademicYearId, setSavingAcademicYearId] = useState(null);
  
  // Registration Forms state
  const [registrationForms, setRegistrationForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [savingFormId, setSavingFormId] = useState(null);
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [formEditData, setFormEditData] = useState({
    formName: '',
    formDescription: '',
    formFields: []
  });
  
  // Field types for form builder
  const FIELD_TYPES = [
    { key: 'text', label: 'Text', icon: '📝' },
    { key: 'email', label: 'Email', icon: '📧' },
    { key: 'tel', label: 'Phone', icon: '📱' },
    { key: 'number', label: 'Number', icon: '🔢' },
    { key: 'date', label: 'Date', icon: '📅' },
    { key: 'textarea', label: 'Text Area', icon: '📄' },
    { key: 'select', label: 'Dropdown', icon: '📋' },
    { key: 'radio', label: 'Radio', icon: '🔘' },
    { key: 'checkbox', label: 'Checkbox', icon: '☑️' }
  ];
  
  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: null, // 'college', 'course', 'branch', or 'academicYear'
    item: null,
    onConfirm: null,
    affectedStudents: [],
    totalStudentCount: 0,
    hasMoreStudents: false,
    isLoadingStudents: false
  });
  const [activeSection, setActiveSection] = useState('courses'); // 'courses', 'calendar', 'academic-calendar', 'forms', or 'notifications'

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
  const isAdmin = isFullAccessRole(user?.role);

  // Fetch colleges from API
  const fetchColleges = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await api.get('/colleges?includeInactive=true');
      const collegeData = response.data.data || [];
      setColleges(collegeData);
      return collegeData;
    } catch (error) {
      console.error('Failed to fetch colleges', error);
      toast.error(error.response?.data?.message || 'Failed to fetch colleges');
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Fetch academic years from API
  const fetchAcademicYears = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setAcademicYearsLoading(true);
      }
      const response = await api.get('/academic-years?includeInactive=true');
      const yearData = response.data.data || [];
      setAcademicYears(yearData);
      return yearData;
    } catch (error) {
      console.error('Failed to fetch academic years', error);
      // Don't show error toast - might not have the table yet
      return [];
    } finally {
      if (!silent) {
        setAcademicYearsLoading(false);
      }
    }
  };

  // Academic Year management functions
  const handleCreateAcademicYear = async (event) => {
    event.preventDefault();
    if (!newAcademicYear.yearLabel.trim()) {
      toast.error('Year label is required');
      return;
    }

    try {
      setCreatingAcademicYear(true);
      await api.post('/academic-years', {
        yearLabel: newAcademicYear.yearLabel.trim(),
        startDate: newAcademicYear.startDate || null,
        endDate: newAcademicYear.endDate || null,
        isActive: true
      });
      
      toast.success('Academic year created successfully');
      setNewAcademicYear({ yearLabel: '', startDate: '', endDate: '' });
      await fetchAcademicYears({ silent: true });
    } catch (error) {
      console.error('Failed to create academic year', error);
      toast.error(error.response?.data?.message || 'Failed to create academic year');
    } finally {
      setCreatingAcademicYear(false);
    }
  };

  const toggleAcademicYearActive = async (year) => {
    try {
      setSavingAcademicYearId(year.id);
      await api.put(`/academic-years/${year.id}`, {
        isActive: !year.isActive
      });
      toast.success(`Academic year ${!year.isActive ? 'activated' : 'deactivated'}`);
      await fetchAcademicYears({ silent: true });
    } catch (error) {
      console.error('Failed to toggle academic year status', error);
      toast.error(error.response?.data?.message || 'Failed to update academic year status');
    } finally {
      setSavingAcademicYearId(null);
    }
  };

  const handleDeleteAcademicYear = (year) => {
    setDeleteModal({
      isOpen: true,
      type: 'academicYear',
      item: year,
      onConfirm: async () => {
        try {
          setSavingAcademicYearId(year.id);
          await api.delete(`/academic-years/${year.id}`);
          toast.success('Academic year deleted successfully');
          await fetchAcademicYears({ silent: true });
          setDeleteModal({ isOpen: false, type: null, item: null, onConfirm: null });
        } catch (error) {
          console.error('Failed to delete academic year', error);
          toast.error(error.response?.data?.message || 'Failed to delete academic year');
        } finally {
          setSavingAcademicYearId(null);
        }
      }
    });
  };

  // Fetch registration forms
  const fetchRegistrationForms = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setFormsLoading(true);
      }
      const response = await api.get('/forms');
      setRegistrationForms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch registration forms', error);
      if (!silent) {
        toast.error('Failed to fetch registration forms');
      }
    } finally {
      if (!silent) {
        setFormsLoading(false);
      }
    }
  };

  // Toggle form active status
  const toggleFormActive = async (form) => {
    try {
      setSavingFormId(form.form_id);
      await api.put(`/forms/${form.form_id}`, { isActive: !form.is_active });
      toast.success(`Form ${!form.is_active ? 'activated' : 'deactivated'}`);
      await fetchRegistrationForms({ silent: true });
    } catch (error) {
      console.error('Failed to toggle form status', error);
      toast.error('Failed to update form status');
    } finally {
      setSavingFormId(null);
    }
  };

  // Delete form
  const handleDeleteForm = (form) => {
    setDeleteModal({
      isOpen: true,
      type: 'form',
      item: form,
      onConfirm: async () => {
        try {
          setSavingFormId(form.form_id);
          await api.delete(`/forms/${form.form_id}`);
          toast.success('Form deleted successfully');
          await fetchRegistrationForms({ silent: true });
          setDeleteModal({ isOpen: false, type: null, item: null, onConfirm: null });
        } catch (error) {
          console.error('Failed to delete form', error);
          toast.error('Failed to delete form');
        } finally {
          setSavingFormId(null);
        }
      }
    });
  };

  // Start editing a form
  const startEditingForm = (form) => {
    setFormEditData({
      formName: form.form_name,
      formDescription: form.form_description || '',
      formFields: form.form_fields || []
    });
    setSelectedFormId(form.form_id);
    setIsEditingForm(true);
  };

  // Cancel editing
  const cancelEditingForm = () => {
    setIsEditingForm(false);
    setFormEditData({ formName: '', formDescription: '', formFields: [] });
  };

  // Update form field
  const updateFormField = (index, field, value) => {
    const updatedFields = [...formEditData.formFields];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    setFormEditData({ ...formEditData, formFields: updatedFields });
  };

  // Toggle field enabled
  const toggleFieldEnabled = (index) => {
    const updatedFields = [...formEditData.formFields];
    updatedFields[index].isEnabled = !updatedFields[index].isEnabled;
    setFormEditData({ ...formEditData, formFields: updatedFields });
  };

  // Add field option
  const addFieldOption = (fieldIndex) => {
    const updatedFields = [...formEditData.formFields];
    updatedFields[fieldIndex].options = [...(updatedFields[fieldIndex].options || []), `Option ${(updatedFields[fieldIndex].options?.length || 0) + 1}`];
    setFormEditData({ ...formEditData, formFields: updatedFields });
  };

  // Update field option
  const updateFieldOption = (fieldIndex, optionIndex, value) => {
    const updatedFields = [...formEditData.formFields];
    updatedFields[fieldIndex].options[optionIndex] = value;
    setFormEditData({ ...formEditData, formFields: updatedFields });
  };

  // Remove field option
  const removeFieldOption = (fieldIndex, optionIndex) => {
    const updatedFields = [...formEditData.formFields];
    updatedFields[fieldIndex].options = updatedFields[fieldIndex].options.filter((_, i) => i !== optionIndex);
    setFormEditData({ ...formEditData, formFields: updatedFields });
  };

  // Add new field
  const addFormField = (fieldType) => {
    const newField = {
      id: Date.now().toString(),
      key: `field_${Date.now()}`,
      label: '',
      type: fieldType,
      required: false,
      placeholder: '',
      options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' ? ['Option 1', 'Option 2'] : [],
      isEnabled: true
    };
    setFormEditData({
      ...formEditData,
      formFields: [...formEditData.formFields, newField]
    });
  };

  // Remove field
  const removeFormField = (index) => {
    const updatedFields = formEditData.formFields.filter((_, i) => i !== index);
    setFormEditData({ ...formEditData, formFields: updatedFields });
  };

  // Save form
  const saveFormChanges = async () => {
    if (!formEditData.formName.trim()) {
      toast.error('Form name is required');
      return;
    }

    for (let i = 0; i < formEditData.formFields.length; i++) {
      const field = formEditData.formFields[i];
      if (!field.label.trim()) {
        toast.error(`Field ${i + 1} label is required`);
        return;
      }
    }

    try {
      setSavingFormId(selectedFormId);
      await api.put(`/forms/${selectedFormId}`, {
        formName: formEditData.formName,
        formDescription: formEditData.formDescription,
        formFields: formEditData.formFields
      });
      toast.success('Form updated successfully');
      setIsEditingForm(false);
      await fetchRegistrationForms({ silent: true });
    } catch (error) {
      console.error('Failed to save form', error);
      toast.error('Failed to save form');
    } finally {
      setSavingFormId(null);
    }
  };

  // Get courses for selected college (filtered by collegeId)
  const coursesForSelectedCollege = useMemo(() => {
    if (!selectedCollegeId) return [];
    return courses.filter(course => course.collegeId === selectedCollegeId);
  }, [courses, selectedCollegeId]);

  // College management functions
  const resetNewCollege = () => {
    setNewCollege({ name: '', code: '', isActive: true });
    setIsAddCollegeModalOpen(false);
  };

  const handleCreateCollege = async (event) => {
    event.preventDefault();
    if (!newCollege.name.trim()) {
      toast.error('College name is required');
      return;
    }

    if (!newCollege.code?.trim()) {
      toast.error('College code is required');
      return;
    }

    try {
      setCreatingCollege(true);
      const response = await api.post('/colleges', {
        name: newCollege.name.trim(),
        code: newCollege.code.trim(),
        isActive: newCollege.isActive !== undefined ? newCollege.isActive : true
      });
      
      const createdCollege = response.data.data;
      toast.success('College created successfully');
      resetNewCollege();
      await fetchColleges({ silent: true });
      setSelectedCollegeId(createdCollege.id);
    } catch (error) {
      console.error('Failed to create college', error);
      const errorMessage = error.response?.data?.message || 'Failed to create college';
      if (errorMessage.includes('already exists')) {
        toast.error('College with this name or code already exists');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setCreatingCollege(false);
    }
  };


  const cancelEditCollege = (collegeId) => {
    setEditingCollegeId(null);
    setCollegeDrafts(prev => {
      const updated = { ...prev };
      delete updated[collegeId];
      return updated;
    });
  };

  const saveCollegeEdits = async (collegeId) => {
    const draft = collegeDrafts[collegeId];
    if (!draft || !draft.name?.trim()) {
      toast.error('College name is required');
      return;
    }

    try {
      setSavingCollegeId(collegeId);
      const updates = {};
      if (draft.name !== undefined) updates.name = draft.name.trim();
      if (draft.code !== undefined) {
        if (!draft.code || !draft.code.trim()) {
          toast.error('College code is required');
          return;
        }
        updates.code = draft.code.trim();
      }
      
      await api.put(`/colleges/${collegeId}`, updates);
      toast.success('College updated successfully');
      await fetchColleges({ silent: true });
      cancelEditCollege(collegeId);
    } catch (error) {
      console.error('Failed to update college', error);
      const errorMessage = error.response?.data?.message || 'Failed to update college';
      if (errorMessage.includes('already exists')) {
        toast.error('College with this name or code already exists');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSavingCollegeId(null);
    }
  };

  const toggleCollegeActive = async (college) => {
    try {
      setSavingCollegeId(college.id);
      await api.put(`/colleges/${college.id}`, {
        isActive: !college.isActive
      });
      toast.success(`College ${!college.isActive ? 'activated' : 'deactivated'}`);
      await fetchColleges({ silent: true });
    } catch (error) {
      console.error('Failed to toggle college status', error);
      toast.error(error.response?.data?.message || 'Failed to update college status');
    } finally {
      setSavingCollegeId(null);
    }
  };

  const handleDeleteCollege = async (college) => {
    // Show modal with loading state first
    setDeleteModal({
      isOpen: true,
      type: 'college',
      item: college,
      affectedStudents: [],
      totalStudentCount: 0,
      hasMoreStudents: false,
      isLoadingStudents: true,
      onConfirm: async () => {
        try {
          setSavingCollegeId(college.id);
          const response = await api.delete(`/colleges/${college.id}?cascade=true`);
          const deletedCount = response.data.deletedStudents || 0;
          toast.success(`College deleted successfully${deletedCount > 0 ? ` along with ${deletedCount} student record(s)` : ''}`);
          await fetchColleges({ silent: true });
          if (selectedCollegeId === college.id) {
            setSelectedCollegeId(null);
            setSelectedCourseId(null);
          }
          setDeleteModal({ isOpen: false, type: null, item: null, onConfirm: null, affectedStudents: [], totalStudentCount: 0, hasMoreStudents: false, isLoadingStudents: false });
        } catch (error) {
          console.error('Failed to delete college', error);
          toast.error(error.response?.data?.message || 'Failed to delete college');
        } finally {
          setSavingCollegeId(null);
        }
      }
    });

    // Fetch affected students
    try {
      const response = await api.get(`/colleges/${college.id}/affected-students`);
      const { students, totalCount, hasMore } = response.data.data || {};
      setDeleteModal(prev => ({
        ...prev,
        affectedStudents: students || [],
        totalStudentCount: totalCount || 0,
        hasMoreStudents: hasMore || false,
        isLoadingStudents: false
      }));
    } catch (error) {
      console.error('Failed to fetch affected students', error);
      setDeleteModal(prev => ({
        ...prev,
        isLoadingStudents: false
      }));
    }
  };

  const updateCollegeDraft = (collegeId, field, value) => {
    setCollegeDrafts(prev => ({
      ...prev,
      [collegeId]: {
        ...(prev[collegeId] || {}),
        [field]: value
      }
    }));
  };

  const handleEditCollege = (college) => {
    setEditingCollegeId(college.id);
    setCollegeDrafts(prev => ({
      ...prev,
      [college.id]: {
        name: college.name,
        code: college.code || ''
      }
    }));
  };

  const fetchCourses = async ({ silent = false, collegeId = null } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const params = { includeInactive: true };
      if (collegeId) {
        params.collegeId = collegeId;
      }
      const response = await api.get('/courses', { params });
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
    const initializeData = async () => {
      await fetchColleges();
      await fetchCourses();
      await fetchAcademicYears();
      await fetchRegistrationForms();
    };
    initializeData();
  }, []);

  useEffect(() => {
    // Auto-select first college if none selected
    if (colleges.length > 0 && !selectedCollegeId) {
      setSelectedCollegeId(colleges[0].id);
    }
  }, [colleges, selectedCollegeId]);

  useEffect(() => {
    // Fetch courses when college selection changes
    if (selectedCollegeId) {
      fetchCourses({ collegeId: selectedCollegeId });
    } else {
      fetchCourses();
    }
  }, [selectedCollegeId]);

  useEffect(() => {
    if (coursesForSelectedCollege.length === 0) {
      setSelectedCourseId(null);
      return;
    }

    const hasSelected = coursesForSelectedCollege.some((course) => course.id === selectedCourseId);
    if (!hasSelected) {
      const firstCourseId = coursesForSelectedCollege[0]?.id;
      if (firstCourseId) {
        setSelectedCourseId(firstCourseId);
        loadBranches(firstCourseId);
      }
    }
  }, [coursesForSelectedCollege, selectedCourseId]);

  const selectedCourse = useMemo(
    () => coursesForSelectedCollege.find((course) => course.id === selectedCourseId) || null,
    [coursesForSelectedCollege, selectedCourseId]
  );

  const selectedCollege = useMemo(
    () => colleges.find((college) => college.id === selectedCollegeId) || null,
    [colleges, selectedCollegeId]
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

  // Handle body scroll when modal is open/closed
  useEffect(() => {
    if (isAddCourseModalOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll when modal closes
      document.body.style.overflow = '';
    }
    
    return () => {
      // Cleanup: re-enable body scroll
      document.body.style.overflow = '';
    };
  }, [isAddCourseModalOpen]);

  const resetNewCourse = () => {
    setNewCourse(defaultCourseForm);
    setIsAddCourseModalOpen(false);
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();

    const collegeIdToUse = selectedCollegeId || (selectedCollege?.id);
    
    if (!collegeIdToUse) {
      toast.error('Please select a college first');
      setIsAddCourseModalOpen(false);
      return;
    }

    if (!newCourse.name.trim()) {
      toast.error('Course name is required');
      return;
    }

    if (!newCourse.code?.trim()) {
      toast.error('Course code is required');
      return;
    }

    if (!newCourse.totalYears || Number(newCourse.totalYears) <= 0) {
      toast.error('Total years must be greater than zero');
      return;
    }

    if (!newCourse.usePerYearConfig) {
      if (!newCourse.semestersPerYear || Number(newCourse.semestersPerYear) <= 0) {
        toast.error('Semesters per year must be greater than zero');
        return;
      }
    } else {
      // Validate per-year configuration
      if (!newCourse.yearSemesterConfig || newCourse.yearSemesterConfig.length === 0) {
        toast.error('Please configure semesters for each year');
        return;
      }
      const totalYears = Number(newCourse.totalYears);
      if (newCourse.yearSemesterConfig.length !== totalYears) {
        toast.error(`Please configure semesters for all ${totalYears} years`);
        return;
      }
    }

    try {
      setCreatingCourse(true);
      
      // Ensure semestersPerYear is always a valid number (backend requires it)
      const semestersPerYearValue = newCourse.usePerYearConfig 
        ? (Number(newCourse.semestersPerYear) || 2) // Default to 2 if not set when using per-year config
        : Number(newCourse.semestersPerYear);
      
      if (!semestersPerYearValue || semestersPerYearValue <= 0 || semestersPerYearValue > 4) {
        toast.error('Semesters per year must be between 1 and 4');
        setCreatingCourse(false);
        return;
      }
      
      const payload = {
        name: newCourse.name.trim(),
        code: newCourse.code.trim(),
        collegeId: collegeIdToUse,
        totalYears: Number(newCourse.totalYears),
        semestersPerYear: semestersPerYearValue,
        isActive: newCourse.isActive
      };

      // Add per-year configuration if enabled
      if (newCourse.usePerYearConfig && newCourse.yearSemesterConfig && Array.isArray(newCourse.yearSemesterConfig) && newCourse.yearSemesterConfig.length > 0) {
        // Validate each year config has required fields
        const validConfig = newCourse.yearSemesterConfig.filter(config => 
          config && typeof config.year === 'number' && typeof config.semesters === 'number'
        );
        if (validConfig.length === Number(newCourse.totalYears)) {
          payload.yearSemesterConfig = validConfig;
        } else {
          toast.error('Invalid year semester configuration. Please check all years are configured.');
          setCreatingCourse(false);
          return;
        }
      }

      const response = await api.post('/courses', payload);
      toast.success('Course created successfully');
      const createdCourse = response.data?.data;
      resetNewCourse();
      const updatedCourses = await fetchCourses({ silent: true, collegeId: collegeIdToUse });
      const nextSelectedId = createdCourse?.id || updatedCourses[0]?.id || null;
      if (nextSelectedId) {
        setSelectedCourseId(nextSelectedId);
        await loadBranches(nextSelectedId);
      }
    } catch (error) {
      console.error('Failed to create course', error);
      const errorMessage = error.response?.data?.message || 'Failed to create course';
      if (errorMessage.includes('College not found')) {
        toast.error('Selected college not found. Please refresh and try again.');
      } else {
        toast.error(errorMessage);
      }
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
    await fetchColleges({ silent: true });
    await fetchAcademicYears({ silent: true });
    await fetchRegistrationForms({ silent: true });
    const updatedCourses = await fetchCourses({ silent: true, collegeId: selectedCollegeId });
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

  const handleDeleteCourse = async (course) => {
    // Show modal with loading state first
    setDeleteModal({
      isOpen: true,
      type: 'course',
      item: course,
      affectedStudents: [],
      totalStudentCount: 0,
      hasMoreStudents: false,
      isLoadingStudents: true,
      onConfirm: async () => {
        try {
          setSavingCourseId(course.id);
          const response = await api.delete(`/courses/${course.id}?cascade=true`);
          const deletedCount = response.data.deletedStudents || 0;
          toast.success(`Course deleted successfully${deletedCount > 0 ? ` along with ${deletedCount} student record(s)` : ''}`);
          
          // Clear selection if deleted course was selected
          if (selectedCourseId === course.id) {
            setSelectedCourseId(null);
            setEditingCourseId(null);
          }
          
          await fetchCourses({ silent: true });
          setDeleteModal({ isOpen: false, type: null, item: null, onConfirm: null, affectedStudents: [], totalStudentCount: 0, hasMoreStudents: false, isLoadingStudents: false });
        } catch (error) {
          console.error('Failed to delete course', error);
          const errorMessage = error.response?.data?.message || 'Failed to delete course';
          toast.error(errorMessage);
        } finally {
          setSavingCourseId(null);
        }
      }
    });

    // Fetch affected students
    try {
      const response = await api.get(`/courses/${course.id}/affected-students`);
      const { students, totalCount, hasMore } = response.data.data || {};
      setDeleteModal(prev => ({
        ...prev,
        affectedStudents: students || [],
        totalStudentCount: totalCount || 0,
        hasMoreStudents: hasMore || false,
        isLoadingStudents: false
      }));
    } catch (error) {
      console.error('Failed to fetch affected students', error);
      setDeleteModal(prev => ({
        ...prev,
        isLoadingStudents: false
      }));
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

  const handleSelectCollege = async (collegeId) => {
    setSelectedCollegeId(collegeId);
    setSelectedCourseId(null);
    setEditingCourseId(null);
    setEditingBranch(null);
    // Fetch courses for the selected college
    await fetchCourses({ silent: true, collegeId });
  };

  const handleEditCourse = (course) => {
    setEditingCourseId(course.id);
    setCourseDrafts((prev) => ({
      ...prev,
      [course.id]: {
        name: course.name,
        code: course.code || '',
        collegeId: course.collegeId,
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

    if (!draft.code || !draft.code.trim()) {
      toast.error('Course code is required');
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
      const updates = {
        name: draft.name.trim(),
        code: draft.code.trim(),
        totalYears: Number(draft.totalYears),
        semestersPerYear: Number(draft.semestersPerYear)
      };
      
      // Include collegeId if it was changed
      if (draft.collegeId !== undefined) {
        updates.collegeId = draft.collegeId;
      }
      
      await api.put(`/courses/${courseId}`, updates);
      toast.success('Course updated successfully');
      await fetchCourses({ silent: true, collegeId: selectedCollegeId });
      await loadBranches(courseId);
      cancelEditCourse(courseId);
    } catch (error) {
      console.error('Failed to update course', error);
      const errorMessage = error.response?.data?.message || 'Failed to update course';
      if (errorMessage.includes('College not found')) {
        toast.error('Selected college not found. Please refresh and try again.');
      } else {
        toast.error(errorMessage);
      }
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

  const resetNewBranch = () => {
    setNewBranch({ name: '', code: '', academicYearId: '' });
    setIsAddBranchModalOpen(false);
    setBranchModalCourseId(null);
  };

  const handleAddBranch = async (course) => {
    // If course is null, we're calling from the modal, so use newBranch state
    // Otherwise, use branchForms for backward compatibility
    const payload = course === null ? { ...newBranch } : (branchForms[course?.id] || {});

    if (!payload.name || !payload.name.trim()) {
      toast.error('Branch name is required');
      return;
    }

    if (!payload.code || !payload.code.trim()) {
      toast.error('Branch code is required');
      return;
    }

    if (!payload.academicYearId) {
      toast.error('Please select a batch year for the branch');
      return;
    }

    // If course is null, find the course from branchModalCourseId
    // Otherwise, use the provided course
    const courseToUse = course || coursesForSelectedCollege.find(c => c.id === branchModalCourseId);
    if (!courseToUse) {
      toast.error('Course not found');
      return;
    }

    try {
      setSavingBranchId(`new-${courseToUse.id}`);
      await api.post(`/courses/${courseToUse.id}/branches`, {
        name: payload.name.trim(),
        code: payload.code.trim(),
        totalYears: Number(payload.totalYears || courseToUse.totalYears),
        semestersPerYear: Number(payload.semestersPerYear || courseToUse.semestersPerYear),
        academicYearId: Number(payload.academicYearId),
        isActive: true
      });
      toast.success('Branch added successfully');
      resetNewBranch();
      setBranchForms((prev) => {
        const updated = { ...prev };
        delete updated[courseToUse.id];
        return updated;
      });
      await loadBranches(courseToUse.id);
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
        code: branch.code || '',
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

    if (!draft.code || !draft.code.trim()) {
      toast.error('Branch code is required');
      return;
    }

    try {
      setSavingBranchId(branch.id);
      await api.put(`/courses/${courseId}/branches/${branch.id}`, {
        name: draft.name.trim(),
        code: draft.code.trim(),
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

  const handleDeleteBranch = async (courseId, branch) => {
    // Show modal with loading state first
    setDeleteModal({
      isOpen: true,
      type: 'branch',
      item: branch,
      affectedStudents: [],
      totalStudentCount: 0,
      hasMoreStudents: false,
      isLoadingStudents: true,
      onConfirm: async () => {
        try {
          setSavingBranchId(branch.id);
          const response = await api.delete(`/courses/${courseId}/branches/${branch.id}?cascade=true`);
          const deletedCount = response.data.deletedStudents || 0;
          toast.success(`Branch deleted successfully${deletedCount > 0 ? ` along with ${deletedCount} student record(s)` : ''}`);
          cancelEditBranch();
          await loadBranches(courseId);
          await fetchCourses({ silent: true });
          setDeleteModal({ isOpen: false, type: null, item: null, onConfirm: null, affectedStudents: [], totalStudentCount: 0, hasMoreStudents: false, isLoadingStudents: false });
        } catch (error) {
          console.error('Failed to delete branch', error);
          toast.error(error.response?.data?.message || 'Failed to delete branch');
        } finally {
          setSavingBranchId(null);
        }
      }
    });

    // Fetch affected students
    try {
      const response = await api.get(`/courses/${courseId}/branches/${branch.id}/affected-students`);
      const { students, totalCount, hasMore } = response.data.data || {};
      setDeleteModal(prev => ({
        ...prev,
        affectedStudents: students || [],
        totalStudentCount: totalCount || 0,
        hasMoreStudents: hasMore || false,
        isLoadingStudents: false
      }));
    } catch (error) {
      console.error('Failed to fetch affected students', error);
      setDeleteModal(prev => ({
        ...prev,
        isLoadingStudents: false
      }));
    }
  };

  const branchesForSelectedCourse = useMemo(() => {
    if (!selectedCourse) return [];
    const allBranches = courseBranches[selectedCourse.id] || [];
    if (!branchBatchFilter) return allBranches;
    return allBranches.filter(branch => branch.academicYearId === parseInt(branchBatchFilter, 10));
  }, [selectedCourse, courseBranches, branchBatchFilter]);

  // Get unique branch count for display (unique by name)
  const uniqueBranchCount = useMemo(() => {
    if (!selectedCourse) return 0;
    const allBranches = courseBranches[selectedCourse.id] || [];
    const uniqueNames = new Set(allBranches.map(branch => branch.name));
    return uniqueNames.size;
  }, [selectedCourse, courseBranches]);
  
  // Reset batch filter when course changes
  useEffect(() => {
    setBranchBatchFilter('');
  }, [selectedCourseId]);

  const courseOptionsSummary = useMemo(() => {
    const courseCount = coursesForSelectedCollege.filter((course) => course.isActive).length;
    
    // Count unique branch names per course (using course.branches directly, not courseBranches state)
    const branchCount = coursesForSelectedCollege.reduce((acc, course) => {
      // Use course.branches directly (from API response) instead of courseBranches state
      const branches = course.branches || [];
      const activeBranches = branches.filter((branch) => branch.isActive);
      // Get unique branch names (not counting duplicates across batches)
      const uniqueBranchNames = new Set(activeBranches.map((branch) => branch.name));
      return acc + uniqueBranchNames.size;
    }, 0);

    return {
      courseCount,
      branchCount,
      defaultYears: 4,
      defaultSemesters: 2
    };
  }, [coursesForSelectedCollege]);

  if (loading) {
    return (
      <div className="space-y-4 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SkeletonBox height="h-7" width="w-32" />
            <SkeletonBox height="h-4" width="w-64" className="mt-2" />
          </div>
          <SkeletonBox height="h-10" width="w-24" className="rounded-md" />
        </div>
        
        {/* Navigation Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600">
            Manage colleges, courses, branches, and attendance calendar.
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveSection('courses')}
          className={`rounded-lg border-2 p-3 text-left transition-all ${
            activeSection === 'courses'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${
              activeSection === 'courses' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Colleges & Courses</h2>
              <p className="text-xs text-gray-500">Manage colleges, courses & branches</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('calendar')}
          className={`rounded-lg border-2 p-3 text-left transition-all ${
            activeSection === 'calendar'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${
              activeSection === 'calendar' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Attendance Calendar</h2>
              <p className="text-xs text-gray-500">Holidays & attendance calendar</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('academic-calendar')}
          className={`rounded-lg border-2 p-3 text-left transition-all ${
            activeSection === 'academic-calendar'
              ? 'border-green-500 bg-green-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${
              activeSection === 'academic-calendar' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Academic Calendar</h2>
              <p className="text-xs text-gray-500">Manage semester dates</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('forms')}
          className={`rounded-lg border-2 p-3 text-left transition-all ${
            activeSection === 'forms'
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${
              activeSection === 'forms' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Registration Form</h2>
              <p className="text-xs text-gray-500">Student registration form fields</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('notifications')}
          className={`rounded-lg border-2 p-3 text-left transition-all ${
            activeSection === 'notifications'
              ? 'border-indigo-500 bg-indigo-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${
              activeSection === 'notifications' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <Bell size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
              <p className="text-xs text-gray-500">SMS & Email templates</p>
            </div>
          </div>
        </button>
      </div>

      {/* Content Section */}
      {activeSection === 'courses' && (
        <>
          {/* Quick Stats Bar */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Landmark size={16} className="text-blue-600" />
              <span className="text-sm text-gray-600">Colleges:</span>
              <span className="font-semibold text-gray-900">{colleges.filter(c => c.isActive).length}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-green-600" />
              <span className="text-sm text-gray-600">Batches:</span>
              <span className="font-semibold text-gray-900">{academicYears.filter(y => y.isActive).length}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-purple-600" />
              <span className="text-sm text-gray-600">Courses:</span>
              <span className="font-semibold text-gray-900">{courseOptionsSummary.courseCount}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-orange-600" />
              <span className="text-sm text-gray-600">Branches:</span>
              <span className="font-semibold text-gray-900">{courseOptionsSummary.branchCount}</span>
            </div>
          </div>

          {/* Two Column Layout: Left - Colleges & Batches, Right - Courses & Branches */}
          <div className="grid gap-4 lg:grid-cols-[320px,1fr] min-w-0">
            {/* Left Column */}
            <div className="space-y-4 min-w-0">
              {/* Colleges Card */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <Landmark size={16} className="text-blue-600" />
                      Colleges
                    </h3>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {colleges.length}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  {/* Add College Button */}
                  <button
                    onClick={() => setIsAddCollegeModalOpen(true)}
                    className="mb-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    Add New College
                  </button>
                  
                  {/* College List */}
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto min-h-0">
                    {colleges.length === 0 && !loading ? (
                      <p className="py-4 text-center text-sm text-gray-400">No colleges yet</p>
                    ) : colleges.length === 0 ? (
                      <SkeletonList count={3} />
                    ) : (
                      colleges.map((college) => (
                        <div
                          key={college.id}
                          onClick={() => handleSelectCollege(college.id)}
                          className={`group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                            selectedCollegeId === college.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${college.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className={`text-sm truncate ${selectedCollegeId === college.id ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                              {college.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditCollege(college); }}
                              className="p-1 text-gray-400 hover:text-blue-500"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCollegeActive(college); }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title={college.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {college.isActive ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteCollege(college); }}
                              className="p-1 text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Years Card */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <GraduationCap size={16} className="text-green-600" />
                      Batches (Academic Years)
                    </h3>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {academicYears.filter(y => y.isActive).length}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  {/* Add Year Form */}
                  <form onSubmit={handleCreateAcademicYear} className="mb-3 flex gap-2">
                    <input
                      type="text"
                      value={newAcademicYear.yearLabel}
                      onChange={(e) => setNewAcademicYear((prev) => ({ ...prev, yearLabel: e.target.value }))}
                      placeholder="e.g., 2027"
                      className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-green-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <button
                      type="submit"
                      disabled={creatingAcademicYear || !newAcademicYear.yearLabel.trim()}
                      className="rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                  
                  {/* Year Tags */}
                  <div className="flex flex-wrap gap-2">
                    {academicYears.length === 0 && !loading ? (
                      <p className="py-2 text-sm text-gray-400">No batches yet</p>
                    ) : academicYears.length === 0 ? (
                      <div className="flex flex-wrap gap-2 w-full">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <SkeletonBox key={i} height="h-8" width="w-20" className="rounded-full" />
                        ))}
                      </div>
                    ) : (
                      academicYears.map((year) => (
                        <div
                          key={year.id}
                          className={`group inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 text-sm font-medium transition-all ${
                            year.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <span>{year.yearLabel}</span>
                          <button
                            onClick={() => toggleAcademicYearActive(year)}
                            disabled={savingAcademicYearId === year.id}
                            className="p-0.5 rounded hover:bg-white/50 transition-colors"
                          >
                            {year.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          </button>
                          <button
                            onClick={() => handleDeleteAcademicYear(year)}
                            disabled={savingAcademicYearId === year.id}
                            className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-white/50 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Courses & Branches */}
            <div className="space-y-4 min-w-0 overflow-hidden">
              {!selectedCollege ? (
                <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8">
                  <div className="text-center">
                    <Landmark size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-500">Select a college to manage its courses</p>
                  </div>
                </div>
              ) : (
                <>
{/* Course List & Branches */}
                  <div className="grid gap-4 lg:grid-cols-[240px,1fr] min-w-0 overflow-hidden">
                    {/* Course List */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 min-w-0 overflow-hidden">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Select Course</div>
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto min-w-0">
                        {coursesForSelectedCollege.length === 0 && !loading ? (
                          <p className="py-4 text-center text-sm text-gray-400">No courses yet</p>
                        ) : coursesForSelectedCollege.length === 0 ? (
                          <SkeletonList count={3} />
                        ) : (
                          coursesForSelectedCollege.map((course) => (
                            <div
                              key={course.id}
                              onClick={() => handleSelectCourse(course.id)}
                              className={`group flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                                selectedCourseId === course.id
                                  ? 'bg-purple-100 border border-purple-300'
                                  : 'bg-white hover:bg-purple-50 border border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${course.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <div className="min-w-0">
                                  <span className={`block text-sm truncate ${selectedCourseId === course.id ? 'font-medium text-purple-900' : 'text-gray-700'}`}>
                                    {course.name}
                                  </span>
                                  <span className="text-xs text-gray-500">{course.totalYears}yr · {course.semestersPerYear}sem</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditCourse(course); }}
                                  className="p-1 text-gray-400 hover:text-blue-500"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleCourseActive(course); }}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title={course.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {course.isActive ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course); }}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {/* Add Course Button Below List */}
                      {selectedCollege ? (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsAddCourseModalOpen(true);
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer"
                            style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                          >
                            <Plus size={16} />
                            Add New Course
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400 text-center">
                          Select a college to add courses
                        </div>
                      )}
                    </div>

                    {/* Branches Panel */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm min-w-0 overflow-hidden">
                      {selectedCourse ? (
                        <>
                          <div className="border-b border-gray-100 px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">{selectedCourse.name} - Branches</h4>
                                <p className="text-xs text-gray-500">{selectedCourse.totalYears} years · {selectedCourse.semestersPerYear} semesters/year</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={branchBatchFilter}
                                  onChange={(e) => setBranchBatchFilter(e.target.value)}
                                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                  <option value="">All Batches</option>
                                  {academicYears.filter(y => y.isActive).map((year) => (
                                    <option key={year.id} value={year.id}>{year.yearLabel}</option>
                                  ))}
                                </select>
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                                  {branchBatchFilter ? branchesForSelectedCourse.length : uniqueBranchCount} {branchBatchFilter ? 'shown' : 'branches'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Add Branch Button */}
                          <div className="border-b border-gray-100 p-4">
                            <button
                              onClick={() => {
                                setBranchModalCourseId(selectedCourse.id);
                                setIsAddBranchModalOpen(true);
                              }}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                            >
                              <Plus size={16} />
                              Add New Branch
                            </button>
                          </div>

                          {/* Branch List */}
                          <div className="p-4 max-h-[300px] overflow-y-auto">
                            {branchesLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <LoadingAnimation width={24} height={24} showMessage={false} />
                              </div>
                            ) : branchesForSelectedCourse.length === 0 ? (
                              <p className="py-8 text-center text-sm text-gray-400">No branches yet</p>
                            ) : (
                              <div className="space-y-2">
                                {branchesForSelectedCourse.map((branch) => (
                                  <div
                                    key={branch.id}
                                    className="group flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${branch.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                      <span className="text-sm font-medium text-gray-800 truncate">{branch.name}</span>
                                      {branch.academicYearLabel && (
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                          {branch.academicYearLabel}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => startEditBranch(selectedCourse.id, branch, selectedCourse)}
                                        disabled={savingBranchId === branch.id}
                                        className="p-1 text-gray-400 hover:text-blue-500"
                                        title="Edit"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        onClick={() => toggleBranchActive(selectedCourse.id, branch)}
                                        disabled={savingBranchId === branch.id}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                        title={branch.isActive ? 'Deactivate' : 'Activate'}
                                      >
                                        {branch.isActive ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBranch(selectedCourse.id, branch)}
                                        disabled={savingBranchId === branch.id}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                        title="Delete"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center p-8">
                          <div className="text-center">
                            <Layers size={32} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-500">Select a course to view branches</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
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
                <h2 className="text-base font-semibold text-gray-900">Attendance Calendar</h2>
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

      {/* Academic Calendar Section */}
      {activeSection === 'academic-calendar' && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
          <AcademicCalendar
            colleges={colleges}
            courses={courses}
            academicYears={academicYears}
          />
        </div>
      )}

      {/* Registration Forms Section */}
      {activeSection === 'forms' && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {formsLoading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingAnimation width={32} height={32} message="Loading form..." />
            </div>
          ) : registrationForms.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-purple-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Registration Form</h3>
              <p className="text-gray-600">Contact administrator to set up the registration form.</p>
            </div>
          ) : (() => {
            const form = registrationForms[0]; // Only show the first/single form
            
            return isEditingForm ? (
              // Inline Form Editor
              <div className="p-4">
                {/* Editor Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Pencil size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Edit Registration Form</h2>
                      <p className="text-sm text-gray-500">Customize form fields and settings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelEditingForm}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveFormChanges}
                      disabled={savingFormId}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {savingFormId ? <LoadingAnimation width={16} height={16} showMessage={false} /> : <Settings2 size={16} />}
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* Form Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Form Name *</label>
                    <input
                      type="text"
                      value={formEditData.formName}
                      onChange={(e) => setFormEditData({ ...formEditData, formName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formEditData.formDescription}
                      onChange={(e) => setFormEditData({ ...formEditData, formDescription: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Add Field Types */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add New Field</label>
                  <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.map((type) => (
                      <button
                        key={type.key}
                        onClick={() => addFormField(type.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                      >
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Fields Editor */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Form Fields ({formEditData.formFields.length})</h4>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {formEditData.formFields.map((field, index) => (
                      <div
                        key={field.id || index}
                        className={`rounded-lg border-2 p-3 transition-all ${
                          field.isEnabled !== false ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Label *</label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateFormField(index, 'label', e.target.value)}
                                placeholder="Field label"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Type</label>
                              <select
                                value={field.type}
                                onChange={(e) => updateFormField(index, 'type', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                              >
                                {FIELD_TYPES.map((t) => (
                                  <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                              <input
                                type="text"
                                value={field.placeholder || ''}
                                onChange={(e) => updateFormField(index, 'placeholder', e.target.value)}
                                placeholder="Placeholder text"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateFormField(index, 'required', e.target.checked)}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                Required
                              </label>
                              <button
                                onClick={() => toggleFieldEnabled(index)}
                                className={`p-1.5 rounded transition-colors ${
                                  field.isEnabled !== false
                                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                                title={field.isEnabled !== false ? 'Enabled' : 'Disabled'}
                              >
                                {field.isEnabled !== false ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                              </button>
                              <button
                                onClick={() => removeFormField(index)}
                                className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                title="Remove field"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Options for select/radio/checkbox */}
                        {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                          <div className="mt-3 pl-3 border-l-2 border-purple-200">
                            <label className="block text-xs text-gray-500 mb-1">Options</label>
                            <div className="flex flex-wrap gap-2">
                              {(field.options || []).map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => updateFieldOption(index, optIndex, e.target.value)}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none w-24"
                                  />
                                  <button
                                    onClick={() => removeFieldOption(index, optIndex)}
                                    className="p-0.5 text-red-500 hover:bg-red-100 rounded"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addFieldOption(index)}
                                className="px-2 py-1 text-xs border border-dashed border-gray-300 rounded hover:border-purple-400 hover:bg-purple-50 transition-colors"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Form View Mode
              <div className="p-4">
                {/* Form Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2.5 rounded-lg">
                      <FileText size={24} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">{form.form_name}</h2>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          form.is_active 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {form.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {form.form_description || 'Student registration form'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditingForm(form)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Pencil size={16} />
                      Edit Form
                    </button>
                    <button
                      onClick={() => toggleFormActive(form)}
                      disabled={savingFormId === form.form_id}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                        form.is_active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {form.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {form.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{form.form_fields?.length || 0}</p>
                    <p className="text-xs text-gray-500">Total Fields</p>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
                    <p className="text-2xl font-bold text-purple-600">{form.form_fields?.filter(f => f.isEnabled !== false).length || 0}</p>
                    <p className="text-xs text-gray-500">Active Fields</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{form.pending_count || 0}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{form.approved_count || 0}</p>
                    <p className="text-xs text-gray-500">Approved</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Layers size={14} className="text-purple-600" />
                    Form Fields
                  </h4>
                  {form.form_fields && form.form_fields.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {form.form_fields.map((field, index) => (
                        <div
                          key={field.id || index}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            field.isEnabled !== false
                              ? 'border-gray-200 bg-white'
                              : 'border-gray-100 bg-gray-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-medium truncate ${
                              field.isEnabled !== false ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {field.label}
                            </span>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {field.required && <span className="text-red-500 text-xs">*</span>}
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                field.isEnabled !== false ? 'bg-emerald-500' : 'bg-gray-300'
                              }`} />
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 capitalize">{field.type}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No fields configured</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Notifications Section */}
      {activeSection === 'notifications' && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
          <NotificationSettings />
        </div>
      )}

      {/* Edit College Modal */}
      {editingCollegeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                Edit College
              </h3>
              <button
                onClick={() => cancelEditCollege(editingCollegeId)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">College Name *</label>
                <input
                  type="text"
                  value={collegeDrafts[editingCollegeId]?.name || ''}
                  onChange={(e) => updateCollegeDraft(editingCollegeId, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter college name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  College Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={collegeDrafts[editingCollegeId]?.code || ''}
                  onChange={(e) => updateCollegeDraft(editingCollegeId, 'code', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase"
                  placeholder="Enter college code (e.g., PCE)"
                  required
                  maxLength={10}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => cancelEditCollege(editingCollegeId)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveCollegeEdits(editingCollegeId)}
                disabled={savingCollegeId === editingCollegeId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCollegeId === editingCollegeId ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {editingCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Pencil size={18} className="text-purple-600" />
                Edit Course
              </h3>
              <button
                onClick={() => setEditingCourseId(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Name *</label>
                <input
                  type="text"
                  value={courseDrafts[editingCourseId]?.name || ''}
                  onChange={(e) => setCourseDrafts(prev => ({ ...prev, [editingCourseId]: { ...prev[editingCourseId], name: e.target.value } }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Enter course name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={courseDrafts[editingCourseId]?.code || ''}
                  onChange={(e) => setCourseDrafts(prev => ({ ...prev, [editingCourseId]: { ...prev[editingCourseId], code: e.target.value.toUpperCase() } }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none uppercase"
                  placeholder="Enter course code (e.g., BTECH)"
                  required
                  maxLength={20}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Years</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={courseDrafts[editingCourseId]?.totalYears || ''}
                    onChange={(e) => setCourseDrafts(prev => ({ ...prev, [editingCourseId]: { ...prev[editingCourseId], totalYears: e.target.value } }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semesters/Year</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={courseDrafts[editingCourseId]?.semestersPerYear || ''}
                    onChange={(e) => setCourseDrafts(prev => ({ ...prev, [editingCourseId]: { ...prev[editingCourseId], semestersPerYear: e.target.value } }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setEditingCourseId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveCourseEdits(editingCourseId)}
                disabled={savingCourseId === editingCourseId}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {savingCourseId === editingCourseId ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Pencil size={18} className="text-orange-600" />
                Edit Branch
              </h3>
              <button
                onClick={cancelEditBranch}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={branchDrafts[editingBranch.branchId]?.name || ''}
                  onChange={(e) => updateBranchDraft(editingBranch.branchId, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder="Enter branch name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={branchDrafts[editingBranch.branchId]?.code || ''}
                  onChange={(e) => updateBranchDraft(editingBranch.branchId, 'code', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none uppercase"
                  placeholder="Enter branch code (e.g., CSE)"
                  required
                  maxLength={10}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Years</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={branchDrafts[editingBranch.branchId]?.totalYears || ''}
                    onChange={(e) => updateBranchDraft(editingBranch.branchId, 'totalYears', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semesters/Year</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={branchDrafts[editingBranch.branchId]?.semestersPerYear || ''}
                    onChange={(e) => updateBranchDraft(editingBranch.branchId, 'semestersPerYear', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={cancelEditBranch}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const branch = courseBranches[editingBranch.courseId]?.find(b => b.id === editingBranch.branchId);
                  if (branch) saveBranchEdit(editingBranch.courseId, branch);
                }}
                disabled={savingBranchId === editingBranch.branchId}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {savingBranchId === editingBranch.branchId ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: null, item: null, onConfirm: null, affectedStudents: [], totalStudentCount: 0, hasMoreStudents: false, isLoadingStudents: false })}
        onConfirm={deleteModal.onConfirm || (() => {})}
        title={`Delete ${deleteModal.type === 'college' ? 'College' : deleteModal.type === 'course' ? 'Course' : deleteModal.type === 'academicYear' ? 'Academic Year' : deleteModal.type === 'form' ? 'Form' : 'Branch'}`}
        itemName={deleteModal.item?.name || deleteModal.item?.yearLabel || deleteModal.item?.form_name}
        itemType={deleteModal.type}
        affectedStudents={deleteModal.affectedStudents || []}
        totalStudentCount={deleteModal.totalStudentCount || 0}
        hasMoreStudents={deleteModal.hasMoreStudents || false}
        isLoadingStudents={deleteModal.isLoadingStudents || false}
      />
    </div>
    
      {/* Add College Modal - Using createPortal to render to document.body */}
      {isAddCollegeModalOpen && typeof document !== 'undefined' && document.body && createPortal(
        <div 
          data-modal="add-college"
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 99999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAddCollegeModalOpen(false);
              resetNewCollege();
            }
          }}
        >
          <div 
            className="w-full max-w-md rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 10000 }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add New College</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Create a new college to organize courses
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddCollegeModalOpen(false);
                  resetNewCollege();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCollege} className="p-6 space-y-4">
              {/* College Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  College Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCollege.name}
                  onChange={(e) => setNewCollege((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="College name (e.g., Pydah College of Engineering)"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {/* College Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  College Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCollege.code}
                  onChange={(e) => setNewCollege((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="College code (e.g., PCE)"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase"
                  required
                  maxLength={10}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique code for the college (e.g., PCE, PDC)
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCollegeModalOpen(false);
                    resetNewCollege();
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    creatingCollege || 
                    !newCollege.name.trim() || 
                    !newCollege.code?.trim()
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingCollege ? (
                    <>
                      <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create College
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Branch Modal - Using createPortal to render to document.body */}
      {isAddBranchModalOpen && typeof document !== 'undefined' && document.body && createPortal(
        <div 
          data-modal="add-branch"
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 99999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAddBranchModalOpen(false);
              resetNewBranch();
            }
          }}
        >
          <div 
            className="w-full max-w-md rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 10000 }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add New Branch</h3>
                {selectedCourse && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    for <span className="font-medium text-orange-600">{selectedCourse.name}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setIsAddBranchModalOpen(false);
                  resetNewBranch();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                handleAddBranch(null); 
              }} 
              className="p-6 space-y-4"
            >
              {/* Batch Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Batch (Academic Year) <span className="text-red-500">*</span>
                </label>
                <select
                  value={newBranch.academicYearId}
                  onChange={(e) => setNewBranch((prev) => ({ ...prev, academicYearId: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  required
                >
                  <option value="">Select a batch</option>
                  {academicYears.filter(y => y.isActive).map((year) => (
                    <option key={year.id} value={year.id}>{year.yearLabel}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the academic year/batch for this branch
                </p>
              </div>

              {/* Branch Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Branch name (e.g., CSE, ECE)"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  required
                />
              </div>

              {/* Branch Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Branch Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBranch.code}
                  onChange={(e) => setNewBranch((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="Branch code (e.g., CSE)"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 uppercase"
                  required
                  maxLength={10}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique code for the branch (e.g., CSE, ECE)
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddBranchModalOpen(false);
                    resetNewBranch();
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savingBranchId === `new-${branchModalCourseId}` || 
                    !newBranch.name.trim() || 
                    !newBranch.code.trim() || 
                    !newBranch.academicYearId
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingBranchId === `new-${branchModalCourseId}` ? (
                    <>
                      <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Branch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Course Modal - Using createPortal to render to document.body */}
      {isAddCourseModalOpen && typeof document !== 'undefined' && document.body && createPortal(
        <div 
          data-modal="add-course"
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 99999
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsAddCourseModalOpen(false);
            resetNewCourse();
          }
        }}
      >
        <div 
          className="w-full max-w-2xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto relative"
          onClick={(e) => e.stopPropagation()}
          style={{ zIndex: 10000 }}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Add New Course</h3>
              {selectedCollege && (
                <p className="text-sm text-gray-500 mt-0.5">
                  for <span className="font-medium text-purple-600">{selectedCollege.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setIsAddCourseModalOpen(false);
                resetNewCourse();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
            {/* Course Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Course Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCourse.name}
                onChange={(e) => setNewCourse((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Course name (e.g., B.Tech, Diploma)"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                required
              />
            </div>

            {/* Course Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Course Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCourse.code}
                onChange={(e) => setNewCourse((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="Course code (e.g., BTECH, DIP)"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 uppercase"
                required
                maxLength={20}
              />
              <p className="mt-1 text-xs text-gray-500">
                Unique code for the course (e.g., BTECH, DIP)
              </p>
            </div>

            {/* Total Years */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Total Years <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={newCourse.totalYears}
                onChange={(e) => {
                  const years = parseInt(e.target.value) || 1;
                  setNewCourse((prev) => {
                    const defaultSemesters = parseInt(prev.semestersPerYear) || 2;
                    let config;
                    if (prev.usePerYearConfig) {
                      if (prev.yearSemesterConfig && prev.yearSemesterConfig.length > 0) {
                        config = Array.from({ length: years }, (_, i) => {
                          const existing = prev.yearSemesterConfig[i];
                          return existing || { year: i + 1, semesters: defaultSemesters };
                        });
                      } else {
                        config = Array.from({ length: years }, (_, i) => ({
                          year: i + 1,
                          semesters: defaultSemesters
                        }));
                      }
                    } else {
                      config = [];
                    }
                    return { ...prev, totalYears: years, yearSemesterConfig: config };
                  });
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                required
              />
            </div>

            {/* Semesters Per Year (if not using per-year config) */}
            {!newCourse.usePerYearConfig && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Semesters Per Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={newCourse.semestersPerYear}
                  onChange={(e) => setNewCourse((prev) => ({ ...prev, semestersPerYear: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Same number of semesters for all years
                </p>
              </div>
            )}

            {/* Per-year configuration toggle */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="modalUsePerYearConfig"
                checked={newCourse.usePerYearConfig}
                onChange={(e) => {
                  const usePerYear = e.target.checked;
                  setNewCourse((prev) => {
                    if (usePerYear) {
                      const totalYears = parseInt(prev.totalYears) || 4;
                      const defaultSemesters = parseInt(prev.semestersPerYear) || 2;
                      let config = prev.yearSemesterConfig && prev.yearSemesterConfig.length === totalYears
                        ? [...prev.yearSemesterConfig]
                        : Array.from({ length: totalYears }, (_, i) => ({
                            year: i + 1,
                            semesters: defaultSemesters
                          }));
                      return { ...prev, usePerYearConfig: true, yearSemesterConfig: config };
                    } else {
                      return { ...prev, usePerYearConfig: false };
                    }
                  });
                }}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="modalUsePerYearConfig" className="text-sm text-gray-700 cursor-pointer">
                Configure semesters per year (e.g., Diploma Year 1: 1 sem, Year 2-3: 2 sems)
              </label>
            </div>

            {/* Per-year semester configuration table */}
            {newCourse.usePerYearConfig && newCourse.yearSemesterConfig && Array.isArray(newCourse.yearSemesterConfig) && newCourse.yearSemesterConfig.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 text-sm font-medium text-gray-700">Semesters per Year:</div>
                <div className="space-y-3">
                  {newCourse.yearSemesterConfig.map((yearConfig, index) => {
                    if (!yearConfig || typeof yearConfig.year !== 'number' || typeof yearConfig.semesters !== 'number') {
                      return null;
                    }
                    return (
                      <div key={`year-${yearConfig.year}-${index}`} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3">
                        <span className="w-20 text-sm font-medium text-gray-700">Year {yearConfig.year}:</span>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={yearConfig.semesters || 2}
                          onChange={(e) => {
                            const semesters = parseInt(e.target.value) || 1;
                            setNewCourse((prev) => {
                              if (!prev.yearSemesterConfig || !Array.isArray(prev.yearSemesterConfig)) {
                                return prev;
                              }
                              const config = [...prev.yearSemesterConfig];
                              if (config[index]) {
                                config[index] = { ...config[index], semesters };
                              }
                              return { ...prev, yearSemesterConfig: config };
                            });
                          }}
                          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                        <span className="text-sm text-gray-600">semester(s)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setIsAddCourseModalOpen(false);
                  resetNewCourse();
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  creatingCourse || 
                  !newCourse.name.trim() || 
                  !newCourse.code?.trim() ||
                  !newCourse.totalYears || 
                  Number(newCourse.totalYears) <= 0 ||
                  (!newCourse.usePerYearConfig && (!newCourse.semestersPerYear || Number(newCourse.semestersPerYear) <= 0)) ||
                  (newCourse.usePerYearConfig && (!newCourse.yearSemesterConfig || newCourse.yearSemesterConfig.length !== Number(newCourse.totalYears)))
                }
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingCourse ? (
                  <>
                    <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Course
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}
    </>
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

const CollegeCard = ({ 
  college, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onToggleActive,
  isEditing,
  isSaving,
  draft,
  onUpdateDraft,
  onSave,
  onCancel,
  coursesCount
}) => {
  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={draft?.name || college.name}
            onChange={(e) => onUpdateDraft('name', e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
            placeholder="College name"
          />
          <input
            type="text"
            value={draft?.code || college.code || ''}
            onChange={(e) => onUpdateDraft('code', e.target.value.toUpperCase())}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors uppercase"
            placeholder="College code (e.g., PCE)"
            required
            maxLength={10}
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={onSelect}
              className="flex-1 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{college.name}</span>
                <StatusBadge isActive={college.isActive} />
              </div>
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-500">{coursesCount || 0} courses</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSelect}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <BookOpen size={14} />
              View Courses
            </button>
            <button
              onClick={onEdit}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={onToggleActive}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {college.isActive ? (
                <>
                  <ToggleRight size={14} className="text-green-600" />
                  Active
                </>
              ) : (
                <>
                  <ToggleLeft size={14} className="text-gray-500" />
                  Activate
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const CourseCard = ({ course, isSelected, onSelect }) => {
  // Count unique branch names (not total across batches)
  const activeBranches = new Set(
    (course.branches || []).filter((branch) => branch.isActive).map((branch) => branch.name)
  ).size;
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

