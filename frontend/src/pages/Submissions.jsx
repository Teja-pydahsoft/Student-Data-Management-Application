import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Trash2, Filter, Upload, Plus, Hash, CheckSquare, Square, UserPlus, User, Phone, MapPin, GraduationCap, Calendar, FileText, X, QrCode, Link2, Copy } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import BulkUploadModal from '../components/BulkUploadModal';
import IndividualStudentModal from '../components/IndividualStudentModal';
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
  const [showIndividualStudent, setShowIndividualStudent] = useState(false);
  const [showAdmissionSeries, setShowAdmissionSeries] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [formLink, setFormLink] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
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
    setFormsLoading(true);
    try {
      const response = await api.get('/forms');
      const activeForms = response.data.data.filter(f => f.is_active);
      setForms(activeForms);
      
      // Generate form link for the first active form
      if (activeForms.length > 0) {
        const baseUrl = window.location.origin;
        setFormLink(`${baseUrl}/form/${activeForms[0].form_id}`);
      }
    } catch (error) {
      console.error('Failed to fetch forms');
      toast.error('Failed to load forms. Please refresh the page.');
    } finally {
      setFormsLoading(false);
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
      const submissionData = response.data.data;
      setSelectedSubmission(submissionData);
      setAdmissionNumber(submissionData.admission_number || '');

      // Auto-generate admission number if auto-assign is enabled and no admission number exists
      if (globalAutoAssign && !submissionData.admission_number) {
        try {
          // Get the batch/academic year from submission data
          const batchYear = submissionData.submission_data?.batch || 
                           submissionData.submission_data?.academic_year ||
                           new Date().getFullYear().toString();
          
          const genResponse = await api.post('/submissions/generate-admission-series', { 
            autoAssign: false,
            academicYear: batchYear
          });
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

  

  const copyFormLink = () => {
    if (formLink) {
      navigator.clipboard.writeText(formLink);
      toast.success('Form link copied to clipboard!');
    } else {
      toast.error('No form link available');
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pre Registration</h1>
          <p className="text-gray-600 mt-2">Manage student registrations and approvals</p>
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
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            title="Show QR Code"
          >
            <QrCode size={18} />
            QR Code
          </button>
          <button
            onClick={copyFormLink}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            title="Copy Form Link"
          >
            <Copy size={18} />
            Copy Link
          </button>
          <button
            onClick={() => setShowIndividualStudent(true)}
            disabled={formsLoading || forms.length === 0}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={formsLoading ? 'Loading forms...' : forms.length === 0 ? 'No forms available' : 'Add a new student'}
          >
            <UserPlus size={18} />
            {formsLoading ? 'Loading...' : 'Add Student'}
          </button>
          <button
            onClick={() => setShowBulkUpload(true)}
            disabled={formsLoading || forms.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={formsLoading ? 'Loading forms...' : forms.length === 0 ? 'No forms available' : 'Upload students in bulk'}
          >
            <Upload size={18} />
            {formsLoading ? 'Loading...' : 'Bulk Upload'}
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
          <div className="bg-gray-50 rounded-xl shadow-2xl max-w-6xl w-full h-[95vh] flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Student Submission Details</h3>
                <p className="text-sm text-gray-500 mt-1">Review and approve student submission</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  selectedSubmission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                  selectedSubmission.status === 'approved' ? 'bg-green-100 text-green-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedSubmission.status.charAt(0).toUpperCase() + selectedSubmission.status.slice(1)}
                </span>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="flex-1 overflow-hidden">
              <div className="flex h-full">
                {/* Left Sidebar - Student Photo & Key Info */}
                <div className="w-80 bg-white border-r border-gray-200 p-6 flex-shrink-0 flex flex-col overflow-y-auto">
                  <div className="space-y-5">
                    {/* Student Photo */}
                    <div className="flex flex-col items-center">
                      <div className="w-32 h-32 rounded-xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center shadow-sm">
                        {selectedSubmission.submission_data.student_photo ? (
                          <img
                            src={selectedSubmission.submission_data.student_photo}
                            alt="Student Photo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-center">
                            <User size={48} className="mx-auto text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">No Photo</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Key Identity Info */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Student Name
                        </label>
                        <p className="text-lg font-bold text-gray-900">
                          {selectedSubmission.submission_data.student_name || selectedSubmission.submission_data['Student Name'] || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Father Name
                        </label>
                        <p className="text-sm font-semibold text-gray-700">
                          {selectedSubmission.submission_data.father_name || selectedSubmission.submission_data['Father Name'] || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          College
                        </label>
                        <p className="text-sm font-semibold text-gray-700">
                          {selectedSubmission.submission_data.college || selectedSubmission.submission_data['College'] || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Course & Branch
                        </label>
                        <p className="text-sm font-semibold text-gray-700">
                          {selectedSubmission.submission_data.course || '-'} - {selectedSubmission.submission_data.branch || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Batch
                        </label>
                        <p className="text-sm font-semibold text-indigo-700">
                          {selectedSubmission.submission_data.batch || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Submitted At
                        </label>
                        <p className="text-sm text-gray-600">
                          {formatDate(selectedSubmission.submitted_at)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Submitted By
                        </label>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          selectedSubmission.submitted_by === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedSubmission.submitted_by === 'admin' ? '👤 Admin' : '🎓 Student'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - All Student Data */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Academic Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <GraduationCap size={16} className="text-blue-600" />
                        Academic Information
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Current Year</label>
                            <p className="text-sm font-semibold text-gray-800">
                              Year {selectedSubmission.submission_data.current_year || selectedSubmission.submission_data['Current Academic Year'] || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Semester</label>
                            <p className="text-sm font-semibold text-gray-800">
                              Sem {selectedSubmission.submission_data.current_semester || selectedSubmission.submission_data['Current Semester'] || '-'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Student Type</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.stud_type || selectedSubmission.submission_data['StudType'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Student Status</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.student_status || selectedSubmission.submission_data['Student Status'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Scholar Status</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.scholar_status || selectedSubmission.submission_data['Scholar Status'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Previous College</label>
                          <p className="text-sm text-gray-800">
                            {selectedSubmission.submission_data.previous_college || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Phone size={16} className="text-green-600" />
                        Contact Information
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Student Mobile</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.student_mobile || selectedSubmission.submission_data['Student Mobile Number'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Parent Mobile 1</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.parent_mobile1 || selectedSubmission.submission_data['Parent Mobile Number 1'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Parent Mobile 2</label>
                          <p className="text-sm text-gray-800">
                            {selectedSubmission.submission_data.parent_mobile2 || selectedSubmission.submission_data['Parent Mobile Number 2'] || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <User size={16} className="text-purple-600" />
                        Personal Information
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
                            <p className="text-sm font-semibold text-gray-800">
                              {selectedSubmission.submission_data.gender === 'M' ? 'Male' : 
                               selectedSubmission.submission_data.gender === 'F' ? 'Female' : 
                               selectedSubmission.submission_data.gender || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
                            <p className="text-sm font-semibold text-gray-800">
                              {selectedSubmission.submission_data.dob || '-'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Caste</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.caste || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Aadhaar Number</label>
                          <p className="text-sm text-gray-800">
                            {selectedSubmission.submission_data.adhar_no || selectedSubmission.submission_data['AADHAR No'] || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">PIN Number</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.pin_no || selectedSubmission.submission_data['Pin Number'] || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <MapPin size={16} className="text-red-600" />
                        Address Information
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                          <p className="text-sm text-gray-800">
                            {selectedSubmission.submission_data.student_address || selectedSubmission.submission_data['Student Address'] || '-'}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">City/Village</label>
                            <p className="text-sm text-gray-800">
                              {selectedSubmission.submission_data.city_village || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Mandal</label>
                            <p className="text-sm text-gray-800">
                              {selectedSubmission.submission_data.mandal_name || '-'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">District</label>
                            <p className="text-sm text-gray-800">
                              {selectedSubmission.submission_data.district || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 col-span-2">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText size={16} className="text-orange-600" />
                        Additional Information
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Certificates Status</label>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedSubmission.submission_data.certificates_status || '-'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Remarks</label>
                          <p className="text-sm text-gray-800">
                            {selectedSubmission.submission_data.remarks || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Approval Actions */}
            <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0 rounded-b-xl">
              {selectedSubmission.status === 'pending' ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1 max-w-md">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Admission Number <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={admissionNumber} 
                        onChange={(e) => setAdmissionNumber(e.target.value)} 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" 
                        placeholder="Enter admission number to approve" 
                      />
                    </div>
                    <div className="flex-1 max-w-md">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rejection Reason (optional)
                      </label>
                      <input 
                        type="text" 
                        value={rejectionReason} 
                        onChange={(e) => setRejectionReason(e.target.value)} 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" 
                        placeholder="Enter reason if rejecting" 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <button 
                      onClick={handleApprove} 
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                    >
                      <CheckCircle size={18} />
                      Approve & Add to Database
                    </button>
                    <button 
                      onClick={handleReject} 
                      className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                    <button 
                      onClick={() => setShowModal(false)} 
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        forms={forms}
        isLoadingForms={formsLoading}
        onUploadComplete={fetchSubmissions}
      />

      <IndividualStudentModal
        isOpen={showIndividualStudent}
        onClose={() => setShowIndividualStudent(false)}
        forms={forms}
        isLoadingForms={formsLoading}
        onSubmitComplete={fetchSubmissions}
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

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Registration Form QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Scan this QR code to access the student registration form
              </p>
              
              {formLink && (
                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formLink)}`}
                    alt="Registration Form QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Form Link:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formLink}
                    readOnly
                    className="flex-1 text-sm text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 outline-none"
                  />
                  <button
                    onClick={copyFormLink}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Copy Link"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => {
                    window.open(formLink, '_blank');
                  }}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Link2 size={18} />
                  Open Form
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Submissions;
