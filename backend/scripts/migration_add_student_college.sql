-- ============================================================================
-- Migration: Add College Field to Students Table
-- ============================================================================
-- 
-- PURPOSE: Add college field to students table for College → Course → Branch hierarchy
-- STATUS: Ready to execute
-- DATE: 2025-01-XX
--
-- MIGRATION STRATEGY:
--   1. Add college column to students table
--   2. Add index for performance
--   3. No data population (handled by separate script)
--
-- ============================================================================

USE student_database;

-- ============================================================================
-- PHASE 1: Add College Column to Students Table
-- ============================================================================

-- Add college column (nullable initially, will be populated by migration script)
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS college VARCHAR(255) NULL AFTER batch;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_students_college ON students(college);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check: college column should exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - college column added'
    ELSE 'FAIL - college column not found'
  END AS migration_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'students'
  AND COLUMN_NAME = 'college';

-- Check: Index should exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - college index added'
    ELSE 'FAIL - college index not found'
  END AS index_status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'students'
  AND INDEX_NAME = 'idx_students_college';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Next Steps:
--   1. Run migrateStudentCollege.js to populate college data
--   2. Update backend controllers
--   3. Update frontend forms
--
-- ============================================================================

