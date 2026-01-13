const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
    busNumber: {
        type: String,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['Standard', 'Mini-bus', 'Van'],
        default: 'Standard'
    },
    amenities: [{
        type: String
    }],
    driverName: {
        type: String
    },
    attendantName: {
        type: String
    },
    status: {
        type: String,
        enum: ['Active', 'In Maintenance', 'Retired'],
        default: 'Active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Bus', busSchema);
