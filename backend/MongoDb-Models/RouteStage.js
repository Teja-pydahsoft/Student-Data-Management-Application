const mongoose = require('mongoose');

const routeStageSchema = new mongoose.Schema({
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransportRoute',
        required: true
    },
    stageCode: {
        type: String,
        trim: true
    },
    stageName: {
        type: String,
        required: true,
        trim: true
    },
    stopOrder: {
        type: Number,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

// Ensure a stage name is unique per route
routeStageSchema.index({ routeId: 1, stageName: 1 }, { unique: true });

module.exports = mongoose.model('RouteStage', routeStageSchema);
