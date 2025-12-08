import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Settings,
  Plus,
  Edit2,
  X,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowUpDown,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStaticFileUrlDirect } from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
import { SkeletonBox, SkeletonTable } from '../components/SkeletonLoader';
import useAuthStore from '../store/authStore';
import { isFullAccessRole } from '../constants/rbac';

const FeeManagement = () => {
  const [filters, setFilters] = useState({
    batch: '',
    course: '',
    branch: '',
    college: '',
    feeHeaderId: '', // New: selected fee header filter
    studentName: '',
    pinNumber: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    batches: [],
    courses: [],
    branches: [],
    colleges: []
  });
  const [coursesWithBranches, setCoursesWithBranches] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeHeaders, setFeeHeaders] = useState([]);
  const [yearSemColumns, setYearSemColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { studentId, yearSemKey, feeHeaderId }
  const [cellValue, setCellValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [feeChanges, setFeeChanges] = useState(new Map()); // Track all fee changes: Map<`${studentId}_${yearSemKey}`, { amount, year, semester }>
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalStudents, setTotalStudents] = useState(0);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editingFees, setEditingFees] = useState({});
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [studentFeeModalOpen, setStudentFeeModalOpen] = useState(false);
  const [selectedStudentForFee, setSelectedStudentForFee] = useState(null);
  const [studentFeeDetails, setStudentFeeDetails] = useState(null);
  const [paymentAmounts, setPaymentAmounts] = useState(new Map()); // Track payment amounts: Map<`${studentId}_${feeHeaderId}_${year}_${semester}`, amount>
  const [isMounted, setIsMounted] = useState(false);
  const [feeHeadersForConfig, setFeeHeadersForConfig] = useState([]);
  const [editingHeaderId, setEditingHeaderId] = useState(null);
  const [newHeader, setNewHeader] = useState({ header_name: '', description: '', is_active: true });
  const searchEffectInitialized = useRef(false);
  
  // Cache for students data
  const studentsCache = useRef(new Map());
  const cacheKey = useRef('');

  const user = useAuthStore((state) => state.user);
  const isAdmin = isFullAccessRole(user?.role);

  // Filter branches based on selected course
  const availableBranches = useMemo(() => {
    if (!filters.course) {
      return filterOptions.branches;
    }
    const selectedCourse = coursesWithBranches.find(c => c.name === filters.course);
    if (!selectedCourse || !selectedCourse.branches) {
      return [];
    }
    const branchNames = [...new Set(selectedCourse.branches.map(b => b.name))];
    return branchNames.filter(name => filterOptions.branches.includes(name));
  }, [filters.course, coursesWithBranches, filterOptions.branches]);

  // Pagination calculations
  const safePageSize = pageSize || 1;
  const totalPages = totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / safePageSize)) : 1;
  const showingFrom = totalStudents === 0 ? 0 : Math.min((currentPage - 1) * safePageSize + 1, totalStudents);
  const showingTo = totalStudents === 0 ? 0 : Math.min(totalStudents, showingFrom + Math.max(students.length - 1, 0));
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const loadFilterOptions = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.college) params.append('college', filters.college);

      const [filtersResponse, coursesResponse] = await Promise.all([
        api.get(`/fees/filters?${params.toString()}`),
        api.get('/courses', { params: { includeInactive: false } })
      ]);

      if (filtersResponse.data?.success) {
        const data = filtersResponse.data.data || {};
        setFilterOptions({
          batches: data.batches || [],
          courses: data.courses || [],
          branches: data.branches || [],
          colleges: data.colleges || []
        });
      }

      if (coursesResponse.data?.success) {
        setCoursesWithBranches(coursesResponse.data.data || []);
      }
    } catch (error) {
      console.warn('Unable to load fee filter options', error);
    }
  };

  const loadFeeHeaders = async () => {
    try {
      const response = await api.get('/fees/headers');
      if (response.data?.success) {
        const headers = response.data.data || [];
        setFeeHeaders(headers);
        setFeeHeadersForConfig(headers);
        
        // Set "Tuition Fee" as default if not already selected
        if (!filters.feeHeaderId && headers.length > 0) {
          const tuitionFee = headers.find(h => 
            (h.header_name || h.headerName || '').toLowerCase().includes('tuition')
          );
          if (tuitionFee) {
            setFilters(prev => ({ ...prev, feeHeaderId: String(tuitionFee.id) }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load fee headers:', error);
      toast.error('Failed to load fee headers');
    }
  };

  const loadStudents = async (pageOverride = null, useCache = true) => {
    setLoading(true);
    try {
      const pageToUse = pageOverride !== null ? pageOverride : currentPage;
      const params = new URLSearchParams();

      if (filters.batch) params.append('batch', filters.batch);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.college) params.append('college', filters.college);
      // Fee header is required - always include it if selected
      if (filters.feeHeaderId) {
        params.append('feeHeaderId', filters.feeHeaderId);
      }
      // Combined search - if pinNumber has value, use it for both PIN and student name search
      if (filters.pinNumber) {
        params.append('pinNumber', filters.pinNumber.trim());
        params.append('studentName', filters.pinNumber.trim());
      } else if (filters.studentName) {
        params.append('studentName', filters.studentName.trim());
      }

      // Build cache key
      const cacheKeyStr = params.toString() + `_page_${pageToUse}_size_${pageSize}`;
      
      // Check cache first
      if (useCache && studentsCache.current.has(cacheKeyStr)) {
        const cached = studentsCache.current.get(cacheKeyStr);
        setStudents(cached.students);
        setTotalStudents(cached.totalStudents);
        setLoading(false);
        return;
      }

      // Always use pagination when fee header is selected
      // Otherwise, use pagination only when no basic filters are applied
      const hasBasicFilters = !!(filters.batch || filters.course || filters.branch || filters.college);
      
      if (filters.feeHeaderId) {
        // Always paginate when fee header is selected
        params.append('limit', pageSize.toString());
        params.append('offset', ((pageToUse - 1) * pageSize).toString());
      } else if (hasBasicFilters) {
        // Load all when basic filters are applied (but no fee header)
        params.append('limit', '10000');
        params.append('offset', '0');
      } else {
        // Use pagination when no filters
        params.append('limit', pageSize.toString());
        params.append('offset', ((pageToUse - 1) * pageSize).toString());
      }

      const response = await api.get(`/fees/students?${params.toString()}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch students');
      }

      const data = response.data.data || {};
      setStudents(data.students || []);
      setTotalStudents(data.totalStudents || 0);

      // Cache the result
      studentsCache.current.set(cacheKeyStr, {
        students: data.students || [],
        totalStudents: data.totalStudents || 0,
        timestamp: Date.now()
      });

      // Limit cache size to 50 entries
      if (studentsCache.current.size > 50) {
        const firstKey = studentsCache.current.keys().next().value;
        studentsCache.current.delete(firstKey);
      }

      // Always update fee headers from response to ensure dropdown has options
      if (data.feeHeaders && Array.isArray(data.feeHeaders)) {
        // Backend returns headerName in response
        const formattedHeaders = data.feeHeaders.map(h => ({
          id: h.id,
          header_name: h.headerName || h.header_name,
          headerName: h.headerName || h.header_name,
          description: h.description || '',
          is_active: h.is_active !== false && h.is_active !== 0 && h.is_active !== '0'
        }));
        setFeeHeaders(formattedHeaders);
      }

      // Update year-semester columns
      if (data.yearSemColumns && data.yearSemColumns.length > 0) {
        setYearSemColumns(data.yearSemColumns);
      }
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug: Track modal state changes
  useEffect(() => {
    if (studentFeeModalOpen) {
      console.log('Modal state changed - studentFeeModalOpen:', studentFeeModalOpen);
      console.log('selectedStudentForFee:', selectedStudentForFee);
      console.log('isMounted:', isMounted);
      console.log('document.body exists:', typeof document !== 'undefined' && !!document.body);
    }
  }, [studentFeeModalOpen, selectedStudentForFee, isMounted]);

  // Load fee headers on mount and set default
  useEffect(() => {
    const initializeFeeHeaders = async () => {
      await loadFeeHeaders();
    };
    initializeFeeHeaders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load filter options when filters change
  useEffect(() => {
    loadFilterOptions();
  }, [filters.batch, filters.course, filters.branch, filters.college]);

  useEffect(() => {
    setCurrentPage(1);
    // Clear cache when filters change
    studentsCache.current.clear();
    loadStudents(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.batch,
    filters.course,
    filters.branch,
    filters.college,
    filters.feeHeaderId,
    pageSize
  ]);

  useEffect(() => {
    if (!searchEffectInitialized.current) {
      searchEffectInitialized.current = true;
      return;
    }

    setCurrentPage(1);
    const handle = setTimeout(() => {
      loadStudents(1);
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.studentName, filters.pinNumber]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [field]: value
      };
      if (field === 'course') {
        newFilters.branch = '';
      }
      return newFilters;
    });
  };

  const handleClearFilters = () => {
    setFilters({
      batch: '',
      course: '',
      branch: '',
      college: '',
      feeHeaderId: '',
      studentName: '',
      pinNumber: ''
    });
    studentsCache.current.clear();
    setCurrentPage(1);
    setFeeChanges(new Map()); // Clear pending changes when filters change
  };

  const handlePageChange = (newPage) => {
    if (loading || newPage === currentPage || newPage < 1 || newPage > totalPages) {
      return;
    }
    setCurrentPage(newPage);
    loadStudents(newPage, true); // Use cache for pagination
  };

  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value, 10);
    if (Number.isNaN(newSize) || newSize <= 0 || newSize === pageSize) {
      return;
    }
    setCurrentPage(1);
    setPageSize(newSize);
  };

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
        case 'studentName':
          aValue = (a.studentName || '').toLowerCase();
          bValue = (b.studentName || '').toLowerCase();
          isNumeric = false;
          break;
        case 'pinNumber':
          const aPin = String(a.pinNumber || '');
          const bPin = String(b.pinNumber || '');
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

  // Inline cell editing handlers - now just tracks changes, doesn't save
  const handleCellClick = (studentId, yearSemKey, feeHeaderId) => {
    if (!filters.feeHeaderId) {
      toast.error('Please select a fee header first');
      return;
    }
    const student = students.find(s => s.id === studentId);
    if (!student || !student.yearSemFees) return;
    
    const yearSemData = student.yearSemFees[yearSemKey];
    if (!yearSemData) return;
    
    const fee = yearSemData.fees[feeHeaderId] || {};
    setEditingCell({ studentId, yearSemKey, feeHeaderId, year: yearSemData.year, semester: yearSemData.semester });
    setCellValue(fee.amount || '');
  };

  const handleCellBlur = () => {
    if (!editingCell) return;
    
    const { studentId, yearSemKey, feeHeaderId, year, semester } = editingCell;
    const newAmount = parseFloat(cellValue) || 0;
    
    // Get current fee to check if changed
    const student = students.find(s => s.id === studentId);
    const yearSemData = student?.yearSemFees?.[yearSemKey];
    const currentFee = yearSemData?.fees[feeHeaderId] || {};
    
    // If value hasn't changed, just clear editing
    if (currentFee.amount === newAmount) {
      setEditingCell(null);
      setCellValue('');
      return;
    }
    
    // Track the change in feeChanges Map
    const changeKey = `${studentId}_${yearSemKey}_${feeHeaderId}`;
    setFeeChanges(prev => {
      const newMap = new Map(prev);
      if (newAmount === 0 && currentFee.amount === 0) {
        // No change, remove from map if exists
        newMap.delete(changeKey);
      } else {
        // Store the change
        newMap.set(changeKey, {
          studentId,
          yearSemKey,
          feeHeaderId,
          year,
          semester,
          amount: newAmount,
          currentFee: currentFee
        });
      }
      return newMap;
    });
    
    setEditingCell(null);
    setCellValue('');
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setCellValue('');
    }
  };

  // Bulk save all fee changes
  const handleBulkSaveFees = async () => {
    if (feeChanges.size === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      // Group changes by studentId
      const changesByStudent = {};
      feeChanges.forEach((change) => {
        if (!changesByStudent[change.studentId]) {
          changesByStudent[change.studentId] = [];
        }
        changesByStudent[change.studentId].push({
          feeHeaderId: change.feeHeaderId,
          amount: change.amount,
          paidAmount: change.currentFee.paidAmount || 0,
          dueDate: change.currentFee.dueDate || null,
          paymentDate: change.currentFee.paymentDate || null,
          paymentStatus: change.currentFee.paymentStatus || 'pending',
          remarks: change.currentFee.remarks || null,
          year: change.year,
          semester: change.semester
        });
      });

      // Save all changes
      const savePromises = Object.entries(changesByStudent).map(([studentId, fees]) => {
        return api.post(`/fees/students/${studentId}`, {
          studentId: parseInt(studentId),
          fees: fees
        });
      });

      await Promise.all(savePromises);
      
      toast.success(`Successfully updated fees for ${Object.keys(changesByStudent).length} student(s)`);
      
      // Clear changes and reload
      setFeeChanges(new Map());
      studentsCache.current.clear();
      await loadStudents(currentPage, false);
    } catch (error) {
      console.error('Failed to save fees:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to save fees');
    } finally {
      setSaving(false);
    }
  };

  // Clear all pending changes
  const handleClearChanges = () => {
    setFeeChanges(new Map());
    setEditingCell(null);
    setCellValue('');
    toast.info('All pending changes cleared');
  };

  // Open student fee details modal
  const handleOpenStudentFeeModal = async (student) => {
    console.log('Opening student fee modal for:', student);
    setSelectedStudentForFee(student);
    setStudentFeeModalOpen(true);
    setPaymentAmounts(new Map());
    setStudentFeeDetails(null); // Reset to show loading
    
    try {
      // Fetch all fee details for this student
      const response = await api.get(`/fees/students/${student.id}/details`);
      if (response.data?.success && response.data.data) {
        console.log('Student fee details loaded:', response.data.data);
        setStudentFeeDetails(response.data.data);
      } else {
        console.error('Invalid response structure:', response.data);
        toast.error('Failed to load student fee details - invalid response');
        setStudentFeeDetails({ fees: [], yearSemColumns: [], feeHeaders: [] }); // Set empty structure
      }
    } catch (error) {
      console.error('Failed to load student fee details:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to load student fee details');
      setStudentFeeDetails({ fees: [], yearSemColumns: [], feeHeaders: [] }); // Set empty structure on error
    }
  };

  // Handle payment amount change
  const handlePaymentAmountChange = (feeHeaderId, year, semester, amount) => {
    const key = `${selectedStudentForFee.id}_${feeHeaderId}_${year}_${semester}`;
    setPaymentAmounts(prev => {
      const newMap = new Map(prev);
      const numAmount = parseFloat(amount) || 0;
      if (numAmount > 0) {
        newMap.set(key, numAmount);
      } else {
        newMap.delete(key);
      }
      return newMap;
    });
  };

  // Save cash payments
  const handleSaveCashPayments = async () => {
    if (paymentAmounts.size === 0) {
      toast.info('No payments to save');
      return;
    }

    setSaving(true);
    try {
      // Group payments by studentId
      const paymentsByStudent = {};
      paymentAmounts.forEach((amount, key) => {
        const [studentId, feeHeaderId, year, semester] = key.split('_');
        if (!paymentsByStudent[studentId]) {
          paymentsByStudent[studentId] = [];
        }
        
        // Find the fee detail from the studentFeeDetails structure
        const headerFee = studentFeeDetails?.fees?.find(f => f.headerId === parseInt(feeHeaderId));
        if (!headerFee) return;
        
        const yearSemKey = `Y${year}_S${semester}`;
        const feeDetail = headerFee.yearSemFees?.[yearSemKey];
        
        const currentPaidAmount = feeDetail?.paidAmount || 0;
        const newPaidAmount = currentPaidAmount + amount;
        const feeAmount = feeDetail?.amount || 0;
        
        paymentsByStudent[studentId].push({
          feeHeaderId: parseInt(feeHeaderId),
          amount: feeAmount,
          paidAmount: newPaidAmount,
          dueDate: feeDetail?.dueDate || null,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentStatus: newPaidAmount >= feeAmount ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending'),
          remarks: feeDetail?.remarks || 'Cash payment',
          year: parseInt(year),
          semester: parseInt(semester)
        });
      });

      // Save all payments
      const savePromises = Object.entries(paymentsByStudent).map(([studentId, fees]) => {
        return api.post(`/fees/students/${studentId}`, {
          studentId: parseInt(studentId),
          fees: fees
        });
      });

      await Promise.all(savePromises);
      
      toast.success(`Successfully recorded cash payments for ${Object.keys(paymentsByStudent).length} student(s)`);
      
      // Close modal and reload data
      setStudentFeeModalOpen(false);
      setSelectedStudentForFee(null);
      setStudentFeeDetails(null);
      setPaymentAmounts(new Map());
      studentsCache.current.clear();
      await loadStudents(currentPage, false);
    } catch (error) {
      console.error('Failed to save payments:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to save payments');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenConfigModal = () => {
    loadFeeHeaders();
    setConfigModalOpen(true);
  };

  const handleCloseConfigModal = () => {
    setConfigModalOpen(false);
    setEditingHeaderId(null);
    setNewHeader({ header_name: '', description: '', is_active: true });
  };

  const handleCreateHeader = async () => {
    if (!newHeader.header_name.trim()) {
      toast.error('Fee header name is required');
      return;
    }

    try {
      const response = await api.post('/fees/headers', newHeader);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to create fee header');
      }

      toast.success('Fee header created successfully');
      setNewHeader({ header_name: '', description: '', is_active: true });
      await loadFeeHeaders();
      await loadStudents(currentPage);
    } catch (error) {
      console.error('Failed to create fee header:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to create fee header');
    }
  };

  const handleEditHeader = (header) => {
    setEditingHeaderId(header.id);
    setNewHeader({
      header_name: header.header_name,
      description: header.description || '',
      is_active: header.is_active !== false
    });
  };

  const handleUpdateHeader = async () => {
    if (!newHeader.header_name.trim()) {
      toast.error('Fee header name is required');
      return;
    }

    try {
      const response = await api.put(`/fees/headers/${editingHeaderId}`, newHeader);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update fee header');
      }

      toast.success('Fee header updated successfully');
      setEditingHeaderId(null);
      setNewHeader({ header_name: '', description: '', is_active: true });
      await loadFeeHeaders();
      await loadStudents(currentPage);
    } catch (error) {
      console.error('Failed to update fee header:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to update fee header');
    }
  };

  const handleDeleteHeader = async (headerId) => {
    if (!window.confirm('Are you sure you want to delete this fee header? This action cannot be undone if there are associated student fees.')) {
      return;
    }

    try {
      const response = await api.delete(`/fees/headers/${headerId}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to delete fee header');
      }

      toast.success('Fee header deleted successfully');
      await loadFeeHeaders();
      await loadStudents(currentPage);
    } catch (error) {
      console.error('Failed to delete fee header:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to delete fee header');
    }
  };

  const renderPhoto = (student) => {
    if (student.studentPhoto) {
      const src = student.studentPhoto.startsWith('data:')
        ? student.studentPhoto
        : getStaticFileUrlDirect(student.studentPhoto);
      return (
        <img
          src={src}
          alt={student.studentName || 'Student'}
          className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
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
      <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs sm:text-sm flex-shrink-0">
        {initials || 'NA'}
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full bg-green-100 p-2 sm:p-3 text-green-600 flex-shrink-0">
            <DollarSign size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 heading-font">Fee Management</h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Manage student fees by college, course, branch, year, and semester.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenConfigModal}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <Settings size={16} />
            Configure
          </button>
          <button
            type="button"
            onClick={() => loadStudents(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Filters Section */}
      <section className="bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-600 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {/* Fee Header - First Position (Required) */}
            <select
              value={filters.feeHeaderId}
              onChange={(e) => handleFilterChange('feeHeaderId', e.target.value)}
              className="w-full rounded-md border-2 border-blue-400 bg-blue-50 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation min-h-[44px] font-semibold text-blue-900"
              required
            >
              <option value="">Select Fee Header *</option>
              {feeHeaders && feeHeaders.length > 0 ? (
                feeHeaders
                  .filter(h => h.is_active !== false && h.is_active !== 0 && h.is_active !== '0')
                  .map((header) => (
                    <option key={header.id} value={String(header.id)}>
                      {header.header_name || header.headerName || `Header ${header.id}`}
                    </option>
                  ))
              ) : (
                <option value="" disabled>Loading fee headers...</option>
              )}
            </select>
            {filterOptions.colleges.length > 0 && (
              <select
                value={filters.college}
                onChange={(e) => handleFilterChange('college', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              >
                <option value="">All Colleges</option>
                {filterOptions.colleges.map((college) => (
                  <option key={college} value={college}>
                    {college}
                  </option>
                ))}
              </select>
            )}
            <select
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Batches</option>
              {filterOptions.batches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
            <select
              value={filters.course}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
            >
              <option value="">All Courses</option>
              {filterOptions.courses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px] disabled:opacity-50"
              disabled={filters.course && availableBranches.length === 0}
            >
              <option value="">All Branches</option>
              {availableBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by PIN or Student Name..."
                value={filters.pinNumber || filters.studentName}
                onChange={(e) => {
                  const value = e.target.value;
                  // Update both filters - backend will handle searching both fields
                  handleFilterChange('pinNumber', value);
                  handleFilterChange('studentName', value);
                }}
                className="w-full pl-10 rounded-md border border-gray-300 px-3 py-2.5 sm:py-1.5 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 touch-manipulation min-h-[44px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        </div>
      </section>

      {/* Students Table */}
      <section className="bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 sm:p-6">
            {/* Skeleton Header */}
            <div className="w-full border-collapse mb-4">
              <div className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-20 shadow-md">
                <div className="flex gap-2 sm:gap-4 pb-3 border-b border-gray-200">
                  <SkeletonBox height="h-4" width="w-[18%]" className="rounded" />
                  <SkeletonBox height="h-4" width="w-[10%]" className="rounded hidden md:block" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded hidden lg:block" />
                  <SkeletonBox height="h-4" width="w-[10%]" className="rounded hidden lg:block" />
                  <SkeletonBox height="h-4" width="w-[10%]" className="rounded hidden lg:block" />
                  <SkeletonBox height="h-4" width="w-[12%]" className="rounded hidden md:block" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded" />
                </div>
              </div>
            </div>
            {/* Skeleton Rows */}
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, rowIdx) => (
                <div 
                  key={rowIdx} 
                  className={`flex gap-2 sm:gap-4 py-4 border-b border-gray-200 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <div className="flex items-center gap-2 w-[18%]">
                    <SkeletonBox height="h-8" width="w-8" className="rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonBox height="h-3" width="w-3/4" />
                      <SkeletonBox height="h-2.5" width="w-1/2" />
                    </div>
                  </div>
                  <SkeletonBox height="h-4" width="w-[10%]" className="rounded hidden md:block self-center" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded hidden lg:block self-center" />
                  <SkeletonBox height="h-4" width="w-[10%]" className="rounded hidden lg:block self-center" />
                  <SkeletonBox height="h-4" width="w-[10%]" className="rounded hidden lg:block self-center" />
                  <SkeletonBox height="h-4" width="w-[12%]" className="rounded hidden md:block self-center" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded self-center" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded self-center" />
                  <SkeletonBox height="h-4" width="w-[8%]" className="rounded self-center" />
                </div>
              ))}
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
            <p>No students found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            {/* Bulk Save Button - Moved to Top */}
            {filters.feeHeaderId && feeChanges.size > 0 && (
              <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    {feeChanges.size} fee change(s) pending
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearChanges}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Clear Changes
                  </button>
                  <button
                    onClick={handleBulkSaveFees}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save All Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="w-full overflow-hidden">
              <div className="w-full">
                <table className="w-full border-collapse table-fixed" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-20 shadow-md">
                  <tr>
                    <th className="px-1.5 sm:px-2 md:px-3 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-50 border-l border-r border-gray-200 hidden lg:table-cell w-[8%] max-w-[100px]">
                      Batch
                    </th>
                    <th className="px-1.5 sm:px-2 md:px-3 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-50 border-r border-gray-200 hidden md:table-cell w-[12%]">
                      <button
                        onClick={() => handleSort('pinNumber')}
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        <span>PIN</span>
                        {sortConfig.field === 'pinNumber' && (
                          <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'rotate-180' : ''} />
                        )}
                      </button>
                    </th>
                    <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider w-[20%] sm:w-[18%]">
                      <button
                        onClick={() => handleSort('studentName')}
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                      >
                        <span>Student</span>
                        {sortConfig.field === 'studentName' && (
                          <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'rotate-180' : ''} />
                        )}
                      </button>
                    </th>
                    <th className="px-1.5 sm:px-2 md:px-3 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-50 border-r border-gray-200 hidden lg:table-cell w-[10%]">
                      Course
                    </th>
                    <th className="px-1.5 sm:px-2 md:px-3 py-2.5 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-50 border-r border-gray-200 hidden lg:table-cell w-[10%]">
                      Branch
                    </th>
                    {!filters.feeHeaderId ? (
                      <th className="px-2 sm:px-3 py-2.5 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-red-600 uppercase tracking-wider bg-red-50 border-l-2 border-blue-400" colSpan={yearSemColumns.length}>
                        Please select a fee header to view fees
                      </th>
                    ) : (
                      yearSemColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-1 sm:px-2 md:px-3 py-2.5 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider bg-blue-50 border-l-2 border-blue-400 border-r border-gray-200"
                          style={{ width: `${Math.max(8, 100 / yearSemColumns.length)}%` }}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-[10px] sm:text-xs">{col.label}</span>
                            <span className="text-[9px] sm:text-[10px] font-normal text-gray-600 mt-0.5">
                              {feeHeaders.find(h => h.id === parseInt(filters.feeHeaderId))?.header_name || feeHeaders.find(h => h.id === parseInt(filters.feeHeaderId))?.headerName || 'Fee'}
                            </span>
                          </div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sortedStudents.map((student, index) => {
                    // Check if this student has pending changes
                    const hasChanges = Array.from(feeChanges.keys()).some(key => 
                      key.startsWith(`${student.id}_`)
                    );
                    const isEven = index % 2 === 0;
                    
                    return (
                    <tr 
                      key={student.id} 
                      className={`
                        transition-all duration-200 ease-in-out
                        ${isEven ? 'bg-white' : 'bg-gray-50/50'}
                        ${hasChanges ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}
                        hover:bg-blue-50/50 hover:shadow-sm
                        border-b border-gray-200
                      `}
                    >
                      <td className="px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 align-middle text-xs sm:text-sm text-gray-900 bg-gray-50/30 border-l border-r border-gray-100 hidden lg:table-cell overflow-hidden whitespace-nowrap">
                        <div className="truncate max-w-full" title={student.batch || 'N/A'}>
                          {student.batch || 'N/A'}
                        </div>
                      </td>
                      <td className="px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 align-middle text-xs sm:text-sm text-gray-900 bg-gray-50/30 border-r border-gray-100 hidden md:table-cell whitespace-nowrap">
                        {student.pinNumber || 'N/A'}
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-3 sm:py-4 align-middle">
                        <div 
                          className="flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleOpenStudentFeeModal(student)}
                        >
                          {renderPhoto(student)}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                              {student.studentName}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">
                              {student.parentMobile1 || student.parentMobile2 || 'No contact'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 align-middle text-xs sm:text-sm text-gray-900 bg-gray-50/30 border-r border-gray-100 hidden lg:table-cell overflow-hidden whitespace-nowrap">
                        <div className="truncate max-w-full" title={student.course || 'N/A'}>
                          {student.course || 'N/A'}
                        </div>
                      </td>
                      <td className="px-1.5 sm:px-2 md:px-3 py-3 sm:py-4 align-middle text-xs sm:text-sm text-gray-900 bg-gray-50/30 border-r border-gray-100 hidden lg:table-cell overflow-hidden whitespace-nowrap">
                        <div className="truncate max-w-full" title={student.branch || 'N/A'}>
                          {student.branch || 'N/A'}
                        </div>
                      </td>
                      {!filters.feeHeaderId ? (
                        <td className="px-2 sm:px-3 py-3 sm:py-4 text-center text-xs sm:text-sm text-gray-500 align-middle border-l-2 border-blue-300" colSpan={yearSemColumns.length}>
                          Select a fee header to view and edit fees
                        </td>
                      ) : (
                        yearSemColumns.map((col) => {
                          const yearSemData = student.yearSemFees?.[col.key];
                          const fee = yearSemData?.fees[parseInt(filters.feeHeaderId)] || {};
                          const isEditing = editingCell?.studentId === student.id && 
                                           editingCell?.yearSemKey === col.key && 
                                           editingCell?.feeHeaderId === parseInt(filters.feeHeaderId);
                          
                          // Check if this cell has pending changes
                          const changeKey = `${student.id}_${col.key}_${filters.feeHeaderId}`;
                          const pendingChange = feeChanges.get(changeKey);
                          const displayAmount = pendingChange ? pendingChange.amount : (fee.amount || 0);
                          
                          return (
                            <td
                              key={col.key}
                              className={`
                                px-1 sm:px-2 md:px-3 py-3 sm:py-4 text-center align-middle
                                border-l-2 border-blue-300 border-r border-gray-200
                                hover:bg-blue-100/50 transition-all duration-200 cursor-pointer
                                ${pendingChange ? 'bg-yellow-100 border-yellow-300' : ''}
                              `}
                              onClick={() => handleCellClick(student.id, col.key, parseInt(filters.feeHeaderId))}
                            >
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={cellValue}
                                  onChange={(e) => setCellValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleCellKeyDown}
                                  className="w-full px-1.5 sm:px-2 py-1.5 text-xs sm:text-sm text-center border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  disabled={saving}
                                />
                              ) : (
                                <div className="flex flex-col gap-0.5 sm:gap-1 items-center justify-center">
                                  <div className={`text-xs sm:text-sm font-semibold ${pendingChange ? 'text-yellow-800' : 'text-gray-900'}`}>
                                    {formatCurrency(displayAmount)}
                                    {pendingChange && <span className="text-[10px] text-yellow-600 ml-0.5">*</span>}
                                  </div>
                                  {fee.paidAmount > 0 && (
                                    <div className="text-[10px] sm:text-xs font-semibold text-green-700 bg-green-50 px-1.5 sm:px-2 py-0.5 rounded mt-0.5">
                                      Paid: {formatCurrency(fee.paidAmount)}
                                    </div>
                                  )}
                                  {displayAmount > 0 && fee.paidAmount < displayAmount && (
                                    <div className="text-[10px] sm:text-xs text-red-600 font-medium mt-0.5">
                                      Due: {formatCurrency(displayAmount - (fee.paidAmount || 0))}
                                    </div>
                                  )}
                                  {displayAmount === 0 && !pendingChange && (
                                    <div className="text-[10px] sm:text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors cursor-pointer mt-0.5">Click to add</div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>

            {/* Pagination */}
            {(filters.feeHeaderId || (!filters.batch && !filters.course && !filters.branch && !filters.college)) && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Showing {showingFrom} to {showingTo} of {totalStudents} students
                  </span>
                  <select
                    value={pageSize}
                    onChange={handlePageSizeChange}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={isFirstPage || loading}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={isLastPage || loading}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Student Fee Details Modal */}
      {isMounted && studentFeeModalOpen && selectedStudentForFee && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setStudentFeeModalOpen(false);
              setSelectedStudentForFee(null);
              setStudentFeeDetails(null);
              setPaymentAmounts(new Map());
            }
          }}
        >
          <div
            className="w-full max-w-6xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Fee Details - {selectedStudentForFee.studentName}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  PIN: {selectedStudentForFee.pinNumber} | {selectedStudentForFee.course} - {selectedStudentForFee.branch}
                </p>
              </div>
              <button
                onClick={() => {
                  setStudentFeeModalOpen(false);
                  setSelectedStudentForFee(null);
                  setStudentFeeDetails(null);
                  setPaymentAmounts(new Map());
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            
            {!studentFeeDetails ? (
              <div className="p-8 flex items-center justify-center">
                <LoadingAnimation />
              </div>
            ) : (
              <div className="p-6">
                {/* Fee Headers and Year/Semester Grid */}
                {(!studentFeeDetails.fees || !Array.isArray(studentFeeDetails.fees) || studentFeeDetails.fees.length === 0) ? (
                  <div className="p-8 text-center text-gray-500">
                    <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
                    <p>No fee data available for this student.</p>
                    <p className="text-xs mt-2">Fees array: {studentFeeDetails.fees ? `${studentFeeDetails.fees.length} items` : 'null'}</p>
                  </div>
                ) : (!studentFeeDetails.yearSemColumns || !Array.isArray(studentFeeDetails.yearSemColumns) || studentFeeDetails.yearSemColumns.length === 0) ? (
                  <div className="p-8 text-center text-gray-500">
                    <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
                    <p>No year/semester data available.</p>
                    <p className="text-xs mt-2">YearSemColumns: {studentFeeDetails.yearSemColumns ? `${studentFeeDetails.yearSemColumns.length} items` : 'null'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border border-gray-200">
                            Fee Header
                          </th>
                          {studentFeeDetails.yearSemColumns && studentFeeDetails.yearSemColumns.map((col) => (
                            <th
                              key={col.key}
                              className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border border-gray-200 bg-blue-50 min-w-[120px]"
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {studentFeeDetails.fees && studentFeeDetails.fees.map((headerFee) => (
                        <tr key={headerFee.headerId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 border border-gray-200">
                            <div>
                              <div className="font-semibold text-gray-900">{headerFee.headerName}</div>
                              {headerFee.description && (
                                <div className="text-xs text-gray-500 mt-1">{headerFee.description}</div>
                              )}
                            </div>
                          </td>
                          {studentFeeDetails.yearSemColumns && studentFeeDetails.yearSemColumns.map((col) => {
                            const fee = (headerFee.yearSemFees && headerFee.yearSemFees[col.key]) || {};
                            const paymentKey = `${selectedStudentForFee.id}_${headerFee.headerId}_${col.year}_${col.semester}`;
                            const paymentAmount = paymentAmounts.get(paymentKey) || 0;
                            const currentPaid = fee.paidAmount || 0;
                            const totalPaid = currentPaid + paymentAmount;
                            const feeAmount = fee.amount || 0;
                            const isFullyPaid = totalPaid >= feeAmount && feeAmount > 0;
                            const isPartiallyPaid = totalPaid > 0 && totalPaid < feeAmount;
                            
                            return (
                              <td
                                key={col.key}
                                className={`px-3 py-2 border border-gray-200 text-center ${isFullyPaid ? 'bg-green-50' : isPartiallyPaid ? 'bg-yellow-50' : ''}`}
                              >
                                <div className="space-y-2">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(feeAmount)}
                                  </div>
                                  {currentPaid > 0 && (
                                    <div className="text-xs text-green-600 font-medium">
                                      Paid: {formatCurrency(currentPaid)}
                                    </div>
                                  )}
                                  {paymentAmount > 0 && (
                                    <div className="text-xs text-blue-600 font-bold">
                                      +{formatCurrency(paymentAmount)} (Cash)
                                    </div>
                                  )}
                                  {feeAmount > 0 && totalPaid < feeAmount && (
                                    <div className="text-xs text-red-600 font-medium">
                                      Due: {formatCurrency(feeAmount - totalPaid)}
                                    </div>
                                  )}
                                  {feeAmount > 0 && (
                                    <div className="mt-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={feeAmount - totalPaid}
                                        placeholder="Cash amount"
                                        value={paymentAmount > 0 ? paymentAmount : ''}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          handlePaymentAmountChange(headerFee.headerId, col.year, col.semester, val);
                                        }}
                                        className="w-full px-2 py-1 text-xs text-center border border-gray-300 rounded focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  )}
                                  {isFullyPaid && (
                                    <div className="text-xs text-green-700 font-bold mt-1">
                                      ✓ Paid
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                )}

                {/* Payment Summary and Save Button */}
                {paymentAmounts.size > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-blue-900">
                          Total Cash Payment: {formatCurrency(Array.from(paymentAmounts.values()).reduce((sum, amt) => sum + amt, 0))}
                        </div>
                        <div className="text-xs text-blue-700 mt-1">
                          {paymentAmounts.size} fee(s) selected for payment
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPaymentAmounts(new Map())}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleSaveCashPayments}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                          {saving ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard size={16} />
                              Record Cash Payment
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Edit Student Fees Modal */}
      {editingStudentId && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelEdit();
            }
          }}
        >
          <div
            className="w-full max-w-4xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Fees - {students.find(s => s.id === editingStudentId)?.studentName}
              </h3>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {feeHeaders.map((header) => {
                const fee = editingFees[header.id] || {};
                return (
                  <div key={header.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900">{header.header_name || header.headerName}</h4>
                    {header.description && (
                      <p className="text-sm text-gray-600">{header.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={fee.amount || 0}
                          onChange={(e) => handleFeeChange(header.id, 'amount', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={fee.paidAmount || 0}
                          onChange={(e) => handleFeeChange(header.id, 'paidAmount', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={fee.dueDate || ''}
                          onChange={(e) => handleFeeChange(header.id, 'dueDate', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={fee.paymentDate || ''}
                          onChange={(e) => handleFeeChange(header.id, 'paymentDate', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
                        <select
                          value={fee.paymentStatus || 'pending'}
                          onChange={(e) => handleFeeChange(header.id, 'paymentStatus', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={fee.remarks || ''}
                          onChange={(e) => handleFeeChange(header.id, 'remarks', e.target.value)}
                          placeholder="Optional remarks"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveStudentFees(editingStudentId)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Fees'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fee Headers Configuration Modal */}
      {isMounted && configModalOpen && typeof document !== 'undefined' && document.body && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseConfigModal();
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Configure Fee Headers</h3>
              <button
                onClick={handleCloseConfigModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Add/Edit Header Form */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-gray-900">
                  {editingHeaderId ? 'Edit Fee Header' : 'Add New Fee Header'}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Header Name *</label>
                    <input
                      type="text"
                      value={newHeader.header_name}
                      onChange={(e) => setNewHeader({ ...newHeader, header_name: e.target.value })}
                      placeholder="e.g., Tuition Fee, Bus Fee"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newHeader.description}
                      onChange={(e) => setNewHeader({ ...newHeader, description: e.target.value })}
                      placeholder="Optional description"
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={newHeader.is_active}
                      onChange={(e) => setNewHeader({ ...newHeader, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingHeaderId && (
                      <button
                        onClick={() => {
                          setEditingHeaderId(null);
                          setNewHeader({ header_name: '', description: '', is_active: true });
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={editingHeaderId ? handleUpdateHeader : handleCreateHeader}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      {editingHeaderId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Headers List */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Existing Fee Headers</h4>
                <div className="space-y-2">
                  {feeHeadersForConfig.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No fee headers configured</p>
                  ) : (
                    feeHeadersForConfig.map((header) => (
                      <div
                        key={header.id}
                        className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{header.header_name || header.headerName}</span>
                            {!header.is_active && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          {header.description && (
                            <p className="text-sm text-gray-600 mt-1">{header.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditHeader(header)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteHeader(header.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FeeManagement;
