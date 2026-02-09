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

const postMessage = async (channelId, message, messageType = 'text', attachmentUrl = null, attachmentType = null) => {
    const body = { message: message || '', message_type: messageType };
    if (attachmentUrl) body.attachment_url = attachmentUrl;
    if (attachmentType) body.attachment_type = attachmentType;
    const response = await api.post(`/chat/channels/${channelId}/messages`, body);
    return response.data;
};

const postPoll = async (channelId, question, options) => {
    const response = await api.post(`/chat/channels/${channelId}/messages`, { message: question, message_type: 'poll', options: options || ['Yes', 'No'] });
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

const deleteMessage = async (messageId) => {
    const response = await api.delete(`/chat/messages/${messageId}`);
    return response.data;
};

const editMessage = async (messageId, message) => {
    const response = await api.patch(`/chat/messages/${messageId}`, { message });
    return response.data;
};

const votePoll = async (messageId, optionIndex) => {
    const response = await api.post(`/chat/messages/${messageId}/vote`, { option_index: optionIndex });
    return response.data;
};

const createScheduledMessage = async (channelId, message, scheduled_at) => {
    const response = await api.post(`/chat/channels/${channelId}/scheduled`, { message, scheduled_at });
    return response.data;
};

const listScheduledMessages = async (channelId) => {
    const response = await api.get(`/chat/channels/${channelId}/scheduled`);
    return response.data;
};

const getChannelSettings = async (channelId) => {
    const response = await api.get(`/chat/channels/${channelId}/settings`);
    return response.data;
};

const updateChannelSettings = async (channelId, settings) => {
    const response = await api.put(`/chat/channels/${channelId}/settings`, settings);
    return response.data;
};

const uploadAttachment = async (channelId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/chat/channels/${channelId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

const editPoll = async (messageId, data) => {
    const response = await api.patch(`/chat/messages/${messageId}/poll`, data);
    return response.data;
};

export default {
    listChannels,
    getChannelByClub,
    getMessages,
    postMessage,
    postPoll,
    createChannel,
    moderateMessage,
    deleteMessage,
    editMessage,
    votePoll,
    createScheduledMessage,
    listScheduledMessages,
    getChannelSettings,
    updateChannelSettings,
    uploadAttachment,
    editPoll
};
