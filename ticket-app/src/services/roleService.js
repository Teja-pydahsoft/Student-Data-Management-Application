import api from '../config/api';

/**
 * Get all roles
 */
export const getRoles = async (includeInactive = false) => {
    try {
        const response = await api.get('/roles', {
            params: { include_inactive: includeInactive }
        });
        return response.data;
    } catch (error) {
        console.error('Get Roles Error:', error);
        throw error.response?.data || error;
    }
};

/**
 * Get single role by ID
 */
export const getRole = async (roleId) => {
    try {
        const response = await api.get(`/roles/${roleId}`);
        return response.data;
    } catch (error) {
        console.error('Get Role Error:', error);
        throw error.response?.data || error;
    }
};

/**
 * Create new custom role
 */
export const createRole = async (roleData) => {
    try {
        const response = await api.post('/roles', roleData);
        return response.data;
    } catch (error) {
        console.error('Create Role Error:', error);
        throw error.response?.data || error;
    }
};

/**
 * Update existing role
 */
export const updateRole = async (roleId, roleData) => {
    try {
        const response = await api.put(`/roles/${roleId}`, roleData);
        return response.data;
    } catch (error) {
        console.error('Update Role Error:', error);
        throw error.response?.data || error;
    }
};

/**
 * Delete role
 */
export const deleteRole = async (roleId) => {
    try {
        const response = await api.delete(`/roles/${roleId}`);
        return response.data;
    } catch (error) {
        console.error('Delete Role Error:', error);
        throw error.response?.data || error;
    }
};

/**
 * Get modules structure (for building permission UI)
 */
export const getModulesStructure = async () => {
    try {
        const response = await api.get('/roles/modules');
        return response.data;
    } catch (error) {
        console.error('Get Modules Structure Error:', error);
        throw error.response?.data || error;
    }
};
