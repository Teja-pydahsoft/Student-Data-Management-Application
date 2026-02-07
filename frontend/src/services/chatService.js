import api from '../config/api';

const listChannels = async () => {
    const response = await api.get('/chat/channels');
    return response.data;
};

const getChannelByClub = async (clubId) => {
    const response = await api.get(`/chat/channels/by-club/${clubId}`);
    return response.data;
};

const getMessages = async (channelId, params = {}) => {
    const response = await api.get(`/chat/channels/${channelId}/messages`, { params });
    return response.data;
};

const postMessage = async (channelId, message) => {
    const response = await api.post(`/chat/channels/${channelId}/messages`, { message });
    return response.data;
};

const createChannel = async (data) => {
    const response = await api.post('/chat/channels', data);
    return response.data;
};

const moderateMessage = async (messageId, isHidden) => {
    const response = await api.patch(`/chat/messages/${messageId}/moderate`, { is_hidden: isHidden });
    return response.data;
};

export default {
    listChannels,
    getChannelByClub,
    getMessages,
    postMessage,
    createChannel,
    moderateMessage
};
