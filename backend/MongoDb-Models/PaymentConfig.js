const mongoose = require('mongoose');

const paymentConfigSchema = mongoose.Schema({
    college: {
        type: String,
        required: true
    },
    account_name: {
        type: String, // e.g., "College Fees Account"
        required: true
    },
    bank_name: {
        type: String, // e.g., "HDFC Bank"
        required: true
    },
    account_number: {
        type: String,
        required: true
    },
    ifsc_code: {
        type: String,
        required: true
    },
    upi_id: {
        type: String, // Optional
        required: false
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);
