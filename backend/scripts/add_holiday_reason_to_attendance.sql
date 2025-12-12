-- Migration: Add holiday_reason column to attendance_records table
-- Run this script directly in your MySQL client

USE student_database;

-- Check if column already exists and add it if it doesn't
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'student_database'
    AND TABLE_NAME = 'attendance_records' 
    AND COLUMN_NAME = 'holiday_reason'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE attendance_records ADD COLUMN holiday_reason TEXT NULL AFTER status',
  'SELECT "Column holiday_reason already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration completed successfully!' AS message;

