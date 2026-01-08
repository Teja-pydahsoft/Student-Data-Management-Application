const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        ref: 'Student' // Reference by Admission Number
    },
    studentName: {
        type: String
    },
    grantedBy: {
        type: String,
        required: true
    },
    remarks: {
        type: String
    },
    validUpto: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Permission', PermissionSchema);
