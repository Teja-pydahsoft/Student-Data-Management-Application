import React, { useState, useEffect } from 'react';
import { Search, Eye, Edit, Trash2, Download, Filter, Upload, X, UserCog, Plus, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getStaticFileUrlDirect } from '../config/api';
import toast from 'react-hot-toast';
import BulkRollNumberModal from '../components/BulkRollNumberModal';
import ManualRollNumberModal from '../components/ManualRollNumberModal';
import LoadingAnimation from '../components/LoadingAnimation';

const Students = () => {
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
  const [editingRollNumber, setEditingRollNumber] = useState(false);
  const [tempRollNumber, setTempRollNumber] = useState('');
  const [completionPercentages, setCompletionPercentages] = useState({});

  // Get completion percentage for a student from backend
  const getStudentCompletionPercentage = async (admissionNumber) => {
    try {
      const response = await api.get(`/submissions/student/${admissionNumber}/completion-status`);
      return response.data.data.completionPercentage;
    } catch (error) {
      console.error('Failed to fetch completion status:', error);
      return 0;
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Fetch completion percentages when students are loaded
  useEffect(() => {
    const fetchCompletionPercentages = async () => {
      if (students.length === 0) return;

      const percentages = {};
      for (const student of students) {
        try {
          const response = await api.get(`/submissions/student/${student.admission_number}/completion-status`);
          percentages[student.admission_number] = response.data.data.completionPercentage;
        } catch (error) {
          console.error(`Failed to fetch completion for ${student.admission_number}:`, error);
          percentages[student.admission_number] = 0;
        }
      }
      setCompletionPercentages(percentages);
    };

    fetchCompletionPercentages();
  }, [students]);

  useEffect(() => {
    // Extract available fields and their unique values from students data
    if (students.length > 0) {
      const fieldsMap = {};

      // Keywords to exclude (text fields that shouldn't be filters)
      const excludeKeywords = ['name', 'phone', 'mobile', 'contact', 'address', 'email', 'number', 'guardian', 'parent', 'information'];

      students.forEach(student => {
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

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/students');
      setStudents(response.data.data);
      // Update statistics after fetching students
      setTimeout(() => {
        calculateOverallStats();
      }, 100);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      // Add filters (including date ranges) to query
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(`filter_${key}`, value);
        }
      });

      const response = await api.get(`/students?${params.toString()}`);
      setStudents(response.data.data);
      // Update statistics after search
      setTimeout(() => {
        calculateOverallStats();
      }, 100);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
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
    fetchStudents();
  };

  const applyFilters = () => {
    handleSearch();
  };

  const handleViewDetails = (student) => {
    setSelectedStudent(student);
    setEditData(student.student_data);
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

    setEditData(allFields);
    setShowModal(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    try {
      console.log('Saving edit data:', editData);
      console.log('Selected student:', selectedStudent);

      await api.put(`/students/${selectedStudent.admission_number}`, {
        studentData: editData,
      });

      console.log('Save successful');
      toast.success('Student data updated successfully');
      setEditMode(false);
      fetchStudents();
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
      fetchStudents();
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
      fetchStudents();
    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Admission Number', 'PIN Number', 'Name', 'Mobile Number', ...Object.keys(students[0].student_data)];
    const csvContent = [
      headers.join(','),
      ...students.map((student) => {
        const data = student.student_data;
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
    try {
      // Fetch dashboard statistics from backend
      const response = await api.get('/students/dashboard-stats');
      if (response.data.success) {
        const data = response.data.data;
        setStats({
          total: data.totalStudents || 0,
          completed: data.completedProfiles || 0,
          averageCompletion: data.averageCompletion || 0
        });
      } else {
        // Fallback to local calculation if backend stats fail
        if (students.length === 0) {
          setStats({ total: 0, completed: 0, averageCompletion: 0 });
          return;
        }

        const totalStudents = students.length;
        let completedStudents = 0;
        let totalCompletion = 0;

        // Fetch completion percentages for all students
        for (const student of students) {
          const percentage = await getStudentCompletionPercentage(student.admission_number);
          totalCompletion += percentage;
          if (percentage >= 80) {
            completedStudents++;
          }
        }

        const averageCompletion = totalStudents > 0 ? Math.round(totalCompletion / totalStudents) : 0;

        setStats({
          total: totalStudents,
          completed: completedStudents,
          averageCompletion
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      // Fallback to local calculation
      if (students.length === 0) {
        setStats({ total: 0, completed: 0, averageCompletion: 0 });
        return;
      }

      const totalStudents = students.length;
      let completedStudents = 0;
      let totalCompletion = 0;

      // Fetch completion percentages for all students
      for (const student of students) {
        const percentage = await getStudentCompletionPercentage(student.admission_number);
        totalCompletion += percentage;
        if (percentage >= 80) {
          completedStudents++;
        }
      }

      const averageCompletion = totalStudents > 0 ? Math.round(totalCompletion / totalStudents) : 0;

      setStats({
        total: totalStudents,
        completed: completedStudents,
        averageCompletion
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={120}
            height={120}
            message="Loading students..."
          />
          <div className="space-y-2">
            <p className="text-lg font-medium text-text-primary">Loading Students Database</p>
            <p className="text-sm text-text-secondary">Please wait while we fetch your data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary heading-font">Students Database</h1>
          <p className="text-text-secondary mt-2 body-font">Manage and view all student records</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/students/add" className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            <Plus size={18} />
            Add Student
          </Link>
          <button onClick={() => setShowManualRollNumber(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <UserCog size={18} />
            Update PIN Numbers
          </button>
          <button onClick={() => setShowBulkRollNumber(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Upload size={18} />
            Bulk Upload PIN CSV
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-card-bg rounded-xl shadow-sm border border-border-light p-4">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Search by admission number or student data..."
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilters ? 'bg-primary text-white' : 'bg-border-light text-text-primary hover:bg-accent/10'}`}>
            <Filter size={18} />
            Filters
          </button>
          <button onClick={handleSearch} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            Search
          </button>
        </div>

        {showFilters && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary">Advanced Filters</h3>
              <button onClick={clearFilters} className="text-xs text-error hover:text-red-700 flex items-center gap-1">
                <X size={14} />
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Created From</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy-600 mb-1">Created To</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-navy-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy-600 mb-1">PIN Number Status</label>
                <select
                  value={filters.pinNumberStatus || ''}
                  onChange={(e) => handleFilterChange('pinNumberStatus', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">All</option>
                  <option value="assigned">With PIN Number</option>
                  <option value="unassigned">Without PIN Number</option>
                </select>
              </div>
            </div>

            {availableFields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border-light">
                <p className="text-xs font-semibold text-text-primary mb-3">Filter by Form Fields:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {availableFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-text-secondary mb-1">{field.name}</label>
                      <select
                        value={filters[`field_${field.name}`] || ''}
                        onChange={(e) => handleFilterChange(`field_${field.name}`, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      >
                        <option value="">All</option>
                        {field.values.map((value, idx) => (
                          <option key={idx} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button onClick={applyFilters} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm">
                Apply Filters
              </button>
              <button onClick={clearFilters} className="px-4 py-2 border border-border-light text-text-primary rounded-lg hover:bg-accent/10 transition-colors text-sm btn-hover">
                Reset
              </button>
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
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
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
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% of total
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Average Completion</p>
                <p className="text-3xl font-bold text-purple-600">{stats.averageCompletion}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.averageCompletion}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <TrendingUp className="text-purple-600" size={24} />
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Photo</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Admission Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">PIN Number</th>
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
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {(() => {
                          const data = student.student_data;
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
                              className={`h-2 rounded-full ${completionPercentage >= 80 ? 'bg-green-500' : completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${completionPercentage}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-medium ${completionPercentage >= 80 ? 'text-green-600' : completionPercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{new Date(student.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleViewDetails(student)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => handleDelete(student.admission_number)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
                          completionPercentage >= 80 ? 'bg-green-100 text-green-800' :
                          completionPercentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
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
                        {editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)'] ?
                          new Date(editData.dob || editData['DOB (Date of Birth - DD-MM-YYYY)']).toLocaleDateString() : '-'}
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
                        {editData.admission_date || editData['Admission Date'] ?
                          new Date(editData.admission_date || editData['Admission Date']).toLocaleDateString() : '-'}
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
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
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

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
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

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
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

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
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
                    <span>{new Date(selectedStudent.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span>{' '}
                    <span>{new Date(selectedStudent.updated_at).toLocaleString()}</span>
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

      <ManualRollNumberModal
        isOpen={showManualRollNumber}
        onClose={() => setShowManualRollNumber(false)}
        onUpdateComplete={fetchStudents}
      />
    </div>
  );
};

export default Students;
