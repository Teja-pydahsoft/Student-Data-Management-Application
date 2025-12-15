-- ============================================================================
-- Performance Optimization Script for Attendance Page
-- ============================================================================
-- 
-- PURPOSE: Add critical database indexes to optimize attendance queries
-- TARGET: Reduce query time from 30-60 seconds to 2-3 seconds for up to 10,000 students
-- 
-- Run this script on your MySQL database to add performance indexes
-- ============================================================================

USE student_database;

-- ============================================================================
-- 1. Composite index for students table - most common filter combination
-- This index covers: student_status, course, batch, current_year, current_semester
-- Used for filtering students in attendance queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_status_course_batch_year_sem 
ON students(student_status, course, batch, current_year, current_semester);

-- ============================================================================
-- 2. Index on student_name for ORDER BY optimization
-- Used when sorting students by name in attendance list
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_name 
ON students(student_name);

-- ============================================================================
-- 3. Composite index for attendance_records JOIN optimization
-- This index optimizes the LEFT JOIN between students and attendance_records
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
ON attendance_records(student_id, attendance_date);

-- ============================================================================
-- 4. Composite index for attendance_records with status
-- Used for statistics queries that filter by date and status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_attendance_date_status 
ON attendance_records(attendance_date, status);

-- ============================================================================
-- 5. Indexes on parent_mobile columns for search optimization
-- Used when searching by parent mobile number
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_parent_mobile1 
ON students(parent_mobile1);

CREATE INDEX IF NOT EXISTS idx_students_parent_mobile2 
ON students(parent_mobile2);

-- ============================================================================
-- 6. Indexes on registration_status and fee_status (if columns exist)
-- These are optional and will fail gracefully if columns don't exist
-- ============================================================================

-- Check if registration_status column exists before creating index
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'students' 
    AND COLUMN_NAME = 'registration_status'
);

SET @sql = IF(@col_exists > 0,
  'CREATE INDEX IF NOT EXISTS idx_students_registration_status ON students(registration_status)',
  'SELECT "registration_status column does not exist, skipping index" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if fee_status column exists before creating index
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'students' 
    AND COLUMN_NAME = 'fee_status'
);

SET @sql = IF(@col_exists > 0,
  'CREATE INDEX IF NOT EXISTS idx_students_fee_status ON students(fee_status)',
  'SELECT "fee_status column does not exist, skipping index" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 7. Update table statistics for query optimizer
-- This helps MySQL choose the best indexes
-- ============================================================================
ANALYZE TABLE students;
ANALYZE TABLE attendance_records;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all created indexes
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('students', 'attendance_records')
  AND INDEX_NAME LIKE 'idx_%'
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;

SELECT 'Performance optimization indexes created successfully!' AS status;

