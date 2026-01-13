const mongoose = require('mongoose');
require('dotenv').config();

// Use a separate URI for Transport DB. 
// If TRANSPORT_MONGO_URI is not set, fallback to a default (modify as needed).
const TRANSPORT_URI = process.env.TRANSPORT_MONGO_URI || 'mongodb://localhost:27017/transport_db';

const transportConnection = mongoose.createConnection(TRANSPORT_URI, {
    // Options if needed (authSource, etc.)
});

transportConnection.on('connected', () => {
    console.log(`✅ Transport MongoDB Connected`);
});

transportConnection.on('error', (err) => {
    console.error(`❌ Transport MongoDB Connection Error: ${err.message}`);
});

module.exports = transportConnection;
