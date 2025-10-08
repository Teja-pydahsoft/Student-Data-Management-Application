# Quick Start Guide

Get your Student Database Management System up and running in 5 minutes!

## ⚡ Quick Setup (Windows)

### 1. Install Prerequisites

Make sure you have:
- **Node.js** (v16+): Download from https://nodejs.org/
- **MySQL** (v8.0+): Download from https://dev.mysql.com/downloads/mysql/

### 2. Setup Backend

Open PowerShell or Command Prompt:

```powershell
# Navigate to backend
cd "d:\Student Database Management\backend"

# Install dependencies
npm install

# Create .env file
copy .env.example .env

# Edit .env with your MySQL password
notepad .env
```

**Important:** Update `DB_PASSWORD` in `.env` with your MySQL root password!

```powershell
# Initialize database (creates tables and admin user)
npm run init-db

# Start backend server
npm run dev
```

✅ Backend running at `http://localhost:5000`

### 3. Setup Frontend

Open a **NEW** PowerShell/Command Prompt window:

```powershell
# Navigate to frontend
cd "d:\Student Database Management\frontend"

# Install dependencies
npm install

# Start frontend server
npm run dev
```

✅ Frontend running at `http://localhost:3000`

### 4. Access the Application

1. Open browser: `http://localhost:3000`
2. Login with:
   - **Username:** `admin`
   - **Password:** `admin123`

## 🎯 First Steps

### Create Your First Form

1. Click **Forms** in sidebar
2. Click **Create Form** button
3. Enter form name: "Student Registration"
4. Add fields:
   - Name (Text, Required)
   - Email (Email, Required)
   - Phone (Phone Number, Required)
   - Course (Dropdown with options)
5. Click **Create Form**
6. View and download the QR code

### Test Form Submission

1. In Forms page, click **QR** button
2. Right-click QR code → Open in new tab (or scan with phone)
3. Fill out the form
4. Submit
5. Go to **Submissions** page
6. Review and approve the submission

### View Student Database

1. Click **Students** in sidebar
2. See approved student records
3. Search, edit, or export data

## 📋 Common Commands

### Backend Commands
```powershell
cd "d:\Student Database Management\backend"

npm run dev        # Start development server
npm start          # Start production server
npm run init-db    # Reinitialize database
```

### Frontend Commands
```powershell
cd "d:\Student Database Management\frontend"

npm run dev        # Start development server
npm run build      # Build for production
```

## 🔧 Troubleshooting

### "Cannot connect to database"
- Check MySQL is running
- Verify password in `backend/.env`
- Ensure MySQL port 3306 is not blocked

### "Port 5000 already in use"
- Change `PORT=5001` in `backend/.env`
- Update `VITE_API_URL` in `frontend/.env`

### "npm: command not found"
- Install Node.js from https://nodejs.org/
- Restart terminal after installation

### Database initialization fails
```powershell
# Login to MySQL manually
mysql -u root -p

# Create database
CREATE DATABASE student_database;

# Then run init script again
npm run init-db
```

## 📱 Testing on Mobile

### Option 1: Same Network
1. Find your computer's IP address:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., 192.168.1.100)

2. Update `backend/.env`:
   ```
   FRONTEND_URL=http://192.168.1.100:3000
   ```

3. Restart backend server

4. On mobile, scan QR code or visit:
   `http://192.168.1.100:3000/form/[form-id]`

### Option 2: ngrok (Internet Access)
```powershell
# Install ngrok: https://ngrok.com/

# Expose backend
ngrok http 5000

# Update frontend .env with ngrok URL
# Restart servers
```

## 🎨 Customization

### Change Admin Password
1. Login to admin panel
2. Use the change password API endpoint
3. Or update directly in database

### Modify Theme Colors
Edit `frontend/tailwind.config.js`:
```javascript
colors: {
  primary: {
    500: '#your-color',
    600: '#your-darker-color',
    // ...
  }
}
```

### Add More Field Types
Edit `frontend/src/pages/FormBuilder.jsx`:
```javascript
const FIELD_TYPES = [
  // Add your custom field type
  { value: 'custom', label: 'Custom Field' },
];
```

## 📊 Database Access

### View Data in MySQL
```powershell
mysql -u root -p
USE student_database;

# View all tables
SHOW TABLES;

# View students
SELECT * FROM students;

# View forms
SELECT * FROM forms;

# View submissions
SELECT * FROM form_submissions;
```

## 🚀 Production Deployment

### Backend (Simple)
```powershell
# Install PM2
npm install -g pm2

# Start with PM2
cd backend
pm2 start server.js --name student-db-backend

# Auto-restart on system boot
pm2 startup
pm2 save
```

### Frontend (Simple)
```powershell
cd frontend
npm run build

# Serve with a static server
npm install -g serve
serve -s dist -p 3000
```

## 📞 Need Help?

1. Check the main README.md for detailed documentation
2. Review API endpoints in README.md
3. Check browser console for errors (F12)
4. Check backend terminal for error logs

## ✅ Verification Checklist

- [ ] MySQL is installed and running
- [ ] Node.js is installed (check: `node --version`)
- [ ] Backend dependencies installed
- [ ] Backend .env configured with correct DB password
- [ ] Database initialized successfully
- [ ] Backend server running on port 5000
- [ ] Frontend dependencies installed
- [ ] Frontend server running on port 3000
- [ ] Can access http://localhost:3000
- [ ] Can login with admin/admin123
- [ ] Can create a form
- [ ] Can view QR code
- [ ] Can submit form
- [ ] Can approve submission

---

**Happy coding! 🎉**
