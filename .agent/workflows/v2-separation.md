---
description: Separate V2 as standalone backend and frontend applications
---

# Version 2.0 Separation Workflow

## Overview
This workflow guides you through creating separate **pydah-v2-backend** and **pydah-v2-frontend** applications outside the Student-Data-Management-Application folder, similar to the ticket-app structure but as independent applications that connect to the main workspace.

## Architecture
```
E:\
├── Student-Data-Management-Application\     (V1 - Main Portal)
│   ├── backend\                             (V1 Backend - Port 5000)
│   ├── frontend\                            (V1 Frontend - Port 5173)
│   ├── ticket-backend\                      (Ticket Backend - Port 5001)
│   └── ticket-app\                          (Ticket Frontend - Port 5174)
│
├── pydah-v2-backend\                        (NEW - V2 Backend - Port 5002)
│   ├── config\
│   ├── controllers\
│   ├── routes\
│   ├── middleware\
│   ├── migrations\
│   └── server.js
│
└── pydah-v2-frontend\                       (NEW - V2 Frontend - Port 5175)
    ├── src\
    ├── public\
    └── package.json
```

## Phase 1: Create V2 Backend Structure

### Step 1: Create V2 Backend Directory
```powershell
# Navigate to parent directory
cd E:\

# Create V2 backend folder
mkdir pydah-v2-backend
cd pydah-v2-backend

# Initialize npm project
npm init -y
```

### Step 2: Install V2 Backend Dependencies
```powershell
npm install express cors dotenv mysql2 bcryptjs jsonwebtoken express-validator multer compression body-parser mongoose
npm install --save-dev nodemon
```

### Step 3: Copy Core Backend Files
You'll need to copy these files from the main backend:
- `config/database.js` (shared database connection)
- `config/mongoConfig.js` (if using MongoDB)
- `middleware/auth.js`
- `middleware/rbac.js`
- `constants/rbac.js` (update with V2 roles)

### Step 4: Create V2-Specific Controllers
Copy and modify these V2-specific controllers:
- `controllers/facultyController.js`
- `controllers/hourlyAttendanceController.js`
- `controllers/academicContentController.js`
- `controllers/internalMarksController.js`
- `controllers/chatController.js`
- `controllers/periodSlotsController.js`
- `controllers/timetableController.js`
- `controllers/subjectsController.js`

### Step 5: Create V2-Specific Routes
Copy and modify these V2-specific routes:
- `routes/facultyRoutes.js`
- `routes/hourlyAttendanceRoutes.js`
- `routes/academicContentRoutes.js`
- `routes/internalMarksRoutes.js`
- `routes/chatRoutes.js`
- `routes/periodSlotsRoutes.js`
- `routes/timetableRoutes.js`
- `routes/subjectsRoutes.js`

### Step 6: Create V2 Backend server.js
Create a new `server.js` that:
- Runs on port 5002
- Connects to the same database as V1
- Only includes V2-specific routes
- Has CORS configured for V2 frontend (port 5175)

## Phase 2: Create V2 Frontend Structure

### Step 1: Create V2 Frontend Directory
```powershell
# Navigate to parent directory
cd E:\

# Create V2 frontend using Vite
npm create vite@latest pydah-v2-frontend -- --template react
cd pydah-v2-frontend
```

### Step 2: Install V2 Frontend Dependencies
```powershell
npm install
npm install react-router-dom axios lucide-react react-hot-toast date-fns
npm install --save-dev tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3: Copy Core Frontend Files
Copy these shared files from main frontend:
- `src/utils/api.js` (update base URL to V2 backend)
- `src/context/AuthContext.jsx`
- `src/constants/rbac.js` (update with V2 roles)

### Step 4: Create V2-Specific Pages
Create these V2-specific pages:
- `src/pages/faculty/Dashboard.jsx`
- `src/pages/faculty/PostAttendance.jsx`
- `src/pages/faculty/ContentManage.jsx`
- `src/pages/faculty/TestsManage.jsx`
- `src/pages/faculty/Announcements.jsx`
- `src/pages/faculty/Students.jsx`
- `src/pages/faculty/Chats.jsx`
- `src/pages/student/AcademicDashboard.jsx`

### Step 5: Create V2 Layout
Create `src/components/Layout/FacultyLayout.jsx` for faculty portal navigation.

### Step 6: Configure Vite for Port 5175
Update `vite.config.js`:
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true
      }
    }
  }
})
```

