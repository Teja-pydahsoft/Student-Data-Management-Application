import api from '../config/api';

const getClubs = async () => {
    const response = await api.get('/clubs');
    return response.data;
};

const getClubDetails = async (clubId) => {
    const response = await api.get(`/clubs/${clubId}`);
    return response.data;
};

const createClub = async (clubData) => {
    // If clubData is FormData, send as is. If it's an object with a file, convert.
    // Assuming UI sends FormData if file exists, or we handle it here.
    // Let's enforce UI sending FormData or standard object.
    // If we want to accept object and convert:
    const isFormData = clubData instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};

    const response = await api.post('/clubs', clubData, config);
    return response.data;
};

const joinClub = async (clubId) => {
    const response = await api.post(`/clubs/${clubId}/join`);
    return response.data;
};

const updateMembershipStatus = async (clubId, studentId, status) => {
    const response = await api.patch(`/clubs/${clubId}/members`, { studentId, status });
    return response.data;
};

const createActivity = async (clubId, activityData) => {
    const isFormData = activityData instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};

    const response = await api.post(`/clubs/${clubId}/activities`, activityData, config);
    return response.data;
};

const updateClub = async (clubId, formData) => {
    // Determine content type based on if formData is FormData
    const isFormData = formData instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.put(`/clubs/${clubId}`, formData, config);
    return response.data;
};

const deleteClub = async (clubId) => {
    const response = await api.delete(`/clubs/${clubId}`);
    return response.data;
};

export default {
    getClubs,
    getClubDetails,
    createClub,
    joinClub,
    updateMembershipStatus,
    joinClub,
    updateMembershipStatus,
    createActivity,
    updateClub,
    deleteClub
};
