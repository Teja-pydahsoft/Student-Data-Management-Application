-- ============================================================================
-- Migration: Add sms_sent Column to attendance_records Table
-- ============================================================================
-- 
-- PURPOSE: Track SMS notification status for absent students
--          This allows the UI to show correct SMS status even after page refresh
-- STATUS: Ready to execute
-- DATE: 2025-01-XX
--
-- MIGRATION STRATEGY:
--   1. Check if sms_sent column exists (using INFORMATION_SCHEMA)
--   2. Add sms_sent column if it doesn't exist
--   3. Add index for performance
--
-- NOTE: This SQL script should be run manually or use the Node.js migration
--       script: backend/scripts/run_sms_sent_migration.js
--
-- ============================================================================

USE student_database;

-- ============================================================================
-- PHASE 1: Check if Column Exists
-- ============================================================================

-- Check if sms_sent column already exists
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'Column already exists - no action needed'
    ELSE 'Column does not exist - proceed with migration'
  END AS column_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'attendance_records'
  AND COLUMN_NAME = 'sms_sent';

-- ============================================================================
-- PHASE 2: Add sms_sent Column (Only if it doesn't exist)
-- ============================================================================

-- WARNING: This will fail if column already exists
-- Use the Node.js migration script for safe execution: run_sms_sent_migration.js
-- Or manually check INFORMATION_SCHEMA first

-- Add sms_sent column
-- ALTER TABLE attendance_records 
-- ADD COLUMN sms_sent TINYINT(1) DEFAULT 0 
-- COMMENT 'Indicates if SMS notification was sent (1 = sent, 0 = not sent)';

-- ============================================================================
-- PHASE 3: Add Index for Performance
-- ============================================================================

-- Check if index already exists
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'Index already exists - no action needed'
    ELSE 'Index does not exist - proceed with creation'
  END AS index_status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'attendance_records'
  AND INDEX_NAME = 'idx_sms_sent';

-- Create index (will fail if already exists)
-- CREATE INDEX idx_sms_sent ON attendance_records(sms_sent);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify column was added
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'attendance_records'
  AND COLUMN_NAME = 'sms_sent';

-- Verify index was created
SELECT 
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'attendance_records'
  AND INDEX_NAME = 'idx_sms_sent';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
