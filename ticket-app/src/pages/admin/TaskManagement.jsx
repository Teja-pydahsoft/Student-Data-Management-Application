import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Ticket,
    Search,
    UserPlus,
    Edit,
    Eye,
    CheckCircle,
    Clock,
    XCircle,
    Filter
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../../components/LoadingAnimation';
import '../../styles/admin-pages.css';

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

const TaskManagement = () => {
    const [activeTab, setActiveTab] = useState('pending'); // pending, assigned, resolved
    const [filters, setFilters] = useState({
        category_id: '',
        assigned_to: '',
        search: ''
    });
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);

    // Forms state
    const [assignForm, setAssignForm] = useState({ assigned_to: [], notes: '' });
    const [statusForm, setStatusForm] = useState({ status: '', notes: '' });
    const [commentForm, setCommentForm] = useState({ comment_text: '', is_internal: false });

    const queryClient = useQueryClient();

    // Map tabs to status array
    const getStatusesForTab = (tab) => {
        switch (tab) {
            case 'pending': return ['pending'];
            case 'assigned': return ['approaching', 'resolving'];
            case 'resolved': return ['completed', 'closed'];
            default: return [];
        }
    };

    // Queries
    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['tickets', activeTab, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            // We fetch all or filter client side if backend doesn't support multiple stats well
            // For now, let's just fetch default list and filter client side for tabs to ensure accuracy
            params.append('page', '1');
            params.append('limit', '200'); // Fetch more to filter locally for now
            const response = await api.get(`/tickets?${params.toString()}`);
            return response.data;
        }
    });

    const { data: usersData } = useQuery({
        queryKey: ['rbac-users'],
        queryFn: async () => {
            const response = await api.get('/rbac/users');
            return response.data?.data || [];
        }
    });

    const { data: categoriesData } = useQuery({
        queryKey: ['complaint-categories'],
        queryFn: async () => {
            const response = await api.get('/complaint-categories');
            return response.data?.data || [];
        }
    });

    // Mutations
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
            if (selectedTicket) queryClient.invalidateQueries(['ticket', selectedTicket.id]);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign ticket')
    });

    const statusMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.put(`/tickets/${ticketId}/status`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Status updated successfully');
            setShowStatusModal(false);
            setStatusForm({ status: '', notes: '' });
            queryClient.invalidateQueries(['tickets']);
            if (selectedTicket) queryClient.invalidateQueries(['ticket', selectedTicket.id]);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status')
    });

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
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to add comment')
    });

    // Filter Logic
    const allTickets = ticketsData?.data || [];
    const filteredTickets = allTickets.filter(ticket => {
        const statuses = getStatusesForTab(activeTab);
        const matchesStatus = statuses.includes(ticket.status);
        const matchesCategory = filters.category_id ? ticket.category_id === parseInt(filters.category_id) : true;
        // const matchesAssignee = filters.assigned_to ? ... : true; // Complex logic if array, simplified for now
        const matchesSearch = filters.search ?
            ticket.title.toLowerCase().includes(filters.search.toLowerCase()) ||
            ticket.ticket_number.toLowerCase().includes(filters.search.toLowerCase())
            : true;

        return matchesStatus && matchesCategory && matchesSearch;
    });

    // Handlers
    const handleAssign = () => {
        if (assignForm.assigned_to.length === 0) return toast.error('Select at least one user');
        assignMutation.mutate({ ticketId: selectedTicket.id, data: assignForm });
    };

    const handleStatusUpdate = () => {
        if (!statusForm.status) return toast.error('Select a status');
        statusMutation.mutate({ ticketId: selectedTicket.id, data: statusForm });
    };

    // Modal Openers
    const openAssignModal = (ticket) => {
        setSelectedTicket(ticket);
        setAssignForm({ assigned_to: ticket.assignments?.map(a => a.assigned_to) || [], notes: '' });
        setShowAssignModal(true);
    };

    const openStatusModal = (ticket) => {
        setSelectedTicket(ticket);
        setStatusForm({ status: ticket.status, notes: '' });
        setShowStatusModal(true);
    };

    if (isLoading) return <LoadingAnimation />;

    return (
        <div className="admin-page-container">
            {/* Header */}
            <div className="page-header animate-fade-in">
                <h1 className="page-title">Task Management</h1>
                <p className="page-subtitle">Track and manage support tickets</p>
            </div>

            {/* Main Content Card - Using CSSFlex via card-base */}
            <div className="card-base" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Tabs Section - Pure CSS */}
                <div className="admin-tabs-container">
                    <div className="admin-tabs-list">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`admin-tab-btn ${activeTab === 'pending' ? 'active-pending' : ''}`}
                        >
                            <Clock size={16} /> Pending
                        </button>
                        <button
                            onClick={() => setActiveTab('assigned')}
                            className={`admin-tab-btn ${activeTab === 'assigned' ? 'active-assigned' : ''}`}
                        >
                            <UserPlus size={16} /> Assigned / In Progress
                        </button>
                        <button
                            onClick={() => setActiveTab('resolved')}
                            className={`admin-tab-btn ${activeTab === 'resolved' ? 'active-resolved' : ''}`}
                        >
                            <CheckCircle size={16} /> Resolved
                        </button>
                    </div>
                </div>

                {/* Filters Section - Pure CSS */}
                <div className="admin-filters-section">
                    <div className="admin-filters-grid">
                        <div className="input-group-wrapper">
                            <Search className="input-icon" size={16} />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Search by ID or Title..."
                                className="input-with-icon"
                            />
                        </div>
                        <div className="input-group-wrapper">
                            <Filter className="input-icon" size={16} />
                            <select
                                value={filters.category_id}
                                onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                                className="input-with-icon"
                                style={{ appearance: 'none', cursor: 'pointer' }}
                            >
                                <option value="">All Categories</option>
                                {categoriesData?.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table Section - Pure CSS */}
                <div className="admin-table-scroll-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Ref #</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTickets.length > 0 ? (
                                filteredTickets.map((ticket) => (
                                    <tr key={ticket.id}>
                                        <td>
                                            <span className="text-sm font-bold text-gray-900">{ticket.ticket_number}</span>
                                            <div className="text-xs text-gray-500 mt-0.5">{new Date(ticket.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td>
                                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{ticket.title}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{ticket.student_name}</div>
                                        </td>
                                        <td>
                                            <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-200">
                                                {ticket.category_name}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${STATUS_COLORS[ticket.status]}`}>
                                                {STATUS_LABELS[ticket.status]}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setSelectedTicket(ticket)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="View Details">
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => openAssignModal(ticket)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100" title="Assign">
                                                    <UserPlus size={18} />
                                                </button>
                                                <button onClick={() => openStatusModal(ticket)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100" title="Update Status">
                                                    <Edit size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '4rem 0', textAlign: 'center' }}>
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                                <Ticket size={32} className="text-gray-300" />
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">No tickets found</p>
                                            <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {selectedTicket && !showAssignModal && !showStatusModal && !showCommentModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-lg">
                        <div className="modal-header">
                            <h2 className="modal-title">Ticket Details</h2>
                            <button onClick={() => setSelectedTicket(null)} className="modal-close-btn"><XCircle size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-gray-100 pb-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedTicket.ticket_number}</h3>
                                    <div className="flex gap-2">
                                        <span className={`status-badge ${STATUS_COLORS[selectedTicket.status]}`}>
                                            {STATUS_LABELS[selectedTicket.status]}
                                        </span>
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                                            {selectedTicket.category_name}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500">Created on</div>
                                    <div className="font-medium text-gray-900">{new Date(selectedTicket.created_at).toLocaleDateString()}</div>
                                    <div className="text-sm text-gray-500 mt-1">by {selectedTicket.student_name}</div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Issue Description</h4>
                                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {selectedTicket.description}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setSelectedTicket(null)} className="btn-secondary">Close</button>
                            <button onClick={() => openAssignModal(selectedTicket)} className="btn-primary">Assign To</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Modal */}
            {showAssignModal && selectedTicket && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-md">
                        <div className="modal-header">
                            <h2 className="modal-title">Assign Ticket</h2>
                            <button onClick={() => setShowAssignModal(false)} className="modal-close-btn"><XCircle size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl mb-6 p-2 custom-scrollbar bg-gray-50/50">
                                {usersData?.map((user) => (
                                    <label key={user.id} className="flex items-center p-3 hover:bg-white hover:shadow-sm cursor-pointer rounded-lg transition-all border border-transparent hover:border-gray-100 mb-1">
                                        <input
                                            type="checkbox"
                                            checked={assignForm.assigned_to.includes(user.id)}
                                            onChange={() => {
                                                const newAssigned = assignForm.assigned_to.includes(user.id)
                                                    ? assignForm.assigned_to.filter(id => id !== user.id)
                                                    : [...assignForm.assigned_to, user.id];
                                                setAssignForm({ ...assignForm, assigned_to: newAssigned });
                                            }}
                                            className="w-5 h-5 text-blue-600 rounded bg-gray-100 border-gray-300 focus:ring-blue-500"
                                        />
                                        <div className="ml-3">
                                            <div className="font-medium text-gray-900">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.role}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowAssignModal(false)} className="btn-secondary">Cancel</button>
                            <button onClick={handleAssign} disabled={assignMutation.isPending} className="btn-primary">
                                {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Modal */}
            {showStatusModal && selectedTicket && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-sm">
                        <div className="modal-header">
                            <h2 className="modal-title">Update Status</h2>
                            <button onClick={() => setShowStatusModal(false)} className="modal-close-btn"><XCircle size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div>
                                <label className="form-label">New Status</label>
                                <select
                                    value={statusForm.status}
                                    onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                                    className="form-input cursor-pointer"
                                >
                                    <option value="">Select Status</option>
                                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowStatusModal(false)} className="btn-secondary">Cancel</button>
                            <button onClick={handleStatusUpdate} disabled={statusMutation.isPending} className="btn-primary">
                                {statusMutation.isPending ? 'Updating...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskManagement;
