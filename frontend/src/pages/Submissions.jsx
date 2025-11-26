import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Trash2, Filter, Upload, Plus, Hash, CheckSquare, Square } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import BulkUploadModal from '../components/BulkUploadModal';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';

const Submissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showAdmissionSeries, setShowAdmissionSeries] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);
  const [forms, setForms] = useState([]);
  const [fieldStatus, setFieldStatus] = useState(null);
  const [selectedSubmissions, setSelectedSubmissions] = useState(new Set());
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDeleteProgressModal, setShowDeleteProgressModal] = useState(false);
  const [deletingProgress, setDeletingProgress] = useState({ current: 0, total: 0, isDeleting: false });
  const [globalAutoAssign, setGlobalAutoAssign] = useState(false);

  useEffect(() => {
    setAutoAssign(globalAutoAssign);
  }, [globalAutoAssign]);

  useEffect(() => {
    fetchSubmissions();
    fetchForms();
    fetchAutoAssignStatus();
  }, [filter]);

  const fetchForms = async () => {
    try {
      const response = await api.get('/forms');
      setForms(response.data.data.filter(f => f.is_active));
    } catch (error) {
      console.error('Failed to fetch forms');
    }
  };

  const fetchAutoAssignStatus = async () => {
    try {
      const response = await api.get('/submissions/auto-assign-status');
      setGlobalAutoAssign(response.data.data.enabled);
    } catch (error) {
      console.error('Failed to fetch auto-assign status:', error.response?.data?.message || error.message);
      // Set default value if API fails
      setGlobalAutoAssign(false);
      // Show user-friendly error message
      if (error.response?.status === 500) {
        toast.error('Settings not configured. Please run the database initialization script.');
      }
    }
  };

  const toggleGlobalAutoAssign = async () => {
    try {
      await api.post('/submissions/toggle-auto-assign', { enabled: !globalAutoAssign });
      setGlobalAutoAssign(!globalAutoAssign);
      toast.success(`Auto-assign ${!globalAutoAssign ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle auto-assign:', error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Failed to toggle auto-assign. Settings table may not be configured.');
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/submissions?status=${filter}`);
      setSubmissions(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (submissionId) => {
    try {
      const response = await api.get(`/submissions/${submissionId}`);
      setSelectedSubmission(response.data.data);
      setAdmissionNumber(response.data.data.admission_number || '');

      // Auto-generate admission number if auto-assign is enabled and no admission number exists
      if (globalAutoAssign && !response.data.data.admission_number) {
        try {
          const genResponse = await api.post('/submissions/generate-admission-series', { autoAssign: false });
          setAdmissionNumber(genResponse.data.data.admissionNumbers[0]);
        } catch (error) {
          console.error('Failed to generate admission number:', error);
        }
      }

      setShowModal(true);
    } catch (error) {
      toast.error('Failed to fetch submission details');
    }
  };

  const handleApprove = async () => {
    if (!admissionNumber.trim()) {
      toast.error('Admission number is required');
      return;
    }

    try {
      console.log('Approving submission:', selectedSubmission.submission_id, 'with admission number:', admissionNumber.trim());

      await api.post(`/submissions/${selectedSubmission.submission_id}/approve`, {
        admissionNumber: admissionNumber.trim(),
      });

      toast.success('Submission approved successfully');
      setShowModal(false);
      setAdmissionNumber('');
      fetchSubmissions();
    } catch (error) {
      console.error('Approval error:', error);

      // Enhanced error handling for different types of errors
      let errorMessage = 'Failed to approve submission';

      if (error.response?.status === 500) {
        if (error.response?.data?.message?.includes('JSON')) {
          errorMessage = 'Data format error: Please check all form fields are properly filled.';
        } else {
          errorMessage = 'Server error: Please check the data format and try again.';
        }
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.message || 'Invalid data provided';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      // Log additional error details for debugging
      if (error.response?.data) {
        console.error('Error response data:', error.response.data);
      }

      toast.error(errorMessage);
    }
  };

  const handleReject = async () => {
    try {
      await api.post(`/submissions/${selectedSubmission.submission_id}/reject`, {
        reason: rejectionReason,
      });
      toast.success('Submission rejected');
      setShowModal(false);
      setRejectionReason('');
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to reject submission');
    }
  };

  const handleDelete = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) {
      return;
    }

    try {
      await api.delete(`/submissions/${submissionId}`);
      toast.success('Submission deleted successfully');
      fetchSubmissions();
    } catch (error) {
      toast.error('Failed to delete submission');
    }
  };

  const handleSelectSubmission = (submissionId, isSelected) => {
    const newSelected = new Set(selectedSubmissions);
    if (isSelected) {
      newSelected.add(submissionId);
    } else {
      newSelected.delete(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedSubmissions(new Set(submissions.map(s => s.submission_id)));
    } else {
      setSelectedSubmissions(new Set());
    }
  };

  const handleBulkApprove = async () => {
    if (selectedSubmissions.size === 0) {
      toast.error('Please select submissions to approve');
      return;
    }

    try {
      const response = await api.post('/submissions/bulk-approve', {
        submissionIds: Array.from(selectedSubmissions)
      });

      toast.success(`Successfully approved ${response.data.approvedCount} submissions`);
      setSelectedSubmissions(new Set());
      setShowBulkApproveModal(false);
      fetchSubmissions();
    } catch (error) {
      console.error('Bulk approval error:', error);
      toast.error(error.response?.data?.message || 'Failed to approve submissions');
    }
  };

  const handleBulkDelete = async () => {
    const submissionIds = Array.from(selectedSubmissions);
    if (submissionIds.length === 0) {
      toast.error('Please select submissions to delete');
      return;
    }

    setDeletingProgress({ current: 0, total: submissionIds.length, isDeleting: true });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < submissionIds.length; i++) {
      if (!deletingProgress.isDeleting) {
        // Cancelled
        break;
      }

      try {
        await api.delete(`/submissions/${submissionIds[i]}`);
        successCount++;
        setDeletingProgress(prev => ({ ...prev, current: i + 1 }));
      } catch (error) {
        console.error(`Error deleting submission ${submissionIds[i]}:`, error);
        failedCount++;
      }

      // Small delay for smooth animation
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setDeletingProgress({ current: 0, total: 0, isDeleting: false });
    setShowDeleteProgressModal(false);
    setSelectedSubmissions(new Set());

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} submissions`);
    }
    if (failedCount > 0) {
      toast.error(`Failed to delete ${failedCount} submissions`);
    }

    fetchSubmissions();
  };

  

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-600 mt-2">Review and approve student form submissions</p>
          {selectedSubmissions.size > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              {selectedSubmissions.size} submission{selectedSubmissions.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedSubmissions.size > 0 && (
            <button
              onClick={() => {
                if (filter === 'pending') {
                  setShowBulkApproveModal(true);
                } else {
                  setShowBulkDeleteModal(true);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                filter === 'pending'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {filter === 'pending' ? <CheckCircle size={18} /> : <Trash2 size={18} />}
              {filter === 'pending'
                ? `Approve Selected (${selectedSubmissions.size})`
                : `Delete All Selected (${selectedSubmissions.size})`
              }
            </button>
          )}
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload size={18} />
            Bulk Upload
          </button>
          <button
            onClick={() => setShowAdmissionSeries(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Hash size={18} />
            Generate Series
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 w-fit">
          {['pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-300 ease-in-out transform
                ${filter === status
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md scale-105'
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-100 hover:scale-105 hover:shadow-sm'}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="globalAutoAssign"
            checked={globalAutoAssign}
            onChange={toggleGlobalAutoAssign}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="globalAutoAssign" className="text-sm font-medium text-gray-700">
            Auto-Assign Series
          </label>
        </div>
      </div>


      {loading? (<div className="flex items-center justify-center">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading submissions..."
          />
        </div>
      </div>):(
        <> 
        {submissions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="text-gray-400" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No {filter} submissions</h3>
              <p className="text-gray-600">There are no {filter} submissions at the moment.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-12">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                        onChange={(e) => { e.stopPropagation(); handleSelectAll(e.target.checked); }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Student Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Admission Number</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Pin Number</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Mobile Number</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Batch</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Branch</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Submitted By</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Submitted At</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr
                      key={submission.submission_id}
                      onClick={() => handleViewDetails(submission.submission_id)}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        selectedSubmissions.has(submission.submission_id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.has(submission.submission_id)}
                          onChange={(e) => { e.stopPropagation(); handleSelectSubmission(submission.submission_id, e.target.checked); }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">{submission.submission_data['student_name'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{submission.admission_number || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{submission.submission_data['pin_no'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{submission.submission_data['student_mobile'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{submission.submission_data['batch'] || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{submission.submission_data['branch'] || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : submission.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${submission.submitted_by === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {submission.submitted_by === 'admin' ? '👤 Admin' : '🎓 Student'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(submission.submitted_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (submission.admission_number) {
                              api.get(`/submissions/${submission.submission_id}`)
                                .then(response => {
                                  const data = response.data.data;
                                  setSelectedSubmission(data);
                                  setAdmissionNumber(data.admission_number);
                                  // Directly approve using the fetched data
                                  api.post(`/submissions/${submission.submission_id}/approve`, {
                                    admissionNumber: data.admission_number,
                                  })
                                    .then(() => {
                                      toast.success('Submission approved successfully');
                                      fetchSubmissions();
                                    })
                                    .catch(error => {
                                      console.error('Approval error:', error);
                                      toast.error('Failed to approve submission');
                                    });
                                })
                                .catch(error => {
                                  toast.error('Failed to fetch submission details');
                                });
                            } else {
                              handleViewDetails(submission.submission_id);
                            }
                          }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve">
                            <CheckCircle size={16} />
                          </button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(submission.submission_id);
                          }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                            <XCircle size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>)}

      {showModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Submission Details</h3>

            <div className="space-y-4 mb-6">
              <div>
                <span className="text-sm font-medium text-gray-600">Form:</span>
                <p className="text-gray-900">{selectedSubmission.form_name}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedSubmission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : selectedSubmission.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {selectedSubmission.status}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Submitted At:</span>
                <p className="text-gray-900">{formatDate(selectedSubmission.submitted_at)}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Form Data</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {Object.entries(selectedSubmission.submission_data).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-sm font-medium text-gray-600">{key}:</span>
                    <span className="text-gray-900">{Array.isArray(value) ? value.join(', ') : value}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedSubmission.status === 'pending' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admission Number *</label>
                  <input type="text" value={admissionNumber} onChange={(e) => setAdmissionNumber(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Enter admission number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason (optional)</label>
                  <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" rows="3" placeholder="Enter reason for rejection" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              {selectedSubmission.status === 'pending' && (
                <>
                  <button onClick={handleApprove} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    <CheckCircle size={18} />
                    Approve
                  </button>
                  <button onClick={handleReject} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                    <XCircle size={18} />
                    Reject
                  </button>
                </>
              )}
              <button onClick={() => setShowModal(false)} className="ml-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        forms={forms}
        onUploadComplete={fetchSubmissions}
      />

      {/* Bulk Approve Modal */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Bulk Approve Submissions</h3>

            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                You are about to approve <strong>{selectedSubmissions.size}</strong> submission{selectedSubmissions.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-gray-500">
                Each submission will need an admission number assigned during the approval process.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkApprove}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle size={18} />
                Approve All Selected
              </button>
              <button
                onClick={() => setShowBulkApproveModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Bulk Delete Submissions</h3>

            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                You are about to delete <strong>{selectedSubmissions.size}</strong> submission{selectedSubmissions.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-gray-500">
                This action cannot be undone. All selected submissions will be permanently removed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setDeletingProgress({ current: 0, total: selectedSubmissions.size, isDeleting: true });
                  setShowDeleteProgressModal(true);
                  handleBulkDelete();
                }}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 size={18} />
                Delete All Selected
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Progress Modal */}
      {showDeleteProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Deleting Submissions</h3>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Deleting {deletingProgress.current}/{deletingProgress.total}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((deletingProgress.current / deletingProgress.total) * 100)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4 relative overflow-hidden">
                <div
                  className="progress-shimmer h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(deletingProgress.current / deletingProgress.total) * 100}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
                <span className="ml-2 text-gray-600">Processing...</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDeletingProgress(prev => ({ ...prev, isDeleting: false }));
                  setShowDeleteProgressModal(false);
                  toast.info('Deletion cancelled');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admission Number Series Modal */}
      {showAdmissionSeries && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Generate Admission Series</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                <input
                  type="text"
                  id="seriesPrefix"
                  defaultValue={new Date().getFullYear().toString()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Enter academic year (e.g., 2025)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Admission numbers will be generated as: {new Date().getFullYear()}0001, {new Date().getFullYear()}0002, etc.
                </p>
              </div>


              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoAssign"
                  checked={autoAssign}
                  onChange={(e) => setAutoAssign(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoAssign" className="ml-2 block text-sm text-gray-900">
                  Auto-assign to pending submissions based on their academic year
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  const academicYear = document.getElementById('seriesPrefix').value;

                  if (!academicYear.trim()) {
                    toast.error('Academic year is required');
                    return;
                  }

                  // Validate academic year format (4-digit year)
                  const yearMatch = academicYear.trim().match(/(\d{4})/);
                  if (!yearMatch) {
                    toast.error('Please enter a valid 4-digit year (e.g., 2025)');
                    return;
                  }

                  api.post('/submissions/generate-admission-series', {
                    prefix: yearMatch[1],
                    academicYear: yearMatch[1],
                    autoAssign
                  })
                    .then(response => {
                      const data = response.data.data;
                      const numbers = data.admissionNumbers;

                      if (autoAssign) {
                        toast.success(`Generated and auto-assigned admission numbers for academic year ${yearMatch[1]}!`);
                        fetchSubmissions(); // Refresh to show updated admission numbers
                        // Set global auto-assign
                        toggleGlobalAutoAssign();
                      } else {
                        navigator.clipboard.writeText(numbers.join('\n'));
                        toast.success(`Admission number ${numbers[0]} generated and copied to clipboard!`);
                      }
                      setShowAdmissionSeries(false);
                      setAutoAssign(false);
                    })
                    .catch(error => {
                      console.error('Generate series error:', error);
                      toast.error(error.response?.data?.message || 'Failed to generate admission series');
                    });
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Hash size={18} />
                {autoAssign ? 'Generate & Auto-Assign' : 'Generate & Copy'}
              </button>
              <button
                onClick={() => {
                  setShowAdmissionSeries(false);
                  setAutoAssign(false);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Submissions;