## Phase 3: Database Migration

### Step 1: Run V2 Migration
The V2 migration should already exist in the main backend. You can:
1. Run it from V1 backend (it will create V2 tables in the shared database)
2. Or copy the migration to V2 backend and run it there

```powershell
# From V1 backend
cd E:\Student-Data-Management-Application\backend
node scripts/runMigrations.js
```

## Phase 4: Environment Configuration

### V2 Backend .env
Create `E:\pydah-v2-backend\.env`:
```env
PORT=5002
NODE_ENV=development

# Database (shared with V1)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=student_database
DB_STAGING=student_database_staging

# JWT (shared with V1 for SSO)
JWT_SECRET=your_jwt_secret

# CORS
CORS_ORIGINS=http://localhost:5175,http://localhost:5173

# MongoDB (if needed)
MONGODB_URI=mongodb://localhost:27017/pydah_v2
```

### V2 Frontend .env
Create `E:\pydah-v2-frontend\.env`:
```env
VITE_API_URL=http://localhost:5002/api
VITE_V1_PORTAL_URL=http://localhost:5173
```

## Phase 5: Cross-Application Integration

### SSO Integration
Both V1 and V2 should:
1. Share the same JWT_SECRET
2. Use the same authentication tokens
3. Allow seamless navigation between portals

### Navigation Links
- V1 Student Portal → Link to V2 Academic Dashboard
- V2 Faculty Portal → Link to V1 Admin Portal
- Shared authentication state

## Phase 6: Testing

### Test V2 Backend
```powershell
cd E:\pydah-v2-backend
npm run dev
# Should run on http://localhost:5002
```

### Test V2 Frontend
```powershell
cd E:\pydah-v2-frontend
npm run dev
# Should run on http://localhost:5175
```

### Test Integration
1. Login to V1 portal (http://localhost:5173)
2. Navigate to V2 portal (http://localhost:5175)
3. Verify SSO works (no re-login required)
4. Test faculty features
5. Test student academic dashboard

## Phase 7: Deployment

### Backend Deployment
- Deploy V2 backend to separate service (e.g., Vercel, Railway, or AWS)
- Use environment variables for production database
- Configure CORS for production frontend URL

### Frontend Deployment
- Deploy V2 frontend to Vercel or similar
- Update API URL to production backend
- Configure environment variables

## File Migration Checklist

### From V1 Backend to V2 Backend
- [ ] `config/database.js`
- [ ] `config/mongoConfig.js`
- [ ] `middleware/auth.js`
- [ ] `middleware/rbac.js`
- [ ] `constants/rbac.js`
- [ ] `controllers/facultyController.js`
- [ ] `controllers/hourlyAttendanceController.js`
- [ ] `controllers/academicContentController.js`
- [ ] `controllers/internalMarksController.js`
- [ ] `controllers/chatController.js`
- [ ] `controllers/periodSlotsController.js`
- [ ] `controllers/timetableController.js`
- [ ] `controllers/subjectsController.js`
- [ ] `routes/*` (V2-specific routes)
- [ ] `migrations/pydah_v2_faculty_and_academics.sql`

### From V1 Frontend to V2 Frontend
- [ ] `src/utils/api.js`
- [ ] `src/context/AuthContext.jsx`
- [ ] `src/constants/rbac.js`
- [ ] `src/components/Layout/FacultyLayout.jsx`
- [ ] `src/pages/faculty/*`
- [ ] `src/pages/student/AcademicDashboard.jsx`
- [ ] `src/index.css` (shared styles)

## Notes
- V2 uses the **same database** as V1 (shared tables + new V2 tables)
- V2 backend runs on **port 5002**
- V2 frontend runs on **port 5175**
- Both applications are **separate codebases** but **connected via database and SSO**
- This structure allows independent development, deployment, and scaling
