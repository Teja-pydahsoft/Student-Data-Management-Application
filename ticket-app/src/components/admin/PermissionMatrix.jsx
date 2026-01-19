import React from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import './PermissionMatrix.css';

/**
 * Permission Matrix Component
 * Displays a grid of modules and their permissions (READ, WRITE, UPDATE, DELETE)
 * Similar to the UI shown in the Create Administrator modal
 */
const PermissionMatrix = ({
    permissions,
    onChange,
    disabled = false,
    modules = null  // Optional: custom modules structure
}) => {
    // Default modules structure
    const defaultModules = {
        ticket_dashboard: {
            label: 'Dashboard',
            permissions: {
                read: 'View Dashboard'
            }
        },
        ticket_management: {
            label: 'Ticket Management',
            permissions: {
                read: 'View Tickets',
                write: 'Create Tickets',
                update: 'Update Tickets',
                delete: 'Delete Tickets'
            }
        },
        employee_management: {
            label: 'Employee Management',
            permissions: {
                read: 'View Employees',
                write: 'Create Employees',
                update: 'Update Employees',
                delete: 'Remove Employees'
            }
        },
        category_management: {
            label: 'Category Management',
            permissions: {
                read: 'View Categories',
                write: 'Create Categories',
                update: 'Update Categories',
                delete: 'Delete Categories'
            }
        },
        ticket_reports: {
            label: 'Reports & Analytics',
            permissions: {
                read: 'View Reports',
                write: 'Generate Reports',
                update: 'Customize Reports',
                delete: 'Delete Reports'
            }
        },
        ticket_settings: {
            label: 'System Settings',
            permissions: {
                read: 'View Settings',
                write: 'Create Settings',
                update: 'Update Settings',
                delete: 'Delete Settings'
            }
        }
    };

    const modulesData = modules || defaultModules;

    const handlePermissionChange = (moduleKey, permissionKey, value) => {
        if (disabled) return;

        const updatedPermissions = {
            ...permissions,
            [moduleKey]: {
                ...(permissions[moduleKey] || {}),
                [permissionKey]: value
            }
        };

        onChange(updatedPermissions);
    };

    const hasAnyPermission = (moduleKey) => {
        const modulePerms = permissions[moduleKey];
        if (!modulePerms) return false;
        return Object.values(modulePerms).some(val => val === true);
    };

    return (
        <div className="permission-matrix">
            <div className="permission-matrix-header">
                <h3>Module Permissions</h3>
                <p className="text-sm text-gray-500">
                    Configure access permissions for each module
                </p>
            </div>

            <div className="permission-modules-grid">
                {Object.entries(modulesData).map(([moduleKey, moduleData]) => {
                    const modulePerms = permissions[moduleKey] || {};
                    const hasAccess = hasAnyPermission(moduleKey);

                    return (
                        <div
                            key={moduleKey}
                            className={`permission-module-card ${hasAccess ? 'has-access' : ''}`}
                        >
                            <div className="module-header">
                                <div className="module-icon">
                                    {hasAccess ? (
                                        <FiUnlock className="text-green-500" />
                                    ) : (
                                        <FiLock className="text-gray-400" />
                                    )}
                                </div>
                                <h4 className="module-title">{moduleData.label}</h4>
                            </div>

                            <div className="module-permissions">
                                {Object.entries(moduleData.permissions).map(([permKey, permLabel]) => (
                                    <label
                                        key={permKey}
                                        className={`permission-checkbox ${disabled ? 'disabled' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={modulePerms[permKey] === true}
                                            onChange={(e) => handlePermissionChange(
                                                moduleKey,
                                                permKey,
                                                e.target.checked
                                            )}
                                            disabled={disabled}
                                        />
                                        <span className="permission-label">
                                            <span className="permission-action">{permKey.toUpperCase()}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PermissionMatrix;
