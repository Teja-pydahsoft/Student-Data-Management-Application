-- ============================================================================
-- Rollback: Remove Colleges Support
-- ============================================================================
-- 
-- PURPOSE: Reverse the colleges migration if needed
-- STATUS: EMERGENCY ROLLBACK ONLY
-- WARNING: Only run if migration needs to be completely reversed
--
-- This will:
--   1. Remove foreign key constraint
--   2. Remove index
--   3. Remove college_id column
--   4. (Optional) Drop colleges table
--
-- NOTE: This does NOT restore courses to their original state.
--       Course data remains, just without college_id references.
-- ============================================================================

USE student_database;

-- ============================================================================
-- STEP 1: Remove Foreign Key Constraint
-- ============================================================================

ALTER TABLE courses 
  DROP FOREIGN KEY IF EXISTS fk_course_college;

-- ============================================================================
-- STEP 2: Remove Index
-- ============================================================================

DROP INDEX IF EXISTS idx_courses_college_id ON courses;

-- ============================================================================
-- STEP 3: Remove college_id Column
-- ============================================================================

ALTER TABLE courses 
  DROP COLUMN IF EXISTS college_id;

-- ============================================================================
-- STEP 4: (Optional) Drop Colleges Table
-- ============================================================================
-- 
-- Uncomment only if you want to completely remove colleges:
--
-- DROP TABLE IF EXISTS colleges;
--
-- WARNING: This will delete all college data!
--

-- ============================================================================
-- VERIFICATION: Confirm Rollback
-- ============================================================================

-- Check: college_id column should not exist
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - college_id column removed'
    ELSE 'FAIL - college_id column still exists'
  END AS rollback_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'courses'
  AND COLUMN_NAME = 'college_id';

-- Check: Courses table should still have all courses
SELECT 
  'Courses Count' AS check_name,
  COUNT(*) AS total_courses
FROM courses;

-- Check: Branches should still be intact
SELECT 
  'Branches Count' AS check_name,
  COUNT(*) AS total_branches
FROM course_branches;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- 
-- After rollback:
--   1. Revert backend code changes
--   2. Revert frontend to Phase 1 (mocked colleges)
--   3. Test application
--
-- ============================================================================

