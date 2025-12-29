import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Edit,
  Trash2,
  Download,
  Filter,
  Upload,
  X,
  UserCog,
  Plus,
  Users,
  CheckCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Key,
  FileSpreadsheet,
  FileText,
  Eye,
  RefreshCw,
  Book,
  Calendar,
  History,
  MessageSquare
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api, { getStaticFileUrlDirect } from '../config/api';
import StudentHistoryTab from '../components/Students/StudentHistoryTab';
import StudentAttendanceTab from '../components/Students/StudentAttendanceTab';
import StudentSmsTab from '../components/Students/StudentSmsTab';
import toast from 'react-hot-toast';
import BulkRollNumberModal from '../components/BulkRollNumberModal';
import BulkUploadModal from '../components/BulkUploadModal';
import ManualRollNumberModal from '../components/ManualRollNumberModal';
import RejoinModal from '../components/RejoinModal';
import LoadingAnimation from '../components/LoadingAnimation';
import { SkeletonTable, SkeletonStudentsTable } from '../components/SkeletonLoader';
import { formatDate } from '../utils/dateUtils';
import { useStudents, useUpdateStudent, useDeleteStudent, useBulkDeleteStudents, useInvalidateStudents } from '../hooks/useStudents';
import useAuthStore from '../store/authStore';
import { BACKEND_MODULES, hasPermission as hasModulePermission, USER_ROLES, hasModuleAccess, FRONTEND_MODULES } from '../constants/rbac';

// Student status options
const STUDENT_STATUS_OPTIONS = [
  'Regular',
  'Admission Cancelled',
  'Detained',
  'Discontinued',
  'Long Absent',
  'Rejoined',
  'Course Completed'
];

// Certificate status options
const CERTIFICATES_STATUS_OPTIONS = [
  'Verified',
  'Unverified',
  'Submitted',
  'Pending',
  'Partial',
  'Originals Returned',
  'Not Required'
];

// Fee status options
const FEE_STATUS_OPTIONS = [
  'no due',
  'due',
  'permitted'
];

// Scholar status options
const SCHOLAR_STATUS_OPTIONS = [
  'eligible',
  'not eligible',
  'approved',
  'rejected from the first year',
  'rejected from the second year',
  'rejected from the third year',
  'rejected from the final year'
];

// Registration status options
const REGISTRATION_STATUS_OPTIONS = [
  'Pending',
  'Completed'
];

