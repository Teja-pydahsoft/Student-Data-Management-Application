const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { createDefaultForm } = require('./scripts/createDefaultForm');
const mysql = require('mysql2/promise');

// Import routes
const authRoutes = require('./routes/authRoutes');
const formRoutes = require('./routes/formRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const studentRoutes = require('./routes/studentRoutes');
const courseRoutes = require('./routes/courseRoutes');
const collegeRoutes = require('./routes/collegeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const logRoutes = require('./routes/logRoutes');
const userRoutes = require('./routes/userRoutes');
const rbacUserRoutes = require('./routes/rbacUserRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const academicYearRoutes = require('./routes/academicYearRoutes');
const semesterRoutes = require('./routes/semesterRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const feeRoutes = require('./routes/feeRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const complaintCategoryRoutes = require('./routes/complaintCategoryRoutes');
const serviceRoutes = require('./routes/serviceRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Allow multiple origins via FRONTEND_URLS env var (comma separated), or single FRONTEND_URL
const rawFrontendUrls = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = rawFrontendUrls.split(',').map(u => u.trim()).filter(Boolean);


// Compression middleware for faster responses
app.use(compression({
  level: 6, // Compression level (1-9, 6 is a good balance)
  filter: (req, res) => {
    // Compress all responses except if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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


// app.get('/', (req, res) => {
//   console.log('🌐 Root endpoint accessed');
//   res.sendFile(path.resolve(__dirname, 'test.html'));
// });



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

    // MySQL staging pool check
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
app.use('/api/courses', courseRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rbac/users', rbacUserRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/complaint-categories', complaintCategoryRoutes);
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/polls', require('./routes/pollRoutes'));
app.use('/api/services', serviceRoutes);
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/student-history', require('./routes/studentHistoryRoutes'));
app.use('/api/sms-templates', require('./routes/smsTemplateRoutes'));
app.use('/api/notifications', require('./routes/pushRoutes'));

// Legacy route support for direct API access (without /api prefix)
app.use('/auth', authRoutes);
app.use('/forms', formRoutes);
app.use('/submissions', submissionRoutes);
app.use('/students', studentRoutes);
app.use('/courses', courseRoutes);
app.use('/colleges', collegeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/logs', logRoutes);
app.use('/users', userRoutes);
app.use('/rbac/users', rbacUserRoutes);
app.use('/calendar', calendarRoutes);
app.use('/academic-years', academicYearRoutes);
app.use('/semesters', semesterRoutes);
app.use('/settings', settingsRoutes);
app.use('/fees', feeRoutes);
app.use('/tickets', ticketRoutes);
app.use('/complaint-categories', complaintCategoryRoutes);

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
      students: '/api/students',
      courses: '/api/courses',
      logs: '/api/logs',
      users: '/api/users'
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

    // Display S3 Configuration
    const AWS_REGION = process.env.AWS_REGION || 'not set';
    const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'not set';
    const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'not set';
    const accessKeyDisplay = AWS_ACCESS_KEY_ID !== 'not set' && AWS_ACCESS_KEY_ID.length > 8
      ? AWS_ACCESS_KEY_ID.substring(0, 8) + '...'
      : AWS_ACCESS_KEY_ID;

    console.log('☁️  S3 Service Configuration:');
    console.log(`   Region: ${AWS_REGION}`);
    console.log(`   Bucket: ${S3_BUCKET_NAME}`);
    console.log(`   Access Key ID: ${accessKeyDisplay}`);
    console.log(`   Secret Access Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '***' + (process.env.AWS_SECRET_ACCESS_KEY.substring(process.env.AWS_SECRET_ACCESS_KEY.length - 4) || '') : 'NOT SET'}`);

    // Start the server FIRST (before DB connection test)
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Test database and S3 connections AFTER server starts (async)
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

      // Test S3 connection
      try {
        const s3Service = require('./services/s3Service');
        const s3Connected = await s3Service.testConnection();

        if (s3Connected) {
          console.log('✅ S3 bucket connection: SUCCESS');
        } else {
          console.error('❌ S3 bucket connection: FAILED');
          console.error('⚠️  Document uploads may fail but server is running');
        }
      } catch (s3Error) {
        console.error('❌ S3 connection test error:', s3Error.message);
        console.error('⚠️  Document uploads may fail but server is running');
        // Don't fail server startup if S3 is not configured
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
