# Setup Checklist ✅

Follow this checklist step-by-step to get your Student Database Management System running.

## Pre-Installation Checklist

### System Requirements
- [ ] Windows 10/11 (or compatible OS)
- [ ] At least 2GB free disk space
- [ ] Internet connection for package downloads
- [ ] Administrator access (for MySQL installation)

### Software Prerequisites
- [ ] **Node.js v16+** installed
  - Download: https://nodejs.org/
  - Verify: `node --version`
  
- [ ] **MySQL v8.0+** installed and running
  - Download: https://dev.mysql.com/downloads/mysql/
  - Verify: `mysql --version`
  
- [ ] **npm** installed (comes with Node.js)
  - Verify: `npm --version`

## Backend Setup Checklist

### Step 1: Navigate to Backend
- [ ] Open PowerShell or Command Prompt
- [ ] Run: `cd "d:\Student Database Management\backend"`

### Step 2: Install Dependencies
- [ ] Run: `npm install`
- [ ] Wait for installation to complete (may take 2-3 minutes)
- [ ] Verify: Check for `node_modules` folder

### Step 3: Configure Environment
- [ ] Run: `copy .env.example .env`
- [ ] Open `.env` file: `notepad .env`
- [ ] Update the following:
  - [ ] `DB_PASSWORD=` (your MySQL root password)
  - [ ] `JWT_SECRET=` (change to a random string)
  - [ ] `ADMIN_PASSWORD=` (change default password)
- [ ] Save and close the file

### Step 4: Initialize Database
- [ ] Ensure MySQL is running
- [ ] Run: `npm run init-db`
- [ ] Look for success messages:
  - [ ] "Database connected successfully"
  - [ ] "Database schema created successfully"
  - [ ] "Default admin user created"
- [ ] Note the admin credentials displayed

### Step 5: Start Backend Server
- [ ] Run: `npm run dev`
- [ ] Look for success message:
  - [ ] "Server running on: http://localhost:5000"
  - [ ] "Database connected successfully"
- [ ] Keep this terminal window open

## Frontend Setup Checklist

### Step 1: Navigate to Frontend
- [ ] Open a **NEW** PowerShell or Command Prompt window
- [ ] Run: `cd "d:\Student Database Management\frontend"`

### Step 2: Install Dependencies
- [ ] Run: `npm install`
- [ ] Wait for installation to complete (may take 2-3 minutes)
- [ ] Verify: Check for `node_modules` folder

### Step 3: Configure Environment (Optional)
- [ ] Run: `copy .env.example .env`
- [ ] Default configuration should work
- [ ] Only edit if backend is on different port

### Step 4: Start Frontend Server
- [ ] Run: `npm run dev`
- [ ] Look for success message:
  - [ ] "Local: http://localhost:3000"
- [ ] Browser should open automatically
- [ ] Keep this terminal window open

## Verification Checklist

### Backend Verification
- [ ] Backend terminal shows no errors
- [ ] Visit: http://localhost:5000/health
- [ ] Should see: `{"success":true,"message":"Server is running"}`

### Frontend Verification
- [ ] Frontend terminal shows no errors
- [ ] Browser opened to http://localhost:3000
- [ ] Login page is visible
- [ ] No console errors (Press F12 to check)

### Login Verification
- [ ] Enter username: `admin`
- [ ] Enter password: `admin123` (or your custom password)
- [ ] Click "Login"
- [ ] Should redirect to Dashboard
- [ ] Dashboard shows statistics (all zeros initially)

### Database Verification
- [ ] Open MySQL: `mysql -u root -p`
- [ ] Run: `USE student_database;`
- [ ] Run: `SHOW TABLES;`
- [ ] Should see 6 tables:
  - [ ] admins
  - [ ] forms
  - [ ] form_submissions
  - [ ] students
  - [ ] audit_logs
  - [ ] field_templates
- [ ] Run: `SELECT * FROM admins;`
- [ ] Should see admin user
- [ ] Exit: `exit`

## Functionality Testing Checklist

### Test 1: Create a Form
- [ ] Login to admin panel
- [ ] Click "Forms" in sidebar
- [ ] Click "Create Form" button
- [ ] Enter form name: "Test Registration"
- [ ] Enter description: "Testing form creation"
- [ ] Click "Add Field"
- [ ] Configure field:
  - [ ] Label: "Full Name"
  - [ ] Type: "Text Input"
  - [ ] Check "Required field"
- [ ] Click "Add Field" again
- [ ] Configure second field:
  - [ ] Label: "Email"
  - [ ] Type: "Email"
  - [ ] Check "Required field"
- [ ] Click "Create Form"
- [ ] Should see success message
- [ ] Should redirect to Forms page
- [ ] New form should be visible

### Test 2: View QR Code
- [ ] On Forms page, find your test form
- [ ] Click "QR" button
- [ ] QR code modal should open
- [ ] QR code should be visible
- [ ] Click "Download" button
- [ ] PNG file should download
- [ ] Click "Close"

### Test 3: Submit Form (as Student)
- [ ] On Forms page, click "QR" button again
- [ ] Copy the URL from the QR code modal
- [ ] Open new browser tab (or use phone)
- [ ] Paste URL and press Enter
- [ ] Form should load
- [ ] Fill in the fields:
  - [ ] Full Name: "Test Student"
  - [ ] Email: "test@example.com"
  - [ ] Admission Number: "2024001" (optional)
