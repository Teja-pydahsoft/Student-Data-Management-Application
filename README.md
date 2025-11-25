# Pydah Student Database Management System

A comprehensive full-stack application for managing student data through dynamic forms with QR code generation. Built with Node.js, Express, MySQL, React, and modern UI components.

## 🌟 Features

### Admin Panel
- **Default Student Form**: Pre-configured student registration form with all necessary fields
- **QR Code Generation**: Automatic QR code generation for the student form
- **Form Management**: View and activate/deactivate the default form
- **Submission Approval Workflow**: Review and approve/reject student submissions before data enters the database
- **Auto-Assign Admission Series**: Generate sequential admission numbers with toggle for automatic assignment
- **Student Database**: View, search, edit, and export student records
  - **Modern Student Details View**: Premium admin-dashboard layout with left sidebar (photo + key info) and organized right-side sections
  - **Profile Completion Percentage**: Dynamic calculation showing how many fields are filled (33 fields tracked)
  - **Regular Students Filter**: Default view shows only students with "Regular" status
  - **Photo Upload**: Direct photo upload in student details modal
  - **Advanced Filtering**: Filter by college, course, branch, batch, year, semester, status, and more
- **Dashboard**: Real-time statistics showing Regular students count and pending submissions
- **Audit Logging**: Track all admin actions for accountability

### Student Interface
- **Mobile-Responsive Forms**: Clean, mobile-optimized form submission interface
- **QR Code Access**: Students can scan QR codes to directly access forms on their mobile devices
- **Real-time Validation**: Client-side form validation for better user experience

### Technical Features
- **Master Database Architecture**: Centralized student database that can be used by other applications
- **Admission Number System**: Each student is assigned a unique admission number as a key value
- **Dynamic Field Updates**: Admin can modify form fields without changing the QR code
- **Data Merging**: When a student with existing admission number submits a form, data is merged intelligently
- **RESTful API**: Clean API architecture for easy integration
- **JWT Authentication**: Secure admin authentication system
- **Transaction Support**: Database transactions for data integrity

## 📁 Project Structure

```
Pydah Student Database Management/
├── backend/
│   ├── config/
│   │   ├── database.js          # Database connection configuration
│   │   └── schema.sql            # Database schema
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── formController.js     # Form CRUD operations
│   │   ├── submissionController.js # Submission handling
│   │   └── studentController.js  # Student data management
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication middleware
│   │   └── validator.js          # Request validation
│   ├── routes/
│   │   ├── authRoutes.js         # Auth endpoints
│   │   ├── formRoutes.js         # Form endpoints
│   │   ├── submissionRoutes.js   # Submission endpoints
│   │   └── studentRoutes.js      # Student endpoints
│   ├── scripts/
│   │   └── initDatabase.js       # Database initialization script
│   ├── .env.example              # Environment variables template
│   ├── package.json
│   └── server.js                 # Express server entry point
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Layout/
    │   │       └── AdminLayout.jsx  # Admin panel layout
    │   ├── config/
    │   │   └── api.js               # Axios configuration
    │   ├── pages/
    │   │   ├── Dashboard.jsx        # Dashboard page
    │   │   ├── Forms.jsx            # Forms management
    │   │   ├── FormBuilder.jsx      # Form creation/editing
    │   │   ├── Submissions.jsx      # Submission review
    │   │   ├── Students.jsx         # Student database
    │   │   ├── Login.jsx            # Admin login
    │   │   └── PublicForm.jsx       # Public form submission
    │   ├── store/
    │   │   └── authStore.js         # Zustand state management
    │   ├── App.jsx                  # Main app component
    │   ├── main.jsx                 # React entry point
    │   └── index.css                # Global styles
    ├── .env.example
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Step 1: Clone or Navigate to Project Directory
```bash
cd "d:/Student Database Management"
```

### Step 2: Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
```bash
# Copy the example env file
copy .env.example .env

