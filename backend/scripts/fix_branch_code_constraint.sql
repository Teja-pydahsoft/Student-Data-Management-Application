-- Migration: Fix unique_branch_code_per_course constraint to include academic_year_id
-- This allows the same branch code to exist for different academic years
-- Run this script to update the constraint

USE student_database;

-- Step 1: Drop the old unique constraint on branch code
SET @drop_constraint_stmt := IF(
  EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'course_branches'
      AND INDEX_NAME = 'unique_branch_code_per_course'
  ),
  'ALTER TABLE course_branches DROP INDEX unique_branch_code_per_course',
  'SELECT "unique_branch_code_per_course constraint does not exist"'
);
PREPARE stmt FROM @drop_constraint_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Create new unique constraint that includes academic_year_id
-- This allows same branch code for different years, but prevents duplicates within same year
SET @add_constraint_stmt := IF(
  EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'course_branches'
      AND INDEX_NAME = 'unique_branch_code_per_course_year'
  ),
  'SELECT "unique_branch_code_per_course_year constraint already exists"',
  'ALTER TABLE course_branches ADD UNIQUE KEY unique_branch_code_per_course_year (course_id, code, academic_year_id)'
);
PREPARE stmt FROM @add_constraint_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration completed: unique_branch_code_per_course constraint updated to include academic_year_id' AS result;

