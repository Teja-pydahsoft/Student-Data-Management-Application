import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiShield, FiX } from 'react-icons/fi';
import { getRoles, createRole, updateRole, deleteRole } from '../../services/roleService';
import PermissionMatrix from '../../components/admin/PermissionMatrix';
import './RoleManagement.css';

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formData, setFormData] = useState({
        role_name: '',
        display_name: '',
        description: '',
        permissions: {}
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const response = await getRoles();
            setRoles(response.data || []);
        } catch (err) {
            console.error('Error fetching roles:', err);
            setError('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setFormData({
                role_name: role.role_name,
                display_name: role.display_name,
                description: role.description || '',
                permissions: role.permissions || {}
            });
        } else {
            setEditingRole(null);
            setFormData({
                role_name: '',
                display_name: '',
                description: '',
                permissions: initializeEmptyPermissions()
            });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRole(null);
        setFormData({
            role_name: '',
            display_name: '',
            description: '',
            permissions: {}
        });
        setError('');
    };

    const initializeEmptyPermissions = () => {
        return {
            ticket_dashboard: { read: false },
            ticket_management: { read: false, write: false, update: false, delete: false },
            employee_management: { read: false, write: false, update: false, delete: false },
            category_management: { read: false, write: false, update: false, delete: false },
            ticket_reports: { read: false, write: false, update: false, delete: false },
            ticket_settings: { read: false, write: false, update: false, delete: false }
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingRole) {
                // Update existing role
                await updateRole(editingRole.id, {
                    role_name: formData.role_name,
                    display_name: formData.display_name,
                    description: formData.description,
                    permissions: formData.permissions
                });
                setSuccess('Role updated successfully!');
            } else {
                // Create new role
                await createRole(formData);
                setSuccess('Role created successfully!');
            }

            await fetchRoles();
            setTimeout(() => {
                handleCloseModal();
            }, 1500);
        } catch (err) {
            console.error('Error saving role:', err);
            setError(err.message || 'Failed to save role');
        }
    };

    const handleDelete = async (roleId, roleName) => {
        if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
            return;
        }

        try {
            await deleteRole(roleId);
            setSuccess('Role deleted successfully!');
            await fetchRoles();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error deleting role:', err);
            setError(err.message || 'Failed to delete role');
            setTimeout(() => setError(''), 3000);
        }
    };

    if (loading) {
        return (
            <div className="role-management-page animate-pulse">
                <div className="role-management-header mb-8">
                    <div>
                        <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-96"></div>
                    </div>
                    <div className="h-10 bg-gray-200 rounded w-32"></div>
                </div>

                <div className="roles-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="role-card p-6 bg-white border rounded-lg h-64 flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-200"></div>
                                    <div className="space-y-2">
                                        <div className="h-5 bg-gray-200 rounded w-32"></div>
                                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <div className="h-8 bg-gray-200 rounded w-20"></div>
                                <div className="h-8 bg-gray-200 rounded w-20"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="role-management-page">
            <div className="role-management-header">
                <div>
                    <h1>Role Management</h1>
                    <p className="subtitle">Create and manage custom roles with granular permissions</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <FiPlus /> Create Role
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    {success}
                </div>
            )}

            <div className="roles-grid">
                {roles.map(role => (
                    <div key={role.id} className="role-card">
                        <div className="role-card-header">
                            <div className="role-icon">
                                <FiShield />
                            </div>
                            <div className="role-info">
                                <h3>{role.display_name}</h3>
                                {role.is_system_role && (
                                    <span className="badge badge-system">System Role</span>
                                )}
                            </div>
                        </div>

                        <p className="role-description">
                            {role.description || 'No description provided'}
                        </p>

                        <div className="role-stats">
                            <div className="stat">
                                <FiUsers />
                                <span>{role.employee_count || 0} employees</span>
                            </div>
                        </div>

                        <div className="role-permissions-summary">
                            <h4>Permissions</h4>
                            <div className="permission-tags">
                                {Object.entries(role.permissions || {}).map(([module, perms]) => {
                                    const activePerms = Object.entries(perms)
                                        .filter(([_, value]) => value === true)
                                        .map(([key]) => key);

                                    if (activePerms.length === 0) return null;

                                    return (
                                        <span key={module} className="permission-tag">
                                            {module.replace('ticket_', '').replace(/_/g, ' ')}
                                        </span>
                                    );
                                }).filter(Boolean)}
                            </div>
                        </div>

                        <div className="role-card-actions">
                            <button
                                className="btn-secondary btn-sm"
                                onClick={() => handleOpenModal(role)}
                            >
                                <FiEdit2 /> Edit
                            </button>
                            <button
                                className="btn-danger btn-sm"
                                onClick={() => handleDelete(role.id, role.display_name)}
                            >
                                <FiTrash2 /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Role Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
                            <button className="close-btn" onClick={handleCloseModal}>
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-error mb-4">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="alert alert-success mb-4">
                                        {success}
                                    </div>
                                )}

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Role Name *</label>
                                        <input
                                            type="text"
                                            value={formData.role_name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                role_name: e.target.value.toLowerCase().replace(/\s+/g, '_')
                                            })}
                                            placeholder="e.g., principal, supervisor"
                                            required
                                            className="form-input"
                                        />
                                        <small className="form-hint">
                                            Lowercase with underscores only.
                                        </small>
                                    </div>

                                    <div className="form-group">
                                        <label>Display Name *</label>
                                        <input
                                            type="text"
                                            value={formData.display_name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                display_name: e.target.value
                                            })}
                                            placeholder="e.g., Principal, Supervisor"
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            description: e.target.value
                                        })}
                                        placeholder="Brief description of this role's responsibilities"
                                        rows="3"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <PermissionMatrix
                                        permissions={formData.permissions}
                                        onChange={(newPermissions) => setFormData({
                                            ...formData,
                                            permissions: newPermissions
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleCloseModal}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingRole ? 'Update Role' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
