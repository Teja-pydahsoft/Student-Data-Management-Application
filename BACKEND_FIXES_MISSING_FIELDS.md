# Backend Fixes: Missing Fields in Certificate Templates

## 📋 Overview

Fixed backend errors related to missing database columns and request body destructuring in the certificate template controller.

**Date**: December 2024  
**Status**: ✅ Fixed  
**Issue**: `ReferenceError: blank_variables is not defined`

---

## 🐛 Problem

When updating certificate templates, the backend threw an error:

```
Error updating template: ReferenceError: blank_variables is not defined
    at exports.updateTemplate (certificateTemplateController.js:429:9)
```

### Root Cause

The `updateTemplate` function was referencing variables that weren't destructured from `req.body`:
- `blank_variables`
- `font_size`
- `line_spacing`
- `header_height`
- `footer_height`

---

## ✅ Solution

### 1. Updated `createTemplate` Function

**File**: `backend/controllers/certificateTemplateController.js`

**Added to destructuring** (Line ~296):
```javascript
const {
  // ... existing fields
  blank_variables,
  font_size,
  line_spacing,
  header_height,
  footer_height,
  // ... rest
} = req.body;
```

**Added to INSERT query**:
```sql
INSERT INTO certificate_templates (
  ...,
  blank_variables, font_size, line_spacing, header_height, footer_height,
  page_size, page_orientation,
  ...
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ...)
```

**Added to values array**:
```javascript
[
  // ... existing values
  blank_variables ? JSON.stringify(blank_variables) : null,
  font_size || 12,
  line_spacing || 1.5,
  header_height || 80,
  footer_height || 60,
  // ... rest
]
```

### 2. Updated `updateTemplate` Function

**File**: `backend/controllers/certificateTemplateController.js`

**Added to destructuring** (Line ~381):
```javascript
const {
  // ... existing fields
  blank_variables,
  font_size,
  line_spacing,
  header_height,
  footer_height,
  // ... rest
} = req.body;
```

**Added to UPDATE query**:
```sql
UPDATE certificate_templates SET
  ...,
  blank_variables = ?,
  font_size = ?,
  line_spacing = ?,
  header_height = ?,
  footer_height = ?,
  page_size = ?,
  ...
WHERE id = ?
```

**Added to values array**:
```javascript
[
  // ... existing values
  blank_variables ? JSON.stringify(blank_variables) : null,
  font_size || 12,
  line_spacing || 1.5,
  header_height || 80,
  footer_height || 60,
  // ... rest
]
```

---

## 🗄️ Database Migration

**File**: `backend/migrations/add_typography_and_image_size_columns.sql`

```sql
-- Add typography columns
ALTER TABLE certificate_templates
ADD COLUMN IF NOT EXISTS font_size INT DEFAULT 12,
ADD COLUMN IF NOT EXISTS line_spacing DECIMAL(3,1) DEFAULT 1.5;

-- Add header and footer size columns
ALTER TABLE certificate_templates
ADD COLUMN IF NOT EXISTS header_height INT DEFAULT 80,
ADD COLUMN IF NOT EXISTS footer_height INT DEFAULT 60;
```

**Migration runs automatically on server startup!**

---

## 📊 New Fields Summary

| Field Name      | Type          | Default | Description                    |
|-----------------|---------------|---------|--------------------------------|
| blank_variables | JSON          | null    | Admin-fillable input fields    |
| font_size       | INT           | 12      | Font size in pixels            |
| line_spacing    | DECIMAL(3,1)  | 1.5     | Line height multiplier         |
| header_height   | INT           | 80      | Header image height (px)       |
| footer_height   | INT           | 60      | Footer image height (px)       |

---

## 🔄 How Auto-Migration Works

1. **Server Starts**: Backend initialization begins
2. **Migration Check**: `runMigrations()` function executes
3. **File Detection**: Scans `backend/migrations/` for `.sql` files
4. **Tracking Table**: Creates `schema_migrations` if not exists
5. **Execute New Migrations**: Runs only migrations not yet executed
6. **Record Execution**: Marks migration as complete
7. **Continue Startup**: Server continues normal operation

### Console Output
```
🔄 Checking for database migrations...
📋 Found 2 migration file(s)
⏭️  Skipping add_alignment_and_section_padding.sql (already executed)
🔧 Running migration: add_typography_and_image_size_columns.sql
   ✅ Successfully executed add_typography_and_image_size_columns.sql
✅ All migrations completed successfully!
```

