# Employee Management System - Integration Complete ✅

## Overview
The Ticket App now has a dedicated employee management system with a separate `ticket_employees` table that references the main `rbac_users` table.

## Architecture

### Database Structure
```
rbac_users (Main Backend)
    ↓ (referenced by foreign key)
ticket_employees (Ticket Backend)
```

- **`rbac_users`**: Stores all user authentication and basic info (managed by main backend)
- **`ticket_employees`**: Stores ticket-specific employee assignments (managed by ticket backend)

### Key Features
1. **Separation of Concerns**: Ticket employees are managed separately from RBAC users
2. **Data Integrity**: Foreign key constraint ensures referential integrity
3. **Soft Deletes**: Employees can be deactivated without losing data
4. **Role-Based**: Supports 'staff' (Manager) and 'worker' roles
5. **Automatic Migrations**: Database schema updates automatically on server start

## API Endpoints

### Employee Management (`/api/employees`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all active employees with RBAC user details |
| GET | `/api/employees/available-users` | Get RBAC users not yet assigned as employees |
| POST | `/api/employees` | Assign an RBAC user as an employee |
| PUT | `/api/employees/:id` | Update employee role |
| DELETE | `/api/employees/:id` | Remove employee (soft delete) |

### Request/Response Examples

#### Assign Employee
```javascript
POST /api/employees
{
    "rbac_user_id": 5,
    "role": "staff"  // or "worker"
}
```

#### Update Employee Role
```javascript
PUT /api/employees/1
{
    "role": "worker"
}
```

## Frontend Integration

### EmployeeManagement.jsx
- Fetches employees from `/api/employees`
- Shows only ticket-specific employees (not all RBAC users)
- Filters by role (All/Managers/Workers)
- Search by name or email

### EmployeeModal.jsx
- Simplified to only support assigning existing RBAC users
- No "Create New User" functionality (users must exist in RBAC first)
- Role selection based on active tab context
- Disabled state when no user is selected

## Migration System

### Automatic Migrations
Migrations run automatically when the server starts:
```
Server Start → Check Database → Run Pending Migrations → Start Server
```

### Manual Migration Commands
```bash
# Run all pending migrations
npm run migrate

# Rollback the last migration
npm run migrate:rollback
```

### Migration Tracking
The system creates a `migrations` table to track executed migrations:
```sql
CREATE TABLE migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Database Schema

### ticket_employees Table
```sql
CREATE TABLE ticket_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rbac_user_id INT NOT NULL,
    role ENUM('staff', 'worker') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rbac_user_id) REFERENCES rbac_users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_active_employee (rbac_user_id, is_active)
);
```

**Indexes:**
- `idx_employee_role` - On `role` column for faster filtering
- `idx_employee_active` - On `is_active` column for soft delete queries

**Constraints:**
- Foreign key to `rbac_users(id)` with CASCADE delete
- Unique constraint prevents duplicate active assignments

## Workflow

### Adding an Employee
1. User must first exist in `rbac_users` table (created via main backend)
2. Admin navigates to Employee Management in Ticket App
3. Clicks "Add Manager" or "Add Worker"
4. Selects user from available RBAC users list
5. Assigns role (Manager/Worker)
6. Record created in `ticket_employees` table

### Editing an Employee
1. Admin clicks edit icon on employee card
2. Can only change the role (Manager ↔ Worker)
3. Cannot change the underlying RBAC user

### Removing an Employee
1. Admin clicks delete icon
2. Confirms deletion
3. Record is soft-deleted (`is_active = 0`)
4. Employee no longer appears in the list
5. RBAC user remains intact in `rbac_users` table

## Files Modified/Created

### Backend (`ticket-backend/`)
- ✅ `migrations/001_create_employees_table.js` - Migration script
- ✅ `migrations/001_create_employees_table.sql` - SQL migration (legacy)
- ✅ `migrations/migrate.js` - Migration runner
- ✅ `migrations/README.md` - Migration documentation
- ✅ `controllers/employeeController.js` - Employee CRUD operations
- ✅ `routes/employeeRoutes.js` - Employee API routes
- ✅ `server.js` - Added employee routes & auto-migration
- ✅ `package.json` - Added migration scripts

### Frontend (`ticket-app/`)
- ✅ `src/pages/admin/EmployeeManagement.jsx` - Updated to use new API
- ✅ `src/components/admin/EmployeeModal.jsx` - Simplified for assignments only

## Testing

### Verify Migration
```bash
cd ticket-backend
npm run migrate
```

Expected output:
```
✅ Migration completed successfully!
```

### Verify API
```bash
# Get all employees
curl http://localhost:5001/api/employees

# Get available users
curl http://localhost:5001/api/employees/available-users
```

### Verify Frontend
1. Navigate to Employee Management page
2. Click "Add Manager" or "Add Worker"
3. Select a user from the list
4. Assign role
5. Verify employee appears in the list

## Troubleshooting

### Migration Already Executed
If you see "already executed", the migration has run successfully. No action needed.

### Foreign Key Constraint Error
Ensure the `rbac_users` table exists and has the correct structure. The `rbac_user_id` must reference a valid user.

### No Available Users
If the "Select Existing User" list is empty:
1. Ensure users exist in `rbac_users` table
2. Check that they haven't already been assigned as employees
3. Verify they're not `super_admin` or `student` roles

## Next Steps

1. ✅ Migration system is set up and working
2. ✅ Employee API endpoints are functional
3. ✅ Frontend is integrated with new structure
4. 🔄 Test the complete workflow in the UI
5. 🔄 Verify data integrity and constraints

## Benefits of This Approach

1. **Clean Separation**: Ticket employees are separate from general RBAC users
2. **Data Integrity**: Foreign keys ensure consistency
3. **Flexibility**: Can assign/unassign users without affecting their RBAC status
4. **Audit Trail**: Track when employees were assigned
5. **Scalability**: Easy to add ticket-specific employee metadata later
6. **Version Control**: Database schema changes are tracked via migrations
