import api from '../config/api';

export const serviceService = {
    // Config (Admins)
    getAllServices: async () => {
        const response = await api.get('/services');
        return response.data;
    },

    createService: async (data) => {
        const response = await api.post('/services', data);
        return response.data;
    },

    updateService: async (id, data) => {
        const response = await api.put(`/services/${id}`, data);
        return response.data;
    },

    deleteService: async (id) => {
        const response = await api.delete(`/services/${id}`);
        return response.data;
    },

    // Requests
    getRequests: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        const response = await api.get(`/services/requests?${params}`);
        return response.data;
    },

    requestService: async (serviceId) => {
        const response = await api.post('/services/requests', { service_id: serviceId });
        return response.data;
    },

    updateRequestStatus: async (id, data) => {
        const response = await api.put(`/services/requests/${id}`, data);
        return response.data;
    },
};
