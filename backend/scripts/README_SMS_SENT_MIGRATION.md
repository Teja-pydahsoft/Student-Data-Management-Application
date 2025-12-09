# SMS Sent Column Migration

## Overview
This migration adds the `sms_sent` column to the `attendance_records` table to track SMS notification status for absent students. This fixes the issue where SMS status would show as "pending" after page refresh.

## Files Created/Modified

### 1. Migration Script (Node.js)
**File**: `backend/scripts/run_sms_sent_migration.js`

This is the **recommended way** to run the migration. It:
- Checks if the column already exists before adding it
- Checks if the index already exists before creating it
- Provides detailed logging and error handling
- Verifies the migration was successful

**How to run:**
```bash
cd backend/scripts
node run_sms_sent_migration.js
```

### 2. SQL Script (Manual)
**File**: `backend/scripts/add_sms_sent_to_attendance.sql`

This SQL script can be run manually in MySQL/MariaDB, but it includes checks and warnings. The Node.js script is preferred as it handles errors gracefully.

**How to run:**
```bash
mysql -u root -p student_database < backend/scripts/add_sms_sent_to_attendance.sql
```

### 3. Schema Update
**File**: `backend/config/schema.sql`

Updated to include the `sms_sent` column in the table definition for documentation purposes.

## What the Migration Does

1. **Adds `sms_sent` column** to `attendance_records` table:
   - Type: `TINYINT(1)`
   - Default: `0` (not sent)
   - Comment: "Indicates if SMS notification was sent (1 = sent, 0 = not sent)"

2. **Creates index** `idx_sms_sent` on the `sms_sent` column for better query performance

3. **Verifies** the migration was successful

## Column Details

- **Column Name**: `sms_sent`
- **Data Type**: `TINYINT(1)`
- **Default Value**: `0`
- **Values**: 
  - `0` = SMS not sent
  - `1` = SMS sent successfully
- **Index**: `idx_sms_sent`

## Code Integration

The column is already integrated into the codebase:

1. **Backend** (`backend/controllers/attendanceController.js`):
   - Updates `sms_sent = 1` when SMS is successfully sent
   - Returns `smsSent` status in `getAttendance` endpoint
   - Updates status when retrying SMS

2. **Frontend** (`frontend/src/pages/Attendance.jsx`):
   - Populates `smsStatusMap` from API response on page load
   - Displays correct SMS status even after page refresh

## Verification

After running the migration, verify the column exists:

```sql
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'student_database'
  AND TABLE_NAME = 'attendance_records'
  AND COLUMN_NAME = 'sms_sent';
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
ALTER TABLE attendance_records DROP INDEX idx_sms_sent;
ALTER TABLE attendance_records DROP COLUMN sms_sent;
```

**Note**: This will remove all SMS status tracking data. Only use if absolutely necessary.

## Status

✅ Migration script created
✅ Schema updated
✅ Code integration complete
⏳ **Ready to run migration**
