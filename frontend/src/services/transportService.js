import api from '../config/api';

const transportService = {
    getRoutes: () => {
        return api.get('/transport/routes');
    },

    getBuses: () => {
        return api.get('/transport/buses');
    },

    createRequest: (data) => {
        return api.post('/transport/request', data);
    },

    getMyRequests: () => {
        return api.get('/transport/my-requests');
    }
};

export default transportService;
