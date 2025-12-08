-- ============================================================================
-- Migration: Add Year and Semester Columns to student_fees Table
-- ============================================================================
-- 
-- PURPOSE: Add year and semester columns to student_fees table to support
--          storing fees for specific academic periods
-- STATUS: Ready to execute
-- DATE: 2025-01-XX
--
-- ============================================================================

USE student_database;

-- Add year and semester columns to student_fees table
ALTER TABLE student_fees 
ADD COLUMN IF NOT EXISTS year INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS semester INT DEFAULT NULL;

-- Add index for year and semester for better query performance
CREATE INDEX IF NOT EXISTS idx_year_semester ON student_fees(year, semester);
CREATE INDEX IF NOT EXISTS idx_student_fee_year_sem ON student_fees(student_id, fee_header_id, year, semester);

-- Add unique constraint to prevent duplicate fees for same student, header, year, and semester
ALTER TABLE student_fees 
ADD UNIQUE KEY IF NOT EXISTS unique_student_fee_year_sem (student_id, fee_header_id, year, semester);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check: year and semester columns should exist
SELECT 
  CASE 
    WHEN COUNT(*) = 2 THEN 'PASS - year and semester columns added'
    ELSE 'FAIL - columns not found'
  END AS migration_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'student_fees'
  AND COLUMN_NAME IN ('year', 'semester');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Year and semester columns added to student_fees table successfully!' as status;
