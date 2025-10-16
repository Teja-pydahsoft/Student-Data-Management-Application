# Environment Configuration Guide

This guide explains how to configure environment variables for both local development and production deployment.

## Frontend Environment Files

### Local Development (`frontend/.env`)
```env
# Frontend Environment Variables - LOCAL DEVELOPMENT (Connected to Local Backend)
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME="Student Database Management System"
VITE_APP_VERSION="1.0.0"
```

### Production (`frontend/.env.production`)
```env
# Frontend Environment Variables - PRODUCTION
VITE_API_URL=https://student-data-management-application.onrender.com/api
VITE_APP_NAME="Student Database Management System"
VITE_APP_VERSION="1.0.0"
```

### Template (`frontend/.env.example`)
```env
# Frontend Environment Variables - LOCAL DEVELOPMENT (Connected to Local Backend)
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME="Student Database Management System"
VITE_APP_VERSION="1.0.0"

# For production deployment, create a .env.production file with:
# VITE_API_URL=https://your-backend-domain.com/api

# NOTE: This configuration connects local frontend development to local backend
# For hosted backend, change VITE_API_URL to https://student-data-management-application.onrender.com/api
```

## Backend Environment Files

### Local Development (`backend/.env`)
```env
# Backend Environment Variables - LOCAL DEVELOPMENT (Connected to Hosted DBs)
PORT=5000
NODE_ENV=development

# Master Database (AWS RDS MySQL) - HOSTED PRODUCTION DATABASE
DB_HOST=student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=jzuy?28y_A8qB*x5OxdV)$h*90_A
DB_NAME=student_database
DB_SSL=true

# Staging Database (Supabase) - HOSTED PRODUCTION DATABASE
SUPABASE_URL=https://dxotfrooegqxqeuxarxv.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4b3Rmcm9vZWdxeHFldXhhcnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTcxNTYsImV4cCI6MjA3NjA5MzE1Nn0.oYqgtKW9wdg577ip5gARLP-O5hubw3KxsH5ZQ-r1N_k

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=24h

# Default Admin Credentials (for initial setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# CORS Configuration - Allow local development and production
FRONTEND_URL=http://localhost:3000,https://student-data-management-application.vercel.app

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Logging
LOG_LEVEL=info
```

### Production (`backend/.env.production`)
```env
# Backend Environment Variables - PRODUCTION
PORT=5000
NODE_ENV=production

# Master Database (AWS RDS MySQL) - PRODUCTION
DB_HOST=student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=jzuy?28y_A8qB*x5OxdV)$h*90_A
DB_NAME=student_database
DB_SSL=true

# Staging Database (Supabase) - For forms, submissions, admins, audit logs
SUPABASE_URL=https://dxotfrooegqxqeuxarxv.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4b3Rmcm9vZWdxeHFldXhhcnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTcxNTYsImV4cCI6MjA3NjA5MzE1Nn0.oYqgtKW9wdg577ip5gARLP-O5hubw3KxsH5ZQ-r1N_k

# Authentication
JWT_SECRET=your_production_jwt_secret_key_change_this_to_something_secure
JWT_EXPIRES_IN=24h

# Default Admin Credentials (for initial setup - change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# CORS Configuration - Allow both Vercel and Render domains
FRONTEND_URL=https://student-data-management-application.vercel.app

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Logging
LOG_LEVEL=warn
```

### Template (`backend/.env.example`)
```env
# Backend Environment Variables - Example Template
PORT=5000
NODE_ENV=development

# Master Database (MySQL) - LOCAL DEVELOPMENT
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_database
DB_SSL=false

# Master Database (MySQL) - PRODUCTION (AWS RDS Example)
# DB_HOST=your-aws-rds-endpoint.region.rds.amazonaws.com
# DB_PORT=3306
# DB_USER=your_db_user
# DB_PASSWORD=your_db_password
# DB_NAME=student_database
# DB_SSL=true

# Staging Database (Supabase) - For forms, submissions, admins, audit logs
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=24h

# Default Admin Credentials (for initial setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# CORS Configuration - Comma-separated list of allowed frontend origins
FRONTEND_URL=http://localhost:3000
# For production, use: https://your-frontend-domain.com

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Logging
LOG_LEVEL=info

# For production deployment, create a .env.production file with your actual credentials
```

## Database Architecture

### Master Database (MySQL)
- **Location**: AWS RDS (Production) / Local MySQL (Development)
- **Purpose**: Stores approved student data and final records
- **Tables**: students, audit_logs, and dynamic form tables

### Staging Database (Supabase)
- **Location**: Supabase Cloud
- **Purpose**: Handles forms, submissions, admins, and audit logs during the approval process
- **Tables**: forms, form_submissions, admins, audit_logs

## Deployment Instructions

### Local Development (Connected to Hosted Databases)
1. Copy `frontend/.env.example` to `frontend/.env` (already configured for local backend)
2. Copy `backend/.env.example` to `backend/.env` (already configured for hosted databases)
3. Install dependencies and run the applications
4. **No database setup required** - already connected to your hosted databases!

### Quick Start Commands
```bash
# Terminal 1 - Backend (connects to hosted DBs)
cd backend && npm install && npm run dev

# Terminal 2 - Frontend (connects to local backend)
cd frontend && npm install && npm run dev
```

### Local Development (With Local Databases)
If you want to use local databases instead:
1. Copy `frontend/.env.example` to `frontend/.env`
2. Copy `backend/.env.example` to `backend/.env`
3. Update `VITE_API_URL=http://localhost:5000/api` in `frontend/.env`
4. Update database credentials in `backend/.env` for your local MySQL setup
5. Install dependencies and run the applications

### Production Deployment

#### Frontend (Vercel)
1. Set environment variables in Vercel dashboard:
   - `VITE_API_URL=https://student-data-management-application.onrender.com/api`

#### Backend (Render)
1. Set environment variables in Render dashboard with the production values from `backend/.env.production`

#### Database Setup
1. **AWS RDS**: Already configured with provided credentials
2. **Supabase**: Already configured with provided credentials

## Important Security Notes

1. **Never commit `.env` files** to version control
2. **Change default passwords** in production
3. **Use strong JWT secrets** in production
4. **Enable SSL** for production database connections
5. **Restrict CORS origins** to only your domains in production

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify database credentials
   - Check database server status
   - Ensure firewall allows connections

2. **CORS Errors**:
   - Check `FRONTEND_URL` in backend environment
   - Ensure frontend URL matches exactly

3. **Authentication Issues**:
   - Verify `JWT_SECRET` matches between requests
   - Check token expiration settings

### Logs Location
- **Backend**: Check Render logs for the service
- **Frontend**: Check browser console for errors
- **Database**: Check AWS RDS logs and Supabase dashboard
