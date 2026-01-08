const mongoose = require('mongoose');

const NotificationTemplateSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['SMS', 'EMAIL', 'PUSH']
    },
    name: {
        type: String,
        required: true
    },
    subject: {
        type: String, // Only for EMAIL
        default: ''
    },
    templateId: {
        type: String, // Only for SMS (DLT Template ID)
        default: ''
    },
    senderId: {
        type: String, // Only for EMAIL/SMS (Sender Name/ID)
        default: ''
    },
    body: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('NotificationTemplate', NotificationTemplateSchema);
