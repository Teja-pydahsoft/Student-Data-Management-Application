# Student Database Management System

A comprehensive full-stack application for managing student data through dynamic forms with QR code generation. Built with Node.js, Express, MySQL, React, and modern UI components.

## 🌟 Features

### Admin Panel
- **Dynamic Form Builder**: Create custom forms with various field types (text, email, number, date, dropdown, radio, checkbox, etc.)
- **QR Code Generation**: Automatic QR code generation for each form that remains constant even when form fields are updated
- **Form Management**: Edit, activate/deactivate, and delete forms
- **Submission Approval Workflow**: Review and approve/reject student submissions before data enters the database
- **Student Database**: View, search, edit, and export student records
- **Dashboard**: Real-time statistics and recent submissions overview
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
Student Database Management/
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

5. **Start the backend server:**
```bash
# Development mode with auto-reload
npm run dev

# OR Production mode
npm start
```

The backend will run on `http://localhost:5000`

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

### Creating a Form

1. Login to the admin panel
2. Navigate to **Forms** section
3. Click **Create Form**
4. Fill in form details:
   - Form Name (required)
   - Description (optional)
5. Add fields using the **Add Field** button
6. For each field, configure:
   - Label (required)
   - Type (text, email, number, date, dropdown, etc.)
   - Placeholder text
   - Required/Optional
   - Options (for dropdown, radio, checkbox)
7. Click **Create Form**
8. A QR code will be automatically generated

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
2. View all student records
3. Use search to find specific students
4. Click **View** to see full student details
5. Click **Edit** to modify student data
6. Click **Export CSV** to download all records
7. Delete students if needed

### Editing Forms

1. Go to **Forms** section
2. Click **Edit** on any form
3. Modify form name, description, or fields
4. Add/remove/edit fields as needed
5. Click **Update Form**
6. **Important**: The QR code remains the same!

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/change-password` - Change admin password

### Forms
- `POST /api/forms` - Create new form (Admin)
- `GET /api/forms` - Get all forms (Admin)
- `GET /api/forms/:formId` - Get form by ID (Admin)
- `PUT /api/forms/:formId` - Update form (Admin)
- `DELETE /api/forms/:formId` - Delete form (Admin)
- `GET /api/forms/public/:formId` - Get form for public submission (No auth)

### Submissions
- `POST /api/submissions/:formId` - Submit form (Public, no auth)
- `GET /api/submissions` - Get all submissions (Admin)
- `GET /api/submissions/:submissionId` - Get submission details (Admin)
- `POST /api/submissions/:submissionId/approve` - Approve submission (Admin)
- `POST /api/submissions/:submissionId/reject` - Reject submission (Admin)
- `DELETE /api/submissions/:submissionId` - Delete submission (Admin)

### Students
- `GET /api/students` - Get all students with optional search (Admin)
- `GET /api/students/stats` - Get dashboard statistics (Admin)
- `GET /api/students/:admissionNumber` - Get student by admission number (Admin)
- `PUT /api/students/:admissionNumber` - Update student data (Admin)
- `DELETE /api/students/:admissionNumber` - Delete student (Admin)

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
```

### Frontend
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
```

## 📊 Features in Detail

### Dynamic Form Builder
- Support for 9+ field types
- Drag-and-drop field ordering (can be added)
- Conditional field logic (can be extended)
- Field validation rules
- Custom placeholder text
- Required/optional fields

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

### Data Management
- JSON-based flexible schema
- Automatic data merging
- Search across all fields
- CSV export functionality
- Bulk operations support (can be added)

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

---

**Built with ❤️ for efficient student data management**
