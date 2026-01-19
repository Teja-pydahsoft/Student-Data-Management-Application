import axios from 'axios';

const API_URL = import.meta.env.VITE_TICKET_API_URL || 'http://localhost:5001/api';

// Get auth token
const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Get all roles
 */
export const getRoles = async (includeInactive = false) => {
    try {
        const response = await axios.get(`${API_URL}/roles`, {
            headers: getAuthHeader(),
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
        const response = await axios.get(`${API_URL}/roles/${roleId}`, {
            headers: getAuthHeader()
        });
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
        const response = await axios.post(`${API_URL}/roles`, roleData, {
            headers: getAuthHeader()
        });
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
        const response = await axios.put(`${API_URL}/roles/${roleId}`, roleData, {
            headers: getAuthHeader()
        });
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
        const response = await axios.delete(`${API_URL}/roles/${roleId}`, {
            headers: getAuthHeader()
        });
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
        const response = await axios.get(`${API_URL}/roles/modules`, {
            headers: getAuthHeader()
        });
        return response.data;
    } catch (error) {
        console.error('Get Modules Structure Error:', error);
        throw error.response?.data || error;
    }
};
