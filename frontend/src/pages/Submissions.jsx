import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Trash2, Filter, Upload, Plus, Hash } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import BulkUploadModal from '../components/BulkUploadModal';
import LoadingAnimation from '../components/LoadingAnimation';

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

  useEffect(() => {
    fetchSubmissions();
    fetchForms();
  }, [filter]);

  const fetchForms = async () => {
    try {
      const response = await api.get('/forms');
      setForms(response.data.data.filter(f => f.is_active));
    } catch (error) {
      console.error('Failed to fetch forms');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={120}
            height={120}
            message="Loading submissions..."
          />
          <div className="space-y-2">
            <p className="text-lg font-medium text-text-primary">Loading Submissions Database</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-600 mt-2">Review and approve student form submissions</p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 w-fit">
        {['pending', 'approved', 'rejected'].map((status) => (
          <button key={status} onClick={() => setFilter(status)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === status ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Form Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Admission Number</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Submitted By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Submitted At</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.submission_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{submission.form_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{submission.admission_number || 'N/A'}</td>
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
                    <td className="py-3 px-4 text-sm text-gray-600">{new Date(submission.submitted_at).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleViewDetails(submission.submission_id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => handleDelete(submission.submission_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
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
                <p className="text-gray-900">{new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
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

      {/* Admission Number Series Modal */}
      {showAdmissionSeries && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Generate Admission Series</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Series Prefix</label>
                <input
                  type="text"
                  id="seriesPrefix"
                  defaultValue="PYDAH2025"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Enter series prefix (e.g., PYDAH2025)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Count</label>
                <input
                  type="number"
                  id="seriesCount"
                  defaultValue="10"
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Number of admission numbers to generate"
                />
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
                  Auto-assign to pending submissions
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  const prefix = document.getElementById('seriesPrefix').value;
                  const count = parseInt(document.getElementById('seriesCount').value);

                  if (!prefix.trim()) {
                    toast.error('Series prefix is required');
                    return;
                  }

                  if (count <= 0) {
                    toast.error('Count must be greater than 0');
                    return;
                  }

                  api.post('/submissions/generate-admission-series', {
                    prefix: prefix.trim(),
                    count,
                    autoAssign
                  })
                    .then(response => {
                      const data = response.data.data;
                      const numbers = data.admissionNumbers;

                      if (autoAssign) {
                        toast.success(`Generated and auto-assigned ${numbers.length} admission numbers to pending submissions!`);
                        fetchSubmissions(); // Refresh to show updated admission numbers
                      } else {
                        navigator.clipboard.writeText(numbers.join('\n'));
                        toast.success(`${numbers.length} admission numbers generated and copied to clipboard!`);
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