# Edit .env file with your configuration
notepad .env
```

**Important:** Update the following in `.env`:
```env
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_database
DB_PORT=3306

# Staging Database (for pending submissions)
# If omitted, it will use the same host/user/pass as master
STAGING_DB_HOST=localhost
STAGING_DB_USER=root
STAGING_DB_PASSWORD=your_mysql_password
STAGING_DB_NAME=student_staging
STAGING_DB_PORT=3306

# JWT Secret (change this to a random string)
JWT_SECRET=your_super_secret_jwt_key_change_this

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

4. **Initialize the database:**
```bash
npm run init-db
```

This will:
- Create the database
- Create all necessary tables
- Set up the default admin user

5. **Initialize Supabase settings (if using Supabase for staging):**
```bash
npm run init-settings
```

This will check if the settings table exists in Supabase and provide instructions to create it if needed. The settings table is required for the auto-assign series feature.

**Important:** If using Supabase for staging, you need to manually create the settings table in your Supabase dashboard:
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the following SQL:

```sql
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (key, value) VALUES ('auto_assign_series', 'false')
ON CONFLICT (key) DO NOTHING;
```

5. **Start the backend server:**
```bash
# Development mode with auto-reload
npm run dev

# OR Production mode
npm start
```

The backend will run on `http://localhost:5000`

### Dual Database Architecture

- **Master DB (`student_database`)**: Stores approved data and the canonical student records (MySQL/AWS RDS by default).
- **Staging (for pending/rejected submissions)**: This project supports two staging options:
   - Supabase (recommended for staging): store forms, admins and pending submissions in Supabase Postgres. Set `SUPABASE_URL` and `SUPABASE_KEY` in `backend/.env` to enable.
   - MySQL staging database: an optional MySQL `student_staging` (controlled via `STAGING_DB_*` env vars). If `SUPABASE_*` are present, the code uses Supabase for staging features and scripts; otherwise it falls back to MySQL staging.

Flow:
1. Public/CSV submissions are inserted into staging as `pending` (Supabase or `student_staging.form_submissions`).
2. Admin reviews and either rejects (stays in staging with `rejected`) or approves.
3. On approval, data is written to a per-form table in master DB: `form_<form_id>` with columns created from `form_fields`. The staging row is marked `approved`.

### Step 3: Frontend Setup

1. **Open a new terminal and navigate to frontend directory:**
```bash
cd "d:/Student Database Management/frontend"
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
```bash
# Copy the example env file
copy .env.example .env
```

The default configuration should work:
```env
VITE_API_URL=http://localhost:5000/api
```

4. **Start the frontend development server:**
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

### Step 4: Access the Application

1. **Admin Panel**: Open `http://localhost:3000` in your browser
2. **Login Credentials**:
   - Username: `admin`
   - Password: `admin123`

## 📱 Usage Guide

### Default Student Form

The system comes with a pre-configured student registration form that includes all essential fields:

1. **Personal Information**: Student name, gender, date of birth, Aadhar number
2. **Academic Information**: Pin number, batch, branch, student type, roll number
3. **Contact Information**: Student mobile, parent mobile numbers
4. **Address Information**: Complete address, city/village, mandal, district
5. **Additional Information**: Previous college, certificate status, remarks

The form is automatically created when you run the database initialization script.

### Viewing and Downloading QR Codes

1. Go to **Forms** section
2. Click the **QR** button on any form card
3. View the QR code in the modal
4. Click **Download** to save as PNG
5. Print or display the QR code for students to scan

### Student Form Submission

1. Student scans the QR code with their mobile device
2. Form opens directly in their mobile browser
3. Student fills out the form
4. Optionally enters admission number (if they have one)
5. Submits the form
6. Receives confirmation message

### Reviewing Submissions

1. Navigate to **Submissions** section
2. Filter by status: Pending, Approved, or Rejected
3. Click **View** (eye icon) to see submission details
4. For pending submissions:
   - Enter or verify admission number
   - Click **Approve** to accept and save to database
   - OR Click **Reject** with optional reason
