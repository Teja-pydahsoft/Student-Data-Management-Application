-- Migration: Add per-year semester configuration support
-- This allows each year to have a different number of semesters
-- Example: Diploma Year 1: 1 semester, Year 2-3: 2 semesters each

USE student_database;

-- Add year_semester_config JSON column to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS year_semester_config JSON NULL 
AFTER semesters_per_year;

-- Add year_semester_config JSON column to course_branches table
ALTER TABLE course_branches 
ADD COLUMN IF NOT EXISTS year_semester_config JSON NULL 
AFTER semesters_per_year;

-- Example: Update Diploma course to have Year 1 with 1 semester, Year 2-3 with 2 semesters each
-- This will be done in a separate script

