-- Migration: Add multi-select scope columns to rbac_users table
-- This adds support for assigning users to multiple colleges, courses, and branches

-- Add new JSON columns for multi-select
ALTER TABLE rbac_users 
ADD COLUMN IF NOT EXISTS college_ids JSON DEFAULT NULL AFTER branch_id,
ADD COLUMN IF NOT EXISTS course_ids JSON DEFAULT NULL AFTER college_ids,
ADD COLUMN IF NOT EXISTS branch_ids JSON DEFAULT NULL AFTER course_ids,
ADD COLUMN IF NOT EXISTS all_courses TINYINT(1) DEFAULT 0 AFTER branch_ids,
ADD COLUMN IF NOT EXISTS all_branches TINYINT(1) DEFAULT 0 AFTER all_courses;

-- Migrate existing data to the new columns
UPDATE rbac_users 
SET college_ids = JSON_ARRAY(college_id) 
WHERE college_id IS NOT NULL AND (college_ids IS NULL OR college_ids = '[]');

UPDATE rbac_users 
SET course_ids = JSON_ARRAY(course_id) 
WHERE course_id IS NOT NULL AND (course_ids IS NULL OR course_ids = '[]');

UPDATE rbac_users 
SET branch_ids = JSON_ARRAY(branch_id) 
WHERE branch_id IS NOT NULL AND (branch_ids IS NULL OR branch_ids = '[]');

-- Create indexes for the JSON columns for better query performance
-- Note: MySQL 8.0+ supports multi-valued indexes on JSON arrays
-- CREATE INDEX idx_rbac_users_college_ids ON rbac_users ((CAST(college_ids AS UNSIGNED ARRAY)));
-- CREATE INDEX idx_rbac_users_course_ids ON rbac_users ((CAST(course_ids AS UNSIGNED ARRAY)));
-- CREATE INDEX idx_rbac_users_branch_ids ON rbac_users ((CAST(branch_ids AS UNSIGNED ARRAY)));

