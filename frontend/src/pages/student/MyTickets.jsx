import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Ticket,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import api from '../../config/api';
import LoadingAnimation from '../../components/LoadingAnimation';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approaching: 'bg-blue-100 text-blue-800 border-blue-200',
  resolving: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200'
};

const STATUS_LABELS = {
  pending: 'Pending',
  approaching: 'Approaching',
  resolving: 'Resolving',
  completed: 'Completed',
  closed: 'Closed'
};

const MyTickets = () => {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, feedback_text: '' });

  // Fetch student tickets
  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['student-tickets'],
    queryFn: async () => {
      const response = await api.get('/tickets/student/my-tickets');
      return response.data?.data || [];
    }
  });

  // Fetch ticket details
  const { data: ticketDetails } = useQuery({
    queryKey: ['ticket', selectedTicket?.id],
    queryFn: async () => {
      const response = await api.get(`/tickets/${selectedTicket.id}`);
      return response.data?.data;
    },
    enabled: !!selectedTicket
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ ticketId, data }) => {
      const response = await api.post(`/tickets/${ticketId}/feedback`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feedback submitted successfully');
      setShowFeedbackModal(false);
      setFeedbackForm({ rating: 5, feedback_text: '' });
      setSelectedTicket(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to submit feedback');
    }
  });

  const tickets = ticketsData || [];
  const ticket = ticketDetails || selectedTicket;

  const handleFeedbackSubmit = () => {
    if (!feedbackForm.rating) {
      toast.error('Please provide a rating');
      return;
    }
    feedbackMutation.mutate({
      ticketId: selectedTicket.id,
      data: feedbackForm
    });
  };

  if (isLoading) {
    return <LoadingAnimation />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-gray-600 mt-1">View and track your complaints</p>
        </div>
        <Link
          to="/student/raise-ticket"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Raise New Ticket
        </Link>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Ticket className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tickets yet</h3>
          <p className="text-gray-500 mb-6">You haven't raised any complaints yet.</p>
          <Link
            to="/student/raise-ticket"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Raise Your First Ticket
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{ticket.title}</h3>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[ticket.status] || ticket.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Ticket #:</strong> {ticket.ticket_number}</p>
                    <p><strong>Category:</strong> {ticket.category_name} {ticket.sub_category_name && `> ${ticket.sub_category_name}`}</p>
                    <p><strong>Created:</strong> {new Date(ticket.created_at).toLocaleString()}</p>
                  </div>
                  {ticket.description && (
                    <p className="text-sm text-gray-700 mt-3 line-clamp-2">{ticket.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setSelectedTicket(ticket)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="View Details"
                  >
                    <Eye size={20} />
                  </button>
                  {ticket.status === 'completed' && !ticket.feedback && (
                    <button
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setShowFeedbackModal(true);
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
                    >
                      <MessageSquare size={16} />
                      Feedback
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && !showFeedbackModal && (
        <TicketDetailsModal
          ticket={ticket}
          onClose={() => setSelectedTicket(null)}
          onFeedback={() => {
            if (ticket.status === 'completed' && !ticket.feedback) {
              setShowFeedbackModal(true);
            }
          }}
        />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedTicket && (
        <FeedbackModal
          ticket={selectedTicket}
          form={feedbackForm}
          setForm={setFeedbackForm}
          onClose={() => {
            setShowFeedbackModal(false);
            setSelectedTicket(null);
          }}
          onSubmit={handleFeedbackSubmit}
          loading={feedbackMutation.isPending}
        />
      )}
    </div>
  );
};

// Ticket Details Modal
const TicketDetailsModal = ({ ticket, onClose, onFeedback }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Ticket Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Ticket Number</label>
              <p className="text-lg font-semibold text-gray-900">{ticket.ticket_number}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`}>
                {STATUS_LABELS[ticket.status] || ticket.status}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Category</label>
              <p className="text-gray-900">{ticket.category_name} {ticket.sub_category_name && `> ${ticket.sub_category_name}`}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="text-gray-900">{new Date(ticket.created_at).toLocaleString()}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-500">Title</label>
              <p className="text-gray-900">{ticket.title}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-500">Description</label>
              <p className="text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
            </div>
            {ticket.photo_url && (
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500">Photo</label>
                <img src={ticket.photo_url} alt="Ticket photo" className="mt-2 max-w-md rounded-lg border" />
              </div>
            )}
          </div>

          {/* Assignments */}
          {ticket.assignments && ticket.assignments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Assigned To</h3>
              <div className="space-y-2">
                {ticket.assignments.map((assignment) => (
                  <div key={assignment.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{assignment.assigned_to_name}</p>
                    <p className="text-sm text-gray-500">{assignment.assigned_to_role}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments (non-internal only) */}
          {ticket.comments && ticket.comments.filter(c => !c.is_internal).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Comments</h3>
              <div className="space-y-3">
                {ticket.comments.filter(c => !c.is_internal).map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">{comment.user_name}</p>
                      <p className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-gray-700">{comment.comment_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          {ticket.feedback && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Feedback</h3>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⭐</span>
                  <span className="font-semibold text-gray-900">{ticket.feedback.rating}/5</span>
                </div>
                {ticket.feedback.feedback_text && (
                  <p className="text-gray-700">{ticket.feedback.feedback_text}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            {ticket.status === 'completed' && !ticket.feedback && (
              <button
                onClick={onFeedback}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Submit Feedback
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Feedback Modal
const FeedbackModal = ({ ticket, form, setForm, onClose, onSubmit, loading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Submit Feedback</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating *</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setForm({ ...form, rating })}
                  className={`text-3xl ${form.rating >= rating ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Selected: {form.rating}/5</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Feedback (Optional)</label>
            <textarea
              value={form.feedback_text}
              onChange={(e) => setForm({ ...form, feedback_text: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Share your experience..."
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTickets;

