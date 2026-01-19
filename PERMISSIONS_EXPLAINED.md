# Permission Types Explained: READ, WRITE, UPDATE, DELETE

## Overview
In the RBAC system, each module has **4 types of permissions** that control what actions a user can perform. These follow the standard CRUD (Create, Read, Update, Delete) pattern.

---

## 1. **READ** Permission 📖
**What it means:** View/Access/See data

### Examples by Module:

#### **Ticket Management**
- ✅ **Can do:**
  - View list of all tickets
  - See ticket details
  - Read ticket comments
  - View ticket history
  - See assigned tickets
  
- ❌ **Cannot do:**
  - Create new tickets
  - Change ticket status
  - Assign tickets to employees
  - Delete tickets

#### **Employee Management**
- ✅ **Can do:**
  - View employee list
  - See employee details
  - View employee performance stats
  - Check employee assignments
  
- ❌ **Cannot do:**
  - Add new employees
  - Edit employee information
  - Remove employees

#### **Category Management**
- ✅ **Can do:**
  - View category list
  - See category hierarchy
  - View subcategories
  
- ❌ **Cannot do:**
  - Create new categories
  - Modify categories
  - Delete categories

---

## 2. **WRITE** Permission ✍️
**What it means:** Create/Add new data

### Examples by Module:

#### **Ticket Management**
- ✅ **Can do:**
  - Create new tickets
  - Raise complaints
  - Add initial ticket information
  - Upload ticket attachments
  
- ❌ **Cannot do:**
  - Edit existing tickets
  - Change ticket status
  - Delete tickets
  - (But usually can READ if they have WRITE)

#### **Employee Management**
- ✅ **Can do:**
  - Add new employees
  - Create employee accounts
  - Assign initial roles
  - Set up new workers/managers
  
- ❌ **Cannot do:**
  - Edit existing employee details
  - Remove employees
  - Change employee permissions

#### **Category Management**
- ✅ **Can do:**
  - Create new categories
  - Add subcategories
  - Set up category hierarchy
  
- ❌ **Cannot do:**
  - Modify existing categories
  - Delete categories

#### **Reports & Analytics**
- ✅ **Can do:**
  - Generate new reports
  - Create custom report templates
  - Export data
  
- ❌ **Cannot do:**
  - Modify existing reports
  - Delete reports

---

## 3. **UPDATE** Permission 🔄
**What it means:** Modify/Edit existing data

### Examples by Module:

#### **Ticket Management**
- ✅ **Can do:**
  - Change ticket status (Open → In Progress → Completed)
  - Assign/reassign tickets to employees
  - Update ticket priority
  - Add comments to tickets
  - Modify ticket details
  - Update ticket categories
  
- ❌ **Cannot do:**
  - Create new tickets (needs WRITE)
  - Delete tickets (needs DELETE)

#### **Employee Management**
- ✅ **Can do:**
  - Edit employee information
  - Change employee roles
  - Update employee permissions
  - Modify assigned categories
  - Update contact details
  
- ❌ **Cannot do:**
  - Add new employees (needs WRITE)
  - Remove employees (needs DELETE)

#### **Category Management**
- ✅ **Can do:**
  - Rename categories
  - Change category descriptions
  - Reorder categories
  - Modify category settings
  
- ❌ **Cannot do:**
  - Create new categories (needs WRITE)
  - Delete categories (needs DELETE)

#### **Reports & Analytics**
- ✅ **Can do:**
  - Customize existing reports
  - Modify report parameters
  - Update report filters
  
- ❌ **Cannot do:**
  - Generate new reports (needs WRITE)
  - Delete reports (needs DELETE)

---

## 4. **DELETE** Permission 🗑️
**What it means:** Remove/Delete data

### Examples by Module:

#### **Ticket Management**
- ✅ **Can do:**
  - Delete tickets
  - Remove ticket attachments
  - Clear ticket history
  
- ⚠️ **Warning:** Usually restricted to prevent data loss
- ❌ **Cannot do:**
  - Create tickets (needs WRITE)
  - Edit tickets (needs UPDATE)

#### **Employee Management**
- ✅ **Can do:**
  - Remove employees from system
  - Deactivate employee accounts
  - Delete employee records
  
- ⚠️ **Warning:** Usually soft-delete to preserve history
- ❌ **Cannot do:**
  - Add employees (needs WRITE)
  - Edit employees (needs UPDATE)

