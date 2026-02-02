import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  RefreshCw,
  Users as UsersIcon,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileText,
  BookOpen,
  Zap,
  Award,
  Search,
  XCircle,
  X,
  ArrowLeft,
  User,
  Calendar,
  CalendarDays
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line
} from 'recharts';
import toast from 'react-hot-toast';
import RegistrationDownloadModal from '../components/Reports/RegistrationDownloadModal';
import api from '../config/api';
import CalendarWidget from '../components/Attendance/CalendarWidget';

const StatusBadge = ({ status, type = 'icon' }) => {
  const isCompleted = status === 'completed' || status === 'Verified' || status === 'No Due';
  const isPermitted = status === 'Permitted';
  const isPending = status === 'pending' || status === 'Unverified' || status === 'Pending';

  if (type === 'text') {
    let colorClass = 'bg-gray-100 text-gray-700'; // Default
    if (status === 'No Due' || status === 'Verified' || status === 'completed') colorClass = 'bg-green-100 text-green-700';
    else if (status === 'Permitted') colorClass = 'bg-orange-100 text-orange-700';
    else if (status === 'Unverified' || status === 'Pending' || status === 'pending') colorClass = 'bg-red-50 text-red-600';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
        {status === 'completed' ? 'Completed' : status === 'pending' ? 'Pending' : status}
      </span>
    );
  }

  // Icon checks (strictly for 'completed' vs others logic usually)
  const isIconCompleted = status === 'completed';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isIconCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
      }`}>
      {isIconCompleted ? <CheckCircle size={12} /> : <Clock size={12} />}
      {isIconCompleted ? 'Completed' : 'Pending'}
    </span>
  );
};

const Reports = () => {
  const location = useLocation();
  const isAttendanceReports = location.pathname === '/reports/attendance';
  const reportType = isAttendanceReports ? 'attendance' : 'registration';

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalPages: 0,
    totalRecords: 0
  });
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('abstract');

  const [filters, setFilters] = useState({
    college: '',
    batch: '',
    course: '',
    branch: '',
    year: '',
    semester: '',
    search: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    colleges: [],
    batches: [],
    courses: [],
    branches: [],
    years: [],
    semesters: []
  });
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Abstract Data State
  const [abstractData, setAbstractData] = useState([]);
  const [groupingParams, setGroupingParams] = useState({ key: 'college', label: 'College' });

  // Attendance Reports State
  const [attendanceReportData, setAttendanceReportData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceAbstractData, setAttendanceAbstractData] = useState([]);
  const [attendanceAbstractLoading, setAttendanceAbstractLoading] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false); // true when showing detailed view after drill-down
  const [selectedBranchForDrillDown, setSelectedBranchForDrillDown] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [attendanceFilters, setAttendanceFilters] = useState({
    college: '',
    batch: '',
    course: '',
    branch: '',
    year: '',
    semester: '',
    studentIds: [] // Array of selected student IDs
  });
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [attendanceDateRange, setAttendanceDateRange] = useState({
    fromDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });
  const [attendanceDateMode, setAttendanceDateMode] = useState('range'); // 'today' or 'range'
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarAttendanceData, setCalendarAttendanceData] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Fetch Abstract Data
  useEffect(() => {
    if (reportType === 'registration' && activeTab === 'abstract') {
      const fetchAbstract = async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams();
          if (filters.college) params.append('filter_college', filters.college);
          if (filters.batch) params.append('filter_batch', filters.batch);
          if (filters.course) params.append('filter_course', filters.course);
          if (filters.branch) params.append('filter_branch', filters.branch);
          if (filters.year) params.append('filter_year', filters.year);
          if (filters.semester) params.append('filter_semester', filters.semester);
          if (filters.search) params.append('search', filters.search);

          const response = await api.get(`/students/reports/registration/abstract?${params.toString()}`);
          if (response.data?.success) {
            setAbstractData(response.data.data || []);
            setGroupingParams(response.data.groupingParams || { key: 'college', label: 'College' });
          }
        } catch (error) {
          console.error('Failed to load abstract:', error);
          toast.error('Failed to load abstract report');
        } finally {
          setLoading(false);
        }
      };
      fetchAbstract();
    }
  }, [activeTab, filters]);

  // Debounced search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadReport = useCallback(
    async (overrideFilters) => {
      const activeFilters = overrideFilters ?? filters;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeFilters.college) params.append('filter_college', activeFilters.college);
        if (activeFilters.batch) params.append('filter_batch', activeFilters.batch);
        if (activeFilters.course) params.append('filter_course', activeFilters.course);
        if (activeFilters.branch) params.append('filter_branch', activeFilters.branch);
        if (activeFilters.year) params.append('filter_year', activeFilters.year);
        if (activeFilters.semester) params.append('filter_semester', activeFilters.semester);
        if (activeFilters.search) params.append('search', activeFilters.search);
        if (activeFilters.page) params.append('page', activeFilters.page);
        if (activeFilters.limit) params.append('limit', activeFilters.limit);

        const query = params.toString();
        const response = await api.get(`/students/reports/registration${query ? `?${query}` : ''}`);

        if (response.data?.success) {
          setReportData(response.data.data || []);
          if (response.data.pagination) {
            setPagination(prev => ({
              ...prev,
              page: parseInt(response.data.pagination.page),
              totalPages: parseInt(response.data.pagination.totalPages),
              totalRecords: parseInt(response.data.pagination.total),
              limit: parseInt(response.data.pagination.limit)
            }));
          }
          if (response.data.statistics) {
            setStats(response.data.statistics);
          }
        } else {
          throw new Error(response.data?.message || 'Unable to load reports');
        }
      } catch (error) {
        console.error('Failed to load registration report:', error);
        toast.error(
          error.response?.data?.message || error.message || 'Unable to load registration report'
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );
  // Fetch initial options only once on mount
  useEffect(() => {
    const fetchInitialOptions = async () => {
      try {
        const response = await api.get('/students/quick-filters?applyExclusions=true');
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            colleges: data.colleges || [],
            batches: data.batches || [],
            courses: data.courses || [],
            branches: data.branches || [],
            years: data.years || [],
            semesters: data.semesters || []
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch initial filter options:', error);
      }
    };
    fetchInitialOptions();
  }, []);

  // Update Dependents when College or Batch changes
  useEffect(() => {
    const updateCollegeBatchDependents = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.college) params.append('college', filters.college);
        if (filters.batch) params.append('batch', filters.batch);
        params.append('applyExclusions', 'true');

        const response = await api.get(`/students/quick-filters?${params.toString()}`);
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            courses: data.courses || [],
            // Reset downstream options if their parents aren't selected
            branches: !filters.course ? (data.branches || []) : prev.branches,
            years: (!filters.course && !filters.branch) ? (data.years || []) : prev.years,
            semesters: (!filters.course && !filters.branch && !filters.year) ? (data.semesters || []) : prev.semesters
          }));
        }
      } catch (error) {
        console.warn('Failed to update college/batch dependents:', error);
      }
    };
    updateCollegeBatchDependents();
  }, [filters.college, filters.batch, filters.course, filters.branch, filters.year]);

  // Update Dependents when Course changes
  useEffect(() => {
    if (!filters.course) return;

    const updateCourseDependents = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.college) params.append('college', filters.college);
        if (filters.batch) params.append('batch', filters.batch);
        params.append('course', filters.course);
        params.append('applyExclusions', 'true');

        const response = await api.get(`/students/quick-filters?${params.toString()}`);
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            branches: data.branches || [],
            years: !filters.branch ? (data.years || []) : prev.years,
            semesters: (!filters.branch && !filters.year) ? (data.semesters || []) : prev.semesters
          }));
        }
      } catch (error) {
        console.warn('Failed to update course dependents:', error);
      }
    };
    updateCourseDependents();
  }, [filters.course, filters.branch, filters.year]);

  // Update Dependents when Branch changes
  useEffect(() => {
    if (!filters.branch) return;

    const updateBranchDependents = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.college) params.append('college', filters.college);
        if (filters.batch) params.append('batch', filters.batch);
        if (filters.course) params.append('course', filters.course);
        params.append('branch', filters.branch);
        params.append('applyExclusions', 'true');

        const response = await api.get(`/students/quick-filters?${params.toString()}`);
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            years: data.years || [],
            semesters: !filters.year ? (data.semesters || []) : prev.semesters
          }));
        }
      } catch (error) {
        console.warn('Failed to update branch dependents:', error);
      }
    };
    updateBranchDependents();
  }, [filters.branch, filters.year]);

  // Update Dependents when Year changes
  useEffect(() => {
    if (!filters.year) return;

    const updateYearDependents = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.college) params.append('college', filters.college);
        if (filters.batch) params.append('batch', filters.batch);
        if (filters.course) params.append('course', filters.course);
        if (filters.branch) params.append('branch', filters.branch);
        params.append('year', filters.year);
        params.append('applyExclusions', 'true');

        const response = await api.get(`/students/quick-filters?${params.toString()}`);
        if (response.data?.success) {
          const data = response.data.data || {};
          setFilterOptions(prev => ({
            ...prev,
            semesters: data.semesters || []
          }));
        }
      } catch (error) {
        console.warn('Failed to update year dependents:', error);
      }
    };
    updateYearDependents();
  }, [filters.year]);

  useEffect(() => {
    loadReport({ ...filters, page: 1 });
  }, [filters, loadReport]);

  // Fetch attendance report data
  const fetchAttendanceReport = useCallback(async () => {
    let fromDate = attendanceDateRange.fromDate;
    let toDate = attendanceDateRange.toDate;
    
    // If in today mode and dates are not set, use today's date
    if (attendanceDateMode === 'today' && (!fromDate || !toDate)) {
      const today = new Date().toISOString().split('T')[0];
      fromDate = today;
      toDate = today;
      setAttendanceDateRange({ fromDate: today, toDate: today });
    }
    
    if (!fromDate || !toDate) {
      toast.error('Please select both from and to dates');
      return;
    }

    setAttendanceLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('fromDate', fromDate);
      params.append('toDate', toDate);
      
      if (attendanceFilters.college) params.append('college', attendanceFilters.college);
      if (attendanceFilters.batch) params.append('batch', attendanceFilters.batch);
      if (attendanceFilters.course) params.append('course', attendanceFilters.course);
      if (attendanceFilters.branch) params.append('branch', attendanceFilters.branch);
      if (attendanceFilters.year) params.append('year', attendanceFilters.year);
      if (attendanceFilters.semester) params.append('semester', attendanceFilters.semester);

      const response = await api.get(`/attendance/report-for-students?${params.toString()}`);
      if (response.data?.success) {
        setAttendanceReportData(response.data.data);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch attendance report');
      }
    } catch (error) {
      console.error('Failed to fetch attendance report:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to fetch attendance report');
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceDateRange, attendanceFilters, attendanceDateMode]);

  // Fetch attendance abstract data
  const fetchAttendanceAbstract = useCallback(async () => {
    const fromDate = attendanceDateRange.fromDate;
    const toDate = attendanceDateRange.toDate;
    
    if (!fromDate || !toDate) {
      toast.error('Please select both from and to dates');
      return;
    }

    setAttendanceAbstractLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('fromDate', fromDate);
      params.append('toDate', toDate);
      
      if (attendanceFilters.college) params.append('college', attendanceFilters.college);
      if (attendanceFilters.batch) params.append('batch', attendanceFilters.batch);
      if (attendanceFilters.course) params.append('course', attendanceFilters.course);
      if (attendanceFilters.branch) params.append('branch', attendanceFilters.branch);
      if (attendanceFilters.year) params.append('year', attendanceFilters.year);
      if (attendanceFilters.semester) params.append('semester', attendanceFilters.semester);

      const response = await api.get(`/attendance/report/abstract?${params.toString()}`);
      if (response.data?.success) {
        setAttendanceAbstractData(response.data.data || []);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch attendance abstract');
      }
    } catch (error) {
      console.error('Failed to fetch attendance abstract:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to fetch attendance abstract');
    } finally {
      setAttendanceAbstractLoading(false);
    }
  }, [attendanceDateRange, attendanceFilters, attendanceDateMode]);

  // Fetch calendar attendance data
  const fetchCalendarAttendanceData = useCallback(async () => {
    const fromDate = attendanceDateRange.fromDate;
    const toDate = attendanceDateRange.toDate;
    
    if (!fromDate || !toDate) {
      return;
    }

    setCalendarLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('fromDate', fromDate);
      params.append('toDate', toDate);
      
      if (attendanceFilters.college) params.append('college', attendanceFilters.college);
      if (attendanceFilters.batch) params.append('batch', attendanceFilters.batch);
      if (attendanceFilters.course) params.append('course', attendanceFilters.course);
      if (attendanceFilters.branch) params.append('branch', attendanceFilters.branch);
      if (attendanceFilters.year) params.append('year', attendanceFilters.year);
      if (attendanceFilters.semester) params.append('semester', attendanceFilters.semester);

      const response = await api.get(`/attendance/report-for-students?${params.toString()}`);
      if (response.data?.success) {
        setCalendarAttendanceData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch calendar attendance data:', error);
    } finally {
      setCalendarLoading(false);
    }
  }, [attendanceDateRange, attendanceFilters]);

  // Fetch calendar data when modal opens
  useEffect(() => {
    if (calendarModalOpen) {
      fetchCalendarAttendanceData();
    }
  }, [calendarModalOpen, fetchCalendarAttendanceData]);

  // Auto-fetch data when filters or date range change
  useEffect(() => {
    if (!attendanceDateRange.fromDate || !attendanceDateRange.toDate) {
      return;
    }

    const timer = setTimeout(() => {
      if (showDetailedView) {
        fetchAttendanceReport();
      } else {
        fetchAttendanceAbstract();
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [
    attendanceDateRange.fromDate,
    attendanceDateRange.toDate,
    attendanceFilters.college,
    attendanceFilters.batch,
    attendanceFilters.course,
    attendanceFilters.branch,
    attendanceFilters.year,
    attendanceFilters.semester,
    showDetailedView,
    attendanceDateMode,
    fetchAttendanceAbstract,
    fetchAttendanceReport
  ]);

  // Handle branch drill down
  const handleBranchDrillDown = useCallback((branchData) => {
    setSelectedBranchForDrillDown(branchData);
    setShowDetailedView(true);
    // Set filters to match the selected branch
    const newFilters = {
      college: branchData.college || '',
      batch: branchData.batch || '',
      branch: branchData.branch || '',
      year: branchData.year || '',
      semester: branchData.semester || ''
    };
    setAttendanceFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Download attendance report as PDF
  const downloadAttendancePDF = async () => {
    if (!attendanceReportData) {
      toast.error('Please generate the report first');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Title
      doc.setFontSize(18);
      doc.text('Attendance Report', 14, 15);
      doc.setFontSize(12);
      doc.text(`Period: ${attendanceReportData.fromDate} to ${attendanceReportData.toDate}`, 14, 22);

      let yPos = 30;

      // Statistics
      doc.setFontSize(11);
      doc.text(`Total Students: ${attendanceReportData.statistics.totalStudents}`, 14, yPos);
      yPos += 6;
      doc.text(`Working Days: ${attendanceReportData.statistics.totalWorkingDays}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Present: ${attendanceReportData.statistics.totalPresent}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Absent: ${attendanceReportData.statistics.totalAbsent}`, 14, yPos);
      yPos += 6;
      doc.text(`Overall Attendance Percentage: ${attendanceReportData.statistics.overallAttendancePercentage.toFixed(2)}%`, 14, yPos);
      yPos += 10;

      // Table headers
      doc.setFontSize(10);
      doc.text('PIN', 14, yPos);
      doc.text('Student Name', 30, yPos);
      doc.text('Course', 80, yPos);
      doc.text('Branch', 110, yPos);
      doc.text('Working Days', 140, yPos);
      doc.text('Present', 165, yPos);
      doc.text('Absent', 185, yPos);
      doc.text('Percentage', 205, yPos);
      yPos += 6;

      // Table rows
      attendanceReportData.students.forEach((student) => {
        if (yPos > 180) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(student.pinNumber || '-', 14, yPos);
        doc.text(student.studentName || '-', 30, yPos);
        doc.text(student.course || '-', 80, yPos);
        doc.text(student.branch || '-', 110, yPos);
        doc.text(student.statistics.workingDays.toString(), 140, yPos);
        doc.text(student.statistics.presentDays.toString(), 165, yPos);
        doc.text(student.statistics.absentDays.toString(), 185, yPos);
        doc.text(`${student.statistics.attendancePercentage.toFixed(2)}%`, 205, yPos);
        yPos += 6;
      });

      doc.save(`attendance_report_${attendanceReportData.fromDate}_to_${attendanceReportData.toDate}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Download attendance report as Excel
  const downloadAttendanceExcel = async () => {
    if (!attendanceReportData) {
      toast.error('Please generate the report first');
      return;
    }

    try {
      const xlsx = require('xlsx');
      const workbook = xlsx.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['Attendance Report Summary'],
        [''],
        ['Report Period', `${attendanceReportData.fromDate} to ${attendanceReportData.toDate}`],
        [''],
        ['Total Students', attendanceReportData.statistics.totalStudents],
        ['Working Days', attendanceReportData.statistics.totalWorkingDays],
        ['Total Present', attendanceReportData.statistics.totalPresent],
        ['Total Absent', attendanceReportData.statistics.totalAbsent],
        ['Overall Attendance Percentage', `${attendanceReportData.statistics.overallAttendancePercentage.toFixed(2)}%`]
      ];

      const summarySheet = xlsx.utils.aoa_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Detailed sheet
      const headerRow = [
        'PIN Number',
        'Student Name',
        'Admission Number',
        'Batch',
        'Course',
        'Branch',
        'Year',
        'Semester',
        'Working Days',
        'Present Days',
        'Absent Days',
        'Holidays',
        'Unmarked Days',
        'Attendance Percentage'
      ];

      const attendanceRows = [headerRow];
      attendanceReportData.students.forEach((student) => {
        attendanceRows.push([
          student.pinNumber || '',
          student.studentName || '',
          student.admissionNumber || '',
          student.batch || '',
          student.course || '',
          student.branch || '',
          student.year || '',
          student.semester || '',
          student.statistics.workingDays,
          student.statistics.presentDays,
          student.statistics.absentDays,
          student.statistics.holidays,
          student.statistics.unmarkedDays,
          `${student.statistics.attendancePercentage.toFixed(2)}%`
        ]);
      });

      const attendanceSheet = xlsx.utils.aoa_to_sheet(attendanceRows);
      xlsx.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance Details');

      // Generate buffer
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const url = window.URL.createObjectURL(new Blob([buffer]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${attendanceReportData.fromDate}_to_${attendanceReportData.toDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Failed to generate Excel:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadReport({ ...filters, page: newPage });
    }
  };

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
      if (field === 'college') {
        delete newFilters.course;
        delete newFilters.branch;
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'batch') {
        delete newFilters.course;
        delete newFilters.branch;
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'course') {
        delete newFilters.branch;
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'branch') {
        delete newFilters.year;
        delete newFilters.semester;
      } else if (field === 'year') {
        delete newFilters.semester;
      }

      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({
      college: '',
      batch: '',
      course: '',
      branch: '',
      year: '',
      semester: '',
      search: ''
    });
    setSearchTerm('');
  };

  const activeFilterEntries = useMemo(() => {
    const entries = [];
    if (filters.college) entries.push({ key: 'college', label: `College: ${filters.college}` });
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

  // Transform stats for charts
  const overviewChartData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: 'Verification',
        completed: stats.verification?.completed || 0,
        pending: stats.verification?.pending || 0
      },
      {
        name: 'Certificates',
        completed: stats.certificates?.verified || 0,
        pending: stats.certificates?.pending || 0
      },
      {
        name: 'Fees',
        completed: stats.fees?.cleared || 0,
        pending: stats.fees?.pending || 0
      },
      {
        name: 'Promotion',
        completed: stats.promotion?.completed || 0,
        pending: stats.promotion?.pending || 0
      },
      {
        name: 'Scholarship',
        completed: stats.scholarship?.assigned || 0,
        pending: stats.scholarship?.pending || 0
      }
    ];
  }, [stats]);


  // Chart Data Helpers
  const renderSingleStageChart = (stageName, completed, pending, colors = ['#10B981', '#EF4444']) => {
    const data = [
      { name: 'Completed', value: completed },
      { name: 'Pending', value: pending }
    ];
    // Don't render if no data
    if (completed === 0 && pending === 0) return null;

    return (
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center h-full">
        <h3 className="text-xs font-semibold text-gray-700 mb-1">{stageName}</h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-2 text-[10px] mt-1">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: colors[0] }}></div>
            <span className="text-gray-600">{completed}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: colors[1] }}></div>
            <span className="text-gray-600">{pending}</span>
          </div>
        </div>
      </div>
    );
  };

  const StatsGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 flex-shrink-0">
      <div className="bg-blue-50 p-2 md:p-3 rounded-lg border border-blue-100">
        <div className="text-[10px] md:text-xs text-blue-600 uppercase font-semibold">Total</div>
        <div className="text-lg md:text-xl font-bold text-blue-900">{stats?.total || 0}</div>
      </div>
      <div className="bg-gray-50 p-2 md:p-3 rounded-lg border border-gray-100">
        <div className="text-[10px] md:text-xs text-gray-600 uppercase font-semibold">Registration</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.registration?.completed || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.registration?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-yellow-50 p-2 md:p-3 rounded-lg border border-yellow-100">
        <div className="text-[10px] md:text-xs text-yellow-600 uppercase font-semibold">Verification</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.verification?.completed || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.verification?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-purple-50 p-2 md:p-3 rounded-lg border border-purple-100">
        <div className="text-[10px] md:text-xs text-purple-600 uppercase font-semibold">Certificates</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.certificates?.verified || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.certificates?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-green-50 p-2 md:p-3 rounded-lg border border-green-100">
        <div className="text-[10px] md:text-xs text-green-600 uppercase font-semibold">Fees</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.fees?.cleared || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.fees?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-indigo-50 p-2 md:p-3 rounded-lg border border-indigo-100">
        <div className="text-[10px] md:text-xs text-indigo-600 uppercase font-semibold">Promotion</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.promotion?.completed || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.promotion?.pending || 0}</span>
        </div>
      </div>
      <div className="bg-pink-50 p-2 md:p-3 rounded-lg border border-pink-100">
        <div className="text-[10px] md:text-xs text-pink-600 uppercase font-semibold">Scholarship</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-green-600">{stats?.scholarship?.assigned || 0}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-sm font-bold text-red-500">{stats?.scholarship?.pending || 0}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full h-full overflow-hidden">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between flex-shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <FileText size={32} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 heading-font">
                    {reportType === 'registration' ? 'Registration Reports' : 'Attendance Reports'}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {reportType === 'registration' 
                      ? 'Track student registration status across the 5 stages.'
                      : 'View and analyze student attendance with percentage calculations.'}
                  </p>
                </div>
                {/* Today/Range Tabs and Calendar - Only for Attendance Reports */}
                {reportType === 'attendance' && (
                  <>
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => {
                          setAttendanceDateMode('today');
                          const today = new Date().toISOString().split('T')[0];
                          setAttendanceDateRange({ fromDate: today, toDate: today });
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                          attendanceDateMode === 'today'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setAttendanceDateMode('range')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                          attendanceDateMode === 'range'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Range
                      </button>
                    </div>
                    <button
                      onClick={() => setCalendarModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                      title="View Calendar"
                    >
                      <CalendarDays size={18} />
                      Calendar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Registration Report Tabs - Only show when registration is selected */}
            {reportType === 'registration' && (
              <div className='flex bg-gray-100 p-1 rounded-lg mr-2'>
                <button
                  onClick={() => setActiveTab('abstract')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'abstract'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Abstract
                </button>
                <button
                  onClick={() => setActiveTab('sheet')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'sheet'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Sheets
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'analytics'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Graphs
                </button>
              </div>
            )}




            {reportType === 'registration' && (
              <>
                <button
                  onClick={() => loadReport(filters)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  {loading ? <span className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={16} />}
                  Refresh
                </button>
                <button
                  onClick={() => setDownloadModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Download
                </button>
              </>
            )}
          </div>
        </header>

      {/* Filters Section - Only for Registration Reports */}
      {reportType === 'registration' && (
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex-shrink-0">
          {/* Filters and Actions Row */}
          <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 w-full">


            {/* College */}
            <select
              value={filters.college || ''}
              onChange={(e) => handleFilterChange('college', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Colleges</option>
              {filterOptions.colleges.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>

            {/* Batch */}
            <select
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {(filterOptions.batches || []).map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>

            {/* Course */}
            <select
              value={filters.course || ''}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courses</option>
              {(filterOptions.courses || [])
                .map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
            </select>

            {/* Branch */}
            <select
              value={filters.branch || ''}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {(filterOptions.branches || []).map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>

            {/* Year */}
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  Year {year}
                </option>
              ))}
            </select>

            {/* Semester */}
            <select
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sems</option>
              {availableSemesters.map((semester) => (
                <option key={semester} value={String(semester)}>
                  Sem {semester}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
            >
              <XCircle size={16} />
              Clear
            </button>
          )}
        </div>
      </section>
      )}

      {/* Abstract View */}
      {reportType === 'registration' && activeTab === 'abstract' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 gap-4">
          {/* Stats Grid - Shared */}
          {stats && (
            <div className="flex-shrink-0">
              <StatsGrid />
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500" >
              <RefreshCw className="animate-spin" size={24} />
              Loading abstract data...
            </div>
          ) : abstractData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <AlertCircle size={32} />
              <p>No summary data found matching current filters.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Batch</th>

                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Course</th>
                      <th className="px-4 py-3 bg-gray-50 max-w-[200px] whitespace-normal">Branch</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Year</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Sem</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center">Total Students</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center">Overall Completed</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center">Pending</th>
                      {/* Removed Completion % */}
                      {/* Detailed Breakdowns - Unified (No border-l) */}
                      <th className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">Verification</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">Certificates</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">Fees</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">Promotion</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">Scholarship</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {abstractData.map((row, idx) => {
                      const total = parseInt(row.total || 0);
                      const completed = parseInt(row.overall_completed || 0);
                      const pending = total - completed;

                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-700">{row.batch || '-'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{row.course || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{row.branch || '-'}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{row.current_year || '-'}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{row.current_semester || '-'}</td>
                          <td className="px-4 py-3 text-center font-semibold">{total}</td>
                          <td className="px-4 py-3 text-center text-green-600 font-medium">{completed}</td>
                          <td className="px-4 py-3 text-center text-red-500 font-medium">{pending}</td>
                          {/* Removed Completion % Cell */}

                          {/* Breakdown Columns - Matches Header */}
                          <td className="px-4 py-3 text-center text-gray-600">
                            <div className="text-xs">
                              <span className="text-green-600 font-medium">{row.verification_completed}</span> / <span className="text-red-400">{total - row.verification_completed}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            <div className="text-xs">
                              <span className="text-green-600 font-medium">{row.certificates_verified}</span> / <span className="text-red-400">{total - row.certificates_verified}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            <div className="text-xs">
                              <span className="text-green-600 font-medium">{row.fee_cleared}</span> / <span className="text-red-400">{total - row.fee_cleared}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            <div className="text-xs">
                              <span className="text-green-600 font-medium">{row.promotion_completed}</span> / <span className="text-red-400">{total - row.promotion_completed}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            <div className="text-xs">
                              <span className="text-green-600 font-medium">{row.scholarship_assigned}</span> / <span className="text-red-400">{total - row.scholarship_assigned}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200 sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    {/* Grand Total Row */}
                    {abstractData.length > 0 && (
                      <tr>
                        <td className="px-4 py-3" colSpan={5}>Total</td>
                        <td className="px-4 py-3 text-center">{abstractData.reduce((acc, r) => acc + parseInt(r.total || 0), 0)}</td>
                        <td className="px-4 py-3 text-center text-green-700">{abstractData.reduce((acc, r) => acc + parseInt(r.overall_completed || 0), 0)}</td>
                        <td className="px-4 py-3 text-center text-red-600">{
                          abstractData.reduce((acc, r) => acc + (parseInt(r.total || 0) - parseInt(r.overall_completed || 0)), 0)
                        }</td>
                        {/* Removed % Total Cell */}
                        <td className="px-4 py-3 text-center">
                          {abstractData.reduce((acc, r) => acc + parseInt(r.verification_completed || 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {abstractData.reduce((acc, r) => acc + parseInt(r.certificates_verified || 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {abstractData.reduce((acc, r) => acc + parseInt(r.fee_cleared || 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {abstractData.reduce((acc, r) => acc + parseInt(r.promotion_completed || 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {abstractData.reduce((acc, r) => acc + parseInt(r.scholarship_assigned || 0), 0)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics View */}
      {reportType === 'registration' && activeTab === 'analytics' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-4 animate-in fade-in duration-300">
          {stats && <StatsGrid />}

          {stats && (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              {/* Overview Charts (Bar + Line) */}
              <div className="h-80 shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bar Chart */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex-shrink-0">Stage-wise Overview</h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overviewChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="completed" fill="#10B981" name="Completed" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pending" fill="#EF4444" name="Pending" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 flex-shrink-0">Stage-wise Trends</h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="Completed" dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="pending" stroke="#EF4444" strokeWidth={2} name="Pending" dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Detailed Pie Charts Grid - Strip at bottom */}
              <div className="h-48 shrink-0 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {renderSingleStageChart('Verification', stats.verification?.completed || 0, stats.verification?.pending || 0, ['#EAB308', '#FCA5A5'])}
                {renderSingleStageChart('Certificates', stats.certificates?.verified || 0, stats.certificates?.pending || 0, ['#A855F7', '#FCA5A5'])}
                {renderSingleStageChart('Fees', stats.fees?.cleared || 0, stats.fees?.pending || 0, ['#22C55E', '#FCA5A5'])}
                {renderSingleStageChart('Promotion', stats.promotion?.completed || 0, stats.promotion?.pending || 0, ['#6366F1', '#FCA5A5'])}
                {renderSingleStageChart('Scholarship', stats.scholarship?.assigned || 0, stats.scholarship?.pending || 0, ['#EC4899', '#FCA5A5'])}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sheets View */}
      {reportType === 'registration' && activeTab === 'sheet' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 gap-4">

          {/* Stats Grid - Fixed at top of Sheets view */}
          <div className="flex-shrink-0">
            {stats && <StatsGrid />}
          </div>

          {/* Table Area - Grows to fill remaining space */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500" >
              <RefreshCw className="animate-spin" size={24} />
              Loading report data...
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <AlertCircle size={32} />
              <p>No students found matching current filters.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Scrollable Table Body */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left relative">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Pin No</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Student Name</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Course</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Branch</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Year</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Sem</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Registration Status</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Information Verification</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Certificates</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Fees</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Promotion</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Scholarship</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{student.pin_no}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>
                            <div className="font-medium">{student.student_name}</div>
                            <div className="text-xs text-gray-500">{student.admission_number}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{student.course}</td>
                        <td className="px-4 py-3 text-gray-600">{student.branch}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{student.current_year}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{student.current_semester}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={student.overall_status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <StatusBadge status={student.stages.verification} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <StatusBadge status={student.stages.certificates} type="text" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <StatusBadge status={student.stages.fee} type="text" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <StatusBadge status={student.stages.promotion} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <StatusBadge status={student.stages.scholarship} type="text" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Fixed Footer: Pagination */}
              <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between shadow-[0_-2px_4px_rgba(0,0,0,0.02)] z-20">
                <div className="text-xs text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalRecords)} of {pagination.totalRecords} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                    className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages || loading}
                    className="px-3 py-1 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance Reports View */}
      {reportType === 'attendance' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 gap-4">
          {/* Back Button (only in detailed view) */}
          {showDetailedView && (
            <button
              onClick={() => {
                setShowDetailedView(false);
                setSelectedBranchForDrillDown(null);
                setAttendanceFilters(prev => ({
                  ...prev,
                  college: '',
                  batch: '',
                  branch: '',
                  year: '',
                  semester: ''
                }));
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors self-start"
            >
              <ArrowLeft size={18} />
              Back to Summary
            </button>
          )}

          {/* Filters Section */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-10 gap-3">
                {/* Date Range - Only show in range mode */}
                {attendanceDateMode === 'range' && (
                  <div className="col-span-2 flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
                      <input
                        type="date"
                        value={attendanceDateRange.fromDate}
                        onChange={(e) => setAttendanceDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
                      <input
                        type="date"
                        value={attendanceDateRange.toDate}
                        onChange={(e) => setAttendanceDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* College */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">College</label>
                  <select
                    value={attendanceFilters.college || ''}
                    onChange={(e) => setAttendanceFilters(prev => ({ ...prev, college: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Colleges</option>
                    {filterOptions.colleges.map((college) => (
                      <option key={college} value={college}>
                        {college}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch</label>
                  <select
                    value={attendanceFilters.batch || ''}
                    onChange={(e) => setAttendanceFilters(prev => ({ ...prev, batch: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Batches</option>
                    {(filterOptions.batches || []).map((batch) => (
                      <option key={batch} value={batch}>
                        {batch}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Course */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Course</label>
                  <select
                    value={attendanceFilters.course || ''}
                    onChange={(e) => setAttendanceFilters(prev => ({ ...prev, course: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Courses</option>
                    {(filterOptions.courses || []).map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={attendanceFilters.branch || ''}
                    onChange={(e) => setAttendanceFilters(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Branches</option>
                    {(filterOptions.branches || []).map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={attendanceFilters.year || ''}
                    onChange={(e) => setAttendanceFilters(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Years</option>
                    {availableYears.map((year) => (
                      <option key={year} value={String(year)}>
                        Year {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={attendanceFilters.semester || ''}
                    onChange={(e) => setAttendanceFilters(prev => ({ ...prev, semester: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Sems</option>
                    {availableSemesters.map((semester) => (
                      <option key={semester} value={String(semester)}>
                        Sem {semester}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Download Buttons - Inline with filters (only in detailed view) */}
                {showDetailedView && attendanceReportData && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">&nbsp;</label>
                      <button
                        onClick={downloadAttendancePDF}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
                      >
                        <Download size={16} />
                        PDF
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">&nbsp;</label>
                      <button
                        onClick={downloadAttendanceExcel}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium transition-colors"
                      >
                        <Download size={16} />
                        Excel
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Loading Indicator */}
              {(showDetailedView ? attendanceLoading : attendanceAbstractLoading) && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Loading report...
                </div>
              )}
            </div>
          </section>

          {/* Abstract View (Default) */}
          {!showDetailedView && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 gap-4">
              {attendanceAbstractLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
                  <RefreshCw className="animate-spin" size={24} />
                  Loading abstract data...
                </div>
              ) : attendanceAbstractData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
                  <AlertCircle size={32} />
                  <p>No summary data found matching current filters.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left relative">
                      <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 whitespace-nowrap bg-gray-50">College</th>
                          <th className="px-4 py-3 whitespace-nowrap bg-gray-50">Batch</th>
                          <th className="px-4 py-3 bg-gray-50 max-w-[200px] whitespace-normal">Branch</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Year</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Sem</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Total Students</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-gray-50">Working Days</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-green-50">Present %</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-red-50">Absent %</th>
                          <th className="px-4 py-3 whitespace-nowrap text-center bg-blue-50">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {attendanceAbstractData.map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => handleBranchDrillDown(row)}
                            className="hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3 text-gray-700">{row.college || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{row.batch || '-'}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{row.branch || '-'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.year || '-'}</td>
                            <td className="px-4 py-3 text-center text-gray-700">{row.semester || '-'}</td>
                            <td className="px-4 py-3 text-center font-semibold">{row.totalStudents || 0}</td>
                            <td className="px-4 py-3 text-center font-semibold">{row.workingDays || 0}</td>
                            <td className="px-4 py-3 text-center text-green-600 font-medium">
                              {row.presentPercentage?.toFixed(2) || '0.00'}%
                            </td>
                            <td className="px-4 py-3 text-center text-red-500 font-medium">
                              {row.absentPercentage?.toFixed(2) || '0.00'}%
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                row.attendancePercentage >= 75
                                  ? 'bg-green-100 text-green-800 border border-green-300'
                                  : row.attendancePercentage >= 60
                                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                    : 'bg-red-100 text-red-800 border border-red-300'
                              }`}>
                                {row.attendancePercentage?.toFixed(2) || '0.00'}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200 sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                        {attendanceAbstractData.length > 0 && (
                          <tr>
                            <td className="px-4 py-3" colSpan={5}>Total</td>
                            <td className="px-4 py-3 text-center">
                              {attendanceAbstractData.reduce((sum, row) => sum + (row.totalStudents || 0), 0)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {attendanceAbstractData[0]?.workingDays || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-green-600">
                              {(() => {
                                const totalPresent = attendanceAbstractData.reduce((sum, row) => sum + (row.totalPresentDays || 0), 0);
                                const totalStudents = attendanceAbstractData.reduce((sum, row) => sum + (row.totalStudents || 0), 0);
                                const workingDays = attendanceAbstractData[0]?.workingDays || 0;
                                return workingDays > 0 && totalStudents > 0
                                  ? ((totalPresent / (totalStudents * workingDays)) * 100).toFixed(2)
                                  : '0.00';
                              })()}%
                            </td>
                            <td className="px-4 py-3 text-center text-red-500">
                              {(() => {
                                const totalAbsent = attendanceAbstractData.reduce((sum, row) => sum + (row.totalAbsentDays || 0), 0);
                                const totalStudents = attendanceAbstractData.reduce((sum, row) => sum + (row.totalStudents || 0), 0);
                                const workingDays = attendanceAbstractData[0]?.workingDays || 0;
                                return workingDays > 0 && totalStudents > 0
                                  ? ((totalAbsent / (totalStudents * workingDays)) * 100).toFixed(2)
                                  : '0.00';
                              })()}%
                            </td>
                            <td className="px-4 py-3 text-center">
                              {(() => {
                                const totalPresent = attendanceAbstractData.reduce((sum, row) => sum + (row.totalPresentDays || 0), 0);
                                const totalStudents = attendanceAbstractData.reduce((sum, row) => sum + (row.totalStudents || 0), 0);
                                const workingDays = attendanceAbstractData[0]?.workingDays || 0;
                                const overallPercentage = workingDays > 0 && totalStudents > 0
                                  ? (totalPresent / (totalStudents * workingDays)) * 100
                                  : 0;
                                return (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    overallPercentage >= 75
                                      ? 'bg-green-100 text-green-800 border border-green-300'
                                      : overallPercentage >= 60
                                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                        : 'bg-red-100 text-red-800 border border-red-300'
                                  }`}>
                                    {overallPercentage.toFixed(2)}%
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed View (After drill-down) */}
          {showDetailedView && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 gap-4">
              {/* Search Student - Only in detailed view */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search students by name, PIN, or admission number..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
              {/* Statistics Cards */}
              {attendanceReportData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="text-xs text-blue-600 uppercase font-semibold">Total Students</div>
                <div className="text-lg font-bold text-blue-900">{attendanceReportData.statistics.totalStudents}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-600 uppercase font-semibold">Working Days</div>
                <div className="text-lg font-bold text-gray-900">{attendanceReportData.statistics.totalWorkingDays}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                <div className="text-xs text-green-600 uppercase font-semibold">Present Students %</div>
                <div className="text-lg font-bold text-green-900">
                  {attendanceReportData.statistics.presentStudentsPercentage?.toFixed(2) || '0.00'}%
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                <div className="text-xs text-red-600 uppercase font-semibold">Absent Students %</div>
                <div className="text-lg font-bold text-red-900">
                  {attendanceReportData.statistics.absentStudentsPercentage?.toFixed(2) || '0.00'}%
                </div>
              </div>
            </div>
          )}

          {/* Report Table */}
          {attendanceLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <RefreshCw className="animate-spin" size={24} />
              Loading attendance report...
            </div>
          ) : attendanceReportData && attendanceReportData.students.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">PIN No</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Student Name</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Admission No</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Batch</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Course</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Branch</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Year</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">Sem</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 bg-blue-50">Working Days</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 bg-green-50">Present %</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 bg-red-50">Absent %</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-purple-50">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceReportData.students
                      .filter(student => {
                        if (!studentSearchQuery) return true;
                        const query = studentSearchQuery.toLowerCase();
                        return (
                          (student.studentName || '').toLowerCase().includes(query) ||
                          (student.pinNumber || '').toLowerCase().includes(query) ||
                          (student.admissionNumber || '').toLowerCase().includes(query)
                        );
                      })
                      .map((student, index) => (
                      <tr 
                        key={student.id} 
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowStudentModal(true);
                        }}
                        className={`hover:bg-blue-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900 border-r border-gray-100">{student.pinNumber || '-'}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium border-r border-gray-100">{student.studentName || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 border-r border-gray-100">{student.admissionNumber || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 border-r border-gray-100">{student.batch || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 border-r border-gray-100">{student.course || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 border-r border-gray-100">{student.branch || '-'}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium border-r border-gray-100">{student.year || '-'}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium border-r border-gray-100">{student.semester || '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/50 border-r border-gray-100">{student.statistics.workingDays}</td>
                        <td className="px-4 py-3 text-center font-bold bg-green-50/50 border-r border-gray-100">
                          <span className="text-green-700">
                            {student.statistics.workingDays > 0 
                              ? ((student.statistics.presentDays / student.statistics.workingDays) * 100).toFixed(2)
                              : '0.00'}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold bg-red-50/50 border-r border-gray-100">
                          <span className="text-red-700">
                            {student.statistics.workingDays > 0 
                              ? ((student.statistics.absentDays / student.statistics.workingDays) * 100).toFixed(2)
                              : '0.00'}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold bg-purple-50/50">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            student.statistics.attendancePercentage >= 75 
                              ? 'bg-green-100 text-green-800 border border-green-300' 
                              : student.statistics.attendancePercentage >= 60 
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                                : 'bg-red-100 text-red-800 border border-red-300'
                          }`}>
                            {student.statistics.attendancePercentage.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {attendanceReportData.students.length > 0 && (
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                      <tr>
                        <td colSpan="8" className="px-4 py-3 text-right text-gray-700">Total:</td>
                        <td className="px-4 py-3 text-center text-blue-700 bg-blue-100 border-r border-gray-200">
                          {attendanceReportData.statistics.totalWorkingDays}
                        </td>
                        <td className="px-4 py-3 text-center text-green-700 bg-green-100 border-r border-gray-200">
                          {attendanceReportData.statistics.presentStudentsPercentage?.toFixed(2) || '0.00'}%
                        </td>
                        <td className="px-4 py-3 text-center text-red-700 bg-red-100 border-r border-gray-200">
                          {attendanceReportData.statistics.absentStudentsPercentage?.toFixed(2) || '0.00'}%
                        </td>
                        <td className="px-4 py-3 text-center text-purple-700 bg-purple-100">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-200 text-purple-900 border border-purple-300">
                            {attendanceReportData.statistics.overallAttendancePercentage.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : attendanceReportData && attendanceReportData.students.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <AlertCircle size={32} />
              <p>No students found matching the selected criteria.</p>
            </div>
          ) : null}
            </div>
          )}
        </div>
      )}

      <RegistrationDownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        initialFilters={filters}
        filterOptions={filterOptions}
      />

      {/* Student Detail Modal */}
      {showStudentModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowStudentModal(false);
                    setSelectedStudent(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                  <User size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedStudent.studentName || 'Student Details'}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedStudent.pinNumber || selectedStudent.admissionNumber || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowStudentModal(false);
                  setSelectedStudent(null);
                }}
                className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Student Information */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">PIN Number</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.pinNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Admission Number</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.admissionNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Batch</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.batch || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Course</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.course || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Branch</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.branch || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Year</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.year || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Semester</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedStudent.semester || '-'}</p>
                </div>
              </div>

              {/* Attendance Statistics */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Attendance Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-xs text-blue-600 uppercase font-semibold">Working Days</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">{selectedStudent.statistics?.workingDays || 0}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <div className="text-xs text-green-600 uppercase font-semibold">Present Days</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">{selectedStudent.statistics?.presentDays || 0}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <div className="text-xs text-red-600 uppercase font-semibold">Absent Days</div>
                    <div className="text-2xl font-bold text-red-900 mt-1">{selectedStudent.statistics?.absentDays || 0}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <div className="text-xs text-purple-600 uppercase font-semibold">Attendance %</div>
                    <div className="text-2xl font-bold text-purple-900 mt-1">
                      {selectedStudent.statistics?.attendancePercentage?.toFixed(2) || '0.00'}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Range Info */}
              {attendanceReportData && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Report Period:</span> {attendanceReportData.fromDate} to {attendanceReportData.toDate}
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setShowStudentModal(false);
                  setSelectedStudent(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {calendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Attendance Calendar</h2>
                  <p className="text-sm text-gray-500">
                    View working days and holidays for the selected period.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalendarModalOpen(false)}
                className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close calendar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {calendarLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <RefreshCw className="animate-spin" size={24} />
                    <p>Loading calendar data...</p>
                  </div>
                </div>
              ) : (
                <CalendarWidget
                  monthKey={(() => {
                    const date = calendarAttendanceData?.fromDate || attendanceReportData?.fromDate
                      ? new Date(calendarAttendanceData?.fromDate || attendanceReportData.fromDate)
                      : new Date(attendanceDateRange.fromDate);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  })()}
                  onMonthChange={(monthKey) => {
                    const [year, month] = monthKey.split('-');
                    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
                    const lastDay = new Date(parseInt(year), parseInt(month), 0);
                    setAttendanceDateRange({
                      fromDate: firstDay.toISOString().split('T')[0],
                      toDate: lastDay.toISOString().split('T')[0]
                    });
                  }}
                  calendarData={{
                    sundays: [],
                    publicHolidays: ((calendarAttendanceData || attendanceReportData)?.holidayInfo?.details || [])
                      .filter(h => h.type === 'public' || !h.type)
                      .map(h => ({ date: h.date, name: h.name || h.title || 'Holiday' })),
                    customHolidays: ((calendarAttendanceData || attendanceReportData)?.holidayInfo?.details || [])
                      .filter(h => h.type === 'custom')
                      .map(h => ({ date: h.date, title: h.title || h.name || 'Holiday' })),
                    attendanceStatus: (() => {
                      // Use calendarAttendanceData if available, otherwise fall back to attendanceReportData
                      const dataSource = calendarAttendanceData || attendanceReportData;
                      const statusMap = {};
                      if (dataSource?.dates && dataSource?.students) {
                        dataSource.dates.forEach(date => {
                          const holidayDates = new Set(dataSource.holidayInfo?.dates || []);
                          if (!holidayDates.has(date)) {
                            // Check if any student has attendance for this date
                            const hasAttendance = dataSource.students.some(student => 
                              student.attendance && student.attendance[date]
                            );
                            if (hasAttendance) {
                              statusMap[date] = 'present'; // Marked day
                            } else {
                              statusMap[date] = 'absent'; // Unmarked day (shown as red)
                            }
                          }
                        });
                      }
                      return statusMap;
                    })()
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;
