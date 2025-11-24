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
  ChevronUp
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api, { getStaticFileUrlDirect } from '../config/api';
import toast from 'react-hot-toast';
import BulkRollNumberModal from '../components/BulkRollNumberModal';
import BulkUploadModal from '../components/BulkUploadModal';
import ManualRollNumberModal from '../components/ManualRollNumberModal';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';
import { useStudents, useUpdateStudent, useDeleteStudent, useBulkDeleteStudents, useInvalidateStudents } from '../hooks/useStudents';

const Students = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [colleges, setColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(false);
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
    scholar_status: [],
    caste: [],
    gender: [],
    certificates_status: [],
    remarks: []
  });
  const [showBulkRollNumber, setShowBulkRollNumber] = useState(false);
  const [showManualRollNumber, setShowManualRollNumber] = useState(false);
  const [showBulkStudentUpload, setShowBulkStudentUpload] = useState(false);
  const [editingRollNumber, setEditingRollNumber] = useState(false);
  const [tempRollNumber, setTempRollNumber] = useState('');
  const [completionPercentages, setCompletionPercentages] = useState({});
  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
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
    search: searchTerm,
    enabled: true
  });

  const students = studentsData?.students || [];
  const totalStudents = studentsData?.pagination?.total || 0;
  const totalPages = studentsData?.pagination?.totalPages || 
    (totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / (pageSize || 1))) : 1);
  const loading = isLoading;
  const initialLoad = isLoading && students.length === 0;

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

  // Calculate stats when students are loaded - use stable comparison to prevent infinite loops
  const studentsLengthRef = useRef(0);
  const studentsIdsRef = useRef('');
  
  useEffect(() => {
    const currentIds = students.map(s => s.admission_number).sort().join(',');
    const currentLength = students.length;
    
    // Only recalculate if students actually changed (different IDs or length)
    if (currentLength !== studentsLengthRef.current || currentIds !== studentsIdsRef.current) {
      studentsLengthRef.current = currentLength;
      studentsIdsRef.current = currentIds;
      
      // Call calculateOverallStats directly without including it in dependencies
      (async () => {
        if (students.length === 0) {
          setStats({ total: 0, completed: 0, averageCompletion: 0 });
          return;
        }

        const totalStudents = students.length;
        let completedStudents = 0;
        let totalCompletion = 0;

        // Fetch completion percentages for all students in parallel
        const promises = students
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
   }, [students]);

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

  // Fetch filter fields when component mounts to ensure proper filter management
  useEffect(() => {
    fetchColleges();
    fetchQuickFilterOptions(filters);
    fetchDropdownFilterOptions(filters);
  }, []);

  // Refetch filter options when filters change (for cascading filters)
  // Use individual filter values to prevent unnecessary refetches
  const prevFiltersRef = useRef({ college: '', course: '', branch: '', batch: '', year: '', semester: '' });
  
  useEffect(() => {
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
      fetchQuickFilterOptions(filters);
      fetchDropdownFilterOptions(filters);
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

  const fetchQuickFilterOptions = async (currentFilters = {}) => {
    try {
      // Build query params from current filters
      // IMPORTANT: Add college first to ensure proper filtering hierarchy
      const params = new URLSearchParams();
      if (currentFilters.college) params.append('college', currentFilters.college);
      if (currentFilters.course) params.append('course', currentFilters.course);
      if (currentFilters.branch) params.append('branch', currentFilters.branch);
      if (currentFilters.batch) params.append('batch', currentFilters.batch);
      if (currentFilters.year) params.append('year', currentFilters.year);
      if (currentFilters.semester) params.append('semester', currentFilters.semester);
      
      const queryString = params.toString();
      const url = `/attendance/filters${queryString ? `?${queryString}` : ''}`;
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
    } catch (error) {
      console.warn('Failed to fetch quick filter options:', error);
      toast.error('Failed to load filter options');
    }
  };

  const fetchDropdownFilterOptions = async (currentFilters = {}) => {
    try {
      // Build query params from current filters
      const params = new URLSearchParams();
      if (currentFilters.course) params.append('course', currentFilters.course);
      if (currentFilters.branch) params.append('branch', currentFilters.branch);
      if (currentFilters.batch) params.append('batch', currentFilters.batch);
      if (currentFilters.year) params.append('year', currentFilters.year);
      if (currentFilters.semester) params.append('semester', currentFilters.semester);
      
      const queryString = params.toString();
      const url = `/students/filter-options${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      if (response.data?.success) {
        const data = response.data.data || {};
        setDropdownFilterOptions({
          stud_type: data.stud_type || [],
          student_status: data.student_status || [],
          scholar_status: data.scholar_status || [],
          caste: data.caste || [],
          gender: data.gender || [],
          certificates_status: data.certificates_status || [],
          remarks: data.remarks || []
        });
      }
    } catch (error) {
      console.warn('Failed to fetch dropdown filter options:', error);
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

    if (isLoading || isFetching) {
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
  const handleViewDetails = (student) => {
    setEditMode(false);
    setEditingRollNumber(false);
    setTempRollNumber(student.pin_no || '');

    // Prepare all possible fields including hidden ones
    const allFields = {
      // From student_data (form submission) - use original field names
      ...student.student_data,
      // Map individual database columns to expected field names
      'pin_no': student.pin_no || '',
      'previous_college': student.previous_college || '',
      'certificates_status': student.certificates_status || '',
      'student_photo': student.student_photo || ''
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

    setSelectedStudent(stageSyncedStudent);
    setEditData(stageSyncedFields);
    setShowModal(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    try {
      console.log('Saving edit data:', editData);
      console.log('Selected student:', selectedStudent);

      const synchronizedData = syncStageFields(
        editData,
        editData.current_year || editData['Current Academic Year'],
        editData.current_semester || editData['Current Semester']
      );

      await updateStudentMutation.mutateAsync({
        admissionNumber: selectedStudent.admission_number,
        data: { studentData: synchronizedData }
      });

      console.log('Save successful');
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

      // Update completion percentage for the updated student
      const updatedPercentage = await getStudentCompletionPercentage(selectedStudent.admission_number);
      setCompletionPercentages(prev => ({
        ...prev,
        [selectedStudent.admission_number]: updatedPercentage
      }));

    } catch (error) {
      console.error('Save failed:', error);
      // Error toast is handled by the mutation
    }
  };

  const handleSaveRollNumber = async () => {
    try {
      await api.put(`/students/${selectedStudent.admission_number}/pin-number`, {
        pinNumber: tempRollNumber,
      });
      toast.success('PIN number updated successfully');
      setEditingRollNumber(false);
      setSelectedStudent({ ...selectedStudent, pin_no: tempRollNumber });

      // Update local state instead of refetching all data
      setStudents(prevStudents =>
        prevStudents.map(student =>
          student.admission_number === selectedStudent.admission_number
            ? { ...student, pin_no: tempRollNumber }
            : student
        )
      );

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update PIN number');
    }
  };

  const handleDelete = async (admissionNumber) => {
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

  // Calculate overall statistics
  const [stats, setStats] = useState({ total: 0, completed: 0, averageCompletion: 0 });

  const calculateOverallStats = useCallback(async () => {
    if (students.length === 0) {
      setStats({ total: 0, completed: 0, averageCompletion: 0 });
      return;
    }

    const totalStudents = students.length;
    let completedStudents = 0;
    let totalCompletion = 0;

    // Fetch completion percentages for all students in parallel
    const promises = students
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

  // Only show full-page loader on initial load
  if (loading && initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading students..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 heading-font">Students Database</h1>
          <p className="text-gray-600 mt-2 body-font">Manage and view all student records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLocalSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Search by admission number or student data..."
            />
          </div>
          <button onClick={handleLocalSearch} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Search
          </button>
          
          <Link
            to="/students/add"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            <Plus size={18} />
            Add Student
          </Link>

          <button
            onClick={async () => {
              await fetchForms();
              setShowBulkStudentUpload(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-500 to-blue-600 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300"
            disabled={loadingForms}
          >
            <Upload size={18} />
            {loadingForms ? 'Loading Forms...' : 'Bulk Upload Students'}
          </button>

          <button
            onClick={() => setShowManualRollNumber(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            <UserCog size={18} />
            Update PIN Numbers
          </button>

          <button
            onClick={handleBulkDelete}
            disabled={selectedCount === 0 || bulkDeleteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-red-600 to-red-700 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={18} />
            {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete Selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-500 to-blue-600 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Total Students</p>
                <p className="text-xl font-bold text-blue-600">{totalStudents.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Across current filters</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
                  {(dropdownFilterOptions.scholar_status || []).map((status) => (
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
                <label className="text-xs font-medium text-gray-600 mb-1">Certificate Status</label>
                <select
                  value={filters.certificates_status || ''}
                  onChange={(e) => handleFilterChange('certificates_status', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">All</option>
                  {(dropdownFilterOptions.certificates_status || []).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
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

      {students.length === 0 ? (
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
          {(isFetching && !isLoading) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-xl">
              <LoadingAnimation
                width={24}
                height={24}
                message="Loading..."
              />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
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
                  <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-left min-w-[80px] sticky left-12 bg-gray-50 z-20 border-r border-gray-200">
                    <div className="font-semibold">Photo</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Student Name</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">PIN Number</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Admission Number</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Batch</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">College</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Course</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Branch</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Student Type</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                    <div className="font-semibold whitespace-nowrap">Status</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                    <div className="font-semibold whitespace-nowrap">Scholar Status</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Caste</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Gender</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                    <div className="font-semibold whitespace-nowrap">Certificate Status</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Year</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left">
                    <div className="font-semibold whitespace-nowrap">Sem</div>
                  </th>
                  <th className="py-2 px-1.5 text-xs font-semibold text-gray-700 text-left max-w-[120px]">
                    <div className="font-semibold whitespace-nowrap">Remarks</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  return (
                    <tr 
                      key={student.admission_number} 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        // Don't trigger if clicking on checkbox
                        if (e.target.type === 'checkbox' || e.target.closest('input[type="checkbox"]')) {
                          return;
                        }
                        handleViewDetails(student);
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
                      <td className="py-2 px-1.5 text-xs text-gray-900">{student.student_name || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-600">
                        {student.pin_no ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                            {student.pin_no}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-xs font-medium text-gray-900">{student.admission_number || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.batch || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.college || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.course || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.branch || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.stud_type || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" title={student.student_status || ''}>
                        <span className="block truncate">{student.student_status || '-'}</span>
                      </td>
                      <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" title={student.scholar_status || ''}>
                        <span className="block truncate">{student.scholar_status || '-'}</span>
                      </td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.caste || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.gender || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" title={student.certificates_status || ''}>
                        <span className="block truncate">{student.certificates_status || '-'}</span>
                      </td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.current_year || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700">{student.current_semester || '-'}</td>
                      <td className="py-2 px-1.5 text-xs text-gray-700 max-w-[120px] truncate" title={student.remarks || ''}>
                        <span className="block truncate">{student.remarks || '-'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-4 py-4 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              {totalStudents === 0
                ? 'No students to display'
                : `Showing ${showingFrom.toLocaleString()}-${showingTo.toLocaleString()} of ${totalStudents.toLocaleString()}`}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Rows per page
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  disabled={isLoading || isFetching}
                >
                  {pageSizeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={isFirstPage || isLoading || isFetching || totalStudents === 0}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {Math.min(currentPage, totalPages).toLocaleString()} of {totalPages.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={isLastPage || isLoading || isFetching || totalStudents === 0}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Student Details</h3>
                <p className="text-sm text-gray-500 mt-1">View and manage student information</p>
              </div>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <button onClick={handleEdit} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <Edit size={18} />
                    Edit
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Basic Info Section */}
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-6 mb-6 border border-primary-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Admission Number
                    </label>
                    <p className="text-xl font-bold text-gray-900">{selectedStudent.admission_number}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      PIN Number
                    </label>
                    {editingRollNumber ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempRollNumber}
                          onChange={(e) => setTempRollNumber(e.target.value)}
                          placeholder="Enter PIN number"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        />
                        <button
                          onClick={handleSaveRollNumber}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingRollNumber(false);
                            setTempRollNumber(selectedStudent.pin_no || '');
                          }}
                          className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {selectedStudent.pin_no ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-green-100 text-green-800 text-lg font-semibold">
                            {selectedStudent.pin_no}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm italic">Not assigned</span>
                        )}
                        {!editMode && (
                          <button
                            onClick={() => setEditingRollNumber(true)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit PIN Number"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                    Academic Stage
                  </label>
                  <p className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                    <span>Year {selectedStudent.current_year || selectedStudent.student_data?.current_year || '-'}</span>
                    <span className="w-1 h-1 rounded-full bg-indigo-300" />
                    <span>Semester {selectedStudent.current_semester || selectedStudent.student_data?.current_semester || '-'}</span>
                  </p>
                </div>
                </div>
              </div>

              {/* Student Information Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Student Information</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{Object.keys(editData).length} fields</span>
                    {(() => {
                      const completionPercentage = completionPercentages[selectedStudent.admission_number] || 0;
                      return (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          completionPercentage >= 80 ? 'bg-blue-100 text-blue-800' :
                          completionPercentage >= 50 ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {completionPercentage}% Complete
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Individual Fields Display - All 25 Fields - Now All Editable */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Student Form Fields (20 visible fields) - Now All Editable */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                      Student Name
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.student_name || editData['Student Name'] || ''}
                        onChange={(e) => updateEditField('student_name', e.target.value)}
                        placeholder="Enter student name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.student_name || editData['Student Name'] || editData.student_name || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                      Mobile Number
                    </label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editData.student_mobile || editData['Student Mobile Number'] || ''}
                        onChange={(e) => updateEditField('student_mobile', e.target.value)}
                        placeholder="Enter mobile number"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.student_mobile || editData['Student Mobile Number'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                      Father Name
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.father_name || editData['Father Name'] || ''}
                        onChange={(e) => updateEditField('father_name', e.target.value)}
                        placeholder="Enter father name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.father_name || editData['Father Name'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <label className="block text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                      Date of Birth
                    </label>
                    {editMode ? (
                      <input
                        type="date"
                        value={editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)'] ?
                          (editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)']).split('T')[0] : ''}
                        onChange={(e) => updateEditField('dob', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {formatDate(editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)'])}
                      </p>
                    )}
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <label className="block text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                      Aadhar Number
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.adhar_no || editData['ADHAR No'] || ''}
                        onChange={(e) => updateEditField('adhar_no', e.target.value)}
                        placeholder="Enter Aadhar number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.adhar_no || editData['ADHAR No'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <label className="block text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                      Admission Date
                    </label>
                    {editMode ? (
                      <input
                        type="date"
                        value={editData.admission_date || editData['Admission Date'] ?
                          (editData.admission_date || editData['Admission Date']).split('T')[0] : ''}
                        onChange={(e) => updateEditField('admission_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {formatDate(editData.admission_date || editData['Admission Date'])}
                      </p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                      Batch
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.batch || editData.Batch || ''}
                        onChange={(e) => updateEditField('batch', e.target.value)}
                        placeholder="Enter batch"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.batch || editData.Batch || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                      College
                    </label>
                    {editMode ? (
                      <select
                        value={editData.college || editData.College || selectedStudent?.college || ''}
                        onChange={(e) => updateEditField('college', e.target.value)}
                        disabled={collegesLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select College</option>
                        {colleges.filter(c => c.isActive !== false).map((college) => (
                          <option key={college.id} value={college.name}>{college.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.college || editData.College || selectedStudent?.college || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                      Branch
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.branch || editData.Branch || ''}
                        onChange={(e) => updateEditField('branch', e.target.value)}
                        placeholder="Enter branch"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.branch || editData.Branch || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                      Student Type
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.stud_type || editData.StudType || ''}
                        onChange={(e) => updateEditField('stud_type', e.target.value)}
                        placeholder="Enter student type"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.stud_type || editData.StudType || '-'}
                      </p>
                    )}
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                      Current Academic Year
                    </label>
                    {editMode ? (
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      >
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        Year {editData.current_year || editData['Current Academic Year'] || selectedStudent.current_year || '-'}
                      </p>
                    )}
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <label className="block text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                      Current Semester
                    </label>
                    {editMode ? (
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      >
                        <option value="1">Semester 1</option>
                        <option value="2">Semester 2</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        Semester {editData.current_semester || editData['Current Semester'] || selectedStudent.current_semester || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <label className="block text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                      Parent Mobile 1
                    </label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editData.parent_mobile1 || editData['Parent Mobile Number 1'] || ''}
                        onChange={(e) => updateEditField('parent_mobile1', e.target.value)}
                        placeholder="Enter parent mobile 1"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.parent_mobile1 || editData['Parent Mobile Number 1'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <label className="block text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                      Parent Mobile 2
                    </label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editData.parent_mobile2 || editData['Parent Mobile Number 2'] || ''}
                        onChange={(e) => updateEditField('parent_mobile2', e.target.value)}
                        placeholder="Enter parent mobile 2"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.parent_mobile2 || editData['Parent Mobile Number 2'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <label className="block text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                      Student Address
                    </label>
                    {editMode ? (
                      <textarea
                        value={editData.student_address || editData['Student Address (D.No, Str name, Village, Mandal, Dist)'] || ''}
                        onChange={(e) => updateEditField('student_address', e.target.value)}
                        placeholder="Enter student address"
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.student_address || editData['Student Address (D.No, Str name, Village, Mandal, Dist)'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      City/Village
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.city_village || editData['City/Village'] || ''}
                        onChange={(e) => updateEditField('city_village', e.target.value)}
                        placeholder="Enter city/village"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.city_village || editData['City/Village'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Mandal Name
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.mandal_name || editData['Mandal Name'] || ''}
                        onChange={(e) => updateEditField('mandal_name', e.target.value)}
                        placeholder="Enter mandal name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.mandal_name || editData['Mandal Name'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      District
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.district || editData.District || ''}
                        onChange={(e) => updateEditField('district', e.target.value)}
                        placeholder="Enter district"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.district || editData.District || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Caste
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.caste || editData.Caste || ''}
                        onChange={(e) => updateEditField('caste', e.target.value)}
                        placeholder="Enter caste"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.caste || editData.Caste || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Gender
                    </label>
                    {editMode ? (
                      <select
                        value={editData.gender || editData['M/F'] || ''}
                        onChange={(e) => updateEditField('gender', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      >
                        <option value="">Select Gender</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.gender || editData['M/F'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Student Status
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.student_status || editData['Student Status'] || ''}
                        onChange={(e) => updateEditField('student_status', e.target.value)}
                        placeholder="Enter student status"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.student_status || editData['Student Status'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Scholar Status
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.scholar_status || editData['Scholar Status'] || ''}
                        onChange={(e) => updateEditField('scholar_status', e.target.value)}
                        placeholder="Enter scholar status"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.scholar_status || editData['Scholar Status'] || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Remarks
                    </label>
                    {editMode ? (
                      <textarea
                        value={editData.remarks || editData.Remarks || ''}
                        onChange={(e) => updateEditField('remarks', e.target.value)}
                        placeholder="Enter remarks"
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.remarks || editData.Remarks || '-'}
                      </p>
                    )}
                  </div>

                  {/* Hidden Admin Fields (5 fields) - Now with photo display */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      📝 Pin No (Admin)
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.pin_no || ''}
                        onChange={(e) => updateEditField('pin_no', e.target.value)}
                        placeholder="Enter PIN number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.pin_no || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      📝 Previous College (Admin)
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.previous_college || ''}
                        onChange={(e) => updateEditField('previous_college', e.target.value)}
                        placeholder="Enter previous college"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.previous_college || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      📝 Certificate Status (Admin)
                    </label>
                    {editMode ? (
                      <select
                        value={editData.certificates_status || ''}
                        onChange={(e) => updateEditField('certificates_status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
                      >
                        <option value="">Select Status</option>
                        <option value="Verified">Verified</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 font-medium">
                        {editData.certificates_status || '-'}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      📝 Student Photo (Admin)
                    </label>
                    {editMode ? (
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              try {
                                // Upload file to server first
                                const formData = new FormData();
                                formData.append('photo', file);
                                formData.append('admissionNumber', selectedStudent.admission_number);

                                const uploadResponse = await api.post('/students/upload-photo', formData, {
                                  headers: {
                                    'Content-Type': 'multipart/form-data',
                                  },
                                });

                                if (uploadResponse.data.success) {
                                  // Update the field with the uploaded filename
                                  updateEditField('student_photo', uploadResponse.data.data.filename);
                                  toast.success('Photo uploaded successfully');
                                } else {
                                  toast.error('Failed to upload photo');
                                }
                              } catch (error) {
                                console.error('Photo upload error:', error);
                                toast.error('Failed to upload photo');
                              }
                            } else {
                              updateEditField('student_photo', '');
                              updateEditField('student_photo_preview', null);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
                        />
                        {editData.student_photo && editData.student_photo !== '{}' && editData.student_photo !== null && editData.student_photo !== '' && (
                          <p className="text-xs text-gray-600">Current: {String(editData.student_photo)}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {editData.student_photo && editData.student_photo !== '{}' && editData.student_photo !== null && editData.student_photo !== '' ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={getStaticFileUrlDirect(editData.student_photo)}
                              alt="Student Photo"
                              className="w-12 h-12 rounded-lg object-cover border-2 border-gray-200"
                              onError={(e) => {
                                console.error('Photo failed to load:', editData.student_photo);
                                if (e.target && e.target.style) {
                                  e.target.style.display = 'none';
                                }
                                // Find the fallback div and show it
                                const fallbackDiv = e.target && e.target.parentNode ? e.target.parentNode.querySelector('.photo-fallback') : null;
                                if (fallbackDiv) {
                                  fallbackDiv.style.display = 'block';
                                }
                              }}
                            />
                            <div style={{ display: 'none' }}>
                              <span className="text-sm text-gray-900 font-medium">
                                {String(editData.student_photo)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No Photo</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw Data Section (Collapsible) */}
                <div className="border-t pt-4">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2">
                      <span>View Raw Data (Advanced)</span>
                      <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </summary>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(editData).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                            {key}
                          </label>
                          {editMode ? (
                            key === 'student_photo' ? (
                              <div className="space-y-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      updateEditField('student_photo', file.name);
                                      updateEditField('student_photo_preview', file);
                                    } else {
                                      updateEditField('student_photo', '');
                                      updateEditField('student_photo_preview', null);
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                />
                                {value && value !== '{}' && (
                                  <p className="text-xs text-gray-600">Current: {value}</p>
                                )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={Array.isArray(value) ? value.join(', ') : value}
                                onChange={(e) => updateEditField(key, Array.isArray(value) ? e.target.value.split(',').map(v => v.trim()) : e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                              />
                            )
                          ) : (
                            <p className="text-xs text-gray-900 break-words font-mono">
                              {key === 'student_photo' ?
                                (value && value !== '{}' && value !== null && value !== '' ? String(value) : 'No Photo') :
                                (key === 'student_photo_preview' ?
                                  (value ? 'File selected for upload' : 'No file') :
                                  (Array.isArray(value) ? value.join(', ') : (value !== null && value !== undefined && value !== '{}' ? String(value) : '-'))
                                )
                              }
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              {/* Metadata Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Created At:</span>{' '}
                    <span>{formatDate(selectedStudent.created_at)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span>{' '}
                    <span>{formatDate(selectedStudent.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                {editMode ? (
                  <>
                    <button onClick={handleSaveEdit} className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium">
                      Save Changes
                    </button>
                    <button onClick={() => setEditMode(false)} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowModal(false)} className="ml-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Close
                  </button>
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

      <ManualRollNumberModal
        isOpen={showManualRollNumber}
        onClose={() => setShowManualRollNumber(false)}
        onUpdateComplete={() => refreshStudents()}
      />
    </div>
  );
};

export default Students;