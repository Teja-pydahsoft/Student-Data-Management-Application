-- ============================================================================
-- Migration: Add Year and Semester Columns to student_fees Table
-- ============================================================================
-- 
-- PURPOSE: Add year and semester columns to student_fees table to properly
--          track fees for specific academic periods
-- DATE: 2025-01-XX
--
-- ============================================================================

USE student_database;

-- Add year and semester columns to student_fees table
-- Check if columns exist first, then add if they don't
SET @dbname = DATABASE();
SET @tablename = "student_fees";
SET @columnname = "year";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column year already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " INT DEFAULT NULL")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "semester";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column semester already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " INT DEFAULT NULL")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index for year and semester for better query performance
CREATE INDEX IF NOT EXISTS idx_year_semester ON student_fees(year, semester);

-- Add composite index for student_id, fee_header_id, year, and semester
-- This ensures unique fee records per student, header, year, and semester
CREATE INDEX IF NOT EXISTS idx_student_fee_year_sem ON student_fees(student_id, fee_header_id, year, semester);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check: year column should exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - year column added'
    ELSE 'FAIL - year column not found'
  END AS migration_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'student_fees'
  AND COLUMN_NAME = 'year';

-- Check: semester column should exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - semester column added'
    ELSE 'FAIL - semester column not found'
  END AS migration_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'student_fees'
  AND COLUMN_NAME = 'semester';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Year and semester columns added to student_fees table successfully!' as status;
