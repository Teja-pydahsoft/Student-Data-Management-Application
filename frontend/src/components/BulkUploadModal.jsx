import React, { useState, useEffect, useMemo } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from './LoadingAnimation';

const BulkUploadModal = ({ isOpen, onClose, forms, onUploadComplete, isLoadingForms = false }) => {
   if (!isOpen) {
     return null;
   }

   // Auto-select the first available form when forms are loaded
   const [selectedForm, setSelectedForm] = useState('');
   const [file, setFile] = useState(null);
   const [uploading, setUploading] = useState(false);
   const [uploadResult, setUploadResult] = useState(null);
   const [uploadProgress, setUploadProgress] = useState('');

  const selectedFormDetails = useMemo(() => {
    if (!forms || forms.length === 0 || !selectedForm) {
      return null;
    }
    return forms.find((form) => form.form_id === selectedForm) || null;
  }, [forms, selectedForm]);

  const resolvedFormFields = useMemo(() => {
    if (!selectedFormDetails || !selectedFormDetails.form_fields) {
      return [];
    }
    const { form_fields: rawFields } = selectedFormDetails;
    if (Array.isArray(rawFields)) {
      return rawFields;
    }
    try {
      const parsed = JSON.parse(rawFields);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Unable to parse form fields for bulk upload template', error);
      return [];
    }
  }, [selectedFormDetails]);

  const normalize = (value) =>
    value ? value.toString().toLowerCase().replace(/[\s_-]+/g, '') : '';

  const stageFieldSummary = useMemo(() => {
    if (resolvedFormFields.length === 0) {
      return null;
    }

    const findField = (identifiers = []) =>
      resolvedFormFields.find((field) => {
        const key = normalize(field.key);
        const label = normalize(field.label);
        return identifiers.some((identifier) => key === identifier || label === identifier);
      });

    const courseField = findField(['course', 'coursename']);
    const branchField = findField(['branch', 'branchname']);
    const yearField = findField(['currentacademicyear', 'currentyear', 'year']);
    const semesterField = findField(['currentsemester', 'semester']);

    return {
      courseField,
      branchField,
      yearField,
      semesterField
    };
  }, [resolvedFormFields]);

   useEffect(() => {
     if (forms && forms.length > 0 && !selectedForm) {
       setSelectedForm(forms[0].form_id);
       console.log('🔄 Auto-selected form:', forms[0].form_name, forms[0].form_id);
     }
   }, [forms, selectedForm]);

  useEffect(() => {
    if (!forms || forms.length === 0) {
      setSelectedForm('');
    }
  }, [forms]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    console.log('📁 File selected:', {
      name: selectedFile?.name,
      type: selectedFile?.type,
      size: selectedFile?.size
    });

    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (selectedFile && validTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      setUploadResult(null);
      console.log('✅ Valid file selected:', selectedFile.name, 'Type:', selectedFile.type);
    } else {
      toast.error('Please select a valid CSV or Excel file');
      e.target.value = null;
      console.log('❌ Invalid file selected:', selectedFile?.type);
    }
  };

  const downloadTemplate = async () => {
    if (!selectedForm) {
      toast.error('Please select a form first');
      return;
    }

    try {
      // Download Excel template from backend
      const response = await api.get(`/submissions/template/${selectedForm}`, {
        responseType: 'blob' // Important for binary data
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${forms.find(f => f.form_id === selectedForm)?.form_name}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Excel template downloaded successfully');
    } catch (error) {
      console.error('Download template error:', error);
      toast.error('Failed to download template');
    }
  };

  const handleUpload = async () => {
    console.log('🔘 Upload button clicked');

    if (!file) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setUploadProgress('Initializing upload...');

    try {
      console.log('🚀 Starting bulk upload...');
      console.log('📁 File in state:', file ? {
        name: file.name,
        type: file.type,
        size: file.size
      } : 'No file in state');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('formId', selectedForm);

      console.log('📋 Using selected form ID:', selectedForm);

      console.log('📦 FormData contents:', {
        hasFile: formData.has('file'),
        hasFormId: formData.has('formId'),
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
          key,
          value: value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value
        }))
      });

      setUploadProgress('Uploading file and processing data...');
      console.log('📡 Making API request to:', '/submissions/bulk-upload');

      const response = await api.post('/submissions/bulk-upload', formData);
      console.log('✅ API request successful, response status:', response.status);
      console.log('✅ Response data:', response.data);

      setUploadProgress('Processing completed, displaying results...');

      console.log('✅ Upload response:', response.data);
      setUploadResult(response.data);

      // Enhanced toast notification with detailed results
      const { successCount = 0, failedCount = 0, duplicateCount = 0, missingFieldCount = 0 } = response?.data || {};

      let toastMessage = `✅ Enhanced bulk upload completed: ${successCount} success, ${failedCount} failed`;
      if (duplicateCount > 0) toastMessage += `, ${duplicateCount} duplicates`;
      if (missingFieldCount > 0) toastMessage += `, ${missingFieldCount} missing fields`;

      toast.success(toastMessage, {
        duration: 6000, // Longer duration for detailed message
        style: {
          maxWidth: '500px',
          whiteSpace: 'normal',
        }
      });

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
       console.error('❌ Upload error occurred:');
       console.error('❌ Error type:', error.constructor.name);
       console.error('❌ Error message:', error.message);
       console.error('❌ Error response:', error.response);
       console.error('❌ Error request:', error.request);
       console.error('❌ Full error object:', error);

       if (error.response) {
         console.error('❌ Response status:', error.response.status);
         console.error('❌ Response data:', error.response.data);
         console.error('❌ Response headers:', error.response.headers);
       } else if (error.request) {
         console.error('❌ No response received. Network error?');
         console.error('❌ Request details:', error.request);
       } else {
         console.error('❌ Request setup error:', error.message);
       }

       // Set error result for detailed display in modal
       const errorResult = error.response?.data || {
         success: false,
         message: error.response?.data?.message || error.message || 'Failed to upload file',
         successCount: 0,
         failedCount: 0,
         duplicateCount: 0,
         missingFieldCount: 0,
         errors: []
       };
       setUploadResult(errorResult);

       // Enhanced error toast with detailed information
       let errorMessage = '❌ Upload failed: ';
       if (error.response) {
         errorMessage += `Server error (${error.response.status})`;
       } else if (error.request) {
         errorMessage += 'Network error - check connection';
       } else {
         errorMessage += error.message || 'Unknown error';
       }

       toast.error(errorMessage, {
         duration: 6000,
         style: {
           maxWidth: '500px',
           whiteSpace: 'normal',
         }
       });
     } finally {
       console.log('🔄 Upload process finished, setting uploading to false');
       setUploading(false);
     }
  };

  const handleClose = () => {
    setSelectedForm('');
    setFile(null);
    setUploadResult(null);
    setUploadProgress('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
       <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
         <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
           <div className="flex items-center justify-between">
             <div>
               <h3 className="text-2xl font-bold">Bulk Upload Dashboard</h3>
               <p className="text-blue-100 text-sm mt-1">Upload and manage student data in bulk</p>
             </div>
             <button onClick={handleClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors">
               <X size={24} />
             </button>
           </div>
         </div>
         <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">

        <div className="space-y-6">
          {/* Form Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Form *
            </label>
            <select
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-500"
              disabled={isLoadingForms || !forms || forms.length === 0}
            >
              <option value="">
                {isLoadingForms ? 'Loading forms...' : 'Choose a form...'}
              </option>
              {!isLoadingForms && forms && forms.length > 0 ? (
                forms.map((form) => (
                  <option key={form.form_id} value={form.form_id}>
                    {form.form_name}
                  </option>
                ))
              ) : (
                !isLoadingForms && <option value="" disabled>No forms available</option>
              )}
            </select>
            {isLoadingForms && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <LoadingAnimation width={16} height={16} variant="inline" showMessage={false} />
                <span>Fetching available templates...</span>
              </div>
            )}
          </div>

          {/* Download Template */}
          {selectedForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-blue-800 mb-2">
                    Download the Excel template for the selected form and fill it with student data.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download Excel Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-indigo-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm text-indigo-800 font-medium mb-2">
                    Make sure your Excel file includes the required academic structure columns so students are linked to the correct course, branch, year and semester.
                  </p>
                  <ul className="text-sm text-indigo-700 list-disc ml-5 space-y-1">
                    <li>
                      <span className="font-semibold">Course</span>{' '}
                      {stageFieldSummary?.courseField
                        ? `→ matches form field "${stageFieldSummary.courseField.label || stageFieldSummary.courseField.key}"`
                        : '→ add a column named "Course"'}
                    </li>
                    <li>
                      <span className="font-semibold">Branch</span>{' '}
                      {stageFieldSummary?.branchField
                        ? `→ matches form field "${stageFieldSummary.branchField.label || stageFieldSummary.branchField.key}"`
                        : '→ add a column named "Branch"'}
                    </li>
                    <li>
                      <span className="font-semibold">Current Academic Year</span>{' '}
                      {stageFieldSummary?.yearField
                        ? `→ matches form field "${stageFieldSummary.yearField.label || stageFieldSummary.yearField.key}"`
                        : '→ add a column named "Current Academic Year"'}
                    </li>
                    <li>
                      <span className="font-semibold">Current Semester</span>{' '}
                      {stageFieldSummary?.semesterField
                        ? `→ matches form field "${stageFieldSummary.semesterField.label || stageFieldSummary.semesterField.key}"`
                        : '→ add a column named "Current Semester"'}
                    </li>
                  </ul>
                  <p className="text-xs text-indigo-600 mt-2">
                    These columns ensure that each uploaded student is grouped under the correct course & branch and is placed in the right academic stage.
                  </p>
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
                accept=".csv,.xlsx,.xls"
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
                  {file ? file.name : 'Click to upload CSV or Excel file'}
                </p>
                <p className="text-xs text-gray-500">CSV or Excel files only</p>
              </label>
            </div>
          </div>

          {/* Upload Progress Indicator */}
          {uploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <LoadingAnimation
                    width={32}
                    height={32}
                    variant="minimal"
                    showMessage={false}
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-blue-800 mb-2">Processing Upload...</h4>
                  <p className="text-sm text-blue-700">
                    {uploadProgress || 'Please wait while we process your data...'}
                  </p>
                  <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Recovery Actions */}
          {uploadResult && !uploadResult.success && (uploadResult.failedCount > 0 || uploadResult.duplicateCount > 0 || uploadResult.missingFieldCount > 0) && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h6 className="text-sm font-semibold text-yellow-800 mb-3">Suggested Actions</h6>
              <div className="flex flex-wrap gap-2">
                {uploadResult.duplicateCount > 0 && (
                  <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    Review Duplicates
                  </button>
                )}
                {uploadResult.missingFieldCount > 0 && (
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2">
                    <Upload size={16} />
                    Fix Missing Fields
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Professional Upload Results Dashboard */}
          {uploadResult && (
            <div className={`border rounded-xl p-6 ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {/* Header with Status Icon and Message */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  uploadResult.success ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle className="text-green-600" size={24} />
                  ) : (
                    <AlertCircle className="text-red-600" size={24} />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={`text-lg font-semibold ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {uploadResult.success ? 'Upload Completed Successfully' : 'Upload Completed with Issues'}
                  </h4>
                  <p className={`text-sm ${uploadResult.success ? 'text-green-700' : 'text-red-700'} mb-2`}>
                    {uploadResult.message || 'No message available'}
                  </p>

                  {/* Compact Results Summary */}
                  <div className={`text-sm font-medium p-3 rounded-lg ${
                    uploadResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    📊 <strong>Summary:</strong> {uploadResult.successCount || 0} success
                    {(uploadResult.failedCount > 0) && `, ${uploadResult.failedCount} failed`}
                    {(uploadResult.duplicateCount > 0) && `, ${uploadResult.duplicateCount} duplicates`}
                    {(uploadResult.missingFieldCount > 0) && `, ${uploadResult.missingFieldCount} missing fields`}
                    {uploadResult.totalRows && ` • Total: ${uploadResult.totalRows} processed`}
                  </div>
                </div>
              </div>

              {/* Statistics Cards */}
              {uploadResult && uploadResult.successCount !== undefined && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {/* Success Card */}
                  <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">{uploadResult.successCount || 0}</div>
                    <div className="text-sm text-green-700 font-medium">Successful</div>
                  </div>

                  {/* Total Processed Card */}
                  {uploadResult.totalRows && (
                    <div className="bg-white rounded-lg border border-blue-200 p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{uploadResult.totalRows}</div>
                      <div className="text-sm text-blue-700 font-medium">Total Processed</div>
                    </div>
                  )}

                  {/* Duplicates Card */}
                  {uploadResult.duplicateCount > 0 && (
                    <div className="bg-white rounded-lg border border-orange-200 p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600 mb-1">{uploadResult.duplicateCount}</div>
                      <div className="text-sm text-orange-700 font-medium">Duplicates</div>
                    </div>
                  )}

                  {/* Failed Card */}
                  {uploadResult.failedCount > 0 && (
                    <div className={`bg-white rounded-lg border p-4 text-center ${
                      uploadResult.failedCount > 0 ? 'border-red-200' : 'border-gray-200'
                    }`}>
                      <div className={`text-2xl font-bold mb-1 ${
                        uploadResult.failedCount > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {uploadResult.failedCount}
                      </div>
                      <div className={`text-sm font-medium ${
                        uploadResult.failedCount > 0 ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        Failed
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Analysis Section */}
              {uploadResult && uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="text-red-600" size={20} />
                    <h5 className="text-lg font-semibold text-gray-800">Error Analysis</h5>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {uploadResult.errors.map((error, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">Row {error.row}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              error.type === 'duplicate'
                                ? 'bg-orange-100 text-orange-800'
                                : error.type === 'missing_fields'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {error.type === 'duplicate' && 'Duplicate Entry'}
                              {error.type === 'missing_fields' && 'Missing Required Fields'}
                              {error.type === 'processing_error' && 'Processing Error'}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 mb-2">{error.message || 'Unknown error'}</p>

                        {/* Detailed Error Information */}
                        {error.details && (
                          <div className="text-xs text-gray-600 bg-white rounded border p-2">
                            {error.type === 'duplicate' && error.details.duplicates && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">Duplicate Conflicts:</div>
                                <div className="space-y-1">
                                  {error.details.duplicates.map((dup, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span>{dup.field}:</span>
                                      <span className="font-medium">{dup.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {error.type === 'missing_fields' && error.details.missingFields && (
                              <div>
                                <div className="font-medium text-gray-700 mb-1">Missing Fields:</div>
                                <div className="flex flex-wrap gap-1">
                                  {error.details.missingFields.map((field, idx) => (
                                    <span key={idx} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                                      {field}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Summary */}
              {uploadResult && uploadResult.processedRows && uploadResult.processedRows.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="text-blue-600" size={20} />
                    <h5 className="text-lg font-semibold text-gray-800">Processing Summary</h5>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h6 className="text-sm font-medium text-gray-700 mb-2">Successful Rows (First 10):</h6>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {uploadResult.processedRows.filter(row => row.status === 'success').slice(0, 10).map((row, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-green-50 text-green-700 p-2 rounded">
                            <span>Row {row.row}</span>
                            <span className="flex items-center gap-1">
                              <CheckCircle size={14} />
                              Success
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h6 className="text-sm font-medium text-gray-700 mb-2">Failed Rows (First 10):</h6>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {uploadResult.processedRows.filter(row => row.status === 'failed').slice(0, 10).map((row, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-red-50 text-red-700 p-2 rounded">
                            <span>Row {row.row}</span>
                            <span className="flex items-center gap-1">
                              <AlertCircle size={14} />
                              {row.reason?.substring(0, 20) || 'Unknown error'}...
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message and Quick Actions */}
              {uploadResult && uploadResult.success && uploadResult.successCount > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-green-100 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-green-600" size={20} />
                      <span className="text-green-800 font-medium">
                        {uploadResult.successCount} student record{uploadResult.successCount !== 1 ? 's' : ''} uploaded successfully and {uploadResult.successCount !== 1 ? 'are' : 'is'} ready for admin approval.
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h6 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h6>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          handleClose();
                          // Could trigger navigation to submissions page
                          window.location.href = '/submissions';
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
                      >
                        <CheckCircle size={16} />
                        View Submissions
                      </button>
                      <button
                        onClick={handleClose}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                      >
                        Upload Another File
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleUpload}
              disabled={!selectedForm || !file || uploading}
              className="flex-1 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-lg"
            >
              {uploading ? (
                <>
                  <LoadingAnimation
                    width={20}
                    height={20}
                    variant="inline"
                    showMessage={false}
                  />
                  <div className="flex flex-col items-start">
                    <span>Uploading...</span>
                    {uploadProgress && (
                      <span className="text-xs opacity-90">{uploadProgress}</span>
                    )}
                  </div>
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
    </div>
  );
};

export default BulkUploadModal;