5. Approved data is automatically added to the student database

### Managing Student Database

1. Go to **Students** section
2. **Default View**: Shows only "Regular" students (filtered by student status)
3. View all student records in a comprehensive table
4. Use search to find specific students by admission number or name
5. **Advanced Filtering**: Filter by college, course, branch, batch, year, semester, status, scholar status, caste, gender, and more
6. Click **View** to see full student details in a modern modal:
   - **Left Sidebar**: Student photo, name, roll number, course, branch, year/semester, college, batch, student type
   - **Right Section**: Organized into sections (Admission Details, Student Information, Parent Information, Address Details, Administrative Information)
   - **Profile Completion**: Shows completion percentage with progress bar (calculated from 33 fields)
   - **Edit Mode**: Click Edit to modify any field, with dropdowns for Student Type (MANG/CONV/SPOT) and Scholar Status (eligible/not eligible)
   - **Photo Upload**: Click on photo area in edit mode to upload student photo
7. Click **Edit** to modify student data inline
8. Click **Export CSV** to download all records
9. Bulk operations: Select multiple students for bulk delete or PIN number updates
10. Delete students if needed

### Managing the Default Form

1. Go to **Forms** section
2. View the default student form details
3. Toggle form activation/deactivation as needed
4. Download QR code for student access
5. **Note**: The form fields are pre-configured and cannot be modified through the UI

### Dashboard Overview

1. **Statistics Cards**:
   - **Total Students**: Displays count of Regular students only (automatically filtered)
   - **Pending Submissions**: Shows number of submissions awaiting review
2. **Quick Actions**: 
   - **Review Submissions**: Direct link to submissions page with pending count
   - **View Students**: Direct link to students database
3. **Recent Submissions**: 
   - Shows last 10 form submissions
   - Displays form name, admission number, status, and timestamp
   - Click "View All" to see complete submissions list

### Auto-Assign Admission Series

1. **Enable Auto-Assign**: Go to **Submissions** section and toggle the "Auto-Assign Series" switch
2. **Generate Series**: Click the "Generate Series" button to create sequential admission numbers
3. **Auto-Assignment Options**:
   - Generate numbers for manual assignment (copy to clipboard)
   - Auto-assign to pending submissions (assigns to existing pending forms)
   - Enable global auto-assign (new submissions automatically get numbers)
