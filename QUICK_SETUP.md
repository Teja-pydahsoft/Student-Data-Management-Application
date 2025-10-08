# Quick Setup Guide - New Features

## 🚀 Quick Start (5 Minutes)

### Step 1: Install New Dependencies
```bash
cd backend
npm install
```

### Step 2: Run Database Migration
```bash
# Windows (PowerShell)
Get-Content backend\scripts\migration_add_features.sql | mysql -u root -p student_database

# Or using MySQL Workbench
# Open and execute: backend/scripts/migration_add_features.sql
```

### Step 3: Create Uploads Directory
```bash
cd backend
mkdir uploads
```

### Step 4: Restart Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## ✅ Verify Installation

### Test 1: Phone Validation
1. Open any public form
2. Try typing letters in phone field
3. ✅ Should block non-numeric characters

### Test 2: Student Filters
1. Go to Students page
2. Click "Filters" button
3. ✅ Should show filter panel

### Test 3: Bulk Upload
1. Go to Submissions page
2. Click "Bulk Upload" button
3. ✅ Modal should open

### Test 4: Roll Numbers
1. Go to Students page
2. Click "Bulk Roll Numbers" button
3. ✅ Modal should open

## 📋 What's New?

1. **Phone Validation** - Students can only enter numbers in phone fields
2. **Advanced Filters** - Filter students by date range and roll number status
3. **Bulk Upload** - Upload multiple submissions via CSV
4. **Roll Numbers** - Bulk update roll numbers for students
5. **Source Tracking** - See if submission was by student or admin

## 🆘 Troubleshooting

**Problem**: Migration fails  
**Solution**: Run each ALTER statement individually in MySQL Workbench

**Problem**: CSV upload fails  
**Solution**: Ensure uploads directory exists in backend folder

**Problem**: Phone validation not working  
**Solution**: Clear browser cache and reload

## 📖 Full Documentation

- **FEATURE_UPDATE_GUIDE.md** - Complete feature documentation
- **IMPLEMENTATION_STATUS_REPORT.md** - Detailed status report

---

**Ready to use!** 🎉