---

## 🧪 Testing

### Verify Migration Ran
```sql
USE student_database;
DESCRIBE certificate_templates;
```

**Expected columns to exist**:
- `font_size` (INT, default 12)
- `line_spacing` (DECIMAL(3,1), default 1.5)
- `header_height` (INT, default 80)
- `footer_height` (INT, default 60)

### Test Create Template
```bash
# POST /api/certificate-templates
{
  "service_id": 1,
  "middle_content": "Test content",
  "font_size": 14,
  "line_spacing": 2,
  "header_height": 100,
  "footer_height": 80
}
```

**Expected**: Success, no errors

### Test Update Template
```bash
# PUT /api/certificate-templates/:id
{
  "middle_content": "Updated content",
  "font_size": 16,
  "line_spacing": 1.8
}
```

**Expected**: Success, no errors

---

## 🎯 Fields Usage

### Frontend → Backend Flow

**Step 2 (AddServiceWizard.jsx)**:
```javascript
// User adjusts settings
templateData = {
  middle_content: "Certificate text...",
  font_size: 14,
  line_spacing: 1.8,
  header_height: 90,
  footer_height: 70,
  blank_variables: []
}

// Saved to backend
await certificateTemplateService.createTemplate(templateData);
```

**Backend (certificateTemplateController.js)**:
```javascript
// Destructure from request
const { font_size, line_spacing, header_height, footer_height } = req.body;

// Insert to database
await masterPool.execute(`INSERT INTO certificate_templates ...`, [
  font_size || 12,
  line_spacing || 1.5,
  header_height || 80,
  footer_height || 60
]);
```

**Database**:
```
| id | service_id | font_size | line_spacing | header_height | footer_height |
|----|------------|-----------|--------------|---------------|---------------|
| 1  | 5          | 14        | 1.8          | 90            | 70            |
```

---

## 🔒 Validation & Defaults

### Font Size
- **Range**: 8-24px recommended
- **Default**: 12px
- **Backend**: `font_size || 12`

### Line Spacing
- **Range**: 1.0-3.0 recommended
- **Default**: 1.5
- **Backend**: `line_spacing || 1.5`

### Header Height
- **Range**: 40-150px typical
- **Default**: 80px
- **Backend**: `header_height || 80`

### Footer Height
- **Range**: 30-100px typical
- **Default**: 60px
- **Backend**: `footer_height || 60`

### Blank Variables
- **Type**: JSON array
- **Default**: `[]`
- **Backend**: `blank_variables ? JSON.stringify(blank_variables) : null`

---

## ⚠️ Breaking Changes

**None** - All changes are backward compatible:
- New columns have default values
- Existing templates continue to work
- Missing fields use sensible defaults

---

## 📝 Checklist

- [x] Added fields to `createTemplate` destructuring
- [x] Added fields to `createTemplate` INSERT query
- [x] Added fields to `createTemplate` values array
- [x] Added fields to `updateTemplate` destructuring
- [x] Added fields to `updateTemplate` UPDATE query
- [x] Added fields to `updateTemplate` values array
- [x] Created database migration script
- [x] Migration runs automatically on startup
- [x] Default values provided for all fields
- [x] No errors in diagnostics
- [x] Backward compatible

---

## 🚀 Deployment

### For Existing Installations

1. **Pull latest code**
2. **Restart backend server**
3. **Migration runs automatically**
4. **Verify in console logs**
5. **Test creating/updating templates**

### No Manual Steps Required!

The migration system handles everything automatically.

---

## 📚 Related Files

1. `backend/controllers/certificateTemplateController.js` - Controller updates
2. `backend/migrations/add_typography_and_image_size_columns.sql` - New migration
3. `backend/migrations/add_alignment_and_section_padding.sql` - Previous migration
4. `backend/scripts/runMigrations.js` - Auto-migration runner
5. `backend/server.js` - Migration integration

---

## 🎉 Summary

**Problem**: Missing field references caused backend errors  
**Solution**: Added all required fields to create/update functions  
**Migration**: Auto-runs on server startup  
**Impact**: Zero downtime, backward compatible  
**Status**: ✅ Fixed and deployed

**No manual intervention required!** 🎯