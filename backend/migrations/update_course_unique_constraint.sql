-- Migration: Update course unique constraint to allow same course name in different colleges
-- This allows courses like "B.Sc" to exist in multiple colleges
-- Run this script to update the unique constraint from (name) to (college_id, name)

USE student_database;

-- Step 1: Add college_id column if it doesn't exist
-- Note: This may fail if column already exists - that's okay, we'll continue
ALTER TABLE courses ADD COLUMN college_id INT NULL AFTER id;

-- Step 1b: Add index on college_id if it doesn't exist  
-- Note: This may fail if index already exists - that's okay, we'll continue
ALTER TABLE courses ADD INDEX idx_college_id (college_id);

-- Step 2: Drop the old unique constraint on name only
-- Note: This may fail if constraint doesn't exist - that's okay, we'll continue
ALTER TABLE courses DROP INDEX unique_course_name;

-- Step 3: Add new composite unique constraint on (college_id, name)
-- This allows the same course name in different colleges
-- Note: This may fail if constraint already exists - that's okay, we'll continue
ALTER TABLE courses ADD UNIQUE KEY unique_course_name_college (college_id, name);

SELECT 'Migration completed: Course unique constraint updated to (college_id, name)' AS result;
