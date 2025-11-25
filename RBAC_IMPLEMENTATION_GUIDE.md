# RBAC User Management System - Implementation Guide

## Overview

This document describes the complete Role-Based Access Control (RBAC) system implemented for the Student Database Management System. The system provides multi-level access control following the college → course → branch hierarchy.

## Features

- **Multi-level Role Hierarchy**: Super Admin → Campus Principal → Course Principal → HOD
- **Module-wise Permissions**: Read/Write permissions for each module
- **Data Scoping**: Automatic filtering by college/course/branch
- **User Management**: Complete CRUD operations with permission checks

## User Roles

### 1. Super Admin
- **Scope**: All colleges, courses, branches
- **Can Create**: Campus Principals, College AOs
- **Permissions**: Full access to all modules

### 2. Campus Principal
- **Scope**: Assigned college only
- **Can Create**: College AOs, Course Principals (for courses in their college)
- **Permissions**: Configurable per module

### 3. College AO
- **Scope**: Assigned college only
- **Can Create**: None
- **Permissions**: Configurable per module (limited write permissions)

### 4. Course Principal
- **Scope**: Assigned course only
- **Can Create**: Course AOs, HODs (for their course)
- **Permissions**: Configurable per module

### 5. Course AO
- **Scope**: Assigned course only
- **Can Create**: None
- **Permissions**: Configurable per module

### 6. HOD (Head of Department)
- **Scope**: Assigned branch only
- **Can Create**: None
- **Permissions**: Configurable per module

## Modules & Permissions

Each user can have Read (R) and Write (W) permissions for:

1. **Pre-Registration**
2. **Student Management**
3. **Export Students**
4. **Upload Students**
5. **Edit Student**
6. **Delete Student**
7. **Promotions**
8. **Attendance**
9. **Settings**
10. **Campus, Courses, Branches CRUD**
11. **User Management**
12. **Reports**

## Installation & Setup

### 1. Run Database Migration

```bash
cd backend
node scripts/run_rbac_migration.js
```

This creates the `rbac_users` table with all necessary fields.

### 2. Migrate Existing Admin (if you have existing superadmin)

If you already have a superadmin in the `admins` table, migrate it to RBAC:

```bash
node scripts/migrateExistingAdminToRBAC.js
```

This will:
- Find the existing admin with username "superadmin"
- Create a corresponding super_admin in rbac_users
- Preserve the existing password
- Grant full permissions

### 3. Create New Super Admin (if no existing admin)

If you don't have an existing admin, create a new one:

```bash
node scripts/seedSuperAdmin.js
```

Or set environment variables:
```env
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@pydah.edu
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=YourSecurePassword
```

### 3. Start the Server

```bash
npm start
```

## API Endpoints

### User Management

- `GET /api/rbac/users` - Get all users (filtered by scope)
- `GET /api/rbac/users/:id` - Get single user
- `POST /api/rbac/users` - Create new user
- `PUT /api/rbac/users/:id` - Update user
- `DELETE /api/rbac/users/:id` - Deactivate user (soft delete)
- `GET /api/rbac/users/roles/available` - Get roles current user can create
- `GET /api/rbac/users/modules` - Get all available modules

### Authentication

The login endpoint (`POST /api/auth/login`) now supports RBAC users. Users can login with:
- Username or email
- Password

The JWT token includes:
- User ID
- Username
- Role
- College ID, Course ID, Branch ID (if applicable)
- Permissions

## Frontend Usage

### Access Control

The User Management page is accessible to:
- Super Admin (always)
- Users with `user_management` read/write permission

### Creating Users

1. Select a role from the dropdown (only roles you can create are shown)
2. Fill in user details (name, email, phone, username)
3. Select college/course/branch based on role requirements
4. Set permissions for each module (Read/Write checkboxes)
5. Submit - password is auto-generated and shown (TODO: send via email)

### Editing Users

1. Click "Edit" on any user in the list
2. Modify details, permissions, or status
3. Save changes

## Middleware Usage

### Role Verification

```javascript
const { verifyRole } = require('./middleware/rbac');

router.get('/admin-only', verifyRole('super_admin', 'campus_principal'), handler);
```

### Permission Checking

```javascript
const { verifyPermission } = require('./middleware/rbac');

router.post('/students', verifyPermission('student_management', 'write'), handler);
```

### Data Scoping

```javascript
const { attachUserScope } = require('./middleware/rbac');
const { applyUserScope } = require('./utils/scoping');

router.get('/students', attachUserScope, async (req, res) => {
  const { whereClause, params } = applyUserScope(req.userScope, 's');
  const query = `SELECT * FROM students ${whereClause}`;
  // Execute query with params
});
```

## Data Scoping Rules

### Students
- Super Admin: All students
- Campus Principal: Students in their college
- Course Principal: Students in their course
- HOD: Students in their branch

### Attendance
- Same scoping as students

### Reports
- Same scoping as students

## Security Considerations

1. **Password Generation**: Passwords are auto-generated (12 characters, mixed case, numbers, symbols)
2. **Password Storage**: Passwords are hashed using bcrypt (10 rounds)
3. **JWT Tokens**: Include role and permissions, expire after 24 hours
4. **Scope Validation**: All data queries are automatically filtered by user scope
5. **Permission Checks**: Middleware verifies permissions before allowing operations

## Migration from Old System

The new RBAC system works alongside the existing `staff_users` and `admins` tables. To migrate:

1. Run the migration script
2. Create Super Admin
3. Create users for each role level
4. Gradually migrate existing users to the new system
5. Update frontend to use new API endpoints

## Troubleshooting

### "Access denied" errors
- Check user role and permissions
- Verify user scope (college/course/branch assignment)
- Ensure middleware is applied correctly

### "Cannot create user" errors
- Verify you have permission to create the selected role
- Check role requirements (college/course/branch)
- Ensure you're within your scope (e.g., Campus Principal can only create users in their college)

### Data not showing
- Check user scope - data is automatically filtered
- Verify user has read permission for the module
- Check database queries include scope filters

## Future Enhancements

- [ ] Email notification for password generation
- [ ] Password reset functionality
- [ ] Audit logging for user actions
- [ ] Bulk user import
- [ ] Role templates for common permission sets
- [ ] Two-factor authentication

## Support

For issues or questions, contact the development team or refer to the main project documentation.

