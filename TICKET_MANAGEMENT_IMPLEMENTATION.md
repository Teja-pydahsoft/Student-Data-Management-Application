# Ticket Management System Implementation

## Overview
A comprehensive ticket/complaint management system has been implemented for both the Super Admin portal and Student portal. This system allows students to raise complaints, and administrators to manage, assign, and track them through their lifecycle.

## Features Implemented

### 1. Database Schema
- **complaint_categories**: Stores main categories and sub-categories for complaints
- **tickets**: Stores all ticket/complaint records
- **ticket_assignments**: Tracks which RBAC users are assigned to tickets
- **ticket_status_history**: Records all status changes
- **ticket_feedback**: Stores student feedback for completed tickets
- **ticket_comments**: Stores comments/notes on tickets (internal and external)

### 2. Super Admin Portal

#### Ticket Management Page (`/tickets`)
- View all tickets with filtering by:
  - Status (pending, approaching, resolving, completed, closed)
  - Category
  - Assigned user
  - Search by ticket number, student name, etc.
- Ticket statistics dashboard
- Assign tickets to RBAC users
- Update ticket status
- Add comments (internal notes or visible to student)
- View full ticket details including:
  - Student information
  - Category and sub-category
  - Description and photo
  - Assignment history
  - Status history
  - Comments
  - Feedback (if completed)

#### Task Management Page (`/task-management`)
- Manage complaint categories and sub-levels
- Create/edit/delete categories
- Set display order
- Activate/deactivate categories
- Hierarchical view with expand/collapse
- Sub-categories are only shown to students if they exist

### 3. Student Portal

#### Raise Ticket Page (`/student/raise-ticket`)
- Select complaint category (main category)
- Select sub-category (if available for selected category)
- Enter title and description
- Upload photo (optional, max 5MB)
- If sub-category is not defined, shows direct selection

#### My Tickets Page (`/student/my-tickets`)
- View all tickets raised by the student
- View ticket details
- Track ticket status
- View comments from administrators
- Submit feedback for completed tickets (rating 1-5 and optional text)

## Workflow

1. **Student raises complaint**:
   - Selects category (and sub-category if available)
   - Enters title, description, and optionally uploads photo
   - Ticket is created with status "pending"

2. **Super Admin receives ticket**:
   - Views ticket in Ticket Management page
   - Can assign ticket to one or more RBAC users
   - Status automatically changes to "approaching" when assigned

3. **Ticket processing**:
   - Assigned users can update status to "resolving"
   - Comments can be added (internal or visible to student)
   - Status can be updated through: pending → approaching → resolving → completed

4. **Completion**:
   - When status is set to "completed", student can submit feedback
   - Feedback includes rating (1-5 stars) and optional text
   - Ticket can be closed after feedback

## API Endpoints

### Ticket Endpoints
- `POST /api/tickets` - Create ticket (student)
- `GET /api/tickets` - Get all tickets (admin, requires permission)
- `GET /api/tickets/:id` - Get ticket details (student can view own, admin can view all)
- `GET /api/tickets/student/my-tickets` - Get student's tickets
- `GET /api/tickets/stats` - Get ticket statistics (admin)
- `POST /api/tickets/:id/assign` - Assign ticket to users (admin)
- `PUT /api/tickets/:id/status` - Update ticket status (admin)
- `POST /api/tickets/:id/comments` - Add comment (admin/student)
- `POST /api/tickets/:id/feedback` - Submit feedback (student, completed tickets only)

### Complaint Category Endpoints
- `GET /api/complaint-categories` - Get all categories (admin)
- `GET /api/complaint-categories/active` - Get active categories (student)
- `GET /api/complaint-categories/:id` - Get single category
- `POST /api/complaint-categories` - Create category (admin)
- `PUT /api/complaint-categories/:id` - Update category (admin)
- `DELETE /api/complaint-categories/:id` - Delete category (admin)

## RBAC Integration

The ticket management system is integrated with the RBAC system:
- **Module**: `ticket_management`
- **Permissions**:
  - `read`: View tickets and categories
  - `write`: Manage tickets (assign, update status, add comments) and categories

Super Admin has full access automatically.

## Database Setup

To set up the database tables, run:

```bash
cd backend
node scripts/create_ticket_tables.js
```

Or manually execute the SQL file:
```bash
mysql -u root -p student_database < backend/scripts/create_ticket_management_tables.sql
```

## Navigation Updates

### Admin Portal
- Added "Ticket Management" menu item with sub-items:
  - Tickets
  - Task Management

### Student Portal
- Added "My Tickets" menu item

## Status Flow

1. **pending**: Initial state when ticket is created
2. **approaching**: Ticket has been assigned to staff
3. **resolving**: Staff is actively working on the ticket
4. **completed**: Ticket has been resolved
5. **closed**: Ticket is closed (after feedback or manual closure)

## Key Features

1. **Category Management**: 
   - Two-level hierarchy (categories and sub-categories)
   - Sub-categories are optional
   - If sub-category exists, student must select it
   - If no sub-category, direct selection is shown

2. **Assignment System**:
   - Multiple users can be assigned to a ticket
   - Assignment history is tracked
   - Previous assignments are deactivated when new ones are made

3. **Status Tracking**:
   - Complete history of status changes
   - Notes can be added with each status change
   - Automatic timestamps for resolved/closed dates

4. **Feedback System**:
   - Only available for completed tickets
   - Rating from 1 to 5 stars
   - Optional text feedback
   - One feedback per ticket

5. **Comments**:
   - Internal comments (not visible to student)
   - External comments (visible to student)
   - Tracked with user information and timestamps

## File Structure

### Backend
- `backend/controllers/ticketController.js` - Ticket operations
- `backend/controllers/complaintCategoryController.js` - Category management
- `backend/routes/ticketRoutes.js` - Ticket routes
- `backend/routes/complaintCategoryRoutes.js` - Category routes
- `backend/scripts/create_ticket_management_tables.sql` - Database schema
- `backend/scripts/create_ticket_tables.js` - Migration script

### Frontend
- `frontend/src/pages/TicketManagement.jsx` - Admin ticket management
- `frontend/src/pages/TaskManagement.jsx` - Admin category management
- `frontend/src/pages/student/RaiseTicket.jsx` - Student ticket creation
- `frontend/src/pages/student/MyTickets.jsx` - Student ticket viewing

## Testing Checklist

- [ ] Create categories and sub-categories
- [ ] Student raises ticket with category selection
- [ ] Student raises ticket with sub-category selection
- [ ] Student uploads photo with ticket
- [ ] Admin views tickets
- [ ] Admin assigns ticket to users
- [ ] Admin updates ticket status
- [ ] Admin adds comments (internal and external)
- [ ] Student views their tickets
- [ ] Student views ticket details
- [ ] Student submits feedback for completed ticket
- [ ] Status history is tracked correctly
- [ ] Assignment history is tracked correctly

## Notes

- Photo uploads are stored as base64 in the database (can be migrated to S3 later)
- Ticket numbers are auto-generated in format: `TKT-YYYY-XXXXXX-XXX`
- Students can only view their own tickets
- Admins with ticket_management permission can view all tickets
- Super Admin has full access automatically

