import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Ticket,
    Search,
    UserPlus,
    Edit,
    Eye,
    Star,
    MessageSquare,
    XCircle
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

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

const TicketManagement = () => {
    const [filters, setFilters] = useState({
        status: '',
        category_id: '',
        assigned_to: '',
        search: ''
    });
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [assignForm, setAssignForm] = useState({ assigned_to: [], notes: '' });
    const [statusForm, setStatusForm] = useState({ status: '', notes: '' });
    const [commentForm, setCommentForm] = useState({ comment_text: '', is_internal: false });
    const queryClient = useQueryClient();

    // Fetch tickets
    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['tickets', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.category_id) params.append('category_id', filters.category_id);
            if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
            if (filters.search) params.append('search', filters.search);
            params.append('page', '1');
            params.append('limit', '100');

            const response = await api.get(`/tickets?${params.toString()}`);
            return response.data;
        }
    });

    // Fetch RBAC users for assignment
    const { data: usersData } = useQuery({
        queryKey: ['rbac-users'],
        queryFn: async () => {
            const response = await api.get('/rbac/users');
            return response.data?.data || [];
        }
    });

    // Fetch categories
    const { data: categoriesData } = useQuery({
        queryKey: ['complaint-categories'],
        queryFn: async () => {
            const response = await api.get('/complaint-categories');
            return response.data?.data || [];
        }
    });

    // Fetch ticket stats
    const { data: statsData } = useQuery({
        queryKey: ['ticket-stats'],
        queryFn: async () => {
            const response = await api.get('/tickets/stats');
            return response.data?.data || {};
        }
    });

    // Assign ticket mutation
    const assignMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.post(`/tickets/${ticketId}/assign`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Ticket assigned successfully');
            setShowAssignModal(false);
            setAssignForm({ assigned_to: [], notes: '' });
            queryClient.invalidateQueries(['tickets']);
            if (selectedTicket) {
                queryClient.invalidateQueries(['ticket', selectedTicket.id]);
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to assign ticket');
        }
    });

    // Update status mutation
    const statusMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.put(`/tickets/${ticketId}/status`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Ticket status updated successfully');
            setShowStatusModal(false);
            setStatusForm({ status: '', notes: '' });
            queryClient.invalidateQueries(['tickets']);
            if (selectedTicket) {
                queryClient.invalidateQueries(['ticket', selectedTicket.id]);
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    });

    // Add comment mutation
    const commentMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.post(`/tickets/${ticketId}/comments`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Comment added successfully');
            setShowCommentModal(false);
            setCommentForm({ comment_text: '', is_internal: false });
            queryClient.invalidateQueries(['ticket', selectedTicket?.id]);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to add comment');
        }
    });

    // Fetch single ticket details
    const { data: ticketDetails } = useQuery({
        queryKey: ['ticket', selectedTicket?.id],
        queryFn: async () => {
            const response = await api.get(`/tickets/${selectedTicket.id}`);
            return response.data?.data;
        },
        enabled: !!selectedTicket
    });

    const tickets = ticketsData?.data || [];
    const stats = statsData || {};

    const handleAssign = () => {
        if (assignForm.assigned_to.length === 0) {
            toast.error('Please select at least one user');
            return;
        }
        assignMutation.mutate({
            ticketId: selectedTicket.id,
            data: assignForm
        });
    };

    const handleStatusUpdate = () => {
        if (!statusForm.status) {
            toast.error('Please select a status');
            return;
        }
        statusMutation.mutate({
            ticketId: selectedTicket.id,
            data: statusForm
        });
    };

    const handleAddComment = () => {
        if (!commentForm.comment_text.trim()) {
            toast.error('Please enter a comment');
            return;
        }
        commentMutation.mutate({
            ticketId: selectedTicket.id,
            data: commentForm
        });
    };

    const openAssignModal = (ticket) => {
        setSelectedTicket(ticket);
        setAssignForm({
            assigned_to: ticket.assignments?.map(a => a.assigned_to) || [],
            notes: ''
        });
        setShowAssignModal(true);
    };

    const openStatusModal = (ticket) => {
        setSelectedTicket(ticket);
        setStatusForm({
            status: ticket.status,
            notes: ''
        });
        setShowStatusModal(true);
    };

    const openCommentModal = (ticket) => {
        setSelectedTicket(ticket);
        setCommentForm({ comment_text: '', is_internal: false });
        setShowCommentModal(true);
    };

    if (isLoading) {
        return <LoadingAnimation />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Ticket Management</h1>
                    <p className="text-gray-600 mt-1">Manage and track student complaints</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {stats.by_status?.map((stat) => (
                    <div key={stat.status} className="bg-white rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{STATUS_LABELS[stat.status] || stat.status}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.count}</p>
                            </div>
                            <div className={`p-2 rounded-lg ${STATUS_COLORS[stat.status] || 'bg-gray-100'}`}>
                                <Ticket size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Statuses</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                            value={filters.category_id}
                            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Categories</option>
                            {categoriesData?.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                        <select
                            value={filters.assigned_to}
                            onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Users</option>
                            {usersData?.map((user) => (
                                <option key={user.id} value={user.id}>{user.name} ({user.username})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Search tickets..."
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-medium text-gray-900">{ticket.ticket_number}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{ticket.student_name}</div>
                                            <div className="text-sm text-gray-500">{ticket.admission_number}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm text-gray-900">{ticket.category_name}</div>
                                            {ticket.sub_category_name && (
                                                <div className="text-xs text-gray-500">{ticket.sub_category_name}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 max-w-xs truncate">{ticket.title}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`}>
                                            {STATUS_LABELS[ticket.status] || ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{ticket.assigned_users || 'Unassigned'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(ticket.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => openAssignModal(ticket)}
                                                className="text-green-600 hover:text-green-900"
                                                title="Assign"
                                            >
                                                <UserPlus size={16} />
                                            </button>
                                            <button
                                                onClick={() => openStatusModal(ticket)}
                                                className="text-purple-600 hover:text-purple-900"
                                                title="Update Status"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tickets.length === 0 && (
                        <div className="text-center py-12">
                            <Ticket className="mx-auto text-gray-400" size={48} />
                            <p className="mt-4 text-gray-500">No tickets found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Details Modal */}
            {selectedTicket && !showAssignModal && !showStatusModal && !showCommentModal && (
                <TicketDetailsModal
                    ticket={ticketDetails || selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onAssign={() => openAssignModal(selectedTicket)}
                    onStatusUpdate={() => openStatusModal(selectedTicket)}
                    onAddComment={() => openCommentModal(selectedTicket)}
                />
            )}

            {/* Assign Modal */}
            {showAssignModal && selectedTicket && (
                <AssignModal
                    ticket={selectedTicket}
                    users={usersData || []}
                    form={assignForm}
                    setForm={setAssignForm}
                    onClose={() => setShowAssignModal(false)}
                    onAssign={handleAssign}
                    loading={assignMutation.isPending}
                />
            )}

            {/* Status Update Modal */}
            {showStatusModal && selectedTicket && (
                <StatusModal
                    ticket={selectedTicket}
                    form={statusForm}
                    setForm={setStatusForm}
                    onClose={() => setShowStatusModal(false)}
                    onUpdate={handleStatusUpdate}
                    loading={statusMutation.isPending}
                />
            )}

            {/* Comment Modal */}
            {showCommentModal && selectedTicket && (
                <CommentModal
                    ticket={selectedTicket}
                    form={commentForm}
                    setForm={setCommentForm}
                    onClose={() => setShowCommentModal(false)}
                    onAdd={handleAddComment}
                    loading={commentMutation.isPending}
                />
            )}
        </div>
    );
};

// Ticket Details Modal Component
const TicketDetailsModal = ({ ticket, onClose, onAssign, onStatusUpdate, onAddComment }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Ticket Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Ticket Info */}
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
                            <label className="text-sm font-medium text-gray-500">Student</label>
                            <p className="text-gray-900">{ticket.student_name} ({ticket.admission_number})</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-500">Category</label>
                            <p className="text-gray-900">{ticket.category_name} {ticket.sub_category_name && `> ${ticket.sub_category_name}`}</p>
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
                                    <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{assignment.assigned_to_name}</p>
                                            <p className="text-sm text-gray-500">{assignment.assigned_to_role}</p>
                                        </div>
                                        <p className="text-sm text-gray-500">{new Date(assignment.assigned_at).toLocaleDateString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    {ticket.comments && ticket.comments.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Comments</h3>
                            <div className="space-y-3">
                                {ticket.comments.map((comment) => (
                                    <div key={comment.id} className={`p-3 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-medium text-gray-900">{comment.user_name}</p>
                                            <p className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</p>
                                        </div>
                                        <p className="text-gray-700">{comment.comment_text}</p>
                                        {comment.is_internal && (
                                            <span className="inline-block mt-2 text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded">Internal Note</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    {ticket.feedback && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Feedback</h3>
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Star className="text-yellow-500 fill-yellow-500" size={20} />
                                    <span className="font-semibold text-gray-900">{ticket.feedback.rating}/5</span>
                                </div>
                                {ticket.feedback.feedback_text && (
                                    <p className="text-gray-700">{ticket.feedback.feedback_text}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t">
                        <button
                            onClick={onAssign}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            <UserPlus size={18} />
                            Assign
                        </button>
                        <button
                            onClick={onStatusUpdate}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                        >
                            <Edit size={18} />
                            Update Status
                        </button>
                        <button
                            onClick={onAddComment}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            <MessageSquare size={18} />
                            Add Comment
                        </button>
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

// Assign Modal Component
const AssignModal = ({ ticket, users, form, setForm, onClose, onAssign, loading }) => {
    const toggleUser = (userId) => {
        if (form.assigned_to.includes(userId)) {
            setForm({ ...form, assigned_to: form.assigned_to.filter(id => id !== userId) });
        } else {
            setForm({ ...form, assigned_to: [...form.assigned_to, userId] });
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full">
                <div className="p-6 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Assign Ticket</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Users</label>
                        <div className="border rounded-lg max-h-64 overflow-y-auto">
                            {users.map((user) => (
                                <label key={user.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                                    <input
                                        type="checkbox"
                                        checked={form.assigned_to.includes(user.id)}
                                        onChange={() => toggleUser(user.id)}
                                        className="mr-3"
                                    />
                                    <div>
                                        <p className="font-medium text-gray-900">{user.name}</p>
                                        <p className="text-sm text-gray-500">{user.username} • {user.role}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Add assignment notes..."
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
                            onClick={onAssign}
                            disabled={loading || form.assigned_to.length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Assigning...' : 'Assign'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Status Modal Component
const StatusModal = ({ ticket, form, setForm, onClose, onUpdate, loading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Update Status</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Add status update notes..."
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
                            onClick={onUpdate}
                            disabled={loading || !form.status}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Updating...' : 'Update Status'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Comment Modal Component
const CommentModal = ({ ticket, form, setForm, onClose, onAdd, loading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full">
                <div className="p-6 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Add Comment</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
                        <textarea
                            value={form.comment_text}
                            onChange={(e) => setForm({ ...form, comment_text: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={5}
                            placeholder="Enter your comment..."
                        />
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="is_internal"
                            checked={form.is_internal}
                            onChange={(e) => setForm({ ...form, is_internal: e.target.checked })}
                            className="mr-2"
                        />
                        <label htmlFor="is_internal" className="text-sm text-gray-700">
                            Internal note (not visible to student)
                        </label>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onAdd}
                            disabled={loading || !form.comment_text.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Adding...' : 'Add Comment'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketManagement;
