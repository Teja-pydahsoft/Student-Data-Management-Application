import React, { useState } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

const BulkUploadModal = ({ isOpen, onClose, forms, onUploadComplete }) => {
  const [selectedForm, setSelectedForm] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

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
    if (!selectedForm) {
      toast.error('Please select a form first');
      return;
    }

    const form = forms.find(f => f.form_id === selectedForm);
    if (!form) return;

    // Create CSV template with form field labels as headers
    const headers = ['admission_number', ...form.form_fields.map(field => field.label)];
    const csvContent = headers.join(',') + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.form_name}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleUpload = async () => {
    if (!selectedForm) {
      toast.error('Please select a form');
      return;
    }

    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('formId', selectedForm);

      const response = await api.post('/submissions/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult(response.data);
      toast.success(`Successfully uploaded ${response.data.successCount} submissions`);
      
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload file');
      setUploadResult(error.response?.data);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedForm('');
    setFile(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Bulk Upload Submissions</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Form Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Form *
            </label>
            <select
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Choose a form...</option>
              {forms.map((form) => (
                <option key={form.form_id} value={form.form_id}>
                  {form.form_name}
                </option>
              ))}
            </select>
          </div>

          {/* Download Template */}
          {selectedForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-blue-800 mb-2">
                    Download the CSV template for the selected form and fill it with student data.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download Template
                  </button>
                </div>
              </div>
            </div>
          )}

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
                id="csv-upload"
                disabled={!selectedForm}
              />
              <label
                htmlFor="csv-upload"
                className={`cursor-pointer ${!selectedForm ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm text-gray-600 mb-1">
                  {file ? file.name : 'Click to upload CSV file'}
                </p>
                <p className="text-xs text-gray-500">CSV files only</p>
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
                  <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'} mb-2`}>
                    {uploadResult.message}
                  </p>
                  {uploadResult.successCount !== undefined && (
                    <div className="text-sm space-y-1">
                      <p className="text-green-700">✓ Successful: {uploadResult.successCount}</p>
                      {uploadResult.failedCount > 0 && (
                        <p className="text-red-700">✗ Failed: {uploadResult.failedCount}</p>
                      )}
                    </div>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium text-red-800 mb-1">Errors:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>Row {error.row}: {error.message}</li>
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
              disabled={!selectedForm || !file || uploading}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload Submissions
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

export default BulkUploadModal;
