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
// Allow multiple origins via FRONTEND_URLS env var (comma separated), or single FRONTEND_URL
const rawFrontendUrls = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = rawFrontendUrls.split(',').map(u => u.trim()).filter(Boolean);


app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Request logging middleware
app.use((req, res, next) => {
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: allowedOrigins,
    database: process.env.DB_NAME || 'student_database',
    port: PORT,
    uptime: process.uptime()
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

// Legacy route support for direct API access (without /api prefix)
app.use('/auth', authRoutes);
app.use('/forms', formRoutes);
app.use('/submissions', submissionRoutes);
app.use('/students', studentRoutes);

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Pydah Student Database Management API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      forms: '/api/forms',
      submissions: '/api/submissions',
      students: '/api/students'
    }
  });
});

// Catch all non-API routes to return proper 404 (must be after all routes)
app.use('/api/*', (req, res) => {
  console.log('API route not found:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET /api/auth/verify',
      'POST /api/auth/login',
      'POST /api/auth/change-password',
      'GET /api/forms',
      'POST /api/forms',
      'GET /api/forms/public/:formId',
      'GET /api/submissions',
      'POST /api/submissions/generate-admission-series',
      'GET /api/students',
      'GET /api/students/stats',
      'GET /api/students/dashboard-stats'
    ]
  });
});

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

// Small debug/health endpoint - non-sensitive
app.get('/api/debug/health', async (req, res) => {
  const { masterPool } = require('./config/database');
  const jwtPresent = !!process.env.JWT_SECRET;
  const supabaseReady = !!(supabase && supabase.from);
  // basic DB check (fast)
  let dbStatus = 'unknown';
  try {
    const conn = await masterPool.getConnection();
    conn.release();
    dbStatus = 'ok';
  } catch (e) {
    dbStatus = 'error';
  }

  res.json({
    success: true,
    allowedOrigins: allowedOrigins,
    jwtPresent,
    supabaseReady,
    dbStatus
  });
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
    console.log('🔄 Starting server...');

    // Start the server FIRST (before DB connection test)
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Test database connection AFTER server starts (async)
    setTimeout(async () => {
      try {
        const dbConnected = await testConnection();

        if (!dbConnected) {
          console.error('❌ Database connection failed!');
          console.error('❌ API calls may fail but server is running');
        } else {
          // Create a default form if none exists
          try {
            await createDefaultForm();
          } catch (formError) {
            console.error('⚠️  Form creation warning:', formError.message);
          }
        }
      } catch (dbError) {
        console.error('❌ Database test error:', dbError.message);
      }
    }, 1000); // Wait 1 second after server starts

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Process terminated');
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
};

startServer();

module.exports = app;