const Students = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [bulkPasswordState, setBulkPasswordState] = useState({
    isOpen: false,
    processing: false,
    results: null,
    summary: null
  });
  const userPermissions = user?.permissions || {};

  // RBAC-derived capabilities for Student Management
  const canViewStudents = hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'view');
  const canAddStudent = hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'add_student');
  const canBulkUploadStudents = hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'bulk_upload');
  // Edit permission is now granular per field, but we assume if they can view, they might be able to edit specific fields if authorized
  // We keep 'canEditStudents' variable for backward compatibility but bind it to 'view' or 'edit_student' if it existed,
  // but since we removed 'edit_student', we'll rely on field permissions.
  // For UI consistency, we'll allow entering edit mode if the user can view the list.
  const canEditStudents = canViewStudents;
  const canDeleteStudents = hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'delete_student');
  const canUpdatePin = hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'update_pin');
  const canExportStudents = hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'export');
  // SMS tab should be visible for super admin, admin, or users with view_sms permission
  const canViewSms = user?.role === 'super_admin' || user?.role === 'admin' || hasModulePermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'view_sms');
  // Check if user has access to Attendance module
  const canViewAttendance = hasModuleAccess(userPermissions, FRONTEND_MODULES.ATTENDANCE);

  const isCashier = user?.role === USER_ROLES.CASHIER;

  // Helper to check field-level permissions
  const canViewField = useCallback((fieldKey) => {
    if (user?.role === 'admin' || user?.role === 'super_admin') return true;
    const fieldPerms = userPermissions?.student_management?.field_permissions;
    if (!fieldPerms) return true;
    return fieldPerms[fieldKey]?.view === true;
  }, [userPermissions, user?.role]);

  // Helper to check field-level edit permissions
  const canEditField = useCallback((fieldKey) => {
    if (user?.role === 'admin' || user?.role === 'super_admin') return true;
    const fieldPerms = userPermissions?.student_management?.field_permissions;
    if (!fieldPerms) return true;
    return fieldPerms[fieldKey]?.edit === true;
  }, [userPermissions, user?.role]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeStudentTab, setActiveStudentTab] = useState('details');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ student_status: 'Regular' }); // Default to show only Regular students
  const [colleges, setColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true); // Track overall filter loading state
  const [quickFilterOptions, setQuickFilterOptions] = useState({
    batches: [],
    colleges: [],
    courses: [],
    branches: [],
    years: [],
    semesters: []
  });
  const [availableFields, setAvailableFields] = useState([]);
  const [dropdownFilterOptions, setDropdownFilterOptions] = useState({
    stud_type: [],
    student_status: [],
    scholar_status: SCHOLAR_STATUS_OPTIONS,
    caste: [],
    gender: [],
    certificates_status: [],
    remarks: []
  });
  const [showBulkRollNumber, setShowBulkRollNumber] = useState(false);
  const [showManualRollNumber, setShowManualRollNumber] = useState(false);
  const [showBulkStudentUpload, setShowBulkStudentUpload] = useState(false);
  const [editingRollNumber, setEditingRollNumber] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [tempRollNumber, setTempRollNumber] = useState('');
  const [savingPinNumber, setSavingPinNumber] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewingPassword, setViewingPassword] = useState(false);
  const [studentPassword, setStudentPassword] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [completionPercentages, setCompletionPercentages] = useState({});
  const [profileCompletion, setProfileCompletion] = useState({ percentage: 0, filledCount: 0, totalCount: 0 });
  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [editRegistrationStatus, setEditRegistrationStatus] = useState('');
  const [editFeeStatus, setEditFeeStatus] = useState('');
  const [showPermitModal, setShowPermitModal] = useState(false);
  const [permitEndingDate, setPermitEndingDate] = useState('');
  const [permitRemarks, setPermitRemarks] = useState('');
  const [pendingFeeStatusChange, setPendingFeeStatusChange] = useState(null);
  const [pendingPermitAdmissionNumber, setPendingPermitAdmissionNumber] = useState(null);
  const [showRejoinModal, setShowRejoinModal] = useState(false);
  const [rejoinStudent, setRejoinStudent] = useState(null);
  const [editingCell, setEditingCell] = useState(null); // { studentId, field }
  const [cellEditValue, setCellEditValue] = useState('');
  const [inlineEditChanges, setInlineEditChanges] = useState(new Map()); // Track changes before saving
  const skipFilterFetchRef = useRef(false);
  const filtersRef = useRef(filters);
  const searchTermRef = useRef(searchTerm);
  const pageSizeRef = useRef(pageSize);
  const pageSizeOptions = [10, 25, 50, 100];

  // React Query hooks
  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();
  const bulkDeleteMutation = useBulkDeleteStudents();
  const invalidateStudents = useInvalidateStudents();

  // Memoize filters for React Query - use stable comparison to prevent unnecessary refetches
  const prevFiltersStringRef = useRef('');
  const prevFiltersObjectRef = useRef({});

  const memoizedFilters = useMemo(() => {
    const filterParams = {};

    // Standard filters
    if (filters.dateFrom) filterParams.dateFrom = filters.dateFrom;
    if (filters.dateTo) filterParams.dateTo = filters.dateTo;
    if (filters.pinNumberStatus) filterParams.pinNumberStatus = filters.pinNumberStatus;
    if (filters.year) filterParams.year = filters.year;
    if (filters.semester) filterParams.semester = filters.semester;
    if (filters.batch) filterParams.batch = filters.batch;
    if (filters.college) filterParams.college = filters.college;
    if (filters.course) filterParams.course = filters.course;
    if (filters.branch) filterParams.branch = filters.branch;

    // All student database fields
    const studentFields = [
      'admission_number', 'pin_no', 'stud_type', 'student_name', 'student_status',
      'scholar_status', 'student_mobile', 'parent_mobile1', 'parent_mobile2',
      'caste', 'gender', 'father_name', 'dob', 'adhar_no', 'admission_date',
      'student_address', 'city_village', 'mandal_name', 'district',
      'previous_college', 'certificates_status', 'remarks', 'created_at'
    ];

    studentFields.forEach(field => {
      if (filters[field]) {
        filterParams[field] = filters[field];
      }
    });

    // Dynamic field filters (for fields in student_data JSON)
    Object.entries(filters).forEach(([key, value]) => {
      if (key.startsWith('field_') && value) {
        filterParams[key] = value;
      }
    });

    // Compare with previous filters to return same reference if unchanged
    const filtersString = JSON.stringify(filterParams);
    if (prevFiltersStringRef.current === filtersString) {
      return prevFiltersObjectRef.current;
    }

    prevFiltersStringRef.current = filtersString;
    prevFiltersObjectRef.current = filterParams;
    return filterParams;
  }, [filters]);

  // Use React Query to fetch students
  // Only enable students query after filters are loaded
  const {
    data: studentsData,
    isLoading,
    isFetching,
    isError,
    error
  } = useStudents({
    page: currentPage,
    pageSize: pageSize,
    filters: memoizedFilters,
    search: debouncedSearch,
    enabled: !filtersLoading // Disable until filters are loaded
  });

  const students = studentsData?.students || [];
  const totalStudents = studentsData?.pagination?.total || 0;
  const scholarStatusOptions = dropdownFilterOptions.scholar_status?.length
    ? dropdownFilterOptions.scholar_status
    : SCHOLAR_STATUS_OPTIONS;

  // Helper function to extract numeric part from PIN (last 4-5 digits)
  const extractPinNumeric = (pinString) => {
    if (!pinString) return 0;
    const pin = String(pinString);
    const match = pin.match(/(\d{4,5})$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    const allDigits = pin.match(/\d+/g);
    if (allDigits && allDigits.length > 0) {
      return parseInt(allDigits[allDigits.length - 1], 10);
    }
    const parsed = parseFloat(pin);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to extract series prefix from PIN
  const extractPinSeries = (pinString) => {
    if (!pinString) return '';
    const pin = String(pinString);
    const numericMatch = pin.match(/(\d{4,5})$/);
    if (numericMatch) {
      return pin.substring(0, pin.length - numericMatch[1].length);
    }
    const allDigits = pin.match(/\d+/g);
    if (allDigits && allDigits.length > 0) {
      const lastDigits = allDigits[allDigits.length - 1];
      const lastIndex = pin.lastIndexOf(lastDigits);
      return pin.substring(0, lastIndex);
    }
    return pin;
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

  // Sort students based on sortConfig
  const sortedStudents = useMemo(() => {
    if (!sortConfig.field) return students;

    return [...students].sort((a, b) => {
      let aValue, bValue;
      let isNumeric = false;

      switch (sortConfig.field) {
        case 'pinNumber':
          const aPin = String(a.pin_no || '');
          const bPin = String(b.pin_no || '');
          const aSeries = extractPinSeries(aPin);
          const bSeries = extractPinSeries(bPin);

          if (aSeries !== bSeries) {
            const seriesComparison = aSeries.localeCompare(bSeries);
            return sortConfig.direction === 'asc' ? seriesComparison : -seriesComparison;
          }

          aValue = extractPinNumeric(aPin);
          bValue = extractPinNumeric(bPin);
          isNumeric = true;
          break;
        default:
          return 0;
      }

      if (isNumeric) {
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [students, sortConfig]);

  const totalPages = studentsData?.pagination?.totalPages ||
    (totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / (pageSize || 1))) : 1);
  // Only show loading for students table, not the entire page
  // Page structure (header, filters) should always be visible
  // Show loading when filters are still loading OR when students query is loading with no data yet
  const tableLoading = filtersLoading || (isLoading && students.length === 0);
  // Table is fetching when students query is fetching (but filters are already loaded)
  const tableFetching = (isFetching || isLoading) && !filtersLoading;

  const safePageSize = pageSize || 1;
  const showingFromRaw = totalStudents === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const showingFrom = totalStudents === 0 ? 0 : Math.min(showingFromRaw, totalStudents);
  const showingTo = totalStudents === 0 ? 0 : Math.min(totalStudents, showingFrom + Math.max(students.length - 1, 0));
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 100); // 100ms debounce delay for immediate fetch
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  // Get completion percentage for a student from backend
  const getStudentCompletionPercentage = async (admissionNumber) => {
    if (!admissionNumber) {
      return 0; // Return 0 if admission number is missing
    }
    try {
      const response = await api.get(`/submissions/student/${admissionNumber}/completion-status`);
      return response.data.data.completionPercentage;
    } catch (error) {
      // Silently return 0 if completion status can't be fetched
      return 0;
    }
  };

  const syncStageFields = (data, year, semester) => {
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

  /**
   * Calculate student profile completion percentage
   * @param {Object} student - Student object with all fields
   * @param {Object} studentData - Parsed student_data object
   * @returns {Object} { percentage, filledCount, totalCount }
   */
  const calculateProfileCompletion = useCallback((student, studentData = {}) => {
    // Helper to parse student_data if it's a string
    let parsedData = studentData;
    if (typeof studentData === 'string') {
      try {
        parsedData = JSON.parse(studentData || '{}');
      } catch (e) {
        parsedData = {};
      }
    }

    // Also check if student has student_data that needs parsing
    if (student.student_data && typeof student.student_data === 'string') {
      try {
        const parsed = JSON.parse(student.student_data || '{}');
        parsedData = { ...parsedData, ...parsed };
      } catch (e) {
        // Ignore parse errors
      }
    } else if (student.student_data && typeof student.student_data === 'object') {
      parsedData = { ...parsedData, ...student.student_data };
    }

    // Helper to check if a value is valid (not empty, null, undefined, "N/A", "-")
    const isValidValue = (value) => {
      if (value === null || value === undefined) return false;
      const str = String(value).trim().toLowerCase();
      return str !== '' && str !== 'n/a' && str !== '-' && str !== '{}' && str !== 'null' && str !== 'undefined';
    };

    // Helper to get field value from student object or studentData
    const getFieldValue = (fieldKey, altKeys = []) => {
      // Check individual database columns first
      if (student[fieldKey] !== undefined && student[fieldKey] !== null && student[fieldKey] !== '') {
        return student[fieldKey];
      }
      // Check parsedData JSON
      if (parsedData[fieldKey] !== undefined && parsedData[fieldKey] !== null && parsedData[fieldKey] !== '') {
        return parsedData[fieldKey];
      }
      // Check alternative keys
      for (const altKey of altKeys) {
        if (student[altKey] !== undefined && student[altKey] !== null && student[altKey] !== '') {
          return student[altKey];
        }
        if (parsedData[altKey] !== undefined && parsedData[altKey] !== null && parsedData[altKey] !== '') {
          return parsedData[altKey];
        }
      }
      return null;
    };

    // Define all fields that count towards completion
    const profileFields = [
      // Identity Fields
      { key: 'student_name', altKeys: ['Student Name', 'studentname'] },
      { key: 'pin_no', altKeys: ['Pin Number', 'PIN Number', 'roll_no', 'roll_number'] },
      { key: 'dob', altKeys: ['DOB (Date of Birth - DD-MM-YYYY)', 'DOB (Date-Month-Year) Ex: 09-Sep-2003)', 'date_of_birth'] },
      { key: 'adhar_no', altKeys: ['ADHAR No', 'aadhar_no', 'aadhaar_no'] },
      { key: 'father_name', altKeys: ['Father Name', 'fathername'] },
      { key: 'gender', altKeys: ['M/F', 'Gender'] },
      { key: 'caste', altKeys: ['Caste'] },

      // Academic Fields
      { key: 'admission_number', altKeys: ['Admission Number', 'Admission No', 'admission_no'] },
      { key: 'course', altKeys: ['Course', 'Course Name'] },
      { key: 'branch', altKeys: ['Branch', 'Branch Name'] },
      { key: 'batch', altKeys: ['Batch'] },
      { key: 'college', altKeys: ['College', 'College Name'] },
      { key: 'stud_type', altKeys: ['StudType', 'Student Type', 'student_type'] },
      { key: 'current_year', altKeys: ['Current Academic Year', 'Current Year', 'Year'] },
      { key: 'current_semester', altKeys: ['Current Semester', 'Semester', 'Semister'] },
      { key: 'admission_date', altKeys: ['Admission Date', 'admission_date'] },

      // Parent Information
      { key: 'parent_mobile1', altKeys: ['Parent Mobile Number 1', 'Parent Mobile 1', 'parent_mobile_1'] },
      { key: 'parent_mobile2', altKeys: ['Parent Mobile Number 2', 'Parent Mobile 2', 'parent_mobile_2'] },

      // Address Fields
      { key: 'student_address', altKeys: ['Student Address (D.No, Str name, Village, Mandal, Dist)', 'Student Address', 'address'] },
      { key: 'city_village', altKeys: ['City/Village', 'City/Village Name', 'city_village_name'] },
      { key: 'mandal_name', altKeys: ['Mandal Name', 'Mandal', 'mandal'] },
      { key: 'district', altKeys: ['District', 'District Name'] },

      // Administrative Fields
      { key: 'student_status', altKeys: ['Student Status', 'studentstatus'] },
      { key: 'scholar_status', altKeys: ['Scholar Status', 'scholarstatus'] },
      { key: 'certificates_status', altKeys: ['Certificates Status', 'Certificate Status', 'certificatesstatus'] },
      { key: 'previous_college', altKeys: ['Previous College Name', 'Previous College', 'previouscollege'] },
      { key: 'remarks', altKeys: ['Remarks', 'remark'] },

      // Photo
      { key: 'student_photo', altKeys: ['Student Photo', 'photo', 'studentphoto'] }
    ];

    let filledCount = 0;
    const totalCount = profileFields.length;

    // Count filled fields
    profileFields.forEach(field => {
      const value = getFieldValue(field.key, field.altKeys);
      if (isValidValue(value)) {
        filledCount++;
      }
    });

    // Calculate percentage
    const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

    return {
      percentage,
      filledCount,
      totalCount
    };
  }, []);

  const selectedCount = selectedAdmissionNumbers.size;
  const isAllSelected = students.length > 0 && selectedCount === students.length;

  const toggleSelectAllStudents = (checked) => {
    if (checked) {
      setSelectedAdmissionNumbers(new Set(students.map((student) => student.admission_number)));
    } else {
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

  useEffect(() => {
    const newStudent = location.state?.newStudent;
    if (newStudent) {
      // Invalidate cache to refetch with new student
      invalidateStudents();
      setCurrentPage(1);
      // Fetch completion percentage for the new student
      getStudentCompletionPercentage(newStudent.admission_number).then(percentage => {
        setCompletionPercentages(prev => ({
          ...prev,
          [newStudent.admission_number]: percentage
        }));
      });
      // Clear the state to avoid re-adding on re-renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state, invalidateStudents]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (showModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        // Re-enable body scrolling when modal closes
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [showModal]);

  // Recalculate profile completion when editData changes (in edit mode)
  useEffect(() => {
    if (showModal && selectedStudent && editData) {
      const parsedStudentData = typeof editData === 'string'
        ? JSON.parse(editData || '{}')
        : editData;
      const completion = calculateProfileCompletion(selectedStudent, parsedStudentData);
      setProfileCompletion(completion);
    }
  }, [editData, showModal, selectedStudent, calculateProfileCompletion]);

  // Check expired permits on component mount and when students data changes
  useEffect(() => {
    const checkExpiredPermits = async () => {
      try {
        const response = await api.post('/students/check-expired-permits');
        if (response.data?.success && response.data?.updated > 0) {
          // Silently refresh students if any were updated
          invalidateStudents();
        }
      } catch (error) {
        // Silently fail - don't show error to user on background check
        console.error('Failed to check expired permits:', error);
      }
    };

    // Check on mount and when students data is available
    if (students && students.length > 0) {
      checkExpiredPermits();
    }
  }, [students, invalidateStudents]);

  // Calculate stats when students or filters change - update immediately
  const studentsLengthRef = useRef(0);
  const studentsIdsRef = useRef('');
  const filtersRefForStats = useRef(JSON.stringify(filters));

  useEffect(() => {
    const currentIds = students.map(s => s.admission_number).sort().join(',');
    const currentLength = students.length;
    const currentFiltersStr = JSON.stringify(filters);

    // Recalculate if students changed OR filters changed
    const studentsChanged = currentLength !== studentsLengthRef.current || currentIds !== studentsIdsRef.current;
    const filtersChanged = currentFiltersStr !== filtersRefForStats.current;

    if (studentsChanged || filtersChanged) {
      studentsLengthRef.current = currentLength;
      studentsIdsRef.current = currentIds;
      filtersRefForStats.current = currentFiltersStr;

      // Call calculateOverallStats directly without including it in dependencies
      (async () => {
        if (students.length === 0) {
          setStats({ total: 0, completed: 0, averageCompletion: 0 });
          return;
        }

        // Filter to only count Regular students
        const regularStudents = students.filter(student => {
          const status = student.student_status || student.student_data?.student_status || student.student_data?.['Student Status'];
          return status === 'Regular';
        });

        const totalStudents = regularStudents.length;
        let completedStudents = 0;
        let totalCompletion = 0;

        // Fetch completion percentages for all regular students in parallel
        const promises = regularStudents
          .filter(student => student.admission_number)
          .map(async (student) => {
            const percentage = await getStudentCompletionPercentage(student.admission_number);
            return { percentage, admissionNumber: student.admission_number };
          });

        const results = await Promise.all(promises);

        results.forEach(result => {
          totalCompletion += result.percentage;
          if (result.percentage >= 80) {
            completedStudents++;
          }
        });

        const averageCompletion = totalStudents > 0 ? Math.round(totalCompletion / totalStudents) : 0;

        setStats({
          total: totalStudents,
          completed: completedStudents,
          averageCompletion
        });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, filters]);

  // Fetch colleges on component mount
  const fetchColleges = async () => {
    try {
      setCollegesLoading(true);
      const response = await api.get('/colleges');
      if (response.data?.success) {
        setColleges(response.data.data || []);
      } else {
        throw new Error('Failed to fetch colleges');
      }
    } catch (error) {
      console.error('Failed to fetch colleges:', error);
      toast.error(error.response?.data?.message || 'Failed to load colleges');
    } finally {
      setCollegesLoading(false);
    }
  };

  // Load all filters in sequence: colleges → quick filters → dropdown filters
  // This ensures filters are ready before students query runs
  const loadAllFilters = async () => {
    try {
      setFiltersLoading(true);

      // Step 1: Load colleges first (independent)
      await fetchColleges();

      // Step 2: Load quick filter options (with current filters for cascading)
      await fetchQuickFilterOptions(filters);

      // Step 3: Load dropdown filter options (with current filters for cascading)
      await fetchDropdownFilterOptions(filters);

    } catch (error) {
      console.error('Failed to load filters:', error);
      toast.error('Failed to load some filter options');
    } finally {
      setFiltersLoading(false);
    }
  };

  // Fetch filter fields when component mounts - load in sequence
  useEffect(() => {
    loadAllFilters();
  }, []); // Only run on mount

  // Refetch filter options when filters change (for cascading filters)
  // Use individual filter values to prevent unnecessary refetches
  // Only reload filter options, NOT the entire page
  const prevFiltersRef = useRef({ college: '', course: '', branch: '', batch: '', year: '', semester: '' });
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Skip on initial mount (already handled by loadAllFilters)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const currentFilters = {
      college: filters.college || '',
      course: filters.course || '',
      branch: filters.branch || '',
      batch: filters.batch || '',
      year: filters.year || '',
      semester: filters.semester || ''
    };

    // Only refetch if filter values actually changed
    const filtersChanged =
      currentFilters.college !== prevFiltersRef.current.college ||
      currentFilters.course !== prevFiltersRef.current.course ||
      currentFilters.branch !== prevFiltersRef.current.branch ||
      currentFilters.batch !== prevFiltersRef.current.batch ||
      currentFilters.year !== prevFiltersRef.current.year ||
      currentFilters.semester !== prevFiltersRef.current.semester;

    if (filtersChanged) {
      prevFiltersRef.current = currentFilters;
      // Update filter options based on new filters (cascading)
      // Don't exclude any field here - this is for background refresh when filters change via other means
      fetchQuickFilterOptions(currentFilters).catch(err => {
        console.warn('Failed to refresh quick filter options:', err);
      });
      fetchDropdownFilterOptions(currentFilters).catch(err => {
        console.warn('Failed to refresh dropdown filter options:', err);
      });
      // Invalidate students query to refetch with new filters immediately
      invalidateStudents();
    }
  }, [filters.college, filters.course, filters.branch, filters.batch, filters.year, filters.semester]);

  // Remove auto-search - only search on button click
  // useEffect removed - search will only trigger on button click

  // Only clear available fields when filters/search actually change (not on every render)
  const prevFiltersSearchRef = useRef({ filters: {}, searchTerm: '' });

  useEffect(() => {
    const filtersString = JSON.stringify(filters);
    const searchChanged = searchTerm !== prevFiltersSearchRef.current.searchTerm;
    const filtersChanged = filtersString !== JSON.stringify(prevFiltersSearchRef.current.filters);

    if (searchChanged || filtersChanged) {
      prevFiltersSearchRef.current = { filters, searchTerm };
      setAvailableFields([]);
    }
  }, [searchTerm, filters]);

  const fetchQuickFilterOptions = async (currentFilters = {}, excludeField = null) => {
    try {
      // Build query params for cascading filters
      // When excludeField is set, exclude that field to show all options for that dropdown
      // Otherwise, include all parent filters for proper cascading
      const params = new URLSearchParams();

      // Always include college if selected (unless college is being changed)
      if (currentFilters.college && excludeField !== 'college') {
        params.append('college', currentFilters.college);
      }

      // Include course only if:
      // 1. Course is selected AND
      // 2. Course is not being changed AND
      // 3. Branch is not being changed (because we want all branches for the selected course)
      if (currentFilters.course && excludeField !== 'course' && excludeField !== 'branch') {
        params.append('course', currentFilters.course);
      }

      // Include batch only if:
      // 1. Batch is selected AND
      // 2. Batch/year/semester are not being changed
      if (currentFilters.batch && excludeField !== 'batch' && excludeField !== 'year' && excludeField !== 'semester') {
        params.append('batch', currentFilters.batch);
      }

      const queryString = params.toString();
      const url = `/students/quick-filters${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      if (response.data?.success) {
        const data = response.data.data || {};
        setQuickFilterOptions({
          batches: data.batches || [],
          colleges: data.colleges || [],
          courses: data.courses || [],
          branches: data.branches || [],
          years: data.years || [],
          semesters: data.semesters || []
        });
      }
      return true;
    } catch (error) {
      console.warn('Failed to fetch quick filter options:', error);
      // Don't show toast on background refresh, only on initial load
      if (filtersLoading) {
        toast.error('Failed to load filter options');
      }
      throw error;
    }
  };

  const fetchDropdownFilterOptions = async (currentFilters = {}, excludeField = null) => {
    try {
      // Build query params for cascading filters
      // Exclude the field being changed so dropdown shows all available options
      const params = new URLSearchParams();
      if (currentFilters.college && excludeField !== 'college') params.append('college', currentFilters.college);
      if (currentFilters.course && excludeField !== 'course') params.append('course', currentFilters.course);
      if (currentFilters.branch && excludeField !== 'branch') params.append('branch', currentFilters.branch);
      if (currentFilters.batch && excludeField !== 'batch') params.append('batch', currentFilters.batch);
      if (currentFilters.year && excludeField !== 'year') params.append('year', currentFilters.year);
      if (currentFilters.semester && excludeField !== 'semester') params.append('semester', currentFilters.semester);

      const queryString = params.toString();
      const url = `/students/filter-options${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      if (response.data?.success) {
        const data = response.data.data || {};
        const mergeOptions = (base = [], fallback = []) => {
          const merged = new Set([...(fallback || []), ...(base || [])]);
          return Array.from(merged);
        };

        setDropdownFilterOptions({
          stud_type: data.stud_type || [],
          student_status: data.student_status || [],
          scholar_status: mergeOptions(data.scholar_status, SCHOLAR_STATUS_OPTIONS),
          caste: data.caste || [],
          gender: data.gender || [],
          certificates_status: data.certificates_status || [],
          remarks: data.remarks || []
        });
      }
      return true;
    } catch (error) {
      console.warn('Failed to fetch dropdown filter options:', error);
      // Don't show toast on background refresh, only on initial load
      if (filtersLoading) {
        toast.error('Failed to load dropdown filter options');
      }
      throw error;
    }
  };

  // Fetch completion percentages when students are loaded (in parallel)
  // Use stable comparison to prevent infinite loops
  const completionPercentagesStudentsRef = useRef('');

  useEffect(() => {
    const studentIds = students.map(s => s.admission_number).sort().join(',');

    // Only fetch if student IDs actually changed
    if (studentIds === completionPercentagesStudentsRef.current) {
      return;
    }

    completionPercentagesStudentsRef.current = studentIds;

    const fetchCompletionPercentages = async () => {
      if (students.length === 0) return;

      const percentages = {};
      const promises = students
        .filter(student => student.admission_number) // Only process students with admission numbers
        .map(async (student) => {
          try {
            const response = await api.get(`/submissions/student/${student.admission_number}/completion-status`);
            return { admissionNumber: student.admission_number, percentage: response.data.data.completionPercentage };
          } catch (error) {
            // Silently return 0 if completion status can't be fetched
            return { admissionNumber: student.admission_number, percentage: 0 };
          }
        });

      const results = await Promise.all(promises);
      results.forEach(result => {
        percentages[result.admissionNumber] = result.percentage;
      });
      setCompletionPercentages(percentages);
    };

    fetchCompletionPercentages();
  }, [students]);

  // Update selected admission numbers when students change - use stable comparison
  const selectedStudentsRef = useRef('');

  useEffect(() => {
    const studentIds = students.map(s => s.admission_number).sort().join(',');

    // Only update if student IDs actually changed
    if (studentIds === selectedStudentsRef.current) {
      return;
    }

    selectedStudentsRef.current = studentIds;

    setSelectedAdmissionNumbers((prev) => {
      const updated = new Set();
      students.forEach((student) => {
        if (prev.has(student.admission_number)) {
          updated.add(student.admission_number);
        }
      });
      return updated;
    });
  }, [students]);

  // Extract available fields from students - use stable comparison to prevent infinite loops
  const availableFieldsStudentsRef = useRef('');

  useEffect(() => {
    if (students.length === 0) {
      return;
    }

    const studentIds = students.map(s => s.admission_number).sort().join(',');

    // Only extract fields if student IDs actually changed
    if (studentIds === availableFieldsStudentsRef.current) {
      return;
    }

    availableFieldsStudentsRef.current = studentIds;

    // Extract available fields and their unique values from current students data
    const fieldsMap = {};

    // Keywords to exclude (text fields that shouldn't be filters)
    const excludeKeywords = ['name', 'phone', 'mobile', 'contact', 'address', 'email', 'number', 'guardian', 'parent', 'information'];

    students.forEach(student => {
      if (!student.student_data || typeof student.student_data !== 'object') {
        return; // Skip students without valid student_data
      }
      Object.entries(student.student_data).forEach(([key, value]) => {
        const keyLower = key.toLowerCase();
        const shouldExclude = excludeKeywords.some(keyword => keyLower.includes(keyword));

        if (!shouldExclude && !fieldsMap[key]) {
          fieldsMap[key] = new Set();
        }
        if (!shouldExclude && value && typeof value === 'string') {
          fieldsMap[key].add(value);
        }
      });
    });

    const fieldsArray = Object.entries(fieldsMap).map(([key, values]) => ({
      name: key,
      values: Array.from(values).sort()
    }));

    setAvailableFields(prevFields => {
      const combinedMap = new Map();

      prevFields.forEach(field => {
        combinedMap.set(field.name, new Set(field.values));
      });

      fieldsArray.forEach(field => {
        if (!combinedMap.has(field.name)) {
          combinedMap.set(field.name, new Set(field.values));
        } else {
          const existingValues = combinedMap.get(field.name);
          field.values.forEach(value => existingValues.add(value));
        }
      });

      return Array.from(combinedMap.entries())
        .map(([name, values]) => ({
          name,
          values: Array.from(values).sort()
        }))
        .filter(field => field.values.length >= 2 && field.values.length <= 10);
    });
  }, [students]);

  // Error handling for React Query
  useEffect(() => {
    if (isError && error) {
      toast.error(error.response?.data?.message || 'Failed to fetch students');
    }
  }, [isError, error]);

  const fetchForms = async () => {
    if (loadingForms) {
      return;
    }
    setLoadingForms(true);
    try {
      const response = await api.get('/forms');
      if (response.data?.success) {
        setForms(response.data.data || []);
      } else {
        toast.error(response.data?.message || 'Failed to load forms');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load forms');
    } finally {
      setLoadingForms(false);
    }
  };

  // Apply server-side filtering
  const applyFilters = () => {
    setCurrentPage(1);
  };

  // Legacy function for backward compatibility - now uses server-side filtering
  const handleLocalSearch = () => {
    setDebouncedSearch(searchTerm); // Force immediate search update
    setCurrentPage(1);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
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
        // If college changes (or is cleared), clear course and branch to avoid invalid selections
        delete newFilters.course;
        delete newFilters.branch;
      } else if (field === 'course') {
        // If course changes (or is cleared), clear branch to avoid invalid selections
        delete newFilters.branch;
      }

      // Auto-expand filters when a filter is applied
      if (value && !filtersExpanded) {
        setFiltersExpanded(true);
      }

      // Update ref immediately
      filtersRef.current = newFilters;

      // Always update filter options with cascading when a filter changes
      // This ensures child filters show only relevant options based on parent selections
      fetchQuickFilterOptions(newFilters).catch(err => {
        console.warn('Failed to update filter options:', err);
      });
      fetchDropdownFilterOptions(newFilters).catch(err => {
        console.warn('Failed to update dropdown filter options:', err);
      });

      // Automatically apply filter when changed - React Query will refetch automatically
      setCurrentPage(1);
      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setAvailableFields([]);
    setCurrentPage(1);
    skipFilterFetchRef.current = true;
  };

  const handlePageChange = (newPage) => {
    if (isLoading || isFetching) {
      return;
    }

    if (newPage === currentPage || newPage < 1 || newPage > totalPages) {
      return;
    }

    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value, 10);

    if (filtersLoading || isLoading || isFetching) {
      return;
    }

    if (Number.isNaN(newSize) || newSize <= 0 || newSize === pageSize) {
      return;
    }

    setPageSize(newSize);
    setCurrentPage(1);
  };

  const refreshStudents = () => {
    invalidateStudents();
  };

  // Inline editing handlers
  const handleCellClick = (student, field, currentValue, fieldType = 'text') => {
    const studentId = student.id || student.admission_number || student.admissionNumber;
    const admissionNumber =
      student.admission_number ||
      student.admissionNumber ||
      student.admissionNo ||
      student.admission_number;

    setEditingCell({
      studentId,
      admissionNumber,
      field,
      fieldType,
      originalValue: currentValue || ''
    });
    setCellEditValue(currentValue || '');
  };

  const handleCellBlur = async (student, overrideValue = null) => {
    if (!editingCell) return;

    const { field } = editingCell;
    const admissionNumber =
      editingCell.admissionNumber ||
      student.admission_number ||
      student.admissionNumber ||
      student.admissionNo ||
      student.id;

    const newValueRaw = overrideValue !== null ? overrideValue : cellEditValue;
    const newValue = (newValueRaw ?? '').toString().trim();
    const originalValue =
      editingCell.originalValue !== undefined
        ? (editingCell.originalValue ?? '').toString().trim()
        : (student[field] || '').toString().trim();

    // If value hasn't changed, just clear editing
    if (newValue === originalValue) {
      setEditingCell(null);
      setCellEditValue('');
      return;
    }

    // Special handling for student_status -> 'Rejoined' (requires batch selection)
    if (field === 'student_status' && newValue === 'Rejoined') {
      // Open rejoin modal
      setRejoinStudent(student);
      setShowRejoinModal(true);
      setEditingCell(null);
      setCellEditValue('');
      return;
    }

    // Special handling for fee_status -> 'permitted' (requires permit details)
    if (field === 'fee_status' && newValue === 'permitted') {
      // Store which student is being permitted so we can save after modal confirmation
      setPendingFeeStatusChange(newValue);
      setPendingPermitAdmissionNumber(admissionNumber);
      setShowPermitModal(true);
      setEditingCell(null);
      setCellEditValue('');
      return;
    }

    // Save the change immediately
    try {
      if (field === 'fee_status') {
        await api.put(`/students/${admissionNumber}/fee-status`, {
          fee_status: newValue
        });
      } else if (field === 'registration_status') {
        await api.put(`/students/${admissionNumber}/registration-status`, {
          registration_status: newValue
        });
      } else {
        // Update via general update endpoint
        const updateData = { [field]: newValue };
        await updateStudentMutation.mutateAsync({
          admissionNumber: admissionNumber,
          data: { studentData: updateData }
        });
      }

      toast.success(`${field} updated successfully`);
      invalidateStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to update ${field}`);
    }

    setEditingCell(null);
    setCellEditValue('');
  };

  const handleCellKeyDown = (e, student) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur(student);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setCellEditValue('');
    }
  };

  // Render editable cell
  const renderEditableCell = (student, field, fieldType = 'text', options = []) => {
    const studentKey = student.id || student.admission_number || student.admissionNumber;

    // Check if user is cashier and restrict editing to only fee_status
    const isEditsAllowedForField = isCashier ? field === 'fee_status' : true;

    // Allow editing if:
    // 1. General edit permission is true AND field-level edit permission is true AND field allows edits
    // 2. OR User is cashier AND field is fee_status (override general permission if needed)
    const hasPermissionToEdit = ((canEditStudents && canEditField(field)) || (isCashier && field === 'fee_status'));

    const isEditing = hasPermissionToEdit && isEditsAllowedForField && editingCell?.studentId === studentKey && editingCell?.field === field;
    const currentValue = student[field] || '';

    if (isEditing) {
      if (fieldType === 'select') {
        // Ensure current value is in options, add it if not present
        const allOptions = [...new Set([...options, currentValue].filter(Boolean))];
        const displayValue = cellEditValue !== '' ? cellEditValue : (currentValue || '');

        return (
          <select
            value={displayValue}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue === 'permitted' && field === 'fee_status') {
                // Inline edit flow for permitting fees – open modal and remember student
                const admissionNumber =
                  student.admission_number || student.admissionNumber || student.admissionNo;
                setPendingFeeStatusChange(newValue);
                setPendingPermitAdmissionNumber(admissionNumber || null);
                setShowPermitModal(true);
                setEditingCell(null);
                setCellEditValue('');
              } else {
                setCellEditValue(newValue);
                handleCellBlur({ ...student, [field]: newValue }, newValue);
              }
            }}
            onBlur={() => handleCellBlur(student)}
            onKeyDown={(e) => handleCellKeyDown(e, student)}
            autoFocus
            className="w-full px-1 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            {!displayValue && <option value="">Select...</option>}
            {allOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      } else {
        return (
          <input
            type={fieldType}
            value={cellEditValue}
            onChange={(e) => setCellEditValue(e.target.value)}
            onBlur={() => handleCellBlur(student)}
            onKeyDown={(e) => handleCellKeyDown(e, student)}
            autoFocus
            className="w-full px-1 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        );
      }
    }

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleCellClick(student, field, currentValue, fieldType);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleCellClick(student, field, currentValue, fieldType);
        }}
        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded transition-colors"
        title="Click or double-click to edit"
      >
        {currentValue || '-'}
      </div>
    );
  };

  const handleViewPassword = async () => {
    if (!selectedStudent) return;

    setLoadingPassword(true);
    try {
      const response = await api.get(`/students/${selectedStudent.admission_number}/password`);
      if (response.data.success) {
        setStudentPassword(response.data.data);
        setViewingPassword(true);
      } else {
        toast.error(response.data.message || 'Failed to retrieve password');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to retrieve password');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedStudent) return;

    if (!window.confirm('Are you sure you want to reset this student\'s password? A new password will be generated and sent via SMS.')) {
      return;
    }

    setResettingPassword(true);
    try {
      const response = await api.post(`/students/${selectedStudent.admission_number}/reset-password`);
      if (response.data.success) {
        setStudentPassword(response.data.data);
        setViewingPassword(true);
        toast.success('Password reset successfully! SMS sent to student.');
      } else {
        toast.error(response.data.message || 'Failed to reset password');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleViewDetails = (student) => {
    setEditMode(false);
    setEditingRollNumber(false);
    setTempRollNumber(student.pin_no || '');
    setViewingPassword(false);
    setStudentPassword(null);

    // Prepare all possible fields including hidden ones
    const allFields = {
      // From student_data (form submission) - use original field names
      ...student.student_data,
      // Map ALL individual database columns to ensure they're available
      // These override student_data if they exist in individual columns
      ...(student.student_name && { student_name: student.student_name }),
      ...(student.father_name && { father_name: student.father_name }),
      ...(student.gender && { gender: student.gender }),
      ...(student.dob && { dob: student.dob }),
      ...(student.student_mobile && { student_mobile: student.student_mobile }),
      ...(student.parent_mobile1 && { parent_mobile1: student.parent_mobile1 }),
      ...(student.parent_mobile2 && { parent_mobile2: student.parent_mobile2 }),
      ...(student.adhar_no && { adhar_no: student.adhar_no }),
      ...(student.caste && { caste: student.caste }),
      ...(student.batch && { batch: student.batch }),
      ...(student.college && { college: student.college }),
      ...(student.course && { course: student.course }),
      ...(student.branch && { branch: student.branch }),
      ...(student.stud_type && { stud_type: student.stud_type }),
      ...(student.student_status && { student_status: student.student_status }),
      // Always include scholar_status so it can be updated from blank
      scholar_status: student.scholar_status || '',
      ...(student.student_address && { student_address: student.student_address }),
      ...(student.city_village && { city_village: student.city_village }),
      ...(student.mandal_name && { mandal_name: student.mandal_name }),
      ...(student.district && { district: student.district }),
      ...(student.pin_no && { pin_no: student.pin_no }),
      ...(student.previous_college && { previous_college: student.previous_college }),
      // Always include certificates_status even if null, so it can be edited
      certificates_status: student.certificates_status || null,
      ...(student.student_photo && { student_photo: student.student_photo }),
      ...(student.remarks && { remarks: student.remarks }),
      ...(student.admission_date && { admission_date: student.admission_date })
    };

    console.log('Student data:', student);
    console.log('All fields being set:', allFields);

    const stageSyncedFields = syncStageFields(
      allFields,
      student.current_year,
      student.current_semester
    );

    const stageSyncedStudent = {
      ...student,
      current_year: stageSyncedFields.current_year || student.current_year,
      current_semester: stageSyncedFields.current_semester || student.current_semester,
      student_data: stageSyncedFields
    };

    // Calculate profile completion BEFORE opening modal (instant calculation)
    const parsedStudentData = typeof stageSyncedFields === 'string'
      ? JSON.parse(stageSyncedFields || '{}')
      : stageSyncedFields;

    const completion = calculateProfileCompletion(stageSyncedStudent, parsedStudentData);
    setProfileCompletion(completion);
    console.log('Profile completion calculated:', completion);

    setSelectedStudent(stageSyncedStudent);
    setEditData(stageSyncedFields);
    setEditRegistrationStatus(student.registration_status || 'pending');
    setEditFeeStatus(student.fee_status || 'pending');
    setPermitEndingDate(student.permit_ending_date || '');
    setPermitRemarks(student.permit_remarks || '');
    setShowModal(true);
  };

  const handleEdit = () => {
    if (!canEditStudents) {
      toast.error('You do not have permission to edit student details.');
      return;
    }
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (savingEdit) return; // Prevent double submission

    // Check if student status is being changed to "Rejoined"
    if (editData.student_status === 'Rejoined' && selectedStudent.student_status !== 'Rejoined') {
      // Open rejoin modal instead of saving directly
      setRejoinStudent(selectedStudent);
      setShowRejoinModal(true);
      return;
    }

    setSavingEdit(true);
    try {
      console.log('Saving edit data:', editData);
      console.log('Selected student:', selectedStudent);

      const synchronizedData = syncStageFields(
        editData,
        editData.current_year || editData['Current Academic Year'],
        editData.current_semester || editData['Current Semester']
      );

      // Ensure statuses are included within studentData (backend maps these via FIELD_MAPPING)
      if (editRegistrationStatus) {
        synchronizedData.registration_status = editRegistrationStatus;
      }
      if (editFeeStatus) {
        synchronizedData.fee_status = editFeeStatus;
      }

      // If fee status is 'permitted', validate and update via fee-status endpoint to include permit data
      if (editFeeStatus === 'permitted') {
        if (!permitEndingDate) {
          toast.error('Permit ending date is required when fee status is "permitted"');
          return;
        }
        if (!permitRemarks || !permitRemarks.trim()) {
          toast.error('Permit remarks is required when fee status is "permitted"');
          return;
        }
        try {
          await api.put(`/students/${selectedStudent.admission_number}/fee-status`, {
            fee_status: editFeeStatus,
            permit_ending_date: permitEndingDate,
            permit_remarks: permitRemarks
          });
          toast.success('Fee status updated successfully');
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to update fee status');
          throw error;
        }
      }

      await updateStudentMutation.mutateAsync({
        admissionNumber: selectedStudent.admission_number,
        data: {
          studentData: synchronizedData
        }
      });

      console.log('Save successful');

      // Invalidate students query to ensure fresh data
      invalidateStudents();

      setEditMode(false);
      setEditData(synchronizedData);
      setSelectedStudent((prev) =>
        prev
          ? {
            ...prev,
            current_year:
              synchronizedData.current_year || prev.current_year,
            current_semester:
              synchronizedData.current_semester || prev.current_semester,
            student_data: synchronizedData
          }
          : prev
      );

      // Recalculate profile completion after save (instant, no API call needed)
      const updatedStudent = {
        ...selectedStudent,
        current_year: synchronizedData.current_year || selectedStudent.current_year,
        current_semester: synchronizedData.current_semester || selectedStudent.current_semester,
        student_data: synchronizedData
      };
      const parsedStudentData = typeof synchronizedData === 'string'
        ? JSON.parse(synchronizedData || '{}')
        : synchronizedData;
      const updatedCompletion = calculateProfileCompletion(updatedStudent, parsedStudentData);
      setProfileCompletion(updatedCompletion);
      console.log('Profile completion updated after save:', updatedCompletion);

    } catch (error) {
      console.error('Save failed:', error);
      // Error toast is handled by the mutation
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveRollNumber = async () => {
    if (!canUpdatePin) {
      toast.error('You do not have permission to update PIN numbers.');
      return;
    }
    if (savingPinNumber) return; // Prevent double submission

    console.log('[PIN UPDATE] Starting update for:', selectedStudent?.admission_number, 'New PIN:', tempRollNumber);

    setSavingPinNumber(true);
    try {
      const url = `/students/${selectedStudent.admission_number}/pin-number`;
      console.log('[PIN UPDATE] Making API call to:', url);

      // Make the API call - axios throws on non-2xx responses
      const response = await api.put(url, {
        pinNumber: tempRollNumber,
      });

      console.log('[PIN UPDATE] API Response:', response.data);

      // If we reach here, the request was successful (no exception thrown)
      setEditingRollNumber(false);

      // Update selectedStudent state
      setSelectedStudent(prev => ({ ...prev, pin_no: tempRollNumber }));

      // Update editData state as well
      setEditData(prev => ({ ...prev, pin_no: tempRollNumber }));

      // Invalidate the React Query cache to refresh the student list
      invalidateStudents();

      toast.success('PIN number updated successfully');
    } catch (error) {
      console.error('[PIN UPDATE] Error:', error);
      console.error('[PIN UPDATE] Error response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to update PIN number');
    } finally {
      setSavingPinNumber(false);
    }
  };

  const handleDelete = async (admissionNumber) => {
    if (!canDeleteStudents) {
      toast.error('You do not have permission to delete students.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }
    try {
      await deleteStudentMutation.mutateAsync(admissionNumber);

      // Remove from completion percentages
      setCompletionPercentages(prev => {
        const updated = { ...prev };
        delete updated[admissionNumber];
        return updated;
      });

      setSelectedAdmissionNumbers((prev) => {
        const updated = new Set(prev);
        updated.delete(admissionNumber);
        return updated;
      });

      // Cache invalidation is handled by the mutation

    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  const handleBulkDelete = async () => {
    if (!canDeleteStudents) {
      toast.error('You do not have permission to delete students.');
      return;
    }
    if (selectedCount === 0 || bulkDeleteMutation.isPending) {
      return;
    }

    if (!window.confirm(`Delete ${selectedCount} selected student${selectedCount === 1 ? '' : 's'}? This action cannot be undone.`)) {
      return;
    }

    const admissionNumbers = Array.from(selectedAdmissionNumbers);

    try {
      await bulkDeleteMutation.mutateAsync(admissionNumbers);

      // Remove from completion percentages
      setCompletionPercentages((prev) => {
        const updated = { ...prev };
        admissionNumbers.forEach((number) => {
          delete updated[number];
        });
        return updated;
      });
      setSelectedAdmissionNumbers(new Set());

      // Cache invalidation is handled by the mutation
    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  const handleBulkResendPasswords = async () => {
    if (!canUpdatePin) {
      toast.error('You do not have permission to update credentials.');
      return;
    }
    if (selectedCount === 0) return;

    if (!window.confirm(`Send password reset SMS to ${selectedCount} selected student${selectedCount === 1 ? '' : 's'}?`)) {
      return;
    }

    setBulkPasswordState(prev => ({ ...prev, isOpen: true, processing: true, results: null }));

    try {
      const admissionNumbers = Array.from(selectedAdmissionNumbers);
      const response = await api.post('/students/bulk-resend-passwords', {
        students: admissionNumbers
      });

      if (response.data.success) {
        setBulkPasswordState(prev => ({
          ...prev,
          processing: false,
          results: response.data.data,
          summary: response.data.summary
        }));
        toast.success('Bulk password operation completed');
      } else {
        toast.error(response.data.message || 'Failed to process request');
        setBulkPasswordState(prev => ({ ...prev, isOpen: false, processing: false }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Server error');
      setBulkPasswordState(prev => ({ ...prev, isOpen: false, processing: false }));
    }
  };

  const downloadBulkPasswordReport = () => {
    const { results } = bulkPasswordState;
    if (!results || results.length === 0) return;

    const headers = ['Admission Number', 'Status', 'Error', 'Mobile (Username)'];
    const csvContent = [
      headers.join(','),
      ...results.map(r => [
        r.admission_number,
        r.status,
        r.error ? `"${r.error.replace(/"/g, '""')}"` : '',
        r.mobile || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password_resend_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      toast.error('No data to export');
      return;
    }

    const firstStudentData = students[0]?.student_data;
    const dataKeys = firstStudentData && typeof firstStudentData === 'object' ? Object.keys(firstStudentData) : [];
    const headers = [
      'Admission Number',
      'PIN Number',
      'Current Year',
      'Current Semester',
      'Name',
      'Mobile Number',
      ...dataKeys
    ];
    const csvContent = [
      headers.join(','),
      ...students.map((student) => {
        const data = student.student_data;
        if (!data || typeof data !== 'object') {
          return [
            student.admission_number,
            student.pin_no || '',
            student.current_year || '',
            student.current_semester || '',
            '-',
            '-',
            ...Object.keys(student).filter(key => key !== 'student_data' && key !== 'admission_number' && key !== 'pin_no').map(key => student[key] || '')
          ].join(',');
        }
        const nameField = Object.keys(data).find(key =>
          key.toLowerCase().includes('name') ||
          key.toLowerCase().includes('student name') ||
          key.toLowerCase() === 'name'
        );
        const mobileField = Object.keys(data).find(key =>
          key.toLowerCase().includes('mobile') ||
          key.toLowerCase().includes('phone') ||
          key.toLowerCase().includes('contact')
        );

        const row = [
          student.admission_number,
          student.pin_no || '',
          student.current_year || student.student_data?.current_year || '',
          student.current_semester || student.student_data?.current_semester || '',
          nameField ? data[nameField] : '',
          mobileField ? data[mobileField] : '',
          ...Object.values(student.student_data).map((val) =>
            Array.isArray(val) ? `"${val.join(', ')}"` : `"${val}"`
          ),
        ];
        return row.join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const hasFilters = Object.keys(filters).length > 0 || searchTerm;
    const filename = hasFilters
      ? `students_filtered_${new Date().toISOString().split('T')[0]}.csv`
      : `students_all_${new Date().toISOString().split('T')[0]}.csv`;

    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    const message = hasFilters
      ? `Exported ${students.length} filtered students`
      : `Exported ${students.length} students`;
    toast.success(message);
  };

  const updateEditField = (key, value) => {
    setEditData({ ...editData, [key]: value });
  };

  // Helper function to get certificates for course type
  const getCertificatesForCourse = (courseType) => {
    if (courseType === 'Diploma') {
      return [
        { key: 'ssc_certificate', label: 'SSC Certificate' },
        { key: '10th_tc', label: '10th TC (Transfer Certificate)' },
        { key: '10th_study', label: '10th Study Certificate' }
      ];
    } else if (courseType === 'UG') {
      return [
        { key: 'ssc_certificate', label: 'SSC Certificate' },
        { key: '10th_tc', label: '10th TC (Transfer Certificate)' },
        { key: '10th_study', label: '10th Study Certificate' },
        { key: 'inter_diploma_tc', label: 'Inter/Diploma TC (Transfer Certificate)' },
        { key: 'inter_diploma_study', label: 'Inter/Diploma Study Certificate' }
      ];
    } else if (courseType === 'PG') {
      return [
        { key: 'ssc_certificate', label: 'SSC Certificate' },
        { key: '10th_tc', label: '10th TC (Transfer Certificate)' },
        { key: '10th_study', label: '10th Study Certificate' },
        { key: 'inter_diploma_tc', label: 'Inter/Diploma TC (Transfer Certificate)' },
        { key: 'inter_diploma_study', label: 'Inter/Diploma Study Certificate' },
        { key: 'ug_study', label: 'UG Study Certificate' },
        { key: 'ug_tc', label: 'UG TC (Transfer Certificate)' },
        { key: 'ug_pc', label: 'UG PC (Provisional Certificate)' },
        { key: 'ug_cmm', label: 'UG CMM (Consolidated Marks Memo)' },
        { key: 'ug_od', label: 'UG OD (Original Degree)' }
      ];
    }
    return [];
  };

  // Helper function to check if certificate is present
  const isCertificatePresent = (certKey) => {
    // Check in editData first, then selectedStudent.student_data
    const studentData = editData || selectedStudent?.student_data || {};
    const parsedData = typeof studentData === 'string' ? JSON.parse(studentData || '{}') : studentData;
    return parsedData[certKey] === true || parsedData[certKey] === 'Yes' || parsedData[certKey] === 'yes';
  };

  // Helper function to get certificate status display
  const getCertificateStatusDisplay = (certKey, overallStatus) => {
    // If overall status is Verified or Submitted, show Yes
    if (overallStatus === 'Verified' || overallStatus === 'Submitted') {
      return 'Yes';
    }
    // If overall status is Unverified, Pending, or null, check individual certificate
    if (overallStatus === 'Unverified' || overallStatus === 'Pending' || !overallStatus) {
      return isCertificatePresent(certKey) ? 'Yes' : 'No';
    }
    // For other statuses, check individual certificate
    return isCertificatePresent(certKey) ? 'Yes' : 'No';
  };

  // Update certificate status
  const updateCertificateStatus = (certKey, value) => {
    const newEditData = { ...editData };
    newEditData[certKey] = value;

    // Auto-update certificates_status based on all certificates
    const courseName = (editData.course || selectedStudent?.course || '').toLowerCase();
    let courseType = null;
    if (courseName.includes('diploma')) {
      courseType = 'Diploma';
    } else if (
      courseName.includes('pg') ||
      courseName.includes('post graduate') ||
      courseName.includes('m.tech') ||
      courseName.includes('mtech') ||
      courseName.includes('mba') ||
      courseName.includes('mca') ||
      courseName.includes('msc') ||
      courseName.includes('m sc') ||
      courseName.includes('aqua') ||
      courseName.includes('m.pharma') ||
      courseName.includes('m pharma') ||
      (courseName.includes('pharma') && (courseName.includes('m') || courseName.startsWith('pharma')))
    ) {
      courseType = 'PG';
    } else if (courseName) {
      courseType = 'UG';
    }

    if (courseType) {
      const certificates = getCertificatesForCourse(courseType);
      const allYes = certificates.every(cert => {
        const certValue = cert.key === certKey ? value : newEditData[cert.key];
        return certValue === true || certValue === 'Yes' || certValue === 'yes';
      });
      newEditData.certificates_status = allYes && certificates.length > 0 ? 'Verified' : 'Unverified';
    }

    setEditData(newEditData);
  };

  // Calculate overall statistics
  const [stats, setStats] = useState({ total: 0, completed: 0, averageCompletion: 0 });

  const calculateOverallStats = useCallback(async () => {
    if (students.length === 0) {
      setStats({ total: 0, completed: 0, averageCompletion: 0 });
      return;
    }

    // Filter to only count Regular students
    const regularStudents = students.filter(student => {
      const status = student.student_status || student.student_data?.student_status || student.student_data?.['Student Status'];
      return status === 'Regular';
    });

    const totalStudents = regularStudents.length;
    let completedStudents = 0;
    let totalCompletion = 0;

    // Fetch completion percentages for all regular students in parallel
    const promises = regularStudents
      .filter(student => student.admission_number) // Only process students with admission numbers
      .map(async (student) => {
        const percentage = await getStudentCompletionPercentage(student.admission_number);
        return { percentage, admissionNumber: student.admission_number };
      });

    const results = await Promise.all(promises);

    results.forEach(result => {
      totalCompletion += result.percentage;
      if (result.percentage >= 80) {
        completedStudents++;
      }
    });

    const averageCompletion = totalStudents > 0 ? Math.round(totalCompletion / totalStudents) : 0;

    setStats({
      total: totalStudents,
      completed: completedStudents,
      averageCompletion
    });
  }, [students]);

  // Never show full-page loader - always show page structure
  // Only the table area will show loading state

  // If user somehow reaches this page without view permission, show a clean access message
  if (!canViewStudents) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Access to Student Database</h2>
          <p className="text-sm text-gray-600">
            You have view or edit access disabled for the Student Management module. Please contact an administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 lg:p-8">
      <div className="flex flex-col gap-4">
        {/* Search Bar with Action Buttons Inline */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLocalSearch()}
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
              placeholder="Search by student name, PIN number, or admission number..."
            />
          </div>
          <button
            onClick={handleLocalSearch}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation min-h-[44px] font-medium whitespace-nowrap"
          >
            Search
          </button>
          {/* Action Buttons Inline - respect RBAC permissions */}
          <div className="flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto">
            {canAddStudent && (
              <Link
                to="/students/add"
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-white text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px] whitespace-nowrap flex-shrink-0"
              >
                <Plus size={18} />
                <span>Add Student</span>
              </Link>
            )}

            {canBulkUploadStudents && (
              <button
                onClick={async () => {
                  await fetchForms();
                  setShowBulkStudentUpload(true);
                }}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-white text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                disabled={loadingForms}
              >
                <Upload size={18} />
                <span>{loadingForms ? 'Loading Forms...' : 'Bulk Upload Students'}</span>
              </button>
            )}

            {canUpdatePin && (
              <button
                onClick={() => setShowManualRollNumber(true)}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-white text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px] whitespace-nowrap flex-shrink-0"
              >
                <UserCog size={18} />
                <span>Update PIN Numbers</span>
              </button>
            )}

            {canDeleteStudents && (
              <button
                onClick={handleBulkDelete}
                disabled={selectedCount === 0 || bulkDeleteMutation.isPending}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-white text-sm font-medium bg-gradient-to-r from-red-600 to-red-700 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                <Trash2 size={18} />
                <span>{bulkDeleteMutation.isPending ? 'Deleting...' : `Delete Selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}</span>
              </button>
            )}

            {canUpdatePin && !isCashier && (
              <button
                onClick={handleBulkResendPasswords}
                disabled={selectedCount === 0 || bulkPasswordState.processing}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-white text-sm font-medium bg-gradient-to-r from-teal-600 to-teal-700 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                <Key size={18} />
                <span>{bulkPasswordState.processing ? 'Sending...' : `Send Passwords${selectedCount > 0 ? ` (${selectedCount})` : ''}`}</span>
              </button>
            )}

            {canExportStudents && (
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-white text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px] whitespace-nowrap flex-shrink-0"
              >
                <Download size={18} />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Total Students</p>
                <p className="text-xl font-bold text-blue-600">{totalStudents.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {filters.student_status === 'Regular' ? 'Regular students' : 'Across current filters'}
                </p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users className="text-blue-600" size={18} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Completed Profiles</p>
                <p className="text-xl font-bold text-blue-600">{stats.completed}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% of total
                </p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <CheckCircle className="text-blue-600" size={18} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Average Completion</p>
                <p className="text-xl font-bold text-blue-600">{stats.averageCompletion}%</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${stats.averageCompletion}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <TrendingUp className="text-blue-600" size={18} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section - Always Visible and Expandable */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              <Filter size={18} />
              <span>Filters</span>
              {filtersExpanded ? (
                <ChevronUp size={18} className="text-gray-500" />
              ) : (
                <ChevronDown size={18} className="text-gray-500" />
              )}
            </button>
            <div className="flex items-center gap-3">
              {!filtersExpanded && Object.keys(filters).length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Active:</span>
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value) return null;
                    const displayKey = key
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded"
                      >
                        {displayKey}: {value}
                      </span>
                    );
                  })}
                </div>
              )}
              {(Object.keys(filters).length > 0 || searchTerm) && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
        {filtersExpanded && (
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">College</label>
                <select
                  value={filters.college || ''}
                  onChange={(e) => handleFilterChange('college', e.target.value)}
                  disabled={collegesLoading}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All</option>
                  {colleges.filter(c => c.isActive !== false).map((college) => (
                    <option key={college.id} value={college.name}>{college.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Batch</label>
                <select
                  value={filters.batch || ''}
                  onChange={(e) => handleFilterChange('batch', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(quickFilterOptions.batches || []).map((batch) => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Course</label>
                <select
                  value={filters.course || ''}
                  onChange={(e) => handleFilterChange('course', e.target.value)}
                  onFocus={(e) => {
                    // When user focuses on course dropdown, fetch all courses for selected college
                    // Pass excludeField='course' so it excludes course filter but keeps college filter
                    // This ensures all courses are available when changing from one course to another
                    const filtersForFetch = { ...filters };
                    // Temporarily remove course to get all courses for the college
                    if (filtersForFetch.course) {
                      delete filtersForFetch.course;
                    }
                    fetchQuickFilterOptions(filtersForFetch, 'course').catch(err => {
                      console.warn('Failed to refresh course options:', err);
                    });
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(quickFilterOptions.courses || []).map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Branch</label>
                <select
                  value={filters.branch || ''}
                  onChange={(e) => handleFilterChange('branch', e.target.value)}
                  onFocus={(e) => {
                    // When user focuses on branch dropdown, fetch all branches for selected course
                    // Pass excludeField='branch' so it excludes branch filter but keeps course/college filters
                    // This ensures all branches are available when changing from one branch to another
                    const filtersForFetch = { ...filters };
                    // Temporarily remove branch to get all branches for the course
                    if (filtersForFetch.branch) {
                      delete filtersForFetch.branch;
                    }
                    fetchQuickFilterOptions(filtersForFetch, 'branch').catch(err => {
                      console.warn('Failed to refresh branch options:', err);
                    });
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(quickFilterOptions.branches || []).map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Student Type</label>
                <select
                  value={filters.stud_type || ''}
                  onChange={(e) => handleFilterChange('stud_type', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.stud_type || []).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={filters.student_status || ''}
                  onChange={(e) => handleFilterChange('student_status', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.student_status || []).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Scholar Status</label>
                <select
                  value={filters.scholar_status || ''}
                  onChange={(e) => handleFilterChange('scholar_status', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.scholar_status && dropdownFilterOptions.scholar_status.length > 0
                    ? dropdownFilterOptions.scholar_status
                    : SCHOLAR_STATUS_OPTIONS
                  ).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Caste</label>
                <select
                  value={filters.caste || ''}
                  onChange={(e) => handleFilterChange('caste', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.caste || []).map((caste) => (
                    <option key={caste} value={caste}>{caste}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Gender</label>
                <select
                  value={filters.gender || ''}
                  onChange={(e) => handleFilterChange('gender', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.gender || []).map((gender) => (
                    <option key={gender} value={gender}>{gender}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Fee Status</label>
                <select
                  value={filters.fee_status || ''}
                  onChange={(e) => handleFilterChange('fee_status', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Registration Status</label>
                <select
                  value={filters.registration_status || ''}
                  onChange={(e) => handleFilterChange('registration_status', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Year</label>
                <select
                  value={filters.year || ''}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(quickFilterOptions.years || []).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Semester</label>
                <select
                  value={filters.semester || ''}
                  onChange={(e) => handleFilterChange('semester', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(quickFilterOptions.semesters || []).map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <select
                  value={filters.remarks || ''}
                  onChange={(e) => handleFilterChange('remarks', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.remarks || []).map((remark) => (
                    <option key={remark} value={remark}>{remark}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {tableLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <SkeletonStudentsTable rows={pageSize || 10} />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-600">
              {Object.keys(filters).length > 0 || searchTerm
                ? 'No students match the current filters. Try adjusting your search criteria.'
                : 'There are no student records in the database yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
          {/* Show loading overlay only when table is fetching (not on initial page load) */}
          {tableFetching && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-xl">
              <div className="text-center space-y-2">
                <LoadingAnimation
                  width={24}
                  height={24}
                  message=""
                  showMessage={false}
                />
                <p className="text-sm text-gray-600">Updating table...</p>
              </div>
            </div>
          )}
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-center w-12 sticky left-0 bg-gray-50 z-20 border-r border-gray-200">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      disabled={students.length === 0 || bulkDeleteMutation.isPending}
                      checked={isAllSelected}
                      onChange={(e) => toggleSelectAllStudents(e.target.checked)}
                    />
                  </th>
                  {canViewField('student_photo') && (
                    <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-left min-w-[80px] sticky left-12 bg-gray-50 z-20 border-r border-gray-200">
                      <div className="font-semibold">Photo</div>
                    </th>
                  )}
                  {canViewField('student_name') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Student Name</div>
                    </th>
                  )}
                  {canViewField('pin_no') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <button
                        onClick={() => handleSort('pinNumber')}
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        <div className="font-semibold whitespace-nowrap">PIN Number</div>
                        {sortConfig.field === 'pinNumber' && (
                          <ArrowUpDown size={14} className={sortConfig.direction === 'asc' ? 'rotate-180' : ''} />
                        )}
                      </button>
                    </th>
                  )}
                  {canViewField('admission_number') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Admission Number</div>
                    </th>
                  )}
                  {canViewField('batch') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Batch</div>
                    </th>
                  )}
                  {canViewField('college') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">College</div>
                    </th>
                  )}
                  {canViewField('course') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Course</div>
                    </th>
                  )}
                  {canViewField('branch') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Branch</div>
                    </th>
                  )}
                  {!isCashier && (
                    <>
                      {canViewField('stud_type') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                          <div className="font-semibold whitespace-nowrap">Student Type</div>
                        </th>
                      )}
                      {canViewField('caste') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                          <div className="font-semibold whitespace-nowrap">Caste</div>
                        </th>
                      )}
                      {canViewField('gender') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                          <div className="font-semibold whitespace-nowrap">Gender</div>
                        </th>
                      )}
                      {canViewField('student_status') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                          <div className="font-semibold whitespace-nowrap">Status</div>
                        </th>
                      )}
                      {canViewField('certificates_status') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                          <div className="font-semibold whitespace-nowrap">Certificate Status</div>
                        </th>
                      )}
                    </>
                  )}
                  {canViewField('fee_status') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Fee Status</div>
                    </th>
                  )}
                  {canViewField('current_year') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Year</div>
                    </th>
                  )}
                  {canViewField('current_semester') && (
                    <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                      <div className="font-semibold whitespace-nowrap">Sem</div>
                    </th>
                  )}
                  {!isCashier && (
                    <>
                      {canViewField('scholar_status') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                          <div className="font-semibold whitespace-nowrap">Scholar Status</div>
                        </th>
                      )}
                      {canViewField('registration_status') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                          <div className="font-semibold whitespace-nowrap">Registration Status</div>
                        </th>
                      )}
                      {canViewField('remarks') && (
                        <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                          <div className="font-semibold whitespace-nowrap">Remarks</div>
                        </th>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => {
                  return (
                    <tr
                      key={student.admission_number}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        // Don't trigger view modal if interacting with inputs/selects/inline editors
                        if (
                          e.target.type === 'checkbox' ||
                          e.target.closest('input[type="checkbox"]') ||
                          e.target.closest('select') ||
                          e.target.closest('input') ||
                          e.target.closest('textarea')
                        ) {
                          return;
                        }
                        if (!isCashier) {
                          handleViewDetails(student);
                        }
                      }}
                    >
                      <td className="py-2 px-3 text-center sticky left-0 bg-white z-10 border-r border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                          disabled={bulkDeleteMutation.isPending}
                          checked={selectedAdmissionNumbers.has(student.admission_number)}
                          onChange={() => toggleSelectStudent(student.admission_number)}
                        />
                      </td>
                      {canViewField('student_photo') && (
                        <td className="py-2 px-3 sticky left-12 bg-white z-10 border-r border-gray-200">
                          <div className="flex items-center justify-center w-10 h-10">
                            {student.student_photo &&
                              student.student_photo !== '{}' &&
                              student.student_photo !== null &&
                              student.student_photo !== '' &&
                              student.student_photo !== '{}' ? (
                              <img
                                src={getStaticFileUrlDirect(student.student_photo)}
                                alt="Student Photo"
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 shadow-sm"
                                onError={(e) => {
                                  if (e.target && e.target.style) {
                                    e.target.style.display = 'none';
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center shadow-sm">
                                <span className="text-gray-400 text-xs">No Photo</span>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {canViewField('student_name') && (
                        <td className="py-2 px-1.5 text-xs text-gray-900">{student.student_name || '-'}</td>
                      )}
                      {canViewField('pin_no') && (
                        <td className="py-2 px-1.5 text-xs text-gray-600">
                          {student.pin_no ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                              {student.pin_no}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      )}
                      {canViewField('admission_number') && (
                        <td className="py-2 px-1.5 text-xs font-medium text-gray-900">{student.admission_number || '-'}</td>
                      )}
                      {canViewField('batch') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700">{student.batch || '-'}</td>
                      )}
                      {canViewField('college') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700">{student.college || '-'}</td>
                      )}
                      {canViewField('course') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700">{student.course || '-'}</td>
                      )}
                      {canViewField('branch') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700">{student.branch || '-'}</td>
                      )}
                      {!isCashier && (
                        <>
                          {canViewField('stud_type') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700">{student.stud_type || '-'}</td>
                          )}
                          {canViewField('caste') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {renderEditableCell(student, 'caste', 'text')}
                            </td>
                          )}
                          {canViewField('gender') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {renderEditableCell(student, 'gender', 'select', ['M', 'F', 'Other'])}
                            </td>
                          )}
                          {canViewField('student_status') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" onClick={(e) => e.stopPropagation()}>
                              {renderEditableCell(student, 'student_status', 'select', STUDENT_STATUS_OPTIONS)}
                            </td>
                          )}
                          {canViewField('certificates_status') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate">
                              {student.certificates_status || 'Pending'}
                            </td>
                          )}
                        </>
                      )}
                      {canViewField('fee_status') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700" onClick={(e) => e.stopPropagation()}>
                          {renderEditableCell(student, 'fee_status', 'select', FEE_STATUS_OPTIONS)}
                        </td>
                      )}
                      {canViewField('current_year') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700">{student.current_year || '-'}</td>
                      )}
                      {canViewField('current_semester') && (
                        <td className="py-2 px-1.5 text-xs text-gray-700">{student.current_semester || '-'}</td>
                      )}
                      {!isCashier && (
                        <>
                          {canViewField('scholar_status') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" onClick={(e) => e.stopPropagation()}>
                              {renderEditableCell(student, 'scholar_status', 'select', scholarStatusOptions)}
                            </td>
                          )}
                          {canViewField('registration_status') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700" onClick={(e) => e.stopPropagation()}>
                              {renderEditableCell(student, 'registration_status', 'select', REGISTRATION_STATUS_OPTIONS)}
                            </td>
                          )}
                          {canViewField('remarks') && (
                            <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" title={student.remarks || ''}>
                              <span className="block truncate">{student.remarks || '-'}</span>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3 p-3 sm:p-4">
            {sortedStudents.map((student) => {
              return (
                <div
                  key={student.admission_number}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4 space-y-3">
                    {/* Header with Photo and Checkbox */}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded mt-1"
                          disabled={bulkDeleteMutation.isPending}
                          checked={selectedAdmissionNumbers.has(student.admission_number)}
                          onChange={() => toggleSelectStudent(student.admission_number)}
                        />
                      </div>
                      {canViewField('student_photo') && (
                        <div className="flex-shrink-0">
                          {student.student_photo &&
                            student.student_photo !== '{}' &&
                            student.student_photo !== null &&
                            student.student_photo !== '' &&
                            student.student_photo !== '{}' ? (
                            <img
                              src={getStaticFileUrlDirect(student.student_photo)}
                              alt="Student Photo"
                              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 shadow-sm"
                              onError={(e) => {
                                if (e.target && e.target.style) {
                                  e.target.style.display = 'none';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center shadow-sm">
                              <span className="text-gray-400 text-xs">No Photo</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0" onClick={() => !isCashier && handleViewDetails(student)}>
                        {canViewField('student_name') && (
                          <h3 className="font-semibold text-gray-900 text-base truncate">{student.student_name || '-'}</h3>
                        )}
                        {canViewField('admission_number') && (
                          <p className="text-sm text-gray-600 mt-1">{student.admission_number || '-'}</p>
                        )}
                        {canViewField('pin_no') && student.pin_no && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium mt-1">
                            PIN: {student.pin_no}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Key Information Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      {canViewField('batch') && (
                        <div>
                          <p className="text-xs text-gray-500">Batch</p>
                          <p className="text-sm font-medium text-gray-900">{student.batch || '-'}</p>
                        </div>
                      )}
                      {canViewField('college') && (
                        <div>
                          <p className="text-xs text-gray-500">College</p>
                          <p className="text-sm font-medium text-gray-900 truncate" title={student.college || ''}>{student.college || '-'}</p>
                        </div>
                      )}
                      {canViewField('course') && (
                        <div>
                          <p className="text-xs text-gray-500">Course</p>
                          <p className="text-sm font-medium text-gray-900 truncate" title={student.course || ''}>{student.course || '-'}</p>
                        </div>
                      )}
                      {canViewField('branch') && (
                        <div>
                          <p className="text-xs text-gray-500">Branch</p>
                          <p className="text-sm font-medium text-gray-900 truncate" title={student.branch || ''}>{student.branch || '-'}</p>
                        </div>
                      )}
                      {!isCashier && (
                        <>
                          {canViewField('caste') && (
                            <div>
                              <p className="text-xs text-gray-500">Caste</p>
                              <p className="text-sm font-medium text-gray-900 truncate" title={student.caste || ''}>{student.caste || '-'}</p>
                            </div>
                          )}
                          {canViewField('gender') && (
                            <div>
                              <p className="text-xs text-gray-500">Gender</p>
                              <p className="text-sm font-medium text-gray-900 truncate" title={student.gender || ''}>{student.gender || '-'}</p>
                            </div>
                          )}
                          {canViewField('student_status') && (
                            <div>
                              <p className="text-xs text-gray-500">Status</p>
                              <p className="text-sm font-medium text-gray-900 truncate" title={student.student_status || ''}>{student.student_status || '-'}</p>
                            </div>
                          )}
                        </>
                      )}

                      {canViewField('fee_status') && (
                        <div>
                          <p className="text-xs text-gray-500">Fee Status</p>
                          <p className="text-sm font-medium text-gray-900">{student.fee_status || 'pending'}</p>
                        </div>
                      )}
                      {(canViewField('current_year') || canViewField('current_semester')) && (
                        <div>
                          <p className="text-xs text-gray-500">Year/Sem</p>
                          <p className="text-sm font-medium text-gray-900">
                            {canViewField('current_year') ? (student.current_year || '-') : '?'}
                            /
                            {canViewField('current_semester') ? (student.current_semester || '-') : '?'}
                          </p>
                        </div>
                      )}

                      {!isCashier && (
                        <>
                          {canViewField('scholar_status') && (
                            <div>
                              <p className="text-xs text-gray-500">Scholar Status</p>
                              <p className="text-sm font-medium text-gray-900 truncate" title={student.scholar_status || ''}>{student.scholar_status || '-'}</p>
                            </div>
                          )}
                          {canViewField('registration_status') && (
                            <div>
                              <p className="text-xs text-gray-500">Registration Status</p>
                              <p className="text-sm font-medium text-gray-900">{student.registration_status || 'pending'}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Action Button */}
                    {!isCashier && (
                      <button
                        onClick={() => handleViewDetails(student)}
                        className="w-full mt-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation font-medium text-sm"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 border-t border-gray-100">
            <div className="text-xs sm:text-sm text-gray-600">
              {totalStudents === 0
                ? 'No students to display'
                : `Showing ${showingFrom.toLocaleString()}-${showingTo.toLocaleString()} of ${totalStudents.toLocaleString()}`}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <span className="hidden sm:inline">Rows per page</span>
                <span className="sm:hidden">Per page</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="px-2 py-1.5 sm:py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm touch-manipulation min-h-[44px]"
                  disabled={isLoading || isFetching}
                >
                  {pageSizeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={isFirstPage || isLoading || isFetching || totalStudents === 0}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px]"
                >
                  Previous
                </button>
                <span className="text-xs sm:text-sm text-gray-600 px-2">
                  Page {Math.min(currentPage, totalPages).toLocaleString()} of {totalPages.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={isLastPage || isLoading || isFetching || totalStudents === 0}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px]"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedStudent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowModal(false);
              setActiveStudentTab('details');
            }
          }}
          onWheel={(e) => {
            // Prevent scrolling on backdrop
            e.stopPropagation();
          }}
        >
          <div
            className="bg-gray-50 rounded-lg sm:rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] sm:h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Student Details</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">View and manage student information</p>
              </div>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <>
                    {/* View Password button removed */}
                    {/* View Password button removed */}
                    {canEditStudents && !isCashier && (
                      <>
                        <button
                          onClick={handleResetPassword}
                          disabled={resettingPassword}
                          className="flex items-center gap-2 bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors touch-manipulation min-h-[44px] text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Reset Password"
                        >
                          <RefreshCw size={16} className={`sm:w-[18px] sm:h-[18px] ${resettingPassword ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">Reset Password</span>
                          <span className="sm:hidden">Reset</span>
                        </button>
                        <button onClick={handleEdit} className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation min-h-[44px] text-sm sm:text-base">
                          <Edit size={16} className="sm:w-[18px] sm:h-[18px]" />
                          <span className="hidden sm:inline">Edit</span>
                          <span className="sm:hidden">Edit</span>
                        </button>
                      </>
                    )}
                  </>
                )}
                <button onClick={() => {
                  setShowModal(false);
                  setActiveStudentTab('details');
                  setViewingPassword(false);
                  setStudentPassword(null);
                }} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Password Display Modal */}
            {viewingPassword && studentPassword && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Key size={24} className="text-green-600" />
                      Student Login Credentials
                    </h3>
                    <button
                      onClick={() => {
                        setViewingPassword(false);
                        setStudentPassword(null);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-lg">
                        {studentPassword.username}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-lg">
                        {studentPassword.password}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Password format: First 4 letters of name + last 4 digits of mobile number
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => {
                        setViewingPassword(false);
                        setStudentPassword(null);
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content - Two Column Layout */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Sidebar - Student Photo & Key Info */}
              <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 p-4 sm:p-6 flex-shrink-0 flex flex-col overflow-hidden">
                <div className="space-y-5">
                  {/* Student Photo */}
                  {canViewField('student_photo') && (
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center shadow-sm relative ${editMode && !photoUploading ? 'cursor-pointer hover:border-blue-400 active:border-blue-500 transition-colors' : ''} ${photoUploading ? 'cursor-wait opacity-75' : ''}`}>
                          {editData.student_photo && editData.student_photo !== '{}' && editData.student_photo !== null && editData.student_photo !== '' ? (
                            <img
                              key={editData.student_photo}
                              src={getStaticFileUrlDirect(editData.student_photo)}
                              alt="Student Photo"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = e.target.parentElement?.querySelector('.photo-fallback');
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center photo-fallback ${editData.student_photo && editData.student_photo !== '{}' && editData.student_photo !== null && editData.student_photo !== '' ? 'hidden' : ''}`}>
                            <div className="text-center">
                              <UserCog size={48} className="mx-auto text-gray-400 mb-1" />
                              <span className="text-xs text-gray-500">No Photo</span>
                            </div>
                          </div>
                          {editMode && !photoUploading && (
                            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center transition-all">
                              <div className="text-white text-xs font-medium opacity-0 hover:opacity-100">
                                Click to Upload
                              </div>
                            </div>
                          )}
                          {photoUploading && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-lg">
                              <div className="bg-white rounded-lg p-4 flex flex-col items-center gap-2">
                                <LoadingAnimation width={32} height={32} showMessage={false} />
                                <span className="text-sm text-gray-700 font-medium">Uploading photo...</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {editMode && (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  // Validate file type
                                  if (!file.type.startsWith('image/')) {
                                    toast.error('Please select a valid image file');
                                    return;
                                  }

                                  // Validate file size (5MB limit)
                                  if (file.size > 5 * 1024 * 1024) {
                                    toast.error('File size should be less than 5MB');
                                    return;
                                  }

                                  setPhotoUploading(true);
                                  try {
                                    const formData = new FormData();
                                    formData.append('photo', file);
                                    formData.append('admissionNumber', selectedStudent.admission_number);

                                    const uploadResponse = await api.post('/students/upload-photo', formData, {
                                      headers: {
                                        'Content-Type': 'multipart/form-data',
                                      },
                                    });

                                    if (uploadResponse.data.success) {
                                      // Use the base64 data URL returned from backend for immediate display
                                      updateEditField('student_photo', uploadResponse.data.data.photo_url);
                                      toast.success('Photo uploaded successfully');
                                    } else {
                                      toast.error('Failed to upload photo');
                                    }
                                  } catch (error) {
                                    console.error('Photo upload error:', error);
                                    toast.error('Failed to upload photo');
                                  } finally {
                                    setPhotoUploading(false);
                                  }
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              id="student-photo-upload"
                              disabled={photoUploading}
                            />
                            {photoUploading && (
                              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-lg">
                                <div className="bg-white rounded-lg p-4 flex flex-col items-center gap-2">
                                  <LoadingAnimation width={32} height={32} showMessage={false} />
                                  <span className="text-sm text-gray-700 font-medium">Uploading photo...</span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {editMode && (
                        <label htmlFor="student-photo-upload" className="mt-2 text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
                          Click photo to upload
                        </label>
                      )}
                    </div>
                  )}

                  {/* Key Identity Info */}
                  <div className="space-y-3">
                    {canViewField('student_name') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Student Name
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editData.student_name || editData['Student Name'] || ''}
                            onChange={(e) => updateEditField('student_name', e.target.value)}
                            className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                          />
                        ) : (
                          <p className="text-sm font-bold text-gray-900">
                            {editData.student_name || editData['Student Name'] || selectedStudent?.student_name || '-'}
                          </p>
                        )}
                      </div>
                    )}
                    {canViewField('pin_no') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Roll Number
                        </label>
                        {editingRollNumber ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempRollNumber}
                              onChange={(e) => setTempRollNumber(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !savingPinNumber) {
                                  e.preventDefault();
                                  handleSaveRollNumber();
                                }
                              }}
                              placeholder="Enter PIN number"
                              className="flex-1 px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                              disabled={savingPinNumber}
                            />
                            <button
                              type="button"
                              onClick={handleSaveRollNumber}
                              disabled={savingPinNumber}
                              className="px-2 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {savingPinNumber ? (
                                <>
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                </>
                              ) : (
                                'Save'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRollNumber(false);
                                setTempRollNumber(selectedStudent.pin_no || '');
                              }}
                              disabled={savingPinNumber}
                              className="px-2 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {selectedStudent.pin_no ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-green-100 text-green-800 text-sm font-semibold">
                                {selectedStudent.pin_no}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Not assigned</span>
                            )}
                            {!editMode && canUpdatePin && (
                              <button
                                onClick={() => setEditingRollNumber(true)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit PIN Number"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {canViewField('course') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Course
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editData.course || selectedStudent.course || ''}
                            onChange={(e) => updateEditField('course', e.target.value)}
                            className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">
                            {editData.course || selectedStudent.course || '-'}
                          </p>
                        )}
                      </div>
                    )}
                    {canViewField('branch') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Branch
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editData.branch || editData.Branch || ''}
                            onChange={(e) => updateEditField('branch', e.target.value)}
                            className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">
                            {editData.branch || editData.Branch || selectedStudent?.branch || '-'}
                          </p>
                        )}
                      </div>
                    )}
                    {(canViewField('current_year') || canViewField('current_semester')) && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Current Year & Semester
                        </label>
                        {editMode ? (
                          <div className="grid grid-cols-2 gap-2">
                            {canViewField('current_year') && (
                              <select
                                value={editData.current_year || editData['Current Academic Year'] || selectedStudent.current_year || '1'}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEditData((prev) =>
                                    syncStageFields(
                                      {
                                        ...prev,
                                        current_year: value,
                                        'Current Academic Year': value
                                      },
                                      value,
                                      prev.current_semester || prev['Current Semester'] || selectedStudent.current_semester || '1'
                                    )
                                  );
                                }}
                                className="w-full px-2 sm:px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                              >
                                <option value="1">Year 1</option>
                                <option value="2">Year 2</option>
                                <option value="3">Year 3</option>
                                <option value="4">Year 4</option>
                              </select>
                            )}
                            {canViewField('current_semester') && (
                              <select
                                value={editData.current_semester || editData['Current Semester'] || selectedStudent.current_semester || '1'}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEditData((prev) =>
                                    syncStageFields(
                                      {
                                        ...prev,
                                        current_semester: value,
                                        'Current Semester': value
                                      },
                                      prev.current_year || prev['Current Academic Year'] || selectedStudent.current_year || '1',
                                      value
                                    )
                                  );
                                }}
                                className="w-full px-2 sm:px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                              >
                                <option value="1">Sem 1</option>
                                <option value="2">Sem 2</option>
                              </select>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-indigo-700">
                            {canViewField('current_year') && (
                              <span>Year {selectedStudent.current_year || selectedStudent.student_data?.current_year || '-'}</span>
                            )}
                            {canViewField('current_year') && canViewField('current_semester') && <span> • </span>}
                            {canViewField('current_semester') && (
                              <span>Semester {selectedStudent.current_semester || selectedStudent.student_data?.current_semester || '-'}</span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                    {canViewField('college') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          College
                        </label>
                        {editMode ? (
                          <select
                            value={editData.college || editData.College || selectedStudent?.college || ''}
                            onChange={(e) => updateEditField('college', e.target.value)}
                            disabled={collegesLoading}
                            className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Select College</option>
                            {colleges.filter(c => c.isActive !== false).map((college) => (
                              <option key={college.id} value={college.name}>{college.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">
                            {editData.college || editData.College || selectedStudent?.college || '-'}
                          </p>
                        )}
                      </div>
                    )}
                    {canViewField('batch') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Batch
                        </label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editData.batch || editData.Batch || ''}
                            onChange={(e) => updateEditField('batch', e.target.value)}
                            placeholder="Enter batch"
                            className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                          />
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">
                            {editData.batch || editData.Batch || selectedStudent?.batch || '-'}
                          </p>
                        )}
                      </div>
                    )}
                    {canViewField('stud_type') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Student Type
                        </label>
                        {editMode ? (
                          <select
                            value={editData.stud_type || editData.StudType || ''}
                            onChange={(e) => updateEditField('stud_type', e.target.value)}
                            className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                          >
                            <option value="">Select Student Type</option>
                            <option value="MANG">MANG</option>
                            <option value="CONV">CONV</option>
                            <option value="SPOT">SPOT</option>
                          </select>
                        ) : (
                          <p className="text-sm font-semibold text-gray-700">
                            {editData.stud_type || editData.StudType || selectedStudent?.stud_type || '-'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side - All Student Data */}
              <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto min-w-0 flex flex-col">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg mb-6 shrink-0">
                  <button
                    onClick={() => setActiveStudentTab('details')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeStudentTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Book size={16} /> Details
                  </button>
                  {canViewAttendance && (
                    <button
                      onClick={() => setActiveStudentTab('attendance')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeStudentTab === 'attendance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Calendar size={16} /> Attendance
                    </button>
                  )}
                  <button
                    onClick={() => setActiveStudentTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeStudentTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <History size={16} /> History
                  </button>
                  {canViewSms && (
                    <button
                      onClick={() => setActiveStudentTab('sms_tracking')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeStudentTab === 'sms_tracking' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <MessageSquare size={16} /> SMS
                    </button>
                  )}
                </div>

                {activeStudentTab === 'attendance' && (
                  <StudentAttendanceTab student={selectedStudent} />
                )}

                {activeStudentTab === 'history' && (
                  <StudentHistoryTab student={selectedStudent} />
                )}

                {activeStudentTab === 'sms_tracking' && (
                  <StudentSmsTab student={selectedStudent} />
                )}

                <div className={`space-y-4 sm:space-y-6 ${activeStudentTab !== 'details' ? 'hidden' : ''}`}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

                    {/* Column 1 */}
                    <div className="space-y-4">
                      {/* Admission Number */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Users size={16} className="text-blue-600" />
                          Admission Details
                        </h4>
                        {canViewField('admission_number') && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Admission Number
                            </label>
                            <p className="text-base font-bold text-gray-900">{selectedStudent.admission_number}</p>
                          </div>
                        )}
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Completion Progress
                          </label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold ${profileCompletion.percentage >= 80 ? 'text-green-600' :
                                profileCompletion.percentage >= 50 ? 'text-blue-600' :
                                  'text-gray-600'
                                }`}>
                                {profileCompletion.percentage}%
                              </span>
                              <span className="text-xs text-gray-500">
                                ({profileCompletion.filledCount}/{profileCompletion.totalCount} fields)
                              </span>
                              {editMode && (
                                <button
                                  onClick={() => {
                                    // Recalculate on demand
                                    const parsedStudentData = typeof editData === 'string'
                                      ? JSON.parse(editData || '{}')
                                      : editData;
                                    const completion = calculateProfileCompletion(selectedStudent, parsedStudentData);
                                    setProfileCompletion(completion);
                                    toast.success('Completion progress refreshed');
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Refresh completion progress"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${profileCompletion.percentage >= 80 ? 'bg-green-500' :
                                  profileCompletion.percentage >= 50 ? 'bg-blue-500' :
                                    'bg-gray-400'
                                  }`}
                                style={{ width: `${profileCompletion.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Parent Information */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Users size={16} className="text-orange-600" />
                          Parent Information
                        </h4>
                        <div className="space-y-3">
                          {canViewField('parent_mobile1') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Parent Mobile 1
                              </label>
                              {editMode ? (
                                <input
                                  type="tel"
                                  value={editData.parent_mobile1 || editData['Parent Mobile Number 1'] || ''}
                                  onChange={(e) => updateEditField('parent_mobile1', e.target.value)}
                                  placeholder="Enter parent mobile 1"
                                  maxLength={10}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.parent_mobile1 || editData['Parent Mobile Number 1'] || selectedStudent?.parent_mobile1 || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('parent_mobile2') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Parent Mobile 2
                              </label>
                              {editMode ? (
                                <input
                                  type="tel"
                                  value={editData.parent_mobile2 || editData['Parent Mobile Number 2'] || ''}
                                  onChange={(e) => updateEditField('parent_mobile2', e.target.value)}
                                  placeholder="Enter parent mobile 2"
                                  maxLength={10}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.parent_mobile2 || editData['Parent Mobile Number 2'] || selectedStudent?.parent_mobile2 || '-'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Address Details */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Users size={16} className="text-green-600" />
                          Address Details
                        </h4>
                        <div className="space-y-3">
                          {canViewField('student_address') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Full Address
                              </label>
                              {editMode ? (
                                <textarea
                                  value={editData.student_address || editData['Student Address (D.No, Str name, Village, Mandal, Dist)'] || ''}
                                  onChange={(e) => updateEditField('student_address', e.target.value)}
                                  placeholder="Enter student address"
                                  rows="3"
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.student_address || editData['Student Address (D.No, Str name, Village, Mandal, Dist)'] || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            {canViewField('city_village') && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                  City/Village
                                </label>
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={editData.city_village || editData['City/Village'] || ''}
                                    onChange={(e) => updateEditField('city_village', e.target.value)}
                                    placeholder="Enter city/village"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                                  />
                                ) : (
                                  <p className="text-sm text-gray-900 font-medium">
                                    {editData.city_village || editData['City/Village'] || '-'}
                                  </p>
                                )}
                              </div>
                            )}
                            {canViewField('mandal_name') && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                  Mandal
                                </label>
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={editData.mandal_name || editData['Mandal Name'] || ''}
                                    onChange={(e) => updateEditField('mandal_name', e.target.value)}
                                    placeholder="Enter mandal name"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                                  />
                                ) : (
                                  <p className="text-sm text-gray-900 font-medium">
                                    {editData.mandal_name || editData['Mandal Name'] || '-'}
                                  </p>
                                )}
                              </div>
                            )}
                            {canViewField('district') && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                  District
                                </label>
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={editData.district || editData.District || ''}
                                    onChange={(e) => updateEditField('district', e.target.value)}
                                    placeholder="Enter district"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                                  />
                                ) : (
                                  <p className="text-sm text-gray-900 font-medium">
                                    {editData.district || editData.District || selectedStudent?.district || '-'}
                                  </p>
                                )}
                              </div>
                            )}
                            {canViewField('caste') && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                  Caste
                                </label>
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={editData.caste || editData.Caste || ''}
                                    onChange={(e) => updateEditField('caste', e.target.value)}
                                    placeholder="Enter caste"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                                  />
                                ) : (
                                  <p className="text-sm text-gray-900 font-medium">
                                    {editData.caste || editData.Caste || selectedStudent?.caste || '-'}
                                  </p>
                                )}
                              </div>
                            )}
                            {canViewField('gender') && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                  Gender
                                </label>
                                {editMode ? (
                                  <select
                                    value={editData.gender || editData['M/F'] || ''}
                                    onChange={(e) => updateEditField('gender', e.target.value)}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                                  >
                                    <option value="">Select Gender</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                    <option value="Other">Other</option>
                                  </select>
                                ) : (
                                  <p className="text-sm text-gray-900 font-medium">
                                    {editData.gender || editData['M/F'] || selectedStudent?.gender || '-'}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-4">
                      {/* Student Information */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Users size={16} className="text-blue-600" />
                          Student Information
                        </h4>
                        <div className="space-y-3">
                          {canViewField('student_mobile') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Mobile Number
                              </label>
                              {editMode ? (
                                <input
                                  type="tel"
                                  value={editData.student_mobile || editData['Student Mobile Number'] || ''}
                                  onChange={(e) => updateEditField('student_mobile', e.target.value)}
                                  placeholder="Enter mobile number"
                                  maxLength={10}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.student_mobile || editData['Student Mobile Number'] || selectedStudent?.student_mobile || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('father_name') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Father Name
                              </label>
                              {editMode ? (
                                <input
                                  type="text"
                                  value={editData.father_name || editData['Father Name'] || ''}
                                  onChange={(e) => updateEditField('father_name', e.target.value)}
                                  placeholder="Enter father name"
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.father_name || editData['Father Name'] || selectedStudent?.father_name || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('dob') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Date of Birth
                              </label>
                              {editMode ? (
                                <input
                                  type="date"
                                  value={editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)'] ?
                                    (editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)']).split('T')[0] : ''}
                                  onChange={(e) => updateEditField('dob', e.target.value)}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {formatDate(editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)'] || selectedStudent?.dob)}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('adhar_no') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Aadhar Number
                              </label>
                              {editMode ? (
                                <input
                                  type="text"
                                  value={editData.adhar_no || editData['ADHAR No'] || ''}
                                  onChange={(e) => updateEditField('adhar_no', e.target.value)}
                                  placeholder="Enter Aadhar number"
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.adhar_no || editData['ADHAR No'] || selectedStudent?.adhar_no || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('admission_date') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Admission Date
                              </label>
                              {editMode ? (
                                <input
                                  type="date"
                                  value={editData.admission_date || editData['Admission Date'] ?
                                    (editData.admission_date || editData['Admission Date']).split('T')[0] : ''}
                                  onChange={(e) => updateEditField('admission_date', e.target.value)}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {formatDate(editData.admission_date || editData['Admission Date'])}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Administrative Information */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <UserCog size={16} className="text-purple-600" />
                          Administrative Information
                        </h4>
                        <div className="space-y-3">

                          {canViewField('student_status') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Student Status
                              </label>
                              {editMode ? (
                                <select
                                  value={editData.student_status || editData['Student Status'] || selectedStudent?.student_status || ''}
                                  onChange={(e) => updateEditField('student_status', e.target.value)}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px] bg-white"
                                >
                                  {!editData.student_status && !editData['Student Status'] && !selectedStudent?.student_status && (
                                    <option value="">Select Status</option>
                                  )}
                                  {STUDENT_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.student_status || editData['Student Status'] || selectedStudent?.student_status || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('scholar_status') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Scholar Status
                              </label>
                              {editMode ? (
                                <select
                                  value={editData.scholar_status || editData['Scholar Status'] || selectedStudent?.scholar_status || ''}
                                  onChange={(e) => updateEditField('scholar_status', e.target.value)}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px] bg-white"
                                >
                                  {!editData.scholar_status && !editData['Scholar Status'] && !selectedStudent?.scholar_status && (
                                    <option value="">Select Scholar Status</option>
                                  )}
                                  {scholarStatusOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.scholar_status || editData['Scholar Status'] || selectedStudent?.scholar_status || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('fee_status') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Fee Status
                              </label>
                              {editMode ? (
                                <select
                                  value={editFeeStatus || editData.fee_status || editData['Fee Status'] || selectedStudent?.fee_status || ''}
                                  onChange={(e) => {
                                    const newStatus = e.target.value;
                                    setEditFeeStatus(newStatus);
                                    // Clear permit fields if not permitted
                                    if (newStatus !== 'permitted') {
                                      setPermitEndingDate('');
                                      setPermitRemarks('');
                                    }
                                  }}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px] bg-white"
                                >
                                  {!editFeeStatus && !editData.fee_status && !editData['Fee Status'] && !selectedStudent?.fee_status && (
                                    <option value="">Select Fee Status</option>
                                  )}
                                  {FEE_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editFeeStatus || editData.fee_status || editData['Fee Status'] || selectedStudent?.fee_status || '-'}
                                </p>
                              )}
                              {/* Permit Fields - Show when fee status is 'permitted' */}
                              {(editFeeStatus === 'permitted' || editData.fee_status === 'permitted' || selectedStudent?.fee_status === 'permitted') && editMode && (
                                <div className="mt-4 space-y-3 pt-3 border-t border-gray-200">
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                      Permit Ending Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="date"
                                      value={permitEndingDate}
                                      onChange={(e) => setPermitEndingDate(e.target.value)}
                                      className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                      Permit Remarks <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                      value={permitRemarks}
                                      onChange={(e) => setPermitRemarks(e.target.value)}
                                      rows="3"
                                      className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm"
                                      placeholder="Enter remarks for the permit"
                                      required
                                    />
                                  </div>
                                </div>
                              )}
                              {/* Show permit info in view mode */}
                              {(editData.fee_status === 'permitted' || selectedStudent?.fee_status === 'permitted') && !editMode && (
                                <div className="mt-4 space-y-2 pt-3 border-t border-gray-200">
                                  {permitEndingDate && (
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                        Permit Ending Date
                                      </label>
                                      <p className="text-sm text-gray-900 font-medium">
                                        {permitEndingDate || selectedStudent?.permit_ending_date || '-'}
                                      </p>
                                    </div>
                                  )}
                                  {permitRemarks && (
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                        Permit Remarks
                                      </label>
                                      <p className="text-sm text-gray-900 font-medium">
                                        {permitRemarks || selectedStudent?.permit_remarks || '-'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {canViewField('registration_status') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Registration Status
                              </label>
                              {editMode ? (
                                <select
                                  value={editRegistrationStatus || editData.registration_status || editData['Registration Status'] || selectedStudent?.registration_status || ''}
                                  onChange={(e) => setEditRegistrationStatus(e.target.value)}
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px] bg-white"
                                >
                                  {!editRegistrationStatus && !editData.registration_status && !editData['Registration Status'] && !selectedStudent?.registration_status && (
                                    <option value="">Select Registration Status</option>
                                  )}
                                  {REGISTRATION_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editRegistrationStatus || editData.registration_status || editData['Registration Status'] || selectedStudent?.registration_status || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('previous_college') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Previous College
                              </label>
                              {editMode ? (
                                <input
                                  type="text"
                                  value={editData.previous_college || ''}
                                  onChange={(e) => updateEditField('previous_college', e.target.value)}
                                  placeholder="Enter previous college"
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.previous_college || selectedStudent?.previous_college || '-'}
                                </p>
                              )}
                            </div>
                          )}
                          {canViewField('certificates_status') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Certificate Status
                              </label>
                              <p className="text-sm text-gray-900 font-medium">
                                {editData.certificates_status || selectedStudent?.certificates_status || 'Pending'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 italic">
                                (Auto-updated based on certificate information)
                              </p>
                            </div>
                          )}
                          {canViewField('remarks') && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Remarks
                              </label>
                              {editMode ? (
                                <textarea
                                  value={editData.remarks || editData.Remarks || ''}
                                  onChange={(e) => updateEditField('remarks', e.target.value)}
                                  placeholder="Enter remarks"
                                  rows="2"
                                  className="w-full px-3 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-base sm:text-sm touch-manipulation min-h-[44px]"
                                />
                              ) : (
                                <p className="text-sm text-gray-900 font-medium">
                                  {editData.remarks || editData.Remarks || selectedStudent?.remarks || '-'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Certificate Information Section */}
                  {canViewField('certificates_status') && (() => {
                    // Determine course type from student data
                    const courseName = (editData.course || selectedStudent?.course || '').toLowerCase();
                    let courseType = null;
                    if (courseName.includes('diploma')) {
                      courseType = 'Diploma';
                    } else if (
                      courseName.includes('pg') ||
                      courseName.includes('post graduate') ||
                      courseName.includes('m.tech') ||
                      courseName.includes('mtech') ||
                      courseName.includes('mba') ||
                      courseName.includes('mca') ||
                      courseName.includes('msc') ||
                      courseName.includes('m sc') ||
                      courseName.includes('aqua') ||
                      courseName.includes('m.pharma') ||
                      courseName.includes('m pharma') ||
                      (courseName.includes('pharma') && (courseName.includes('m') || courseName.startsWith('pharma')))
                    ) {
                      courseType = 'PG';
                    } else if (courseName) {
                      courseType = 'UG';
                    }

                    if (!courseType) return null;

                    const certificates = getCertificatesForCourse(courseType);
                    const overallStatus = editData.certificates_status || selectedStudent?.certificates_status || null;

                    return (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                          Certificate Information
                        </h4>
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                          <h5 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <FileText size={14} className="text-gray-600" />
                            {editMode ? 'Edit Certificate Status' : 'Certificate Status'}
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {certificates.map((cert) => {
                              const isPresent = isCertificatePresent(cert.key);
                              const displayStatus = getCertificateStatusDisplay(cert.key, overallStatus);
                              const isYes = displayStatus === 'Yes';

                              return (
                                <div
                                  key={cert.key}
                                  className={`flex items-center justify-between p-2.5 bg-white rounded border ${isYes ? 'border-green-200 bg-green-50' : 'border-gray-200'
                                    } transition-colors`}
                                >
                                  <span className="text-xs text-gray-700 flex-1 pr-2">{cert.label}</span>

                                  {editMode ? (
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isPresent}
                                        onChange={(e) => updateCertificateStatus(cert.key, e.target.checked)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                      <span className="ml-2 text-xs font-medium text-gray-700 min-w-[30px]">
                                        {isPresent ? 'Yes' : 'No'}
                                      </span>
                                    </label>
                                  ) : (
                                    <span className={`text-xs font-medium px-2 py-1 rounded ${isYes
                                      ? 'text-green-700 bg-green-100'
                                      : 'text-red-700 bg-red-100'
                                      }`}>
                                      {displayStatus}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="w-full sm:flex-1 bg-green-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation min-h-[44px]"
                    >
                      {savingEdit ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      disabled={savingEdit}
                      className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {canUpdatePin && (
                      <button
                        onClick={handleResetPassword}
                        disabled={resettingPassword}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 active:bg-indigo-200 transition-colors font-medium touch-manipulation min-h-[44px] mr-2 flex items-center justify-center gap-2"
                        title="Resend password via SMS"
                      >
                        <Key size={18} />
                        {resettingPassword ? 'Sending...' : 'Resend Password'}
                      </button>
                    )}
                    <button onClick={() => setShowModal(false)} className="w-full sm:w-auto sm:ml-auto px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium touch-manipulation min-h-[44px]">
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkRollNumberModal
        isOpen={showBulkRollNumber}
        onClose={() => setShowBulkRollNumber(false)}
        onUpdateComplete={() => refreshStudents()}
      />

      <BulkUploadModal
        isOpen={showBulkStudentUpload}
        onClose={() => setShowBulkStudentUpload(false)}
        forms={forms}
        isLoadingForms={loadingForms}
        onUploadComplete={() => {
          refreshStudents(1);
        }}
      />

      {/* Permit Modal */}
      {showPermitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Permit Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permit Ending Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={permitEndingDate}
                  onChange={(e) => setPermitEndingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={permitRemarks}
                  onChange={(e) => setPermitRemarks(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Enter remarks for the permit"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPermitModal(false);
                  setPendingFeeStatusChange(null);
                  setPendingPermitAdmissionNumber(null);
                  setPermitEndingDate('');
                  setPermitRemarks('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!permitEndingDate) {
                    toast.error('Please enter permit ending date');
                    return;
                  }
                  if (!permitRemarks || !permitRemarks.trim()) {
                    toast.error('Please enter permit remarks');
                    return;
                  }

                  // If this is from inline editing, save directly using the stored admission number
                  if (pendingFeeStatusChange === 'permitted' && pendingPermitAdmissionNumber) {
                    try {
                      await api.put(`/students/${pendingPermitAdmissionNumber}/fee-status`, {
                        fee_status: 'permitted',
                        permit_ending_date: permitEndingDate,
                        permit_remarks: permitRemarks
                      });
                      toast.success('Fee status updated successfully');
                      invalidateStudents();
                    } catch (error) {
                      toast.error(error.response?.data?.message || 'Failed to update fee status');
                    }
                    setEditingCell(null);
                    setCellEditValue('');
                  } else {
                    // Otherwise, this is from full student edit modal – just set status,
                    // handleSaveEdit will call the fee-status endpoint with permit data.
                    setEditFeeStatus('permitted');
                  }

                  setShowPermitModal(false);
                  setPendingFeeStatusChange(null);
                  setPendingPermitAdmissionNumber(null);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <ManualRollNumberModal
        isOpen={showManualRollNumber}
        onClose={() => setShowManualRollNumber(false)}
        onUpdateComplete={() => refreshStudents()}
      />

      {/* Rejoin Modal */}
      <RejoinModal
        isOpen={showRejoinModal}
        onClose={() => {
          setShowRejoinModal(false);
          setRejoinStudent(null);
          // Reset the student status in editData back to original
          if (selectedStudent) {
            setEditData(prev => ({
              ...prev,
              student_status: selectedStudent.student_status
            }));
          }
        }}
        student={rejoinStudent}
        onRejoinComplete={(updatedStudent) => {
          // Refresh the student list
          invalidateStudents();
          // Close the modal
          setShowRejoinModal(false);
          setRejoinStudent(null);
          // Close the student details modal if it's open
          setShowModal(false);
          setEditMode(false);
          setSelectedStudent(null);
        }}
      />

      {/* Bulk Password Results Modal */}
      {bulkPasswordState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Key size={24} className="text-teal-600" />
              Bulk Password Operations
            </h3>

            {bulkPasswordState.processing ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Processing password resets and sending SMS...</p>
                <p className="text-xs text-gray-400 mt-2">Please do not close this window.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{bulkPasswordState.summary?.total}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{bulkPasswordState.summary?.success}</div>
                    <div className="text-xs text-green-600">Success</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{bulkPasswordState.summary?.failed}</div>
                    <div className="text-xs text-red-600">Failed</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  <button
                    onClick={downloadBulkPasswordReport}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                  >
                    <FileSpreadsheet size={18} />
                    Download Detailed Report
                  </button>
                  <button
                    onClick={() => setBulkPasswordState(prev => ({ ...prev, isOpen: false }))}
                    className="w-full py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;