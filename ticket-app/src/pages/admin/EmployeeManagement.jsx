import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users,
    UserPlus,
    Trash2,
    Edit,
    Search,
    Phone,
    Mail,
    Filter
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../../components/LoadingAnimation';
import EmployeeModal from '../../components/admin/EmployeeModal';
import '../../styles/admin-pages.css';

const EmployeeManagement = () => {
    const [activeRole, setActiveRole] = useState('all'); // all, staff, worker
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const queryClient = useQueryClient();

    // Fetch employees (from ticket_employees table)
    const { data: employeesData, isLoading } = useQuery({
        queryKey: ['ticket-employees'],
        queryFn: async () => {
            const response = await api.get('/employees');
            return response.data?.data || [];
        }
    });

    // Fetch available RBAC users (not yet assigned as employees)
    const { data: availableUsersData } = useQuery({
        queryKey: ['available-rbac-users'],
        queryFn: async () => {
            const response = await api.get('/employees/available-users');
            return response.data?.data || [];
        }
    });

    // Mutations
    const mutationConfig = {
        onSuccess: () => {
            toast.success(editingUser ? 'Employee updated' : 'Employee assigned');
            closeModal();
            queryClient.invalidateQueries(['ticket-employees']);
            queryClient.invalidateQueries(['available-rbac-users']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Operation failed')
    };

    const createMutation = useMutation({
        mutationFn: (data) => api.post('/employees', data),
        ...mutationConfig
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
        ...mutationConfig
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/employees/${id}`),
        onSuccess: () => {
            toast.success('Employee removed');
            queryClient.invalidateQueries(['ticket-employees']);
            queryClient.invalidateQueries(['available-rbac-users']);
        },
        onError: (err) => toast.error('Failed to delete employee')
    });

    // Mutation for creating new RBAC user
    const createRbacUserMutation = useMutation({
        mutationFn: (data) => api.post('/rbac/users', data),
        onSuccess: async (response, variables) => {
            const newUserId = response.data?.data?.id;
            if (newUserId) {
                // After creating RBAC user, assign them as employee
                createMutation.mutate({
                    rbac_user_id: newUserId,
                    role: variables.role,
                    assigned_categories: variables.assigned_categories || [],
                    assigned_subcategories: variables.assigned_subcategories || []
                });
            } else {
                toast.success('User created successfully');
                closeModal();
                queryClient.invalidateQueries(['available-rbac-users']);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to create user')
    });

    // Filtering
    const employees = employeesData || [];
    const filteredEmployees = employees.filter(employee => {
        const matchesRole = activeRole === 'all' ? true : employee.role === activeRole;
        const name = employee.name?.toLowerCase() || '';
        const email = employee.email?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        const matchesSearch = name.includes(search) || email.includes(search);
        return matchesRole && matchesSearch;
    });

    const handleModalSubmit = (type, payload) => {
        if (type === 'assign') {
            if (!payload.rbac_user_id) return toast.error('Please select a user');
            createMutation.mutate({
                rbac_user_id: payload.rbac_user_id,
                role: payload.role,
                assigned_categories: payload.assigned_categories,
                assigned_subcategories: payload.assigned_subcategories
            });
        } else if (type === 'update') {
            updateMutation.mutate({
                id: payload.id,
                data: {
                    role: payload.role,
                    assigned_categories: payload.assigned_categories,
                    assigned_subcategories: payload.assigned_subcategories
                }
            });
        }
    };

    const handleCreateNewUser = (userData) => {
        // Validate required fields
        if (!userData.name || !userData.email || !userData.username || !userData.password) {
            return toast.error('All fields are required');
        }

        // Create RBAC user with the selected role and categories
        createRbacUserMutation.mutate({
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            username: userData.username,
            password: userData.password,
            role: userData.role,
            assigned_categories: userData.assigned_categories,
            assigned_subcategories: userData.assigned_subcategories
        });
    };

    const openModal = (user = null) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingUser(null);
    };

    if (isLoading) return <LoadingAnimation />;

    return (
        <div className="admin-page-container">
            <div className="page-header animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="page-title">Employee Management</h1>
                        <p className="page-subtitle">Manage ticket managers and field workers</p>
                    </div>
                    <button onClick={() => openModal()} className="btn-primary">
                        <UserPlus size={20} />
                        {activeRole === 'worker' ? 'Add Worker' : activeRole === 'staff' ? 'Add Manager' : 'Add Employee'}
                    </button>
                </div>
            </div>

            <div className="card-base" style={{ padding: 0 }}>

                {/* Tabs */}
                <div className="admin-tabs-container">
                    <div className="admin-tabs-list">
                        <button
                            onClick={() => setActiveRole('all')}
                            className={`admin-tab-btn ${activeRole === 'all' ? 'active-assigned' : ''}`}
                        >
                            All Employees
                        </button>
                        <button
                            onClick={() => setActiveRole('staff')}
                            className={`admin-tab-btn ${activeRole === 'staff' ? 'active-assigned' : ''}`}
                        >
                            Managers
                        </button>
                        <button
                            onClick={() => setActiveRole('worker')}
                            className={`admin-tab-btn ${activeRole === 'worker' ? 'active-resolved' : ''}`}
                        >
                            Workers
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="admin-filters-section">
                    <div className="input-group-wrapper" style={{ maxWidth: '100%' }}>
                        <Search className="input-icon" size={16} />
                        <input
                            className="input-with-icon"
                            placeholder="Search employees by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="card-body">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredEmployees.length > 0 ? (
                            filteredEmployees.map(employee => (
                                <div key={employee.id} className="admin-list-item relative overflow-hidden group hover:border-blue-200 transition-all">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${employee.role === 'staff' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${employee.role === 'staff' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                                {employee.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 line-clamp-1">{employee.name}</h3>
                                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{employee.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openModal(employee)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                                            <button onClick={() => { if (window.confirm('Remove employee?')) deleteMutation.mutate(employee.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Mail size={14} className="text-gray-400" />
                                            <span className="truncate">{employee.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone size={14} className="text-gray-400" />
                                            <span>{employee.phone || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full">
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <Search size={32} />
                                    </div>
                                    <p className="empty-state-text">No employees found matching your filters.</p>
                                    <button onClick={() => { setActiveRole('all'); setSearchTerm(''); }} className="empty-state-action">
                                        Clear filters
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <EmployeeModal
                isOpen={showModal}
                onClose={closeModal}
                user={editingUser}
                activeRole={activeRole}
                existingUsers={availableUsersData}
                onSubmit={handleModalSubmit}
                onCreateNewUser={handleCreateNewUser}
                isSubmitting={createMutation.isPending || updateMutation.isPending || createRbacUserMutation.isPending}
            />
        </div>
    );
};

export default EmployeeManagement;