4. **Sequential Format**: Numbers are generated in format `PREFIX_001`, `PREFIX_002`, etc.
5. **Default Prefix**: Uses `PYDAH2025` by default, can be customized

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/change-password` - Change admin password

### Forms
- `GET /api/forms` - Get all forms (Admin)
- `GET /api/forms/:formId` - Get form by ID (Admin)
- `PUT /api/forms/:formId` - Update form (Admin)
- `GET /api/forms/public/:formId` - Get form for public submission (No auth)

### Submissions
- `POST /api/submissions/:formId` - Submit form (Public, no auth)
- `GET /api/submissions` - Get all submissions (Admin)
- `GET /api/submissions/:submissionId` - Get submission details (Admin)
- `POST /api/submissions/:submissionId/approve` - Approve submission (Admin)
- `POST /api/submissions/:submissionId/reject` - Reject submission (Admin)
- `DELETE /api/submissions/:submissionId` - Delete submission (Admin)
- `POST /api/submissions/generate-admission-series` - Generate sequential admission numbers (Admin)
- `GET /api/submissions/auto-assign-status` - Get auto-assign series setting (Admin)
- `POST /api/submissions/toggle-auto-assign` - Toggle auto-assign series setting (Admin)

Notes:
- Pending/rejected submissions are served from the staging DB.
- Approval persists data to the master DB.

### Students
- `GET /api/students` - Get all students with optional search and filters (Admin)
  - Default filter: `student_status=Regular` (shows only Regular students)
  - Supports filtering by: college, course, branch, batch, year, semester, student_status, scholar_status, caste, gender, etc.
- `GET /api/students/stats` - Get dashboard statistics (Admin)
  - Returns total Regular students count and pending submissions
- `GET /api/students/:admissionNumber` - Get student by admission number (Admin)
- `PUT /api/students/:admissionNumber` - Update student data (Admin)
- `POST /api/students/upload-photo` - Upload student photo (Admin)
- `PUT /api/students/:admissionNumber/pin-number` - Update PIN number (Admin)
- `DELETE /api/students/:admissionNumber` - Delete student (Admin)
- `POST /api/students/bulk-delete` - Bulk delete students (Admin)
- `GET /api/submissions/student/:admissionNumber/completion-status` - Get profile completion percentage (Admin)

## 🗄️ Database Schema

### Tables

1. **admins** - Admin user accounts
2. **forms** - Form definitions with fields stored as JSON
3. **form_submissions** - Pending/approved/rejected submissions
4. **students** - Master student database with data stored as JSON
5. **audit_logs** - Activity logs for all admin actions
6. **field_templates** - Optional reusable field templates

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- SQL injection protection via parameterized queries
- CORS configuration
- Request validation
- Protected admin routes
- Audit logging for accountability

## 🎨 Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL2** - Database driver
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **QRCode** - QR code generation
- **UUID** - Unique ID generation

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Routing
- **Zustand** - State management
- **Axios** - HTTP client
- **TailwindCSS** - Styling
- **Lucide React** - Icons
- **React Hot Toast** - Notifications
- **React QR Code** - QR code display

## 🛠️ Development Commands

### Backend
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run init-db    # Initialize database
npm run init-settings # Initialize Supabase settings table
```

### Frontend
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
```

## 📊 Features in Detail

### Default Student Form
- Pre-configured with all essential student fields
- 25+ predefined fields including personal, academic, and contact information
- Field validation rules
- Required/optional field configuration
- Mobile-optimized form layout

### QR Code System
- Unique QR code per form
- QR code persists through form updates
- High-resolution PNG download
- Direct mobile access
- No app installation required

### Approval Workflow
1. Student submits form
2. Submission enters "pending" state
3. Admin reviews submission
4. Admin approves with admission number
5. Data merges into student database
6. OR Admin rejects with reason

### Student Details View (Premium UI)
- **Modern Layout**: Two-column design with left sidebar and organized right sections
- **Left Sidebar (320px)**: 
  - Student photo with upload capability
  - Key identity information (Name, Roll Number, Course, Branch, Year/Semester, College, Batch, Student Type)
- **Right Section**: Organized into cards
  - **Admission Details**: Admission number, completion progress with visual progress bar
  - **Student Information**: Personal and academic details in two-column grid
  - **Parent Information**: Parent mobile numbers
  - **Address Details**: Full address, city/village, mandal, district, caste, gender
  - **Administrative Information**: Status, scholar status, previous college, certificate status, remarks
- **Profile Completion Percentage**: 
  - Calculates completion based on 33 tracked fields
  - Shows percentage, filled count, and total count
  - Visual progress bar with color coding (Green ≥80%, Blue ≥50%, Gray <50%)
  - Updates in real-time as fields are edited
  - No API calls needed - instant client-side calculation
- **Edit Mode**: 
  - Inline editing for all fields
  - Dropdowns for Student Type (MANG/CONV/SPOT) and Scholar Status (eligible/not eligible)
  - Photo upload by clicking on photo area
  - Real-time completion percentage updates

### Data Management
- JSON-based flexible schema
- Automatic data merging
- Search across all fields
- CSV export functionality
- **Regular Students Filter**: Default view shows only students with "Regular" status
- **Advanced Filtering**: Multiple filter options for precise data retrieval
- Bulk operations support (bulk delete, bulk PIN number update)
- Profile completion tracking (33 fields monitored)

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Check MySQL is running
# Verify credentials in .env
# Ensure database exists
# Check firewall settings
```

