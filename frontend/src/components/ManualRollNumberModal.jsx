import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, CheckCircle, Search } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

const ManualRollNumberModal = ({ isOpen, onClose, onUpdateComplete }) => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rollNumbers, setRollNumbers] = useState({});
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, showOnlyPending]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const response = await api.get('/students?limit=1000');
      const studentsData = response.data.data;
      setStudents(studentsData);
      
      // Initialize roll numbers state with existing values
      const initialRollNumbers = {};
      studentsData.forEach(student => {
        initialRollNumbers[student.admission_number] = student.pin_no || '';
      });
      setRollNumbers(initialRollNumbers);
    } catch (error) {
      toast.error('Failed to fetch students');
      console.error(error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const filterStudents = () => {
    let filtered = [...students];

    // Filter by pending status
    if (showOnlyPending) {
      filtered = filtered.filter(student => !student.pin_no);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(student => {
        const admissionMatch = student.admission_number.toLowerCase().includes(term);
        const rollMatch = student.pin_no?.toLowerCase().includes(term);
        
        // Search in student data
        const data = student.student_data;
        const nameField = Object.keys(data).find(key => 
          key.toLowerCase().includes('name')
        );
        const nameMatch = nameField && data[nameField]?.toLowerCase().includes(term);
        
        return admissionMatch || rollMatch || nameMatch;
      });
    }

    setFilteredStudents(filtered);
  };

  const handleRollNumberChange = (admissionNumber, value) => {
    setRollNumbers(prev => ({
      ...prev,
      [admissionNumber]: value
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    
    try {
      // Filter only changed roll numbers
      const updates = [];
      filteredStudents.forEach(student => {
        const newPinNumber = rollNumbers[student.admission_number]?.trim();
        const oldPinNumber = student.pin_no;

        if (newPinNumber && newPinNumber !== oldPinNumber) {
          updates.push({
            admission_number: student.admission_number,
            pin_no: newPinNumber
          });
        }
      });

      if (updates.length === 0) {
        toast.error('No changes to save');
        setSaving(false);
        return;
      }

      // Send updates to backend
      let successCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const update of updates) {
        try {
          await api.put(`/students/${update.admission_number}/pin-number`, {
            pinNumber: update.pin_no
          });
          successCount++;
        } catch (error) {
          failedCount++;
          errors.push({
            admission: update.admission_number,
            message: error.response?.data?.message || 'Update failed'
          });
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully updated ${successCount} PIN number(s)`);
        if (onUpdateComplete) {
          onUpdateComplete();
        }
        fetchStudents(); // Refresh the list
      }

      if (failedCount > 0) {
        toast.error(`Failed to update ${failedCount} PIN number(s)`);
        console.error('Update errors:', errors);
      }

    } catch (error) {
      toast.error('Failed to save PIN numbers');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setShowOnlyPending(true);
    onClose();
  };

  const extractName = (studentData) => {
    const nameField = Object.keys(studentData).find(key => 
      key.toLowerCase().includes('name')
    );
    return nameField ? studentData[nameField] : '-';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Update PIN Numbers</h3>
            <p className="text-sm text-gray-600 mt-1">Assign PIN numbers to students individually</p>
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by admission number or name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => setShowOnlyPending(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Show only pending</span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing <strong>{filteredStudents.length}</strong> student(s)
              {showOnlyPending && (
                <span className="ml-2 text-orange-600">
                  ({filteredStudents.length} without PIN numbers)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingStudents ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <AlertCircle size={48} className="mb-4" />
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm">Try adjusting your filters or search term</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <div 
                  key={student.admission_number}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                >
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Admission Number
                      </label>
                      <p className="text-sm font-semibold text-gray-900">
                        {student.admission_number}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Student Name
                      </label>
                      <p className="text-sm text-gray-900">
                        {extractName(student.student_data)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        PIN Number *
                      </label>
                      <input
                        type="text"
                        value={rollNumbers[student.admission_number] || ''}
                        onChange={(e) => handleRollNumberChange(student.admission_number, e.target.value)}
                        placeholder="Enter PIN number"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  {student.pin_no && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle size={16} />
                      <span className="text-xs font-medium">Assigned</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={saving || loadingStudents || filteredStudents.length === 0}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save All Changes
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              disabled={saving}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualRollNumberModal;