#### **Category Management**
- ✅ **Can do:**
  - Delete categories
  - Remove subcategories
  - Clear unused categories
  
- ⚠️ **Warning:** May fail if category is in use
- ❌ **Cannot do:**
  - Create categories (needs WRITE)
  - Modify categories (needs UPDATE)

---

## Permission Combinations

### Common Role Configurations:

#### **1. View-Only Role (READ only)**
```javascript
{
  ticket_management: { read: true, write: false, update: false, delete: false }
}
```
**Use case:** Auditors, Viewers, Reporters
- Can see everything
- Cannot make any changes

---

#### **2. Worker Role (READ + UPDATE)**
```javascript
{
  ticket_management: { read: true, write: false, update: true, delete: false }
}
```
**Use case:** Ticket Workers, Support Staff
- Can view tickets
- Can update ticket status
- Cannot create or delete tickets

---

#### **3. Manager Role (READ + WRITE + UPDATE)**
```javascript
{
  ticket_management: { read: true, write: true, update: true, delete: false }
}
```
**Use case:** Managers, Team Leads
- Can view all tickets
- Can create new tickets
- Can update ticket status
- Cannot delete tickets (for safety)

---

#### **4. Admin Role (READ + WRITE + UPDATE + DELETE)**
```javascript
{
  ticket_management: { read: true, write: true, update: true, delete: true }
}
```
**Use case:** Administrators, Super Admins
- Full control over tickets
- Can perform all operations

---

## Real-World Example: Principal Role

Let's say you create a "Principal" role:

```javascript
{
  ticket_dashboard: { 
    read: true  // Can view dashboard
  },
  ticket_management: { 
    read: true,    // Can view all tickets
    write: true,   // Can create tickets
    update: true,  // Can change ticket status, assign workers
    delete: false  // Cannot delete tickets (safety)
  },
  employee_management: { 
    read: true,    // Can view all employees
    write: true,   // Can add new employees
    update: true,  // Can edit employee details
    delete: false  // Cannot remove employees (HR handles this)
  },
  category_management: { 
    read: true,    // Can view categories
    write: false,  // Cannot create categories (admin only)
    update: false, // Cannot modify categories
    delete: false  // Cannot delete categories
  },
  ticket_reports: { 
    read: true,    // Can view reports
    write: true,   // Can generate reports
    update: false, // Cannot customize reports
    delete: false  // Cannot delete reports
  },
  ticket_settings: { 
    read: true,    // Can view settings
    write: false,  // Cannot create settings
    update: false, // Cannot modify settings
    delete: false  // Cannot delete settings
  }
}
```

### What the Principal can do:
✅ View dashboard and all tickets
✅ Create new tickets for urgent issues
✅ Change ticket status and assign workers
✅ View and add employees
✅ Edit employee information
✅ View categories (but not modify them)
✅ View and generate reports
✅ View system settings

### What the Principal cannot do:
❌ Delete tickets or employees
❌ Create or modify categories
❌ Customize or delete reports
❌ Modify system settings

---

## Best Practices

### 1. **Principle of Least Privilege**
- Give users only the permissions they need
- Start with READ, add others as needed

### 2. **Safety First**
- DELETE permission should be restricted
- Consider soft-delete instead of hard-delete

### 3. **Logical Combinations**
- WRITE usually implies READ
- UPDATE usually implies READ
- DELETE usually implies READ

### 4. **Role Hierarchy**
```
Viewer:       READ
Worker:       READ + UPDATE
Manager:      READ + WRITE + UPDATE
Admin:        READ + WRITE + UPDATE + DELETE
```

---

## Summary Table

| Permission | Action | Example |
|------------|--------|---------|
| **READ** | View/Access | See ticket list, view employee details |
| **WRITE** | Create/Add | Create new ticket, add employee |
| **UPDATE** | Modify/Edit | Change ticket status, edit employee info |
| **DELETE** | Remove | Delete ticket, remove employee |

---

## Testing Your Permissions

When you create a role, test it by asking:

1. **READ**: Can this user **see** the data?
2. **WRITE**: Can this user **create new** entries?
3. **UPDATE**: Can this user **change existing** data?
4. **DELETE**: Can this user **remove** data?

If the answer is "No" to any question, don't give that permission! 🔒
