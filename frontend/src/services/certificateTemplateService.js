import api from '../config/api';

export const certificateTemplateService = {
    // Get all available variables
    getVariables: async () => {
        const response = await api.get('/certificate-templates/variables');
        return response.data;
    },

    // Get all templates
    getTemplates: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        const response = await api.get(`/certificate-templates?${params}`);
        return response.data;
    },

    // Get single template
    getTemplate: async (id) => {
        const response = await api.get(`/certificate-templates/${id}`);
        return response.data;
    },

    // Create template
    createTemplate: async (data) => {
        const response = await api.post('/certificate-templates', data);
        return response.data;
    },

    // Update template
    updateTemplate: async (id, data) => {
        const response = await api.put(`/certificate-templates/${id}`, data);
        return response.data;
    },

    // Delete template
    deleteTemplate: async (id) => {
        const response = await api.delete(`/certificate-templates/${id}`);
        return response.data;
    },

    // Upload header image
    uploadHeaderImage: async (templateId, file) => {
        const formData = new FormData();
        formData.append('header', file);
        const response = await api.post(`/certificate-templates/${templateId}/upload-header`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Upload footer image
    uploadFooterImage: async (templateId, file) => {
        const formData = new FormData();
        formData.append('footer', file);
        const response = await api.post(`/certificate-templates/${templateId}/upload-footer`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }
};
