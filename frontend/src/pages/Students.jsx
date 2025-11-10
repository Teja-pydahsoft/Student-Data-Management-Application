import React, { useState, useEffect } from 'react';
import {
  Search,
  Eye,
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
  Settings,
  ToggleLeft,
  ToggleRight,
  ArrowUpCircle
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api, { getStaticFileUrlDirect } from '../config/api';
import toast from 'react-hot-toast';
import BulkRollNumberModal from '../components/BulkRollNumberModal';
import BulkUploadModal from '../components/BulkUploadModal';
import ManualRollNumberModal from '../components/ManualRollNumberModal';
import LoadingAnimation from '../components/LoadingAnimation';
import PromoteStudentModal from '../components/Students/PromoteStudentModal';
import { formatDate } from '../utils/dateUtils';

const Students = () => {
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [availableFields, setAvailableFields] = useState([]);
  const [showBulkRollNumber, setShowBulkRollNumber] = useState(false);
  const [showManualRollNumber, setShowManualRollNumber] = useState(false);
  const [showBulkStudentUpload, setShowBulkStudentUpload] = useState(false);
  const [editingRollNumber, setEditingRollNumber] = useState(false);
  const [tempRollNumber, setTempRollNumber] = useState('');
  const [completionPercentages, setCompletionPercentages] = useState({});
  const [showFilterManagement, setShowFilterManagement] = useState(false);
  const [availableFilterFields, setAvailableFilterFields] = useState([]);
  const [loadingFilterFields, setLoadingFilterFields] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [studentToPromote, setStudentToPromote] = useState(null);
  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const openPromoteModal = (student) => {
    setStudentToPromote(student);
    setShowPromoteModal(true);
  };

  const handlePromotionComplete = (promotionData) => {
    if (!promotionData?.admissionNumber) return;

    setStudents((prevStudents) =>
      prevStudents.map((student) => {
        if (student.admission_number !== promotionData.admissionNumber) {
          return student;
        }

        const updatedStudentData = syncStageFields(
          student.student_data || {},
          promotionData.currentYear,
          promotionData.currentSemester
        );

        return {
          ...student,
          current_year: promotionData.currentYear,
          current_semester: promotionData.currentSemester,
          student_data: updatedStudentData
        };
      })
    );

    if (selectedStudent && selectedStudent.admission_number === promotionData.admissionNumber) {
      const updatedSelected = {
        ...selectedStudent,
        current_year: promotionData.currentYear,
        current_semester: promotionData.currentSemester,
        student_data: syncStageFields(
          selectedStudent.student_data || {},
          promotionData.currentYear,
          promotionData.currentSemester
        )
      };
      setSelectedStudent(updatedSelected);
      setEditData(updatedSelected.student_data);
    }
  };

  useEffect(() => {
    const newStudent = location.state?.newStudent;
    if (newStudent) {
      // Add the new student to state without fetching
      setStudents(prev => [newStudent, ...prev]);
      // Fetch completion percentage for the new student
      getStudentCompletionPercentage(newStudent.admission_number).then(percentage => {
        setCompletionPercentages(prev => ({
          ...prev,
          [newStudent.admission_number]: percentage
        }));
      });
      // Clear the state to avoid re-adding on re-renders
      window.history.replaceState({}, document.title);
    } else {
      fetchStudents();
    }
  }, [location.state]);

  // Calculate stats when students are loaded
  useEffect(() => {
    calculateOverallStats();
  }, [students]);

  // Fetch filter fields when component mounts to ensure proper filter management
  useEffect(() => {
    fetchFilterFields();
  }, []);

  // Real-time filtering effect with server-side filtering
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      applyFilters();
    }, 300); // Debounce API calls

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, filters]);

  // Fetch completion percentages when students are loaded (in parallel)
  useEffect(() => {
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

  useEffect(() => {
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

  useEffect(() => {
    // Extract available fields and their unique values from current students data
    // This now works with filtered data since we're doing server-side filtering
    if (students.length > 0) {
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

      const fieldsArray = Object.entries(fieldsMap)
        .filter(([key, values]) => values.size >= 2 && values.size <= 10)
        .map(([key, values]) => ({
          name: key,
          values: Array.from(values).sort()
        }));

      setAvailableFields(fieldsArray);
    }
  }, [students]);

  const fetchStudents = async (filterParams = {}) => {
    setLoading(true);
    try {
      // Build query parameters for server-side filtering
      const queryParams = new URLSearchParams();

      // Add filter parameters if they exist
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value);
        }
      });

      // Add search term if exists
      if (searchTerm && searchTerm.trim()) {
        queryParams.append('search', searchTerm.trim());
      }

      // Make API call with filters
      const response = await api.get(`/students?${queryParams.toString()}`);
      setStudents(response.data.data);

    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

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
    // Build filter parameters for API call
    const filterParams = {};

    // Add date filters
    if (filters.dateFrom) filterParams.filter_dateFrom = filters.dateFrom;
    if (filters.dateTo) filterParams.filter_dateTo = filters.dateTo;

    // Add PIN status filter
    if (filters.pinNumberStatus) filterParams.filter_pinNumberStatus = filters.pinNumberStatus;
    if (filters.year) filterParams.filter_year = filters.year;
    if (filters.semester) filterParams.filter_semester = filters.semester;

    // Add dynamic field filters
    Object.entries(filters).forEach(([key, value]) => {
      if (key.startsWith('field_') && value) {
        const fieldName = key.replace('field_', '');
        filterParams[`filter_field_${fieldName}`] = value;
      }
    });

    // Fetch filtered data from server
    fetchStudents(filterParams);
  };

  // Legacy function for backward compatibility - now uses server-side filtering
  const handleLocalSearch = () => {
    applyFilters();
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    fetchStudents(); // Fetch unfiltered data from server
  };


  // Fetch available filter fields for admin management
  const fetchFilterFields = async () => {
    setLoadingFilterFields(true);
    try {
      const response = await api.get('/students/filter-fields');
      if (response.data.success) {
        setAvailableFilterFields(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch filter fields');
    } finally {
      setLoadingFilterFields(false);
    }
  };

  // Toggle filter field enabled/disabled status
  const toggleFilterField = async (fieldName, enabled) => {
    try {
      const response = await api.put(`/students/filter-fields/${fieldName}`, {
        enabled,
        type: 'text',
        required: false,
        options: []
      });

      if (response.data.success) {
        toast.success(`Filter field ${enabled ? 'enabled' : 'disabled'} successfully`);

        // If disabling a field, remove it from active filters
        if (!enabled) {
          setFilters(prev => {
            const updated = { ...prev };
            // Remove the field filter if it exists
            delete updated[`field_${fieldName}`];
            return updated;
          });

          // Re-apply filters to update the students list immediately
          setTimeout(() => {
            applyFilters();
          }, 100);
        }

        fetchFilterFields(); // Refresh the list
      }
    } catch (error) {
      toast.error('Failed to update filter field');
    }
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

      await api.put(`/students/${selectedStudent.admission_number}`, {
        studentData: synchronizedData,
      });

      console.log('Save successful');
      toast.success('Student data updated successfully');
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

      // Update local state instead of refetching all data
      setStudents(prevStudents =>
        prevStudents.map(student =>
          student.admission_number === selectedStudent.admission_number
            ? {
                ...student,
                current_year:
                  synchronizedData.current_year || student.current_year,
                current_semester:
                  synchronizedData.current_semester || student.current_semester,
                student_data: synchronizedData
              }
            : student
        )
      );

      // Update completion percentage for the updated student
      const updatedPercentage = await getStudentCompletionPercentage(selectedStudent.admission_number);
      setCompletionPercentages(prev => ({
        ...prev,
        [selectedStudent.admission_number]: updatedPercentage
      }));

    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to update student data');
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
      await api.delete(`/students/${admissionNumber}`);
      toast.success('Student deleted successfully');

      // Update local state instead of refetching all data
      setStudents(prevStudents =>
        prevStudents.filter(student => student.admission_number !== admissionNumber)
      );

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

    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0 || bulkDeleting) {
      return;
    }

    if (!window.confirm(`Delete ${selectedCount} selected student${selectedCount === 1 ? '' : 's'}? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    const admissionNumbers = Array.from(selectedAdmissionNumbers);

    try {
      const response = await api.post('/students/bulk-delete', { admissionNumbers });
      const deletedCount = response.data?.deletedCount || 0;
      const notFound = response.data?.notFound || [];
      const deletedAdmissions = Array.isArray(response.data?.deletedAdmissionNumbers)
        ? response.data.deletedAdmissionNumbers
        : admissionNumbers.filter((number) => !notFound.includes(number));
      const deletedSet = new Set(deletedAdmissions);

      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} student${deletedCount === 1 ? '' : 's'} successfully`);
      }

      if (notFound.length > 0) {
        toast.error(`${notFound.length} admission number${notFound.length === 1 ? '' : 's'} not found`);
      }

      if (deletedCount > 0) {
        setStudents((prevStudents) =>
          prevStudents.filter((student) => !deletedSet.has(student.admission_number))
        );
        setCompletionPercentages((prev) => {
          const updated = { ...prev };
          deletedAdmissions.forEach((number) => {
            delete updated[number];
          });
          return updated;
        });
        setSelectedAdmissionNumbers(new Set());
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete selected students');
    } finally {
      setBulkDeleting(false);
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

  const calculateOverallStats = async () => {
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
  };

  if (loading) {
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
        <div className="flex items-center gap-3">
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
            onClick={() => setShowBulkRollNumber(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-700 to-blue-800 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            <Upload size={18} />
            Bulk Upload PIN CSV
          </button>

          <button
            onClick={handleBulkDelete}
            disabled={selectedCount === 0 || bulkDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-red-600 to-red-700 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={18} />
            {bulkDeleting ? 'Deleting...' : `Delete Selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
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
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-blue-50'}`}>
            <Filter size={18} />
            Filters
          </button>
          <button
            onClick={() => {
              setShowFilterManagement(!showFilterManagement);
              if (!showFilterManagement) {
                fetchFilterFields();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilterManagement ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-blue-50'}`}
            title="Manage Filter Fields"
          >
            <Settings size={18} />
            Filter Settings
          </button>
          <button onClick={handleLocalSearch} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Search
          </button>
        </div>

        {showFilters && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Quick Filters</h3>
              <button onClick={clearFilters} className="text-xs text-gray-700 hover:text-gray-900 flex items-center gap-1">
                <X size={14} />
                Clear All
              </button>
            </div>

            {/* Horizontal Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Date Range Filters */}
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2 border border-blue-200">
                <span className="text-xs font-medium text-blue-700">From:</span>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="px-2 py-1 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2 border border-blue-200">
                <span className="text-xs font-medium text-blue-700">To:</span>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="px-2 py-1 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* PIN Status Filter */}
              <select
                value={filters.pinNumberStatus || ''}
                onChange={(e) => handleFilterChange('pinNumberStatus', e.target.value)}
                className={`px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                  filters.pinNumberStatus ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300'
                }`}
              >
                <option value="">PIN Status: All</option>
                <option value="assigned">With PIN</option>
                <option value="unassigned">Without PIN</option>
              </select>

              <select
                value={filters.year || ''}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className={`px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                  filters.year ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300'
                }`}
              >
                <option value="">Year: All</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>

              <select
                value={filters.semester || ''}
                onChange={(e) => handleFilterChange('semester', e.target.value)}
                className={`px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                  filters.semester ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300'
                }`}
              >
                <option value="">Semester: All</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>

            {/* Dynamic Field Filters - Horizontal Layout */}
            {availableFields.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-900">Filter by Category:</p>
                <div className="flex flex-wrap gap-2">
                  {availableFields
                    .filter(field => {
                      // Only show fields that are enabled in the filter management
                      // If availableFilterFields is not loaded yet, don't show any fields
                      if (availableFilterFields.length === 0) return false;

                      const managedField = availableFilterFields.find(f => f.name === field.name);
                      // Only show if the field is explicitly enabled in filter management
                      return managedField && managedField.enabled;
                    })
                    .map((field) => (
                    <div key={field.name} className="relative">
                      <select
                        value={filters[`field_${field.name}`] || ''}
                        onChange={(e) => handleFilterChange(`field_${field.name}`, e.target.value)}
                        className={`px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[120px] ${
                          filters[`field_${field.name}`] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <option value="">{field.name}: All</option>
                        {field.values.map((value, idx) => (
                          <option key={idx} value={value}>{value}</option>
                        ))}
                      </select>
                      {filters[`field_${field.name}`] && (
                        <button
                          onClick={() => handleFilterChange(`field_${field.name}`, '')}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 text-white rounded-full text-xs hover:bg-gray-800 flex items-center justify-center"
                          title="Clear this filter"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Filters Display */}
            {(searchTerm || Object.values(filters).some(value => value)) && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <span className="font-medium">Active filters (applied to results):</span>
                  <span className="text-xs text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                    {Object.values(filters).filter(value => value).length + (searchTerm ? 1 : 0)} active
                  </span>
                  {searchTerm && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md border border-blue-300 font-medium">
                      Search: "{searchTerm}"
                      <button
                        onClick={() => setSearchTerm('')}
                        className="ml-1 text-blue-600 hover:text-blue-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {Object.entries(filters).map(([key, value]) => {
                    if (value) {
                      let label = '';
                      switch (key) {
                        case 'dateFrom':
                          label = `From: ${value}`;
                          break;
                        case 'dateTo':
                          label = `To: ${value}`;
                          break;
                        case 'pinNumberStatus':
                          label = `PIN: ${value === 'assigned' ? 'With PIN' : 'Without PIN'}`;
                          break;
                        case 'year':
                          label = `Year: ${value}`;
                          break;
                        case 'semester':
                          label = `Semester: ${value}`;
                          break;
                        default:
                          if (key.startsWith('field_')) {
                            const fieldName = key.replace('field_', '');
                            label = `${fieldName}: ${value}`;
                          }
                          break;
                      }
                      return (
                        <span key={key} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md border border-blue-300 font-medium">
                          {label}
                          <button
                            onClick={() => handleFilterChange(key, '')}
                            className="ml-1 text-blue-600 hover:text-blue-900 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Management Modal */}
        {showFilterManagement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Filter Field Management</h3>
                  <p className="text-sm text-gray-500 mt-1">Enable or disable filter fields for the main page</p>
                </div>
                <button
                  onClick={() => setShowFilterManagement(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {loadingFilterFields ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingAnimation width={24} height={24} message="Loading filter fields..." />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableFilterFields.map((field) => (
                      <div key={field.name} className={`rounded-lg p-4 border-2 transition-all ${
                        field.enabled
                          ? 'bg-blue-50 border-blue-200 shadow-sm'
                          : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <label className={`block text-sm font-medium ${
                              field.enabled ? 'text-blue-900' : 'text-gray-500'
                            }`}>
                              {field.name}
                              {field.enabled && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Enabled
                                </span>
                              )}
                              {!field.enabled && (
                                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                  Disabled
                                </span>
                              )}
                            </label>
                            <div className={`text-xs ${field.enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                              Type: {field.type} | Required: {field.required ? 'Yes' : 'No'}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleFilterField(field.name, !field.enabled)}
                            className={`p-2 rounded-lg transition-colors ${
                              field.enabled
                                ? 'text-blue-600 hover:bg-blue-100'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={field.enabled ? 'Disable filter field' : 'Enable filter field'}
                          >
                            {field.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                          </button>
                        </div>
                        {field.options && field.options.length > 0 && (
                          <div className="mt-2">
                            <div className={`text-xs font-medium mb-1 ${field.enabled ? 'text-blue-700' : 'text-gray-500'}`}>
                              Available Options:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {field.options.slice(0, 3).map((option, idx) => (
                                <span key={idx} className={`px-2 py-1 text-xs rounded ${
                                  field.enabled
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {option}
                                </span>
                              ))}
                              {field.options.length > 3 && (
                                <span className={`px-2 py-1 text-xs rounded ${
                                  field.enabled
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  +{field.options.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {availableFilterFields.length === 0 && !loadingFilterFields && (
                  <div className="text-center py-8 text-gray-500">
                    <Settings size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No filter fields available</p>
                    <p className="text-sm">Filter fields are automatically detected from student data</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Completed Profiles</p>
                <p className="text-3xl font-bold text-blue-600">{stats.completed}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% of total
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <CheckCircle className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Average Completion</p>
                <p className="text-3xl font-bold text-blue-600">{stats.averageCompletion}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.averageCompletion}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <TrendingUp className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-600">There are no student records in the database yet.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-center w-12">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      disabled={students.length === 0 || bulkDeleting}
                      checked={isAllSelected}
                      onChange={(e) => toggleSelectAllStudents(e.target.checked)}
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Photo</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Admission Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">PIN Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Year / Semester</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Mobile Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Completion</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created At</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const completionPercentage = completionPercentages[student.admission_number] || 0;
                  return (
                    <tr key={student.admission_number} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                          disabled={bulkDeleting}
                          checked={selectedAdmissionNumbers.has(student.admission_number)}
                          onChange={() => toggleSelectStudent(student.admission_number)}
                        />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
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
                                console.error('Photo failed to load:', student.student_photo);
                                if (e.target && e.target.style) {
                                  e.target.style.display = 'none';
                                }
                                // Find the fallback div and show it
                                const fallbackDiv = e.target && e.target.parentNode ? e.target.parentNode.querySelector('.photo-fallback') : null;
                                if (fallbackDiv) {
                                  fallbackDiv.style.display = 'flex';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center shadow-sm">
                              <span className="text-gray-400 text-xs font-medium">No Photo</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{student.admission_number}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {student.pin_no ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                            {student.pin_no}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium">
                          Year {student.current_year || student.student_data?.current_year || '-'}
                          <span className="w-1 h-1 rounded-full bg-blue-300" />
                          Sem {student.current_semester || student.student_data?.current_semester || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {(() => {
                          const data = student.student_data;
                          if (!data || typeof data !== 'object') {
                            return '-';
                          }
                          const nameField = Object.keys(data).find(key =>
                            key.toLowerCase().includes('name') ||
                            key.toLowerCase().includes('student name') ||
                            key.toLowerCase() === 'name'
                          );
                          return nameField ? data[nameField] : '-';
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {(() => {
                          const data = student.student_data;
                          if (!data || typeof data !== 'object') {
                            return '-';
                          }
                          const mobileField = Object.keys(data).find(key =>
                            key.toLowerCase().includes('mobile') ||
                            key.toLowerCase().includes('phone') ||
                            key.toLowerCase().includes('contact')
                          );
                          return mobileField ? data[mobileField] : '-';
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${completionPercentage >= 80 ? 'bg-blue-600' : completionPercentage >= 50 ? 'bg-blue-400' : 'bg-gray-400'}`}
                              style={{ width: `${completionPercentage}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-medium ${completionPercentage >= 80 ? 'text-blue-600' : completionPercentage >= 50 ? 'text-blue-500' : 'text-gray-600'}`}>
                            {completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(student.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleViewDetails(student)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openPromoteModal(student)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Promote Student"
                          >
                            <ArrowUpCircle size={16} />
                          </button>
                          <button onClick={() => handleDelete(student.admission_number)} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                            <p className="text-sm text-gray-900 break-words font-mono text-xs">
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
        onUpdateComplete={fetchStudents}
      />

      <BulkUploadModal
        isOpen={showBulkStudentUpload}
        onClose={() => setShowBulkStudentUpload(false)}
        forms={forms}
        isLoadingForms={loadingForms}
        onUploadComplete={() => {
          fetchStudents();
        }}
      />

      <ManualRollNumberModal
        isOpen={showManualRollNumber}
        onClose={() => setShowManualRollNumber(false)}
        onUpdateComplete={fetchStudents}
      />

      <PromoteStudentModal
        isOpen={showPromoteModal}
        student={studentToPromote}
        onClose={() => {
          setShowPromoteModal(false);
          setStudentToPromote(null);
        }}
        onPromoted={handlePromotionComplete}
      />
    </div>
  );
};

export default Students;