- [ ] Click "Submit Form"
- [ ] Should see success message

### Test 4: Review Submission
- [ ] Go back to admin panel
- [ ] Click "Submissions" in sidebar
- [ ] Should see 1 pending submission
- [ ] Click "View" (eye icon)
- [ ] Modal should open with submission details
- [ ] Verify data is correct
- [ ] Enter admission number: "2024001"
- [ ] Click "Approve"
- [ ] Should see success message
- [ ] Submission should disappear from pending

### Test 5: View Student Database
- [ ] Click "Students" in sidebar
- [ ] Should see 1 student record
- [ ] Admission Number: "2024001"
- [ ] Click "View" (eye icon)
- [ ] Should see full student details
- [ ] Click "Edit"
- [ ] Modify a field
- [ ] Click "Save Changes"
- [ ] Should see success message

### Test 6: Export Data
- [ ] On Students page
- [ ] Click "Export CSV" button
- [ ] CSV file should download
- [ ] Open CSV file
- [ ] Should contain student data

## Troubleshooting Checklist

### If Backend Won't Start
- [ ] Check MySQL is running
- [ ] Verify `.env` database credentials
- [ ] Check port 5000 is not in use: `netstat -ano | findstr :5000`
- [ ] Check for error messages in terminal
- [ ] Try: `npm install` again
- [ ] Try: `npm run init-db` again

### If Frontend Won't Start
- [ ] Check port 3000 is not in use: `netstat -ano | findstr :3000`
- [ ] Verify backend is running
- [ ] Check for error messages in terminal
- [ ] Try: `npm install` again
- [ ] Clear browser cache

### If Login Fails
- [ ] Verify username: `admin`
- [ ] Verify password: `admin123` (or your custom password)
- [ ] Check backend terminal for errors
- [ ] Check browser console (F12) for errors
- [ ] Verify backend is running on port 5000

### If Database Connection Fails
- [ ] Verify MySQL is running
- [ ] Check MySQL credentials in `.env`
- [ ] Try connecting manually: `mysql -u root -p`
- [ ] Check MySQL port: default is 3306
- [ ] Verify database exists: `SHOW DATABASES;`

### If QR Code Doesn't Work
- [ ] Verify form is "Active" (green badge)
- [ ] Check the URL in QR code
- [ ] Ensure both servers are running
- [ ] Try copying URL manually
- [ ] Check browser console for errors

## Security Checklist (Before Production)

- [ ] Change default admin password
- [ ] Generate strong JWT_SECRET
- [ ] Update CORS settings for production domain
- [ ] Enable HTTPS
- [ ] Set up firewall rules
- [ ] Configure database backups
- [ ] Review and limit database user permissions
- [ ] Enable MySQL SSL connections
- [ ] Set up monitoring and logging
- [ ] Create database backup schedule

## Performance Checklist

- [ ] Database indexes are created (done automatically)
- [ ] Connection pooling is configured (done automatically)
- [ ] Frontend is built for production: `npm run build`
- [ ] Static files are served efficiently
- [ ] Images are optimized
- [ ] Unnecessary console.logs removed
- [ ] Error handling is comprehensive

## Documentation Checklist

- [ ] README.md reviewed
- [ ] QUICK_START.md reviewed
- [ ] COMMANDS_REFERENCE.md bookmarked
- [ ] PROJECT_SUMMARY.md read
- [ ] API endpoints documented
- [ ] Environment variables documented

## Backup Checklist

- [ ] Database backup created
  ```powershell
  mysqldump -u root -p student_database > backup.sql
  ```
- [ ] `.env` file backed up securely
- [ ] Project files backed up
- [ ] Backup location documented
- [ ] Restore procedure tested

## Deployment Checklist (Optional)

### For Production Deployment
- [ ] Choose hosting provider
- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Build frontend: `npm run build`
- [ ] Deploy backend to server
- [ ] Deploy frontend static files
- [ ] Configure domain and SSL
- [ ] Test all functionality
- [ ] Set up monitoring
- [ ] Configure automated backups

## Final Verification

### Everything Working?
- [ ] Backend running without errors
- [ ] Frontend accessible at http://localhost:3000
- [ ] Can login successfully
- [ ] Can create forms
- [ ] Can generate QR codes
- [ ] Can submit forms
- [ ] Can approve submissions
- [ ] Can view student database
- [ ] Can export CSV
- [ ] No console errors
- [ ] No server errors

## Success! 🎉

If all checkboxes are checked, your Student Database Management System is fully operational!

### Next Steps
1. Create your first real form
2. Generate and print QR codes
3. Start collecting student data
4. Review submissions regularly
5. Manage your student database

### Quick Reference
- **Admin Panel:** http://localhost:3000
- **API Health:** http://localhost:5000/health
- **Default Login:** admin / admin123
- **Backend Port:** 5000
- **Frontend Port:** 3000

### Need Help?
- Check README.md for detailed documentation
- Review COMMANDS_REFERENCE.md for all commands
- Check troubleshooting section above
- Review error messages in terminal
- Check browser console (F12)

---

**Keep this checklist for future reference and troubleshooting!**

**Project Status: ✅ READY TO USE**
