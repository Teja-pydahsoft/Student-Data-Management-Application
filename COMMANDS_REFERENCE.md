# Commands Reference Guide

Complete reference for all commands needed to run and manage the Student Database Management System.

## 📦 Installation Commands

### Backend Installation
```powershell
# Navigate to backend directory
cd "d:\Student Database Management\backend"

# Install all dependencies
npm install

# This installs:
# - express (web framework)
# - mysql2 (database driver)
# - cors (cross-origin support)
# - dotenv (environment variables)
# - body-parser (request parsing)
# - qrcode (QR code generation)
# - uuid (unique ID generation)
# - bcryptjs (password hashing)
# - jsonwebtoken (JWT authentication)
# - express-validator (validation)
# - multer (file uploads)
# - nodemon (dev auto-reload)
```

### Frontend Installation
```powershell
# Navigate to frontend directory
cd "d:\Student Database Management\frontend"

# Install all dependencies
npm install

# This installs:
# - react & react-dom (UI library)
# - react-router-dom (routing)
# - axios (HTTP client)
# - react-qr-code (QR display)
# - lucide-react (icons)
# - react-hot-toast (notifications)
# - zustand (state management)
# - vite (build tool)
# - tailwindcss (styling)
```

## 🔧 Configuration Commands

### Backend Configuration
```powershell
# Copy environment template
copy .env.example .env

# Edit environment file
notepad .env

# Or use any text editor
code .env
```

### Frontend Configuration
```powershell
# Copy environment template
copy .env.example .env

# Edit if needed (default should work)
notepad .env
```

## 🗄️ Database Commands

### Initialize Database
```powershell
# From backend directory
cd "d:\Student Database Management\backend"

# Run initialization script
npm run init-db

# This will:
# 1. Create database 'student_database'
# 2. Create all tables (admins, forms, form_submissions, students, audit_logs)
# 3. Create default admin user (admin/admin123)
```

### Manual Database Setup (if needed)
```powershell
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE student_database;

# Exit MySQL
exit

# Then run init script
npm run init-db
```

### Database Backup
```powershell
# Backup entire database
mysqldump -u root -p student_database > backup.sql

# Backup with timestamp
mysqldump -u root -p student_database > backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql

# Restore from backup
mysql -u root -p student_database < backup.sql
```

### Registration 5-Stage Audit Script
Check how many students have completed all 5 registration stages and find those falsely marked as completed:
```powershell
# From project root
node backend/scripts/check_registration_5_stages.js

# Fix falsely completed (set them to pending)
node backend/scripts/check_registration_5_stages.js --fix

# Fix false + set Completed for those who have all 5 stages
node backend/scripts/check_registration_5_stages.js --fix-all
```
The 5 stages are: Verification, Certificates, Fee, Promotion, Scholarship.

### View Database
```powershell
# Login to MySQL
mysql -u root -p

# Use database
USE student_database;

# Show all tables
SHOW TABLES;

# View table structure
DESCRIBE admins;
DESCRIBE forms;
DESCRIBE form_submissions;
DESCRIBE students;
DESCRIBE audit_logs;

# View data
SELECT * FROM admins;
SELECT * FROM forms;
SELECT * FROM form_submissions;
SELECT * FROM students LIMIT 10;
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;

# Count records
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM forms;
SELECT COUNT(*) FROM form_submissions WHERE status = 'pending';

# Exit
exit
```

## 🚀 Running the Application

### Start Backend (Development)
```powershell
# Navigate to backend
cd "d:\Student Database Management\backend"

# Start with auto-reload (recommended for development)
npm run dev

# Server will start on http://localhost:5000
# Auto-reloads when you change code
```

### Start Backend (Production)
```powershell
# Navigate to backend
cd "d:\Student Database Management\backend"

# Start production server
npm start

# Server runs on http://localhost:5000
```

### Start Frontend (Development)
```powershell
# Navigate to frontend
cd "d:\Student Database Management\frontend"

# Start development server
npm run dev

# Server will start on http://localhost:3000
# Opens browser automatically
# Hot-reload enabled
```

### Start Frontend (Production Build)
```powershell
# Navigate to frontend
cd "d:\Student Database Management\frontend"

# Build for production
npm run build

# Preview production build
npm run preview

# Or serve with static server
npm install -g serve
serve -s dist -p 3000
```

## 🔄 Running Both Servers

### Option 1: Two Terminal Windows
```powershell
# Terminal 1 - Backend
cd "d:\Student Database Management\backend"
npm run dev

# Terminal 2 - Frontend
cd "d:\Student Database Management\frontend"
npm run dev
```

### Option 2: Using PM2 (Recommended for Production)
```powershell
# Install PM2 globally
npm install -g pm2

# Start backend
cd "d:\Student Database Management\backend"
pm2 start server.js --name student-db-backend

# Build and serve frontend
cd "d:\Student Database Management\frontend"
npm run build
pm2 serve dist 3000 --name student-db-frontend

# View running processes
pm2 list

# View logs
pm2 logs

# Stop all
pm2 stop all

# Restart all
pm2 restart all

# Delete all processes
pm2 delete all

# Save configuration
pm2 save

# Auto-start on system boot
pm2 startup
```

## 🧪 Testing Commands

### Test Backend API
```powershell
# Health check
curl http://localhost:5000/health

# Login (PowerShell)
$body = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $body -ContentType "application/json"

# Get forms (requires token)
$token = "your_jwt_token_here"
$headers = @{
    Authorization = "Bearer $token"
}
Invoke-RestMethod -Uri "http://localhost:5000/api/forms" -Method GET -Headers $headers
```

### Test Frontend
```powershell
# Check if frontend is accessible
curl http://localhost:3000

# Or open in browser
start http://localhost:3000
```

