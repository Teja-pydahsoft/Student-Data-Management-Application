const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
    stageName: { type: String, required: true },
    distanceFromStart: { type: Number, required: true }, // in km
    fare: { type: Number, required: true }
});

const routeSchema = new mongoose.Schema({
    routeId: {
        type: String,
        required: true,
        unique: true
    },
    routeName: {
        type: String,
        required: true
    },
    startPoint: {
        type: String,
        required: true
    },
    endPoint: {
        type: String,
        required: true
    },
    totalDistance: {
        type: Number
    },
    estimatedTime: {
        type: String // e.g. "45 mins"
    },
    stages: [stageSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Route', routeSchema);