### Port Already in Use
```bash
# Change PORT in backend/.env
# Change port in frontend/.env (VITE_API_URL)
# Update vite.config.js if needed
```

### CORS Errors
```bash
# Verify FRONTEND_URL in backend/.env
# Check api.js baseURL in frontend
# Ensure both servers are running
```

## 📝 Environment Variables Reference

### Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| DB_HOST | MySQL host | localhost |
| DB_USER | MySQL username | root |
| DB_PASSWORD | MySQL password | - |
| DB_NAME | Database name | student_database |
| JWT_SECRET | JWT signing key | - |
| ADMIN_USERNAME | Default admin username | admin |
| ADMIN_PASSWORD | Default admin password | admin123 |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |
| STAGING_DB_HOST | Staging DB host | DB_HOST |
| STAGING_DB_USER | Staging DB user | DB_USER |
| STAGING_DB_PASSWORD | Staging DB password | DB_PASSWORD |
| STAGING_DB_NAME | Staging DB name | student_staging |
| STAGING_DB_PORT | Staging DB port | DB_PORT |

### Frontend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:5000/api |

## 🚀 Production Deployment

### Backend
1. Set `NODE_ENV=production` in .env
2. Use a process manager (PM2, systemd)
3. Set up reverse proxy (Nginx)
4. Enable HTTPS
5. Configure firewall
6. Set strong JWT_SECRET
7. Change default admin password

### Frontend
1. Run `npm run build`
2. Serve `dist` folder with Nginx/Apache
3. Configure environment variables
4. Enable HTTPS
5. Set up CDN (optional)

### Database
1. Use production MySQL server
2. Enable SSL connections
3. Regular backups
4. Monitor performance
5. Set up replication (optional)

## 📄 License

MIT License - Feel free to use this project for personal or commercial purposes.

## 👨‍💻 Support

For issues, questions, or contributions:
1. Check the troubleshooting section
2. Review the API documentation
3. Check database logs
4. Verify environment variables

## ✨ Recent Updates

### Student Details Page Redesign (Latest)
- **Modern Premium UI**: Redesigned with left sidebar photo section and organized right-side data layout
- **Profile Completion Tracking**: Real-time calculation of profile completeness (33 fields)
- **Regular Students Default**: Students page and Dashboard default to showing only Regular students
- **Enhanced Photo Upload**: Direct photo upload in student details modal
- **Improved Field Organization**: Fields grouped into logical sections (Identity, Academic, Parent, Address, Administrative)
- **Better UX**: No scrolling needed, all data fits in viewport with efficient column layout

### Profile Completion System
- Tracks 33 fields for completion calculation:
  - Identity: Name, Roll Number, DOB, Aadhar, Father Name, Gender, Caste
  - Academic: Admission Number, Course, Branch, Batch, College, Student Type, Year, Semester, Admission Date
  - Parent: Parent Mobile 1 & 2
  - Address: Full Address, City/Village, Mandal, District
  - Administrative: Student Status, Scholar Status, Certificate Status, Previous College, Remarks
  - Photo: Student Photo
- Instant calculation (no API calls)
- Visual progress bar with color coding
- Updates in real-time during editing

### Filtering & Search
- Default filter: Shows only "Regular" students
- Advanced filtering: College, Course, Branch, Batch, Year, Semester, Status, Scholar Status, Caste, Gender, Certificate Status
- Quick filters for common searches
- Search by admission number or student name

## 🎯 Future Enhancements

- [ ] Email notifications for submission status
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Bulk import/export
- [ ] Role-based access control
- [ ] Form templates library
- [ ] Mobile app for admin
- [ ] API rate limiting
- [ ] Redis caching
- [ ] Webhook integrations
- [ ] Attendance tracking integration
- [ ] Student promotion workflow

---

**Built with ❤️ for efficient student data management**