## 📊 Monitoring Commands

### View Backend Logs
```powershell
# If running with npm run dev
# Logs appear in terminal

# If running with PM2
pm2 logs student-db-backend

# View specific number of lines
pm2 logs student-db-backend --lines 100

# Clear logs
pm2 flush
```

### Monitor System Resources
```powershell
# With PM2
pm2 monit

# View memory usage
pm2 list

# Detailed info
pm2 show student-db-backend
```

## 🔍 Debugging Commands

### Check Node Version
```powershell
node --version
# Should be v16 or higher
```

### Check npm Version
```powershell
npm --version
```

### Check MySQL Status
```powershell
# Check if MySQL is running
mysql --version

# Try to connect
mysql -u root -p
```

### Check Ports
```powershell
# Check if port 5000 is in use
netstat -ano | findstr :5000

# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process on port (if needed)
# Find PID from netstat output, then:
taskkill /PID <PID> /F
```

### Clear npm Cache
```powershell
npm cache clean --force
```

### Reinstall Dependencies
```powershell
# Backend
cd "d:\Student Database Management\backend"
rmdir /s /q node_modules
del package-lock.json
npm install

# Frontend
cd "d:\Student Database Management\frontend"
rmdir /s /q node_modules
del package-lock.json
npm install
```

## 🛠️ Maintenance Commands

### Update Dependencies
```powershell
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update specific package
npm update express

# Update to latest versions (careful!)
npm install -g npm-check-updates
ncu -u
npm install
```

### Clean Build Files
```powershell
# Frontend - clean build
cd "d:\Student Database Management\frontend"
rmdir /s /q dist
npm run build
```

## 📤 Export/Import Commands

### Export Student Data
```powershell
# From MySQL
mysql -u root -p -e "SELECT * FROM student_database.students" > students_export.txt

# As CSV
mysql -u root -p -e "SELECT * FROM student_database.students" --batch --raw > students.csv

# Or use the built-in CSV export in the admin panel
```

### Backup Entire Project
```powershell
# Create backup folder
mkdir "d:\Backups"

# Copy project (excluding node_modules)
xcopy "d:\Student Database Management" "d:\Backups\Student Database Management" /E /I /EXCLUDE:exclude.txt

# Create exclude.txt with:
# node_modules
# dist
# .env
```

## 🔐 Security Commands

### Change Admin Password
```powershell
# Login to MySQL
mysql -u root -p

USE student_database;

# Generate new password hash (use Node.js)
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('new_password', 10));"

# Update password
UPDATE admins SET password = 'hashed_password_here' WHERE username = 'admin';

exit
```

### Generate New JWT Secret
```powershell
# Generate random string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'));"

# Copy output to .env JWT_SECRET
```

## 🌐 Network Commands

### Find Your IP Address
```powershell
# Windows
ipconfig

# Look for "IPv4 Address" under your active network adapter
# Example: 192.168.1.100
```

### Access from Other Devices
```powershell
# Update backend/.env
FRONTEND_URL=http://192.168.1.100:3000

# Restart backend server

# Access from mobile/other PC:
# http://192.168.1.100:3000
```

### Using ngrok (Internet Access)
```powershell
# Install ngrok from https://ngrok.com/

# Expose backend
ngrok http 5000

# Copy the https URL (e.g., https://abc123.ngrok.io)

# Update frontend/.env
VITE_API_URL=https://abc123.ngrok.io/api

# Restart frontend
```

## 📋 Git Commands (Version Control)

### Initialize Git
```powershell
cd "d:\Student Database Management"

# Initialize repository
git init

# Add all files
git add .

# First commit
git commit -m "Initial commit: Student Database Management System"
```

### Create .gitignore
```powershell
# Create .gitignore in root
echo node_modules/ > .gitignore
echo .env >> .gitignore
echo dist/ >> .gitignore
echo *.log >> .gitignore
```

### Push to GitHub
```powershell
# Create repository on GitHub first, then:
git remote add origin https://github.com/yourusername/student-database.git
git branch -M main
git push -u origin main
```

## 🎯 Quick Command Cheatsheet

```powershell
# SETUP (Run once)
cd "d:\Student Database Management\backend"
npm install
copy .env.example .env
notepad .env  # Configure DB password
npm run init-db

cd "d:\Student Database Management\frontend"
npm install

# DAILY DEVELOPMENT (Run every time)
# Terminal 1:
cd "d:\Student Database Management\backend"
npm run dev

# Terminal 2:
cd "d:\Student Database Management\frontend"
npm run dev

# ACCESS
# Browser: http://localhost:3000
# Login: admin / admin123

# STOP SERVERS
# Press Ctrl+C in each terminal
```

## 🆘 Emergency Commands

### Reset Everything
```powershell
# Stop all servers (Ctrl+C)

# Drop and recreate database
mysql -u root -p -e "DROP DATABASE IF EXISTS student_database;"
cd "d:\Student Database Management\backend"
npm run init-db

# Clear and reinstall dependencies
cd "d:\Student Database Management\backend"
rmdir /s /q node_modules
npm install

cd "d:\Student Database Management\frontend"
rmdir /s /q node_modules
npm install

# Restart servers
```

### Check Everything is Working
```powershell
# 1. Check Node
node --version

# 2. Check MySQL
mysql --version

# 3. Check backend
cd "d:\Student Database Management\backend"
npm run dev
# Should see "Server running on: http://localhost:5000"

# 4. Check frontend (new terminal)
cd "d:\Student Database Management\frontend"
npm run dev
# Should see "Local: http://localhost:3000"

# 5. Test in browser
start http://localhost:3000
```

---

**Keep this reference handy for quick access to all commands!**
