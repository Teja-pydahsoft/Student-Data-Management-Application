import React, { useState, useEffect } from 'react';
import { Search, Eye, Edit, Trash2, Download, Filter, Upload, X, UserCog, Plus, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../config/api';
import toast from 'react-hot-toast';
import BulkRollNumberModal from '../components/BulkRollNumberModal';
import ManualRollNumberModal from '../components/ManualRollNumberModal';

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
    setTempRollNumber(student.roll_number || '');
    setShowModal(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/students/${selectedStudent.admission_number}`, {
        studentData: editData,
      });
      toast.success('Student data updated successfully');
      setEditMode(false);
      fetchStudents();
    } catch (error) {
      toast.error('Failed to update student data');
    }
  };

  const handleSaveRollNumber = async () => {
    try {
      await api.put(`/students/${selectedStudent.admission_number}/roll-number`, {
        rollNumber: tempRollNumber,
      });
      toast.success('Roll number updated successfully');
      setEditingRollNumber(false);
      setSelectedStudent({ ...selectedStudent, roll_number: tempRollNumber });
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update roll number');
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

    const headers = ['Admission Number', 'Roll Number', 'Name', 'Mobile Number', ...Object.keys(students[0].student_data)];
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
          student.roll_number || '',
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
  const calculateOverallStats = async () => {
    if (students.length === 0) return { total: 0, completed: 0, averageCompletion: 0 };

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

    return {
      total: totalStudents,
      completed: completedStudents,
      averageCompletion
    };
  };

  const stats = calculateOverallStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students Database</h1>
          <p className="text-gray-600 mt-2">Manage and view all student records</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/students/add" className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            <Plus size={18} />
            Add Student
          </Link>
          <button onClick={() => setShowManualRollNumber(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <UserCog size={18} />
            Update Roll Numbers
          </button>
          <button onClick={() => setShowBulkRollNumber(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Upload size={18} />
            Bulk Upload CSV
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Search by admission number or student data..."
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilters ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
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
              <h3 className="text-sm font-semibold text-gray-700">Advanced Filters</h3>
              <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                <X size={14} />
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Created From</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Created To</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Roll Number Status</label>
                <select
                  value={filters.rollNumberStatus || ''}
                  onChange={(e) => handleFilterChange('rollNumberStatus', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">All</option>
                  <option value="assigned">With Roll Number</option>
                  <option value="unassigned">Without Roll Number</option>
                </select>
              </div>
            </div>

            {availableFields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-3">Filter by Form Fields:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {availableFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.name}</label>
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
              <button onClick={clearFilters} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Admission Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Roll Number</th>
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
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{student.admission_number}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {student.roll_number ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                            {student.roll_number}
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
                      Roll Number
                    </label>
                    {editingRollNumber ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempRollNumber}
                          onChange={(e) => setTempRollNumber(e.target.value)}
                          placeholder="Enter roll number"
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
                            setTempRollNumber(selectedStudent.roll_number || '');
                          }}
                          className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {selectedStudent.roll_number ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-green-100 text-green-800 text-lg font-semibold">
                            {selectedStudent.roll_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm italic">Not assigned</span>
                        )}
                        {!editMode && (
                          <button
                            onClick={() => setEditingRollNumber(true)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit roll number"
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-gray-900">Student Information</h4>
                  <span className="text-xs text-gray-500">{Object.keys(editData).length} fields</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(editData).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                        {key}
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={Array.isArray(value) ? value.join(', ') : value}
                          onChange={(e) => updateEditField(key, Array.isArray(value) ? e.target.value.split(',').map(v => v.trim()) : e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 break-words">
                          {Array.isArray(value) ? value.join(', ') : value || '-'}
                        </p>
                      )}
                    </div>
                  ))}
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
