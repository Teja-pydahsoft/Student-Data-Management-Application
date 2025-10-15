const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { createDefaultForm } = require('./scripts/createDefaultForm');
const { supabase } = require('./config/supabase');
const mysql = require('mysql2/promise');

// Import routes
const authRoutes = require('./routes/authRoutes');
const formRoutes = require('./routes/formRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// DB health endpoint
app.get('/health/db', async (req, res) => {
  const { masterPool, stagingPool } = require('./config/database');
  try {
    // master MySQL pool check
    const m = await masterPool.getConnection();
    m.release();

    // If Supabase is configured, use it for staging health check; otherwise fallback to stagingPool
    if (supabase) {
      try {
        // lightweight request: check admins table existence (non-destructive)
        const { error } = await supabase.from('admins').select('id').limit(1);
        if (error) throw error;
        return res.json({ success: true, master: 'ok', staging: 'ok (supabase)' });
      } catch (supErr) {
        // report supabase error but continue to allow mysql staging fallback
        console.error('Supabase staging health check failed:', supErr.message || supErr);
        return res.status(500).json({ success: false, error: supErr.message || String(supErr) });
      }
    }

    // fallback: mysql staging pool
    const s = await stagingPool.getConnection();
    s.release();
    res.json({ success: true, master: 'ok', staging: 'ok' });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/students', studentRoutes);

// Debug route to check if routes are registered
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      });
    }
  });
  res.json({ routes });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('⚠️  Server starting without database connection');
      console.error('⚠️  Please check your database configuration');
    } else {
      // Create a default form if none exists
      await createDefaultForm();
    }

    app.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  🚀 Student Database Management System - Backend');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`  Server running on: http://localhost:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Database: ${process.env.DB_NAME || 'student_database'}`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('  Available endpoints:');
      console.log('  - GET  /health');
      console.log('  - POST /api/auth/login');
      console.log('  - GET  /api/forms');
      console.log('  - POST /api/forms');
      console.log('  - GET  /api/submissions');
      console.log('  - GET  /api/students');
      console.log('');
      console.log('  Press Ctrl+C to stop the server');
      console.log('');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
