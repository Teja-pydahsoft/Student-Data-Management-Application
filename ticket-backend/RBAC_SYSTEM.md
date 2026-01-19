# Custom Role-Based Access Control (RBAC) System

## Overview
The ticket management system now supports **flexible, custom roles** with granular permissions. You can create roles like "Principal", "Manager", "Supervisor", etc., and assign specific READ/WRITE/UPDATE/DELETE permissions for each module.

## Database Schema

### `ticket_roles` Table
Stores role definitions with their permissions:
```sql
- id: Primary key
- role_name: Unique identifier (e.g., 'principal', 'manager')
- display_name: Human-readable name (e.g., 'Principal', 'Ticket Manager')
- description: Role description
- permissions: JSON object with module permissions
- is_system_role: Boolean (system roles cannot be deleted)
- is_active: Boolean
- created_by: Reference to rbac_users
- created_at, updated_at: Timestamps
```

### `ticket_employees` Table (Updated)
Now includes custom role support:
```sql
- custom_role_id: Reference to ticket_roles (nullable)
- role_name: VARCHAR for flexible role names
- permissions: JSON for user-specific permission overrides
- (existing columns remain unchanged)
```

## Permission Structure

Permissions are stored as JSON with this structure:
```json
{
  "ticket_dashboard": { "read": true },
  "ticket_management": { 
    "read": true, 
    "write": true, 
    "update": true, 
    "delete": false 
  },
  "employee_management": { 
    "read": true, 
    "write": true, 
    "update": false, 
    "delete": false 
  },
  "category_management": { 
    "read": true, 
    "write": false, 
    "update": false, 
    "delete": false 
  },
  "ticket_reports": { 
    "read": true, 
    "write": false, 
    "update": false, 
    "delete": false 
  },
  "ticket_settings": { 
    "read": false, 
    "write": false, 
    "update": false, 
    "delete": false 
  }
}
```

## Available Modules

1. **ticket_dashboard** - Dashboard access
   - `read`: View Dashboard

2. **ticket_management** - Ticket operations
   - `read`: View Tickets
   - `write`: Create Tickets
   - `update`: Update Tickets (Status, Assignments)
   - `delete`: Delete Tickets

3. **employee_management** - Employee operations
   - `read`: View Employees
   - `write`: Create Employees
   - `update`: Update Employee Details
   - `delete`: Remove Employees

4. **category_management** - Category operations
   - `read`: View Categories
   - `write`: Create Categories
   - `update`: Update Categories
   - `delete`: Delete Categories

5. **ticket_reports** - Reports & Analytics
   - `read`: View Reports
   - `write`: Generate Reports
   - `update`: Customize Reports
   - `delete`: Delete Reports

6. **ticket_settings** - System Settings
   - `read`: View Settings
   - `write`: Create Settings
   - `update`: Update Settings
   - `delete`: Delete Settings

## Default System Roles

### Super Admin
- **Full access** to all modules with all permissions

### Admin
- Full access to tickets and employees
- Limited access to reports and settings
- Cannot delete categories or employees

### Manager (Staff)
- Can manage tickets and create employees
- Read-only access to categories and reports
- No access to settings

### Worker
- Can view and update assigned tickets
- Read-only access to categories
- No access to employee management, reports, or settings

## API Endpoints

### Role Management
```
GET    /api/roles                 - Get all roles
GET    /api/roles/:id             - Get single role
POST   /api/roles                 - Create custom role (Admin only)
PUT    /api/roles/:id             - Update role (Admin only)
DELETE /api/roles/:id             - Delete role (Admin only)
GET    /api/roles/modules         - Get modules structure (for UI)
```

### Employee Management (Updated)
```
POST   /api/employees             - Create employee with custom role
```

**Request Body:**
```json
{
  "custom_role_id": 5,              // Reference to ticket_roles
  "rbac_user_id": 123,              // Optional: Link to existing RBAC user
  "name": "John Doe",               // Required if no rbac_user_id
  "username": "johndoe",            // Required if no rbac_user_id
  "password": "password123",        // Required if no rbac_user_id
  "phone": "1234567890",            // Required if no rbac_user_id
  "email": "john@example.com",      // Optional
  "permissions": {...},             // Optional: User-specific overrides
  "assigned_categories": [1, 2],    // Optional
  "assigned_subcategories": [5, 6]  // Optional
}
```

## Usage Examples

### 1. Create a "Principal" Role
```javascript
POST /api/roles
{
  "role_name": "principal",
  "display_name": "Principal",
  "description": "College principal with full ticket and employee management access",
  "permissions": {
    "ticket_dashboard": { "read": true },
    "ticket_management": { "read": true, "write": true, "update": true, "delete": true },
    "employee_management": { "read": true, "write": true, "update": true, "delete": false },
    "category_management": { "read": true, "write": false, "update": false, "delete": false },
    "ticket_reports": { "read": true, "write": true, "update": false, "delete": false },
    "ticket_settings": { "read": true, "write": false, "update": false, "delete": false }
  }
}
```

### 2. Assign Principal Role to User
```javascript
POST /api/employees
{
  "rbac_user_id": 45,        // Existing user ID
  "custom_role_id": 5,       // Principal role ID
  "assigned_categories": [1, 2, 3]
}
```

### 3. Create Standalone Employee with Custom Role
```javascript
POST /api/employees
{
  "custom_role_id": 6,       // Custom role ID
  "name": "Jane Smith",
  "username": "janesmith",
  "password": "securepass",
  "phone": "9876543210",
  "email": "jane@college.edu"
}
```

### 4. Override Permissions for Specific User
```javascript
POST /api/employees
{
  "rbac_user_id": 50,
  "custom_role_id": 5,
  "permissions": {
    // Override: Give this principal delete access to employees
    "employee_management": { "read": true, "write": true, "update": true, "delete": true }
  }
}
```

## Permission Hierarchy

1. **User-specific permissions** (if set) take precedence
2. **Role permissions** (from ticket_roles) apply if no user override
3. **System role defaults** for backward compatibility

## Frontend Integration

### Checking Permissions
```javascript
import { hasTicketPermission } from '@/constants/ticketRbac';

// Check if user can create tickets
const canCreateTicket = hasTicketPermission(
  user.effective_permissions,
  'ticket_management',
  'write'
);

// Check if user has any access to employee management
const canAccessEmployees = hasTicketModuleAccess(
  user.effective_permissions,
  'employee_management'
);
```

## Migration

Run the migration to set up the system:
```bash
cd ticket-backend
node migrations/004_create_roles_permissions.js
```

This will:
1. Create `ticket_roles` table
2. Insert default system roles
3. Add custom role columns to `ticket_employees`
4. Migrate existing staff/worker roles

## Security Notes

- **System roles** (super_admin, admin, manager, worker) cannot be deleted
- **Custom roles** can only be deleted if no active employees are assigned
- **Admin-only operations**: Creating, updating, and deleting roles
- **Permission validation**: All permissions are validated on the backend

## Next Steps

1. ✅ Database migration completed
2. ✅ Backend API endpoints created
3. 🔄 Frontend UI for role management (to be created)
4. 🔄 Update SubAdminCreation component to support custom roles
5. 🔄 Add role selection in EmployeeManagement component
