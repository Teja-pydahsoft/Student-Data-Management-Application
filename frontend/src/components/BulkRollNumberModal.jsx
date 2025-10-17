import React, { useState, useEffect } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

const BulkRollNumberModal = ({ isOpen, onClose, onUpdateComplete }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const response = await api.get('/students?limit=1000');
      setStudents(response.data.data);
    } catch (error) {
      console.error('Failed to fetch students');
    } finally {
      setLoadingStudents(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setUploadResult(null);
    } else {
      toast.error('Please select a valid CSV file');
      e.target.value = null;
    }
  };

  const downloadTemplate = () => {
    if (students.length === 0) {
      toast.error('No students found to generate template');
      return;
    }

    // Helper function to extract name and mobile from student data
    const extractField = (data, keywords) => {
      const key = Object.keys(data).find(k => 
        keywords.some(keyword => k.toLowerCase().includes(keyword))
      );
      return key ? data[key] : '';
    };

    // Create CSV with actual student data
    const headers = ['admission_number', 'student_name', 'mobile_number', 'pin_no'];
    const rows = students.map(student => {
      const name = extractField(student.student_data, ['name', 'student name']);
      const mobile = extractField(student.student_data, ['mobile', 'phone', 'contact']);
      return [
        student.admission_number,
        name,
        mobile,
        student.admission_number || '' // Use admission_number for now
      ].map(val => `"${val}"`).join(',');
    });

    const csvContent = headers.join(',') + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pin_numbers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template with student data downloaded');
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/students/bulk-update-pin-numbers', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult(response.data);
      toast.success(`Successfully updated ${response.data.successCount} PIN numbers`);
      
      if (onUpdateComplete) {
        onUpdateComplete();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload file');
      setUploadResult(error.response?.data);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Bulk Update PIN Numbers</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium mb-2">Instructions:</p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Download CSV with actual student data (includes name & mobile)</li>
                  <li>Add PIN numbers in the pin_no column</li>
                  <li>Upload the completed CSV file</li>
                  <li>Only admission_number and pin_no columns are required</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  disabled={loadingStudents || students.length === 0}
                  className="mt-3 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingStudents ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Download Template ({students.length} students)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="roll-csv-upload"
              />
              <label htmlFor="roll-csv-upload" className="cursor-pointer">
                <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm text-gray-600 mb-1">
                  {file ? file.name : 'Click to upload CSV file'}
                </p>
                <p className="text-xs text-gray-500">CSV files only (admission_number, pin_no)</p>
              </label>
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`border rounded-lg p-4 ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                {uploadResult.success ? (
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                ) : (
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'} mb-3`}>
                    {uploadResult.message}
                  </p>
                  
                  {/* Summary Statistics */}
                  {uploadResult.successCount !== undefined && (
                    <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Update Summary:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-bold">✓</span>
                          <span className="text-gray-700">Updated: <strong className="text-green-700">{uploadResult.successCount}</strong></span>
                        </div>
                        {uploadResult.failedCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-red-600 font-bold">✗</span>
                            <span className="text-gray-700">Failed: <strong className="text-red-700">{uploadResult.failedCount}</strong></span>
                          </div>
                        )}
                        {uploadResult.notFoundCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600 font-bold">⚠</span>
                            <span className="text-gray-700">Not Found: <strong className="text-yellow-700">{uploadResult.notFoundCount}</strong></span>
                          </div>
                        )}
                        {uploadResult.duplicateCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-orange-600 font-bold">⊗</span>
                            <span className="text-gray-700">Duplicates: <strong className="text-orange-700">{uploadResult.duplicateCount}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Detailed Errors */}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-red-200 max-h-48 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-800 mb-2">Detailed Errors ({uploadResult.errors.length}):</p>
                      <ul className="text-xs text-red-700 space-y-1.5">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index} className="flex gap-2 pb-1.5 border-b border-red-100 last:border-0">
                            <span className="font-semibold min-w-[60px]">Row {error.row}:</span>
                            <span>{error.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Update PIN Numbers
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkRollNumberModal;
