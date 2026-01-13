const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/database');

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - Allow Ticket App and Main App (development + production)
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5174', 'http://localhost:5173'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const ticketRoutes = require('./routes/ticketRoutes');
const complaintCategoryRoutes = require('./routes/complaintCategoryRoutes');
const authRoutes = require('./routes/authRoutes');

app.use('/api/tickets', ticketRoutes);
app.use('/api/complaint-categories', complaintCategoryRoutes);
app.use('/api/auth', authRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ticket-backend' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start Server
const startServer = async () => {
    // Test Database Connection
    const isConnected = await testConnection();
    if (isConnected) {
        // HTTP 431 Fix: Increase header size limit
        const server = require('http').createServer({
            maxHttpHeaderSize: 32768 // 32KB
        }, app);

        server.listen(PORT, () => {
            console.log(`Ticket Backend Service running on port ${PORT}`);
        });
    } else {
        console.error('Failed to connect to database. Server not started.');
        process.exit(1);
    }
};

startServer();
